import { describe, it, expect } from 'vitest'
import type { HostConfig, AppConfig } from './types.js'

describe('types', () => {
  it('HostConfig should have required fields', () => {
    const host: HostConfig = {
      id: 'test-id',
      subdomain: 'myapp',
      port: 3000,
      enabled: true,
    }

    expect(host.id).toBe('test-id')
    expect(host.subdomain).toBe('myapp')
    expect(host.port).toBe(3000)
    expect(host.enabled).toBe(true)
  })

  it('AppConfig should have required fields', () => {
    const config: AppConfig = {
      base_domain: 'dev.example.com',
      http_port: 8080,
      https_port: 8443,
      auto_launch: false,
    }

    expect(config.base_domain).toBe('dev.example.com')
    expect(config.http_port).toBe(8080)
    expect(config.https_port).toBe(8443)
    expect(config.auto_launch).toBe(false)
  })
})
