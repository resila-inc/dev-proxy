# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dev-proxy is a macOS menubar application for local development reverse proxy. It routes requests to local development servers based on subdomains.

Example: `https://myapp.{base_domain}` → `localhost:3000`

## Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Package for macOS
pnpm package:mac

# Enable port forwarding (80→8080, 443→8443, requires sudo)
pnpm pf:enable

# Disable port forwarding
pnpm pf:disable

# Lint
pnpm lint

# Format
pnpm format

# Test
pnpm test
```

## Architecture

```
src/
├── main/              # Electron main process
│   ├── index.ts       # App entry, tray, window management
│   ├── proxy-server.ts # HTTP/HTTPS proxy server
│   ├── store.ts       # Host & config persistence (electron-store)
│   └── ipc-handlers.ts # IPC communication handlers
├── renderer/          # Electron renderer process
│   ├── index.html     # Main UI
│   ├── main.ts        # UI logic
│   ├── styles.css     # Styles
│   └── preload.ts     # Context bridge
└── shared/
    └── types.ts       # Shared type definitions
```

## How It Works

1. HTTP requests (:8080) are redirected to HTTPS
2. HTTPS requests (:8443) extract subdomain from Host header
3. Subdomain is looked up in registered hosts
4. Request is proxied to `127.0.0.1:{port}` (WebSocket supported)

## Configuration

Settings are stored in `~/Library/Application Support/dev-proxy/dev-proxy-data.json`

- `base_domain`: Wildcard domain for routing (user configured)
- `http_port`: HTTP server port (default: 8080)
- `https_port`: HTTPS server port (default: 8443)
- `hosts`: Array of registered host configurations
