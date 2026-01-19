import { ipcMain, BrowserWindow } from 'electron'
import type { ProxyServer } from './proxy-server.js'
import type { AppStore } from './store.js'
import type { HostConfig } from '../shared/types.js'

export function setupIpcHandlers(
  proxyServer: ProxyServer,
  store: AppStore,
  getWindow: () => BrowserWindow | undefined
): void {
  // ホスト管理
  ipcMain.handle('hosts:get', () => {
    return store.getHosts()
  })

  ipcMain.handle('hosts:add', (_event, host: Omit<HostConfig, 'id'>) => {
    return store.addHost(host)
  })

  ipcMain.handle(
    'hosts:update',
    (_event, id: string, updates: Partial<HostConfig>) => {
      return store.updateHost(id, updates)
    }
  )

  ipcMain.handle('hosts:delete', (_event, id: string) => {
    store.deleteHost(id)
  })

  // 設定
  ipcMain.handle('config:get', () => {
    return store.getConfig()
  })

  ipcMain.handle('config:set', (_event, config) => {
    store.setConfig(config)
  })

  // プロキシ
  ipcMain.handle('proxy:start', async () => {
    await proxyServer.start()
  })

  ipcMain.handle('proxy:stop', async () => {
    await proxyServer.stop()
  })

  ipcMain.handle('proxy:restart', async () => {
    await proxyServer.restart()
  })

  ipcMain.handle('proxy:status', () => {
    return proxyServer.getStatus()
  })

  // ウィンドウ操作
  ipcMain.on('window:show', () => {
    getWindow()?.show()
  })

  ipcMain.on('window:hide', () => {
    getWindow()?.hide()
  })

  // ログ・ステータスのイベント転送
  proxyServer.on('log', (log) => {
    getWindow()?.webContents.send('proxy:log', log)
  })

  proxyServer.on('status', (status) => {
    getWindow()?.webContents.send('proxy:status', status)
  })
}
