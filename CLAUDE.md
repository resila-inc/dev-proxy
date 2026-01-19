# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

dev-proxyは、macOS向けのローカル開発用リバースプロキシサーバー。サブドメインベースで各プロジェクトにリクエストを振り分ける。

例: `https://honya.dev.resila.jp` → `localhost:3000`（honyaプロジェクトのポート）

## コマンド

```bash
# 開発サーバー起動（ファイル変更を監視）
pnpm dev

# プロダクションモードで起動
pnpm start

# ポートフォワーディング有効化（80→8080, 443→8443、要sudo）
pnpm pf:enable

# ポートフォワーディング無効化
pnpm pf:disable
```

## 初期セットアップ

1. mkcertで証明書を生成:
   ```bash
   brew install mkcert
   mkcert -install
   cd certs
   mkcert "*.dev.resila.jp"
   ```

2. ポートフォワーディングを有効化:
   ```bash
   pnpm pf:enable
   ```

3. プロキシサーバーを起動:
   ```bash
   pnpm dev
   ```

## アーキテクチャ

```
src/index.ts       # メインのプロキシサーバー実装
config.yaml        # 設定ファイル（ベースドメイン、プロジェクトディレクトリ等）
scripts/           # pfctlによるポートフォワーディング制御スクリプト
certs/             # mkcertで生成したワイルドカード証明書
```

## 動作の流れ

1. HTTPリクエスト（:8080）はHTTPSにリダイレクト
2. HTTPSリクエスト（:8443）のHostヘッダーからサブドメインを抽出
3. サブドメイン名と同名のディレクトリを`projects_dir`から探索
4. そのディレクトリの`.env`ファイルから`PORT`を読み取り
5. `localhost:{PORT}`にプロキシ転送（WebSocketも対応）

## config.yaml 設定項目

- `base_domain`: ベースドメイン（例: dev.resila.jp）
- `projects_dir`: プロジェクトディレクトリのパス
- `env_key`: ポート番号を読み取る.envのキー名
- `default_port`: .envが見つからない場合のデフォルトポート
