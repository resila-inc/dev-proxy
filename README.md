# dev-proxy

A macOS menubar application for local development reverse proxy. Routes requests to local development servers based on subdomains.

## Features

- **Menubar App**: Runs in the macOS menubar with Start/Stop/Restart controls
- **Host Management**: Add, edit, and delete host configurations via GUI
- **Subdomain Routing**: Routes `https://{subdomain}.{base_domain}` to `localhost:{port}`
- **HTTPS Support**: Uses mkcert-generated wildcard certificates
- **WebSocket Support**: Proxies WebSocket connections
- **Real-time Logs**: View HTTP/WS/Error logs in the console

## Installation

### From Release

1. Download the latest DMG from [Releases](https://github.com/resila-inc/dev-proxy/releases)
2. Drag `dev-proxy.app` to Applications
3. Right-click and select "Open" (required for unsigned apps)

### From Source

```bash
# Clone the repository
git clone https://github.com/resila-inc/dev-proxy.git
cd dev-proxy

# Install dependencies
pnpm install

# Generate certificates (replace with your domain)
brew install mkcert
mkcert -install
mkdir -p certs && cd certs
mkcert "*.your-domain.local"
cd ..

# Run in development mode
pnpm dev

# Or build and package
pnpm package:mac
```

## Setup

### 1. Generate Certificates

```bash
brew install mkcert
mkcert -install
cd certs
mkcert "*.your-domain.local"
```

### 2. Enable Port Forwarding

To use standard ports (80/443), enable port forwarding:

```bash
pnpm pf:enable   # Requires sudo
```

This forwards:
- Port 80 → 8080
- Port 443 → 8443

To disable:

```bash
pnpm pf:disable
```

### 3. Configure Settings

1. Click the menubar icon and select "Open Console"
2. Go to the "Settings" tab
3. Set your **Base Domain** (must match the certificate you generated)

### 4. Configure Hosts

1. Go to the "Hosts" tab
2. Click "+ Add" to register a host:
   - **Subdomain**: e.g., `myapp`
   - **Port**: e.g., `3000`
   - **Enabled**: Toggle on/off

### 5. Access Your App

With a host configured as `myapp` on port `3000` and base domain `your-domain.local`:

```
https://myapp.your-domain.local → http://127.0.0.1:3000
```

## Configuration

Settings are stored in `~/Library/Application Support/dev-proxy/dev-proxy-data.json`

| Setting | Default | Description |
|---------|---------|-------------|
| Base Domain | (user configured) | Wildcard domain for routing |
| HTTP Port | `8080` | HTTP server port |
| HTTPS Port | `8443` | HTTPS server port |

## Development

```bash
# Start development server
pnpm dev

# Run linter
pnpm lint

# Run formatter
pnpm format

# Run tests
pnpm test

# Build for production
pnpm build

# Package for macOS
pnpm package:mac
```

## Architecture

```
src/
├── main/           # Electron main process
│   ├── index.ts    # App entry, tray, window
│   ├── proxy-server.ts  # HTTP/HTTPS proxy
│   ├── store.ts    # Host & config persistence
│   └── ipc-handlers.ts  # IPC communication
├── renderer/       # Electron renderer process
│   ├── index.html  # Main UI
│   ├── main.ts     # UI logic
│   ├── styles.css  # Styles
│   └── preload.ts  # Context bridge
└── shared/
    └── types.ts    # Shared type definitions
```

## License

MIT
