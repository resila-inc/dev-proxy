import * as net from 'net'

/**
 * 指定されたポートが利用可能かどうかを確認する
 */
export function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => {
        resolve(true)
      })
    })

    server.listen(port, '127.0.0.1')
  })
}

/**
 * 利用可能なポートを推奨する
 * 3000から開始して、空いているポートを探す
 */
export async function findAvailablePort(
  startPort: number = 3000,
  endPort: number = 9999
): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    const available = await checkPortAvailable(port)
    if (available) {
      return port
    }
  }
  throw new Error(`No available port found between ${startPort} and ${endPort}`)
}
