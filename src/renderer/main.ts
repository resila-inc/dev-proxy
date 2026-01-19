import type { IpcApi, HostConfig, LogEntry, ProxyStatus, AppConfig } from '../shared/types.js'

declare global {
  interface Window {
    api: IpcApi
  }
}

// State
let hosts: HostConfig[] = []
let logs: LogEntry[] = []
let currentFilter = 'all'
let currentConfig: AppConfig | null = null
let editingHostId: string | null = null

// DOM Elements
const statusBadge = document.getElementById('status-badge') as HTMLDivElement
const statusText = statusBadge.querySelector('.status-text') as HTMLSpanElement
const hostsPanel = document.getElementById('hosts-panel') as HTMLDivElement
const logsPanel = document.getElementById('logs-panel') as HTMLDivElement
const settingsPanel = document.getElementById('settings-panel') as HTMLDivElement
const hostsList = document.getElementById('hosts-list') as HTMLDivElement
const logsContainer = document.getElementById('logs-container') as HTMLDivElement
const hostModal = document.getElementById('host-modal') as HTMLDivElement
const hostForm = document.getElementById('host-form') as HTMLFormElement
const modalTitle = document.getElementById('modal-title') as HTMLHeadingElement

// Initialize
async function init(): Promise<void> {
  // Load initial data
  await loadHosts()
  await loadConfig()
  await updateStatus()

  // Setup event listeners
  setupTabs()
  setupHostModal()
  setupLogFilters()
  setupSettings()

  // Subscribe to events
  window.api.onProxyLog((log) => {
    addLog(log)
  })

  window.api.onProxyStatusChange((status) => {
    updateStatusBadge(status)
  })
}

// Tabs
function setupTabs(): void {
  const tabs = document.querySelectorAll('.tab')
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = (tab as HTMLButtonElement).dataset.tab
      if (!tabName) return

      // Update active tab
      tabs.forEach((t) => t.classList.remove('active'))
      tab.classList.add('active')

      // Show corresponding panel
      hostsPanel.classList.remove('active')
      logsPanel.classList.remove('active')
      settingsPanel.classList.remove('active')

      if (tabName === 'hosts') hostsPanel.classList.add('active')
      if (tabName === 'logs') logsPanel.classList.add('active')
      if (tabName === 'settings') settingsPanel.classList.add('active')
    })
  })
}

// Hosts
async function loadHosts(): Promise<void> {
  hosts = await window.api.getHosts()
  renderHosts()
}

function renderHosts(): void {
  if (hosts.length === 0) {
    hostsList.innerHTML = '<p class="empty-message">No hosts registered</p>'
    return
  }

  hostsList.innerHTML = hosts
    .map(
      (host) => `
    <div class="host-item ${host.enabled ? '' : 'disabled'}" data-id="${host.id}">
      <div class="host-info">
        <div class="host-subdomain">${escapeHtml(host.subdomain)}</div>
        <div class="host-url">${escapeHtml(host.subdomain)}.${currentConfig?.base_domain ?? 'dev.resila.jp'}</div>
      </div>
      <span class="host-port">:${host.port}</span>
      <div class="host-actions">
        <button class="btn-icon" data-action="edit" title="Edit">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.13 1.87a2.5 2.5 0 0 1 3.54 3.54l-9 9A2 2 0 0 1 4.25 15H2a1 1 0 0 1-1-1v-2.25a2 2 0 0 1 .59-1.42l9.54-8.46zm2.12 1.42a1 1 0 0 0-1.41 0L3.29 11.84a.5.5 0 0 0-.15.35V14h1.81a.5.5 0 0 0 .35-.15l8.55-8.56a1 1 0 0 0 0-1.41z"/>
          </svg>
        </button>
        <button class="btn-icon danger" data-action="delete" title="Delete">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
          </svg>
        </button>
      </div>
    </div>
  `
    )
    .join('')

  // Attach event listeners
  hostsList.querySelectorAll('.host-item').forEach((item) => {
    const id = (item as HTMLElement).dataset.id
    if (!id) return

    item.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      openEditModal(id)
    })

    item.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      deleteHost(id)
    })
  })
}

function setupHostModal(): void {
  const addBtn = document.getElementById('add-host-btn')
  const cancelBtn = document.getElementById('cancel-modal-btn')
  const backdrop = hostModal.querySelector('.modal-backdrop')
  const subdomainInput = document.getElementById('host-subdomain') as HTMLInputElement
  const previewHint = document.getElementById('subdomain-preview') as HTMLParagraphElement

  addBtn?.addEventListener('click', () => {
    openAddModal()
  })

  cancelBtn?.addEventListener('click', () => {
    closeModal()
  })

  backdrop?.addEventListener('click', () => {
    closeModal()
  })

  // Update preview when subdomain changes
  subdomainInput?.addEventListener('input', () => {
    const subdomain = subdomainInput.value.trim()
    if (subdomain) {
      previewHint.textContent = `${subdomain}.${currentConfig?.base_domain ?? 'dev.resila.jp'}`
    } else {
      previewHint.textContent = ''
    }
  })

  hostForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    await saveHost()
  })
}

function openAddModal(): void {
  editingHostId = null
  modalTitle.textContent = 'Add Host'
  hostForm.reset()
  ;(document.getElementById('host-enabled') as HTMLInputElement).checked = true
  ;(document.getElementById('subdomain-preview') as HTMLParagraphElement).textContent = ''
  hostModal.classList.remove('hidden')
}

function openEditModal(id: string): void {
  const host = hosts.find((h) => h.id === id)
  if (!host) return

  editingHostId = id
  modalTitle.textContent = 'Edit Host'
  ;(document.getElementById('host-subdomain') as HTMLInputElement).value = host.subdomain
  ;(document.getElementById('host-port') as HTMLInputElement).value = String(host.port)
  ;(document.getElementById('host-enabled') as HTMLInputElement).checked = host.enabled
  ;(document.getElementById('subdomain-preview') as HTMLParagraphElement).textContent =
    `${host.subdomain}.${currentConfig?.base_domain ?? 'dev.resila.jp'}`
  hostModal.classList.remove('hidden')
}

function closeModal(): void {
  hostModal.classList.add('hidden')
  editingHostId = null
}

async function saveHost(): Promise<void> {
  const subdomain = (document.getElementById('host-subdomain') as HTMLInputElement).value.trim()
  const port = parseInt((document.getElementById('host-port') as HTMLInputElement).value, 10)
  const enabled = (document.getElementById('host-enabled') as HTMLInputElement).checked

  if (!subdomain || isNaN(port)) return

  if (editingHostId) {
    await window.api.updateHost(editingHostId, { subdomain, port, enabled })
  } else {
    await window.api.addHost({ subdomain, port, enabled })
  }

  closeModal()
  await loadHosts()
}

async function deleteHost(id: string): Promise<void> {
  const host = hosts.find((h) => h.id === id)
  if (!host) return

  if (confirm(`Delete host "${host.subdomain}"?`)) {
    await window.api.deleteHost(id)
    await loadHosts()
  }
}

// Logs
function setupLogFilters(): void {
  const filterBtns = document.querySelectorAll('.filter-btn')
  const clearBtn = document.getElementById('clear-logs-btn')

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = (btn as HTMLButtonElement).dataset.filter
      if (!filter) return

      currentFilter = filter
      filterBtns.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      renderLogs()
    })
  })

  clearBtn?.addEventListener('click', () => {
    logs = []
    renderLogs()
  })
}

function addLog(log: LogEntry): void {
  logs.unshift(log)
  // Keep last 500 logs
  if (logs.length > 500) {
    logs = logs.slice(0, 500)
  }
  renderLogs()
}

function renderLogs(): void {
  const filteredLogs =
    currentFilter === 'all' ? logs : logs.filter((log) => log.type === currentFilter)

  if (filteredLogs.length === 0) {
    logsContainer.innerHTML = '<p class="empty-message">No logs yet</p>'
    return
  }

  logsContainer.innerHTML = filteredLogs
    .map(
      (log) => `
    <div class="log-entry">
      <span class="log-time">${formatTime(log.timestamp)}</span>
      <span class="log-type ${log.type}">${log.type.toUpperCase()}</span>
      <span class="log-message">${escapeHtml(log.message)}</span>
    </div>
  `
    )
    .join('')
}

// Settings
async function loadConfig(): Promise<void> {
  currentConfig = await window.api.getConfig()
  renderSettings()
}

function renderSettings(): void {
  if (!currentConfig) return
  ;(document.getElementById('base-domain') as HTMLInputElement).value = currentConfig.base_domain
  ;(document.getElementById('http-port') as HTMLInputElement).value = String(
    currentConfig.http_port
  )
  ;(document.getElementById('https-port') as HTMLInputElement).value = String(
    currentConfig.https_port
  )
}

function setupSettings(): void {
  const saveBtn = document.getElementById('save-settings-btn')

  saveBtn?.addEventListener('click', async () => {
    const base_domain = (document.getElementById('base-domain') as HTMLInputElement).value.trim()
    const http_port = parseInt(
      (document.getElementById('http-port') as HTMLInputElement).value,
      10
    )
    const https_port = parseInt(
      (document.getElementById('https-port') as HTMLInputElement).value,
      10
    )

    if (!base_domain || isNaN(http_port) || isNaN(https_port)) {
      alert('Please fill in all fields correctly.')
      return
    }

    await window.api.setConfig({ base_domain, http_port, https_port })
    currentConfig = await window.api.getConfig()

    // Restart proxy to apply new settings
    await window.api.restartProxy()
    alert('Settings saved. Proxy restarted.')
  })
}

// Status
async function updateStatus(): Promise<void> {
  const status = await window.api.getProxyStatus()
  updateStatusBadge(status)
}

function updateStatusBadge(status: ProxyStatus): void {
  statusBadge.classList.remove('running', 'stopped', 'error')
  statusBadge.classList.add(status)

  const statusLabels: Record<ProxyStatus, string> = {
    running: 'Running',
    stopped: 'Stopped',
    error: 'Error',
  }
  statusText.textContent = statusLabels[status]
}

// Utilities
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Start
init()
