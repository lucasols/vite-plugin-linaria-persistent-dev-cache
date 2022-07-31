import { react } from '@lucasols/vite-plugin-swc-react'
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'path'
import { createServer } from 'vite'
import { linaria } from 'vite-plugin-linaria-persistent-dev-cache'

export async function startVite(testName: string) {
  const baseCodeDir = path.join(__dirname, '..', 'base-code')
  const testsCodeDir = path.join(__dirname, '..', 'tests-code')

  function removeDir(dir: string) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true })
    }
  }

  removeDir(`${testsCodeDir}/${testName}`)

  cpSync(`${baseCodeDir}`, `${testsCodeDir}/${testName}`, { recursive: true })

  const server = await createServer({
    plugins: [
      linaria({
        sourceMap: true,
        include: [],
        lockFilePath: '../pnpm-lock.yaml',
        disableDevPersistentCache: true,
      }),
      react(),
    ],
    configFile: false,
    root: `${testsCodeDir}/${testName}`,
    server: {
      port: 3001,
    },
  })

  await server.listen()

  const address = server.httpServer?.address()
  const port = typeof address === 'object' ? address?.port : address

  function updateFile(
    file: string,
    { old, replaceWith }: { old: RegExp; replaceWith: string },
  ) {
    const filePath = path.join(testsCodeDir, testName, file)
    const content = readFileSync(filePath, 'utf8')

    const newContent = content.replace(old, replaceWith)

    require('fs').writeFileSync(filePath, newContent)
  }

  function updateFileLine(file: string, line: number, replaceWith: string) {
    const filePath = path.join(testsCodeDir, testName, file)
    const content = readFileSync(filePath, 'utf8')

    const lines = content.split('\n')
    lines[line - 1] = replaceWith

    require('fs').writeFileSync(filePath, lines.join('\n'))
  }

  return { server, port, updateFile, updateFileLine }
}
