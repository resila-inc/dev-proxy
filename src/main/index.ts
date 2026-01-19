import * as path from 'node:path'
import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { AppStore } from './store.js'
import { ProxyServer } from './proxy-server.js'
import { setupIpcHandlers } from './ipc-handlers.js'

// シングルインスタンス
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  let tray: Tray | null = null
  let mainWindow: BrowserWindow | null = null
  let store: AppStore | null = null
  let proxyServer: ProxyServer | null = null

  const getWindow = (): BrowserWindow | undefined => mainWindow ?? undefined

  function createWindow(): void {
    const preloadPath = path.join(__dirname, '../preload/preload.cjs')

    mainWindow = new BrowserWindow({
      width: 600,
      height: 500,
      show: false,
      resizable: true,
      title: 'dev-proxy',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    // 閉じるボタンで非表示にする（終了しない）
    mainWindow.on('close', (event) => {
      if (!app.isQuitting) {
        event.preventDefault()
        mainWindow?.hide()
      }
    })

    const indexPath = app.isPackaged
      ? path.join(__dirname, '../renderer/index.html')
      : path.join(__dirname, '../renderer/index.html')

    mainWindow.loadFile(indexPath)

    // 開発時はDevToolsを開く
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  }

  function createTray(): void {
    const resourcesPath = app.isPackaged
      ? process.resourcesPath
      : path.join(app.getAppPath(), 'resources')

    const iconPath = path.join(resourcesPath, 'iconTemplate.png')
    const icon = nativeImage.createFromPath(iconPath)
    icon.setTemplateImage(true)

    tray = new Tray(icon)
    tray.setToolTip('dev-proxy')

    updateTrayMenu()

    tray.on('click', () => {
      mainWindow?.show()
    })
  }

  function updateTrayMenu(): void {
    const status = proxyServer?.getStatus() ?? 'stopped'
    const isRunning = status === 'running'

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Status: ${status}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Restart',
        enabled: isRunning,
        click: async () => {
          await proxyServer?.restart()
        },
      },
      {
        label: isRunning ? 'Stop' : 'Start',
        click: async () => {
          if (isRunning) {
            await proxyServer?.stop()
          } else {
            await proxyServer?.start()
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Open Console',
        click: () => mainWindow?.show(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true
          app.quit()
        },
      },
    ])

    tray?.setContextMenu(contextMenu)
  }

  app.on('ready', async () => {
    // 初期化
    store = new AppStore()
    proxyServer = new ProxyServer(store)

    // ステータス変更時にメニュー更新
    proxyServer.on('status', () => {
      updateTrayMenu()
    })

    // IPCハンドラー設定
    setupIpcHandlers(proxyServer, store, getWindow)

    // UI作成
    createWindow()
    createTray()

    // プロキシ自動起動
    proxyServer.start().catch((err) => {
      console.error('Failed to start proxy:', err)
    })
  })

  app.on('second-instance', () => {
    mainWindow?.show()
  })

  app.on('before-quit', async () => {
    app.isQuitting = true
    await proxyServer?.stop()
  })

  app.on('activate', () => {
    mainWindow?.show()
  })

  // macOSではドックアイコンを非表示
  app.dock?.hide()
}

// app.isQuitting プロパティの型定義
declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}
