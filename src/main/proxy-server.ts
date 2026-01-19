import * as fs from 'node:fs'
import * as http from 'node:http'
import * as https from 'node:https'
import { EventEmitter } from 'node:events'
import httpProxy from 'http-proxy'
import type { AppStore } from './store.js'
import type { LogEntry, ProxyStatus, ProxyStatusPayload } from '../shared/types.js'
import { CertManager } from './cert-manager.js'

export class ProxyServer extends EventEmitter {
  private proxy: httpProxy | null = null
  private httpServer: http.Server | null = null
  private httpsServer: https.Server | null = null
  private status: ProxyStatus = 'stopped'
  private errorMessage: string | undefined = undefined
  private logIdCounter = 0
  private certManager: CertManager

  constructor(private store: AppStore) {
    super()
    this.certManager = new CertManager()
  }

  getStatus(): ProxyStatusPayload {
    return { status: this.status, error: this.errorMessage }
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

  private setStatus(status: ProxyStatus, error?: string): void {
    this.status = status
    this.errorMessage = error
    const payload: ProxyStatusPayload = { status, error }
    this.emit('status', payload)
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
      // 証明書の確認
      const certCheck = this.certManager.checkCertExists(config.base_domain)
      if (!certCheck.exists) {
        throw new Error(
          `証明書が見つかりません。\n` + `Settings で Base Domain を保存すると自動生成されます。`
        )
      }

      const { certPath, keyPath: certKeyPath } = certCheck.paths!

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
      const message = error instanceof Error ? error.message : String(error)
      this.setStatus('error', message)
      this.emitLog('error', `Failed to start: ${message}`)
      throw error
    }
  }

  async stop(): Promise<void> {
    // サーバーインスタンスがなければ何もしない
    if (!this.httpServer && !this.httpsServer) {
      this.setStatus('stopped')
      return
    }

    return new Promise<void>((resolve) => {
      let resolved = false
      let closed = 0
      const totalToClose = (this.httpServer ? 1 : 0) + (this.httpsServer ? 1 : 0)

      const done = () => {
        if (resolved) return
        resolved = true
        this.cleanup()
        this.emitLog('info', 'Proxy stopped')
        resolve()
      }

      const checkDone = () => {
        closed++
        if (closed >= totalToClose) {
          done()
        }
      }

      // サーバーがなければ即座に完了扱い
      if (totalToClose === 0) {
        done()
        return
      }

      // closeAllConnections() で強制的に接続を閉じる (Node 18.2+)
      if (this.httpServer && 'closeAllConnections' in this.httpServer) {
        ;(
          this.httpServer as http.Server & { closeAllConnections: () => void }
        ).closeAllConnections()
      }
      if (this.httpsServer && 'closeAllConnections' in this.httpsServer) {
        ;(
          this.httpsServer as https.Server & { closeAllConnections: () => void }
        ).closeAllConnections()
      }

      this.httpServer?.close(() => checkDone())
      this.httpsServer?.close(() => checkDone())

      // タイムアウト
      setTimeout(() => {
        if (!resolved) {
          done()
        }
      }, 1000)
    })
  }

  private cleanup(): void {
    this.proxy?.close()
    this.proxy = null
    this.httpServer = null
    this.httpsServer = null
    this.setStatus('stopped')
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }
}
