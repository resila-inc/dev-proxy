import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as net from 'net'
import { checkPortAvailable, findAvailablePort } from './port-utils'

// Mock net module
vi.mock('net', () => ({
  createServer: vi.fn(),
}))

describe('port-utils', () => {
  describe('checkPortAvailable', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return true when port is available', async () => {
      const mockServer = {
        once: vi.fn((event: string, callback: () => void) => {
          if (event === 'listening') {
            setTimeout(callback, 0)
          }
        }),
        listen: vi.fn(),
        close: vi.fn((callback: () => void) => callback()),
      }
      vi.mocked(net.createServer).mockReturnValue(mockServer as unknown as net.Server)

      const result = await checkPortAvailable(3000)
      expect(result).toBe(true)
      expect(mockServer.listen).toHaveBeenCalledWith(3000, '127.0.0.1')
    })

    it('should return false when port is in use', async () => {
      const mockServer = {
        once: vi.fn((event: string, callback: () => void) => {
          if (event === 'error') {
            setTimeout(callback, 0)
          }
        }),
        listen: vi.fn(),
      }
      vi.mocked(net.createServer).mockReturnValue(mockServer as unknown as net.Server)

      const result = await checkPortAvailable(3000)
      expect(result).toBe(false)
    })
  })

  describe('findAvailablePort', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should find the first available port', async () => {
      let createServerCallCount = 0
      vi.mocked(net.createServer).mockImplementation(() => {
        createServerCallCount++
        const currentCall = createServerCallCount
        const mockServer = {
          once: vi.fn((event: string, callback: () => void) => {
            // First two ports (call 1, 2) are in use, third (call 3) is available
            if (currentCall <= 2 && event === 'error') {
              setTimeout(callback, 0)
            }
            if (currentCall > 2 && event === 'listening') {
              setTimeout(callback, 0)
            }
          }),
          listen: vi.fn(),
          close: vi.fn((callback: () => void) => callback()),
        }
        return mockServer as unknown as net.Server
      })

      const result = await findAvailablePort(3000, 3010)
      expect(result).toBe(3002)
    })

    it('should throw error when no port is available', async () => {
      const mockServer = {
        once: vi.fn((event: string, callback: () => void) => {
          if (event === 'error') {
            setTimeout(callback, 0)
          }
        }),
        listen: vi.fn(),
      }
      vi.mocked(net.createServer).mockReturnValue(mockServer as unknown as net.Server)

      await expect(findAvailablePort(3000, 3002)).rejects.toThrow(
        'No available port found between 3000 and 3002'
      )
    })
  })
})
