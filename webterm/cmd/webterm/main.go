package main

import (
	"flag"
	"log"
	"net/http"
	"os"

	"webterm/internal/server"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:7070", "listen address (localhost by default — DO NOT bind public without auth+TLS)")
	root := flag.String("root", ".", "root directory for projects/files")
	token := flag.String("token", os.Getenv("WEBTERM_TOKEN"), "auth token; empty disables auth")
	flag.Parse()

	s := server.New(server.Config{Root: *root, Token: *token})
	log.Printf("WebTerm listening on http://%s (root=%s, auth=%v)", *addr, *root, *token != "")
	if err := http.ListenAndServe(*addr, s.Handler()); err != nil {
		log.Fatal(err)
	}
}
