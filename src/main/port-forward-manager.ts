import { exec, execSync } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface PortForwardCheckResult {
  http_enabled: boolean
  https_enabled: boolean
  all_enabled: boolean
}

export interface PortForwardConfig {
  http_port: number
  https_port: number
}

const DEFAULT_CONFIG: PortForwardConfig = {
  http_port: 8080,
  https_port: 8443,
}

const STANDARD_HTTP_PORT = 80
const STANDARD_HTTPS_PORT = 443

function validatePort(port: number, name: string): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${name}: ${port}`)
  }
}

export class PortForwardManager {
  private config: PortForwardConfig

  constructor(config?: Partial<PortForwardConfig>) {
    const merged = { ...DEFAULT_CONFIG, ...config }

    validatePort(merged.http_port, 'http_port')
    validatePort(merged.https_port, 'https_port')

    this.config = merged
  }

  /**
   * 現在のPort Forwarding設定を確認（sudo不要）
   */
  async checkRules(): Promise<PortForwardCheckResult> {
    try {
      const { stdout } = await execAsync(
        'sudo -n pfctl -sr 2>/dev/null || pfctl -sr 2>/dev/null || echo ""'
      )
      const rules = stdout

      const http_enabled = rules.includes(
        `rdr pass on lo0 inet proto tcp from any to any port ${STANDARD_HTTP_PORT} -> 127.0.0.1 port ${this.config.http_port}`
      )
      const https_enabled = rules.includes(
        `rdr pass on lo0 inet proto tcp from any to any port ${STANDARD_HTTPS_PORT} -> 127.0.0.1 port ${this.config.https_port}`
      )

      return {
        http_enabled,
        https_enabled,
        all_enabled: http_enabled && https_enabled,
      }
    } catch (error) {
      console.warn('Failed to check port forwarding rules:', error)
      return {
        http_enabled: false,
        https_enabled: false,
        all_enabled: false,
      }
    }
  }

  /**
   * Port Forwardingを有効化（osascriptでパスワードダイアログ表示）
   */
  async enable(): Promise<void> {
    const anchor_content = [
      `rdr pass on lo0 inet proto tcp from any to any port ${STANDARD_HTTP_PORT} -> 127.0.0.1 port ${this.config.http_port}`,
      `rdr pass on lo0 inet proto tcp from any to any port ${STANDARD_HTTPS_PORT} -> 127.0.0.1 port ${this.config.https_port}`,
    ].join('\n')

    const script = `
do shell script "
echo '${anchor_content}' | pfctl -a 'com.apple/250.ApplicationFirewall' -f - 2>/dev/null
pfctl -e 2>/dev/null || true
" with administrator privileges
`.trim()

    try {
      execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      })
      console.log('Port forwarding enabled successfully')
    } catch (error) {
      if (error instanceof Error && error.message.includes('User canceled')) {
        console.log('Port forwarding setup cancelled by user')
        throw new Error('User cancelled port forwarding setup')
      }
      throw error
    }
  }

  /**
   * Port Forwarding設定を確保（既に設定済みならスキップ）
   */
  async ensurePortForwarding(): Promise<void> {
    console.log('Checking port forwarding rules...')

    const result = await this.checkRules()

    if (result.all_enabled) {
      console.log('Port forwarding rules already configured')
      return
    }

    console.log('Port forwarding rules not found, attempting to enable...')
    await this.enable()
  }
}
