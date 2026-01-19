import * as fs from 'node:fs'
import * as http from 'node:http'
import * as https from 'node:https'
import * as path from 'node:path'
import httpProxy from 'http-proxy'
import { parse as parseYaml } from 'yaml'
import { parse as parseDotenv } from 'dotenv'

// 設定の型定義
interface Config {
  base_domain: string
  projects_dir: string
  env_key: string
  default_port: number
  server: {
    http_port: number
    https_port: number
  }
  certs: {
    key: string
    cert: string
  }
}

// 設定読み込み
const config_path = path.join(import.meta.dirname, '..', 'config.yaml')
const config: Config = parseYaml(fs.readFileSync(config_path, 'utf-8'))

// プロキシ作成
const proxy = httpProxy.createProxyServer({})

proxy.on('error', (err, req, res) => {
  console.error(`[PROXY ERROR] ${err.message}`)
  if (res instanceof http.ServerResponse) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end(`Proxy Error: ${err.message}`)
  }
})

// サブドメインからポートを解決
function resolve_port(subdomain: string): number | null {
  const project_dir = path.join(config.projects_dir, subdomain)

  if (!fs.existsSync(project_dir)) {
    console.warn(`[WARN] Directory not found: ${project_dir}`)
    return null
  }

  const env_path = path.join(project_dir, '.env')

  if (!fs.existsSync(env_path)) {
    console.warn(`[WARN] .env not found: ${env_path}, using default port`)
    return config.default_port
  }

  const env_content = fs.readFileSync(env_path, 'utf-8')
  const env = parseDotenv(env_content)
  const port = env[config.env_key]

  if (!port) {
    console.warn(`[WARN] ${config.env_key} not found in ${env_path}, using default port`)
    return config.default_port
  }

  return parseInt(port, 10)
}

// リクエストハンドラ
function handle_request(req: http.IncomingMessage, res: http.ServerResponse) {
  const host = req.headers.host || ''
  const subdomain = host.replace(`.${config.base_domain}`, '')

  if (!subdomain || subdomain === host) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Invalid subdomain')
    return
  }

  const port = resolve_port(subdomain)

  if (!port) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end(`Project not found: ${subdomain}`)
    return
  }

  const target = `http://localhost:${port}`
  console.log(`[PROXY] ${host} -> ${target}`)

  proxy.web(req, res, { target })
}

// WebSocketハンドラ
function handle_upgrade(req: http.IncomingMessage, socket: any, head: Buffer) {
  const host = req.headers.host || ''
  const subdomain = host.replace(`.${config.base_domain}`, '')

  if (!subdomain || subdomain === host) {
    socket.destroy()
    return
  }

  const port = resolve_port(subdomain)

  if (!port) {
    socket.destroy()
    return
  }

  const target = `http://localhost:${port}`
  console.log(`[WS] ${host} -> ${target}`)

  proxy.ws(req, socket, head, { target })
}

// HTTPサーバー（HTTPSへリダイレクト）
const http_server = http.createServer((req, res) => {
  const host = req.headers.host || ''
  const location = `https://${host}${req.url}`
  res.writeHead(301, { Location: location })
  res.end()
})

// HTTPSサーバー
const cert_key_path = path.join(import.meta.dirname, '..', config.certs.key)
const cert_path = path.join(import.meta.dirname, '..', config.certs.cert)

if (!fs.existsSync(cert_key_path) || !fs.existsSync(cert_path)) {
  console.error('='.repeat(60))
  console.error('証明書が見つかりません。以下のコマンドで生成してください:')
  console.error('')
  console.error('  cd ~/resila-inc/dev-proxy/certs')
  console.error(`  mkcert "*.${config.base_domain}"`)
  console.error('')
  console.error('mkcertがインストールされていない場合:')
  console.error('  brew install mkcert')
  console.error('  mkcert -install')
  console.error('='.repeat(60))
  process.exit(1)
}

const https_server = https.createServer(
  {
    key: fs.readFileSync(cert_key_path),
    cert: fs.readFileSync(cert_path),
  },
  handle_request
)

https_server.on('upgrade', handle_upgrade)

// 起動
http_server.listen(config.server.http_port, () => {
  console.log(`[HTTP] Listening on port ${config.server.http_port} (redirect to HTTPS)`)
})

https_server.listen(config.server.https_port, () => {
  console.log(`[HTTPS] Listening on port ${config.server.https_port}`)
  console.log('')
  console.log('Ready! Access your projects via:')
  console.log(`  https://{project-name}.${config.base_domain}`)
  console.log('')
  console.log(`Projects directory: ${config.projects_dir}`)
})
