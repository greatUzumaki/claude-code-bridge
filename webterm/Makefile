SHELL := /bin/bash
BIN   := webterm
ROOT  ?= $(HOME)/projects
ADDR  ?= 127.0.0.1:7070

.PHONY: all build web go run dev test vet fmt clean help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-8s %s\n", $$1, $$2}'

all: build

build: web go ## Build frontend then the Go binary (frontend is embedded)

web: ## Install deps + build the React frontend into the embed dir
	cd web && npm install && npm run build

go: ## Build the Go binary (expects frontend already built/embedded)
	go build -o $(BIN) ./cmd/webterm

run: build ## Build everything then run, jailed to ROOT (default ~/projects)
	./$(BIN) --root $(ROOT) --addr $(ADDR)

dev: ## Print the two dev commands (backend :7070 + Vite proxy)
	@echo "backend : go run ./cmd/webterm --root $(ROOT)"
	@echo "frontend: cd web && npm run dev   # proxies /api and /ws to :7070"

test: ## Go tests + frontend unit tests
	go test ./internal/... ./cmd/...
	cd web && npx vitest run

vet: ## go vet + frontend typecheck/build
	go vet ./internal/... ./cmd/...
	cd web && npm run build

fmt: ## gofmt the Go sources
	gofmt -w ./internal ./cmd

clean: ## Remove the built binary
	rm -f $(BIN)
