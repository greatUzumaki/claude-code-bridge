package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"strings"

	"webterm/internal/server"
	"webterm/internal/terminal"
)

func splitComma(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, ",")
}

func main() {
	addr    := flag.String("addr", "127.0.0.1:7070", "listen address (localhost by default — DO NOT bind public without auth+TLS)")
	root    := flag.String("root", ".", "root directory for projects/files")
	token   := flag.String("token", os.Getenv("WEBTERM_TOKEN"), "auth token; empty disables auth")
	origins := flag.String("allowed-origins", "", "comma-separated WS Origin host patterns; empty = strict same-origin. Set to your domain behind a TLS proxy.")
	flag.Parse()

	if !terminal.Available() {
		log.Println("WARNING: tmux not found on PATH — terminals will not work. Install tmux (apt/brew install tmux).")
	}

	s := server.New(server.Config{Addr: *addr, Root: *root, Token: *token, AllowedOrigins: splitComma(*origins)})
	log.Printf("WebTerm listening on http://%s (root=%s, auth=%v)", *addr, *root, *token != "")
	if err := http.ListenAndServe(*addr, s.Handler()); err != nil {
		log.Fatal(err)
	}
}
