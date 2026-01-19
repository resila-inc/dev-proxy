import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'

const execFileAsync = promisify(execFile)

export interface CertPaths {
  certPath: string
  keyPath: string
}

export interface CertCheckResult {
  exists: boolean
  paths?: CertPaths
}

export class CertManager {
  private certsDir: string

  constructor() {
    // 証明書は userData (~/Library/Application Support/dev-proxy) に保存
    this.certsDir = path.join(app.getPath('userData'), 'certs')
  }

  /**
   * mkcert バイナリのパスを取得
   */
  private getMkcertPath(): string {
    const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
    const binaryName = `mkcert-darwin-${arch}`

    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'bin', binaryName)
    }
    return path.join(app.getAppPath(), 'resources', 'bin', binaryName)
  }

  /**
   * 指定ドメインの証明書ファイルパスを取得
   */
  getCertPaths(baseDomain: string): CertPaths {
    const certFileName = `_wildcard.${baseDomain}`
    return {
      certPath: path.join(this.certsDir, `${certFileName}.pem`),
      keyPath: path.join(this.certsDir, `${certFileName}-key.pem`),
    }
  }

  /**
   * 証明書が存在するかチェック
   */
  checkCertExists(baseDomain: string): CertCheckResult {
    const paths = this.getCertPaths(baseDomain)
    const exists = fs.existsSync(paths.certPath) && fs.existsSync(paths.keyPath)
    return { exists, paths: exists ? paths : undefined }
  }

  /**
   * CA がインストールされているかチェック
   */
  async isCAInstalled(): Promise<boolean> {
    try {
      const mkcertPath = this.getMkcertPath()
      const { stdout } = await execFileAsync(mkcertPath, ['-CAROOT'])
      const caRoot = stdout.trim()
      const rootCertPath = path.join(caRoot, 'rootCA.pem')
      return fs.existsSync(rootCertPath)
    } catch {
      return false
    }
  }

  /**
   * CA をインストール（初回のみ必要、sudo パスワード要求あり）
   */
  async installCA(): Promise<void> {
    const mkcertPath = this.getMkcertPath()
    await execFileAsync(mkcertPath, ['-install'])
  }

  /**
   * 指定ドメインの証明書を生成
   */
  async generateCert(baseDomain: string): Promise<CertPaths> {
    // certs ディレクトリを作成
    if (!fs.existsSync(this.certsDir)) {
      fs.mkdirSync(this.certsDir, { recursive: true })
    }

    const mkcertPath = this.getMkcertPath()
    const paths = this.getCertPaths(baseDomain)

    // mkcert でワイルドカード証明書を生成
    await execFileAsync(mkcertPath, [`*.${baseDomain}`], {
      cwd: this.certsDir,
    })

    // mkcert の出力ファイル名を確認
    // mkcert は _wildcard.{domain}.pem と _wildcard.{domain}-key.pem を生成する
    if (!fs.existsSync(paths.certPath) || !fs.existsSync(paths.keyPath)) {
      throw new Error(`証明書の生成に失敗しました: ${baseDomain}`)
    }

    return paths
  }

  /**
   * CA インストール + 証明書生成を一括実行
   */
  async ensureCert(baseDomain: string): Promise<CertPaths> {
    // 既に証明書があればそれを返す
    const check = this.checkCertExists(baseDomain)
    if (check.exists && check.paths) {
      return check.paths
    }

    // CA がインストールされていなければインストール
    const caInstalled = await this.isCAInstalled()
    if (!caInstalled) {
      await this.installCA()
    }

    // 証明書を生成
    return this.generateCert(baseDomain)
  }
}
