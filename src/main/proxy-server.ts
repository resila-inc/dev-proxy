import * as fs from 'node:fs'
import * as http from 'node:http'
import * as https from 'node:https'
import * as path from 'node:path'
import { EventEmitter } from 'node:events'
import { app } from 'electron'
import httpProxy from 'http-proxy'
import type { AppStore } from './store.js'
import type { LogEntry, ProxyStatus } from '../shared/types.js'

export class ProxyServer extends EventEmitter {
  private proxy: httpProxy | null = null
  private httpServer: http.Server | null = null
  private httpsServer: https.Server | null = null
  private status: ProxyStatus = 'stopped'
  private logIdCounter = 0

  constructor(private store: AppStore) {
    super()
  }

  getStatus(): ProxyStatus {
    return this.status
  }

  private emitLog(
    type: LogEntry['type'],
    message: string,
    subdomain?: string,
    target?: string
  ): void {
    const log: LogEntry = {
      id: `${Date.now()}-${this.logIdCounter++}`,
      timestamp: new Date(),
      type,
      message,
      subdomain,
      target,
    }
    this.emit('log', log)
  }

  private setStatus(status: ProxyStatus): void {
    this.status = status
    this.emit('status', status)
  }

  private handleRequest = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const config = this.store.getConfig()
    const host = req.headers.host || ''
    const subdomain = host.replace(`.${config.base_domain}`, '')

    if (!subdomain || subdomain === host) {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Invalid subdomain')
      this.emitLog('error', `Invalid subdomain: ${host}`)
      return
    }

    const hostConfig = this.store.getHostBySubdomain(subdomain)

    if (!hostConfig) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end(`Host not found: ${subdomain}`)
      this.emitLog('error', `Host not registered: ${subdomain}`)
      return
    }

    const target = `http://127.0.0.1:${hostConfig.port}`
    this.emitLog('http', `${req.method} ${req.url}`, subdomain, target)

    this.proxy?.web(req, res, { target })
  }

  private handleUpgrade = (
    req: http.IncomingMessage,
    socket: import('node:stream').Duplex,
    head: Buffer
  ): void => {
    const config = this.store.getConfig()
    const host = req.headers.host || ''
    const subdomain = host.replace(`.${config.base_domain}`, '')

    if (!subdomain || subdomain === host) {
      socket.destroy()
      return
    }

    const hostConfig = this.store.getHostBySubdomain(subdomain)

    if (!hostConfig) {
      socket.destroy()
      return
    }

    const target = `http://127.0.0.1:${hostConfig.port}`
    this.emitLog('ws', `WebSocket upgrade`, subdomain, target)

    this.proxy?.ws(req, socket, head, { target })
  }

  private handleHttpRedirect = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const host = req.headers.host || ''
    const location = `https://${host}${req.url}`
    res.writeHead(301, { Location: location })
    res.end()
  }

  async start(): Promise<void> {
    if (this.status === 'running') {
      return
    }

    const config = this.store.getConfig()

    try {
      // 証明書パスの解決
      const resourcesPath = app.isPackaged ? process.resourcesPath : app.getAppPath()

      const certFileName = `_wildcard.${config.base_domain}`
      const certKeyPath = path.join(resourcesPath, 'certs', `${certFileName}-key.pem`)
      const certPath = path.join(resourcesPath, 'certs', `${certFileName}.pem`)

      if (!fs.existsSync(certKeyPath) || !fs.existsSync(certPath)) {
        throw new Error(
          `証明書が見つかりません。\n` +
            `期待するパス:\n  ${certKeyPath}\n  ${certPath}\n\n` +
            `mkcertで生成してください:\n` +
            `  mkcert "*.${config.base_domain}"`
        )
      }

      // プロキシ作成
      this.proxy = httpProxy.createProxyServer({})

      this.proxy.on('error', (err, _req, res) => {
        this.emitLog('error', `Proxy error: ${err.message}`)
        if (res instanceof http.ServerResponse) {
          res.writeHead(502, { 'Content-Type': 'text/plain' })
          res.end(`Proxy Error: ${err.message}`)
        }
      })

      // HTTPサーバー
      this.httpServer = http.createServer(this.handleHttpRedirect)

      // HTTPSサーバー
      this.httpsServer = https.createServer(
        {
          key: fs.readFileSync(certKeyPath),
          cert: fs.readFileSync(certPath),
        },
        this.handleRequest
      )

      this.httpsServer.on('upgrade', this.handleUpgrade)

      // 起動
      await new Promise<void>((resolve, reject) => {
        const onError = (err: Error) => reject(err)
        this.httpServer?.once('error', onError)
        this.httpsServer?.once('error', onError)

        this.httpServer?.listen(config.http_port, () => {
          this.httpsServer?.listen(config.https_port, () => {
            this.httpServer?.removeListener('error', onError)
            this.httpsServer?.removeListener('error', onError)
            resolve()
          })
        })
      })

      this.setStatus('running')
      this.emitLog('info', `Proxy started. HTTP:${config.http_port} HTTPS:${config.https_port}`)
    } catch (error) {
      this.setStatus('error')
      const message = error instanceof Error ? error.message : String(error)
      this.emitLog('error', `Failed to start: ${message}`)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (this.status === 'stopped') {
      return
    }

    return new Promise<void>((resolve) => {
      let closed = 0
      const checkDone = () => {
        closed++
        if (closed >= 2) {
          this.proxy?.close()
          this.proxy = null
          this.httpServer = null
          this.httpsServer = null
          this.setStatus('stopped')
          this.emitLog('info', 'Proxy stopped')
          resolve()
        }
      }

      this.httpServer?.close(() => checkDone())
      this.httpsServer?.close(() => checkDone())

      setTimeout(() => {
        if (this.status !== 'stopped') {
          this.proxy?.close()
          this.proxy = null
          this.httpServer = null
          this.httpsServer = null
          this.setStatus('stopped')
          resolve()
        }
      }, 3000)
    })
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }
}
