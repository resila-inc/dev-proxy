import Store from 'electron-store'
import type { StoreSchema, HostConfig, AppConfig } from '../shared/types.js'

const DEFAULT_CONFIG: AppConfig = {
  base_domain: 'localhost',
  http_port: 8080,
  https_port: 8443,
  auto_launch: false,
}

export class AppStore {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'dev-proxy-data',
      defaults: {
        hosts: [],
        config: DEFAULT_CONFIG,
      },
    })
  }

  // ホスト管理
  getHosts(): HostConfig[] {
    return this.store.get('hosts', [])
  }

  addHost(host: Omit<HostConfig, 'id'>): HostConfig {
    const hosts = this.getHosts()
    const newHost: HostConfig = {
      ...host,
      id: `host_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    }
    hosts.push(newHost)
    this.store.set('hosts', hosts)
    return newHost
  }

  updateHost(id: string, updates: Partial<HostConfig>): HostConfig {
    const hosts = this.getHosts()
    const index = hosts.findIndex((h) => h.id === id)
    if (index === -1) {
      throw new Error(`Host not found: ${id}`)
    }
    const updated = { ...hosts[index], ...updates, id }
    hosts[index] = updated
    this.store.set('hosts', hosts)
    return updated
  }

  deleteHost(id: string): void {
    const hosts = this.getHosts()
    const filtered = hosts.filter((h) => h.id !== id)
    this.store.set('hosts', filtered)
  }

  getHostBySubdomain(subdomain: string): HostConfig | undefined {
    return this.getHosts().find((h) => h.subdomain === subdomain && h.enabled)
  }

  // 設定管理
  getConfig(): AppConfig {
    return this.store.get('config', DEFAULT_CONFIG)
  }

  setConfig(updates: Partial<AppConfig>): void {
    const config = this.getConfig()
    this.store.set('config', { ...config, ...updates })
  }
}
