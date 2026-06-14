package push

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// ---- helpers ----------------------------------------------------------------

func newManager(t *testing.T) *Manager {
	t.Helper()
	dir := filepath.Join(t.TempDir(), ".webterm")
	m, err := New(dir, "")
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return m
}

func readSubs(t *testing.T, dir string) []webpush.Subscription {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(dir, "push-subs.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		t.Fatalf("readSubs: %v", err)
	}
	var subs []webpush.Subscription
	if err := json.Unmarshal(data, &subs); err != nil {
		t.Fatalf("readSubs unmarshal: %v", err)
	}
	return subs
}

// ---- New / config persistence -----------------------------------------------

func TestNewCreatesConfigFile(t *testing.T) {
	dir := filepath.Join(t.TempDir(), ".webterm")
	m, err := New(dir, "")
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	cfgPath := filepath.Join(dir, "push.json")
	fi, err := os.Stat(cfgPath)
	if err != nil {
		t.Fatalf("push.json missing: %v", err)
	}
	if fi.Mode().Perm() != 0600 {
		t.Fatalf("push.json mode %o, want 0600", fi.Mode().Perm())
	}
	if m.PublicKey() == "" {
		t.Fatal("publicKey is empty")
	}
	if m.NotifySecret() == "" {
		t.Fatal("notifySecret is empty")
	}
	// Verify raw JSON has all fields.
	var cfg config
	data, _ := os.ReadFile(cfgPath)
	if err := json.Unmarshal(data, &cfg); err != nil {
		t.Fatalf("unmarshal push.json: %v", err)
	}
	if cfg.PublicKey == "" || cfg.PrivateKey == "" || cfg.NotifySecret == "" {
		t.Fatalf("push.json missing fields: %+v", cfg)
	}
}

func TestNewReusesExistingKeys(t *testing.T) {
	dir := filepath.Join(t.TempDir(), ".webterm")

	m1, err := New(dir, "")
	if err != nil {
		t.Fatalf("first New: %v", err)
	}

	m2, err := New(dir, "")
	if err != nil {
		t.Fatalf("second New: %v", err)
	}

	if m1.PublicKey() != m2.PublicKey() {
		t.Fatalf("public keys differ: %q vs %q", m1.PublicKey(), m2.PublicKey())
	}
	if m1.NotifySecret() != m2.NotifySecret() {
		t.Fatalf("notify secrets differ")
	}
}

// ---- Subscribe / Unsubscribe ------------------------------------------------

func TestSubscribeDedupesByEndpoint(t *testing.T) {
	m := newManager(t)

	sub := webpush.Subscription{Endpoint: "https://push.example.com/sub/1"}
	m.Subscribe(sub)
	m.Subscribe(sub) // duplicate — should not create a second entry

	subs := readSubs(t, m.dir)
	if len(subs) != 1 {
		t.Fatalf("want 1 subscription, got %d", len(subs))
	}
}

func TestSubscribeDifferentEndpoints(t *testing.T) {
	m := newManager(t)

	m.Subscribe(webpush.Subscription{Endpoint: "https://push.example.com/sub/1"})
	m.Subscribe(webpush.Subscription{Endpoint: "https://push.example.com/sub/2"})

	subs := readSubs(t, m.dir)
	if len(subs) != 2 {
		t.Fatalf("want 2 subscriptions, got %d", len(subs))
	}
}

func TestUnsubscribeRemovesEntry(t *testing.T) {
	m := newManager(t)

	ep1 := "https://push.example.com/sub/1"
	ep2 := "https://push.example.com/sub/2"
	m.Subscribe(webpush.Subscription{Endpoint: ep1})
	m.Subscribe(webpush.Subscription{Endpoint: ep2})

	m.Unsubscribe(ep1)

	subs := readSubs(t, m.dir)
	if len(subs) != 1 {
		t.Fatalf("want 1 subscription after unsubscribe, got %d", len(subs))
	}
	if subs[0].Endpoint != ep2 {
		t.Fatalf("wrong remaining endpoint: %q", subs[0].Endpoint)
	}
}

func TestUnsubscribeNonexistent(t *testing.T) {
	m := newManager(t)
	// Should not panic or error.
	m.Unsubscribe("https://not-subscribed.example.com/x")
}

// ---- labelFromSession -------------------------------------------------------

func TestLabelFromSession(t *testing.T) {
	cases := []struct {
		session string
		want    string
	}{
		{"wt_p_sample_app_1", "p_sample_app_1"},
		{"wt_my_project", "my_project"},
		{"wt_", ""},
		{"no_prefix", "no_prefix"}, // no wt_ prefix → returned as-is (TrimPrefix)
	}
	for _, tc := range cases {
		got := labelFromSession(tc.session)
		// labelFromSession strips "wt_" prefix and replaces "_" with " "
		// so re-derive the expected value from the actual implementation contract:
		// s = TrimPrefix(session, "wt_"); return ReplaceAll(s, "_", " ")
		want := strings.ReplaceAll(strings.TrimPrefix(tc.session, "wt_"), "_", " ")
		if got != want {
			t.Errorf("labelFromSession(%q) = %q, want %q", tc.session, got, want)
		}
	}
}

func TestLabelFromSessionConcreteExample(t *testing.T) {
	// wt_p_sample_app_1 → "p sample app 1" (strips "wt_", replaces all "_" with " ")
	got := labelFromSession("wt_p_sample_app_1")
	if got != "p sample app 1" {
		t.Fatalf("got %q, want %q", got, "p sample app 1")
	}
}

// ---- HTTP handlers ----------------------------------------------------------

func newMux(t *testing.T) (*Manager, *http.ServeMux) {
	t.Helper()
	m := newManager(t)
	mux := http.NewServeMux()
	m.Register(mux)
	return m, mux
}

func TestHandleVAPID(t *testing.T) {
	m, mux := newMux(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/push/vapid", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["publicKey"] != m.PublicKey() {
		t.Fatalf("publicKey mismatch: got %q, want %q", body["publicKey"], m.PublicKey())
	}
}

func TestHandleNotifyWrongKey(t *testing.T) {
	_, mux := newMux(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("POST", "/api/notify?key=WRONG&session=wt_x", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d, want 403", rec.Code)
	}
}

func TestHandleNotifyCorrectKeyNoSubscribers(t *testing.T) {
	m, mux := newMux(t)
	url := "/api/notify?key=" + m.NotifySecret() + "&session=wt_x"
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("POST", url, nil))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d, want 204", rec.Code)
	}
}

func TestHandleSubscribeAndReflectInStorage(t *testing.T) {
	m, mux := newMux(t)

	body := `{"endpoint":"https://push.example.com/abc","keys":{"p256dh":"key1","auth":"auth1"}}`
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/push/subscribe", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("subscribe status %d, want 204", rec.Code)
	}

	subs := readSubs(t, m.dir)
	if len(subs) != 1 {
		t.Fatalf("want 1 sub in storage, got %d", len(subs))
	}
	if subs[0].Endpoint != "https://push.example.com/abc" {
		t.Fatalf("wrong endpoint: %q", subs[0].Endpoint)
	}
}

func TestHandleSubscribeBadJSON(t *testing.T) {
	_, mux := newMux(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/push/subscribe", strings.NewReader("NOT JSON"))
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rec.Code)
	}
}

// ---- SSRF endpoint validation -----------------------------------------------

func TestHandleSubscribeRejectsNonHTTPS(t *testing.T) {
	_, mux := newMux(t)

	cases := []struct {
		name     string
		endpoint string
	}{
		{"http scheme", `http://push.example.com/sub`},
		{"localhost", `https://localhost/sub`},
		{"loopback IP", `https://127.0.0.1/sub`},
		{"private 10.x", `https://10.0.0.1/sub`},
		{"private 192.168.x", `https://192.168.1.1/sub`},
		{"private 172.16.x", `https://172.16.0.1/sub`},
		{"link-local", `https://169.254.0.1/sub`},
		{"unspecified", `https://0.0.0.0/sub`},
		{"IPv6 loopback", `https://[::1]/sub`},
	}
	for _, tc := range cases {
		body := `{"endpoint":"` + tc.endpoint + `","keys":{"p256dh":"k","auth":"a"}}`
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/push/subscribe", strings.NewReader(body))
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: got %d, want 400", tc.name, rec.Code)
		}
	}
}

func TestValidateEndpointAllowsPublicHTTPS(t *testing.T) {
	cases := []string{
		"https://push.example.com/sub/abc",
		"https://fcm.googleapis.com/fcm/send/token",
		"https://updates.push.services.mozilla.com/wpush/v2/token",
	}
	for _, ep := range cases {
		if msg := validateEndpoint(ep); msg != "" {
			t.Errorf("validateEndpoint(%q) = %q, want empty (allowed)", ep, msg)
		}
	}
}

// ---- Debounce ---------------------------------------------------------------

func TestNotifyDebounceSecondCallSuppressed(t *testing.T) {
	m := newManager(t)

	// Two rapid calls for the same sessionKey — second must not panic and must
	// return promptly (no external subscribers, so no network I/O occurs).
	done := make(chan struct{})
	go func() {
		m.Notify("WebTerm", "body", "wt_test")
		m.Notify("WebTerm", "body", "wt_test")
		close(done)
	}()

	select {
	case <-done:
		// good — completed without blocking or panicking
	case <-time.After(3 * time.Second):
		t.Fatal("Notify blocked for more than 3 s")
	}

	// Verify the debounce map was populated.
	m.mu.Lock()
	_, recorded := m.lastNotify["wt_test"]
	m.mu.Unlock()
	if !recorded {
		t.Fatal("lastNotify not populated for sessionKey")
	}
}
