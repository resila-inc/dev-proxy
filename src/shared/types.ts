// ホスト設定
export interface HostConfig {
  id: string
  subdomain: string
  port: number
  enabled: boolean
}

// アプリ設定
export interface AppConfig {
  base_domain: string
  http_port: number
  https_port: number
  auto_launch: boolean
}

// ストアに保存するデータ
export interface StoreSchema {
  hosts: HostConfig[]
  config: AppConfig
}

// プロキシサーバーの状態
export type ProxyStatus = 'running' | 'stopped' | 'error'

// ログエントリ
export interface LogEntry {
  id: string
  timestamp: Date
  type: 'http' | 'ws' | 'error' | 'info'
  message: string
  subdomain?: string
  target?: string
}

// ポート確認結果
export interface PortCheckResult {
  port: number
  available: boolean
}

// プロキシステータス変更イベントのペイロード
export interface ProxyStatusPayload {
  status: ProxyStatus
  error?: string
}

// IPC通信の型定義
export interface IpcApi {
  // ホスト管理
  getHosts: () => Promise<HostConfig[]>
  addHost: (host: Omit<HostConfig, 'id'>) => Promise<HostConfig>
  updateHost: (id: string, host: Partial<HostConfig>) => Promise<HostConfig>
  deleteHost: (id: string) => Promise<void>

  // 設定
  getConfig: () => Promise<AppConfig>
  setConfig: (config: Partial<AppConfig>) => Promise<void>

  // プロキシ
  startProxy: () => Promise<void>
  stopProxy: () => Promise<void>
  restartProxy: () => Promise<void>
  getProxyStatus: () => Promise<ProxyStatusPayload>
  onProxyLog: (callback: (log: LogEntry) => void) => () => void
  onProxyStatusChange: (callback: (payload: ProxyStatusPayload) => void) => () => void

  // ポート関連
  checkPort: (port: number) => Promise<PortCheckResult>
  suggestPort: () => Promise<number>

  // ウィンドウ
  showWindow: () => void
  hideWindow: () => void
  quitApp: () => void
}

declare global {
  interface Window {
    api: IpcApi
  }
}
