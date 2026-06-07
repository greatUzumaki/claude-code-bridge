// Package push implements Web Push notifications for WebTerm.
// It persists VAPID keys and subscriber endpoints under <root>/.webterm/,
// provides HTTP endpoints for subscription management, and exposes a Notify
// method used by the tmux alert hooks.
package push

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// config holds the persisted VAPID keys and notify secret.
type config struct {
	PublicKey    string `json:"publicKey"`
	PrivateKey   string `json:"privateKey"`
	NotifySecret string `json:"notifySecret"`
}

// Manager manages Web Push subscriptions and VAPID keys.
type Manager struct {
	mu         sync.Mutex
	dir        string
	cfg        config
	subs       []webpush.Subscription
	lastNotify map[string]time.Time
}

// New loads or creates push state under dir (should be <root>/.webterm).
func New(dir string) (*Manager, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}

	m := &Manager{
		dir:        dir,
		lastNotify: make(map[string]time.Time),
	}

	if err := m.loadConfig(); err != nil {
		return nil, err
	}
	// Load subscriptions (ok if missing — start empty).
	_ = m.loadSubs()

	return m, nil
}

// loadConfig loads push.json; creates it with fresh VAPID keys if absent.
func (m *Manager) loadConfig() error {
	cfgPath := filepath.Join(m.dir, "push.json")
	data, err := os.ReadFile(cfgPath)
	if err == nil {
		if err2 := json.Unmarshal(data, &m.cfg); err2 != nil {
			return err2
		}
		return nil
	}
	if !os.IsNotExist(err) {
		return err
	}

	// Generate fresh VAPID keys.
	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		return err
	}

	// Generate 32-byte hex notify secret.
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return err
	}

	m.cfg = config{
		PublicKey:    pub,
		PrivateKey:   priv,
		NotifySecret: hex.EncodeToString(secret),
	}

	raw, err := json.MarshalIndent(m.cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(cfgPath, raw, 0600); err != nil {
		return err
	}
	return nil
}

// loadSubs loads push-subs.json; silently ignores absent file.
func (m *Manager) loadSubs() error {
	subsPath := filepath.Join(m.dir, "push-subs.json")
	data, err := os.ReadFile(subsPath)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &m.subs)
}

// persistSubs writes the current subscription list to push-subs.json.
// Must be called with m.mu held.
func (m *Manager) persistSubs() {
	subsPath := filepath.Join(m.dir, "push-subs.json")
	raw, err := json.MarshalIndent(m.subs, "", "  ")
	if err != nil {
		log.Printf("push: marshal subs: %v", err)
		return
	}
	if err := os.WriteFile(subsPath, raw, 0600); err != nil {
		log.Printf("push: write subs: %v", err)
	}
}

// PublicKey returns the VAPID public key (base64url, uncompressed).
func (m *Manager) PublicKey() string { return m.cfg.PublicKey }

// NotifySecret returns the shared secret used to authenticate /api/notify.
func (m *Manager) NotifySecret() string { return m.cfg.NotifySecret }

// Subscribe adds or updates a subscription (deduped by Endpoint).
func (m *Manager) Subscribe(sub webpush.Subscription) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, s := range m.subs {
		if s.Endpoint == sub.Endpoint {
			m.subs[i] = sub // update keys if they changed
			m.persistSubs()
			return
		}
	}
	m.subs = append(m.subs, sub)
	m.persistSubs()
}

// Unsubscribe removes the subscription with the given endpoint.
func (m *Manager) Unsubscribe(endpoint string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	changed := false
	for _, s := range m.subs {
		if s.Endpoint == endpoint {
			changed = true
			continue
		}
		m.subs[n] = s
		n++
	}
	m.subs = m.subs[:n]
	if changed {
		m.persistSubs()
	}
}

// Notify sends a Web Push notification to all subscribers for the given
// sessionKey. Calls within 10 s of a previous call for the same sessionKey
// are silently dropped (debounce).
func (m *Manager) Notify(title, body, sessionKey string) {
	m.mu.Lock()
	if last, ok := m.lastNotify[sessionKey]; ok && time.Since(last) < 10*time.Second {
		m.mu.Unlock()
		return
	}
	m.lastNotify[sessionKey] = time.Now()
	// Prune stale entries to keep the map from growing unbounded.
	for k, t := range m.lastNotify {
		if time.Since(t) > 60*time.Second {
			delete(m.lastNotify, k)
		}
	}

	// Copy subscription slice so we can release the lock during HTTP calls.
	subs := make([]webpush.Subscription, len(m.subs))
	copy(subs, m.subs)
	m.mu.Unlock()

	if len(subs) == 0 {
		return
	}

	payload, err := json.Marshal(map[string]string{
		"title": title,
		"body":  body,
		"tag":   sessionKey,
	})
	if err != nil {
		log.Printf("push: marshal payload: %v", err)
		return
	}

	var staleEndpoints []string
	for _, sub := range subs {
		sub := sub
		resp, err := webpush.SendNotification(payload, &sub, &webpush.Options{
			Subscriber:      "mailto:webterm@localhost",
			VAPIDPublicKey:  m.cfg.PublicKey,
			VAPIDPrivateKey: m.cfg.PrivateKey,
			TTL:             60,
			HTTPClient:      &http.Client{Timeout: 5 * time.Second},
		})
		if err != nil {
			log.Printf("push: send to %s: %v", sub.Endpoint, err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
			log.Printf("push: dropping stale subscription %s (HTTP %d)", sub.Endpoint, resp.StatusCode)
			staleEndpoints = append(staleEndpoints, sub.Endpoint)
		}
	}

	if len(staleEndpoints) > 0 {
		m.mu.Lock()
		n := 0
		for _, s := range m.subs {
			stale := false
			for _, ep := range staleEndpoints {
				if s.Endpoint == ep {
					stale = true
					break
				}
			}
			if !stale {
				m.subs[n] = s
				n++
			}
		}
		m.subs = m.subs[:n]
		m.persistSubs()
		m.mu.Unlock()
	}
}

// labelFromSession derives a human-friendly label from a tmux session name.
// "wt_my_project_1" → "my project 1".
func labelFromSession(session string) string {
	s := strings.TrimPrefix(session, "wt_")
	return strings.ReplaceAll(s, "_", " ")
}

// Register mounts the push HTTP endpoints on mux.
func (m *Manager) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/push/vapid", m.handleVAPID)
	mux.HandleFunc("POST /api/push/subscribe", m.handleSubscribe)
	mux.HandleFunc("POST /api/push/unsubscribe", m.handleUnsubscribe)
	mux.HandleFunc("POST /api/notify", m.handleNotify)
}

func (m *Manager) handleVAPID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"publicKey": m.PublicKey()})
}

// validateEndpoint returns an error string if the push endpoint URL is
// not a safe public HTTPS destination (blocks SSRF to internal hosts).
func validateEndpoint(endpoint string) string {
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" {
		return "endpoint must be an https URL"
	}
	host := u.Hostname()
	if host == "localhost" {
		return "endpoint host not allowed"
	}
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
			return "endpoint host not allowed"
		}
	}
	return ""
}

func (m *Manager) handleSubscribe(w http.ResponseWriter, r *http.Request) {
	var sub webpush.Subscription
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if msg := validateEndpoint(sub.Endpoint); msg != "" {
		http.Error(w, msg, http.StatusBadRequest)
		return
	}
	m.Subscribe(sub)
	w.WriteHeader(http.StatusNoContent)
}

func (m *Manager) handleUnsubscribe(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	m.Unsubscribe(body.Endpoint)
	w.WriteHeader(http.StatusNoContent)
}

func (m *Manager) handleNotify(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	secret := m.NotifySecret()
	// Constant-time comparison to prevent timing attacks.
	if subtle.ConstantTimeCompare([]byte(key), []byte(secret)) != 1 {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	session := r.URL.Query().Get("session")
	label := labelFromSession(session)
	go m.Notify("WebTerm", label+" — ready / waiting", session)
	w.WriteHeader(http.StatusNoContent)
}
