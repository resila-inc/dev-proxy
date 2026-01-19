import { ipcMain, BrowserWindow, app } from 'electron'
import type { ProxyServer } from './proxy-server.js'
import type { AppStore } from './store.js'
import type { HostConfig, PortCheckResult } from '../shared/types.js'
import { checkPortAvailable, findAvailablePort } from './port-utils.js'

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

  ipcMain.handle('hosts:update', (_event, id: string, updates: Partial<HostConfig>) => {
    return store.updateHost(id, updates)
  })

  ipcMain.handle('hosts:delete', (_event, id: string) => {
    store.deleteHost(id)
  })

  // 設定
  ipcMain.handle('config:get', () => {
    return store.getConfig()
  })

  ipcMain.handle('config:set', (_event, config) => {
    store.setConfig(config)

    // auto_launch設定が変更された場合、ログイン項目を更新
    if ('auto_launch' in config) {
      app.setLoginItemSettings({
        openAtLogin: config.auto_launch,
        openAsHidden: true,
      })
    }
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

  // ポート関連
  ipcMain.handle('port:check', async (_event, port: number): Promise<PortCheckResult> => {
    const available = await checkPortAvailable(port)
    return { port, available }
  })

  ipcMain.handle('port:suggest', async (): Promise<number> => {
    return findAvailablePort()
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
