import { contextBridge, ipcRenderer } from 'electron'
import type {
  IpcApi,
  LogEntry,
  ProxyStatusPayload,
  HostConfig,
  AppConfig,
  PortCheckResult,
} from '../shared/types.js'

const api: IpcApi = {
  // ホスト管理
  getHosts: () => ipcRenderer.invoke('hosts:get'),
  addHost: (host: Omit<HostConfig, 'id'>) => ipcRenderer.invoke('hosts:add', host),
  updateHost: (id: string, host: Partial<HostConfig>) =>
    ipcRenderer.invoke('hosts:update', id, host),
  deleteHost: (id: string) => ipcRenderer.invoke('hosts:delete', id),

  // 設定
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: Partial<AppConfig>) => ipcRenderer.invoke('config:set', config),

  // プロキシ
  startProxy: () => ipcRenderer.invoke('proxy:start'),
  stopProxy: () => ipcRenderer.invoke('proxy:stop'),
  restartProxy: () => ipcRenderer.invoke('proxy:restart'),
  getProxyStatus: () => ipcRenderer.invoke('proxy:status'),
  onProxyLog: (callback: (log: LogEntry) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, log: LogEntry) => callback(log)
    ipcRenderer.on('proxy:log', handler)
    return () => ipcRenderer.removeListener('proxy:log', handler)
  },
  onProxyStatusChange: (callback: (payload: ProxyStatusPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ProxyStatusPayload) =>
      callback(payload)
    ipcRenderer.on('proxy:status', handler)
    return () => ipcRenderer.removeListener('proxy:status', handler)
  },

  // ポート関連
  checkPort: (port: number): Promise<PortCheckResult> => ipcRenderer.invoke('port:check', port),
  suggestPort: (): Promise<number> => ipcRenderer.invoke('port:suggest'),

  // ウィンドウ
  showWindow: () => ipcRenderer.send('window:show'),
  hideWindow: () => ipcRenderer.send('window:hide'),
  quitApp: () => ipcRenderer.send('app:quit'),
}

contextBridge.exposeInMainWorld('api', api)
