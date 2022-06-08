/**
 * This file contains a Rollup loader for Linaria.
 * It uses the transform.ts function to generate class names from source code,
 * returns transformed code without template literals and attaches generated source maps
 */
import { EvalCache, Module, slugify, transform } from '@linaria/babel-preset'
import fs from 'fs'
import path from 'path'
import { normalizePath, Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { createFileDepHash, FileDepHashInstance } from './fileDepHash'
import { createPersistentCache } from './persistentCache'

type RollupPluginOptions = {
  sourceMap?: boolean
  persistentCachePath?: string
  disableDevPersistentCache?: boolean
  include: RegExp[]
  exclude?: RegExp[]
  lockFilePath: string
  viteConfigFilePath?: string
  debug?: boolean
}

export default function linaria({
  sourceMap,
  persistentCachePath = './node_modules/.linaria-cache/cache.json',
  disableDevPersistentCache,
  include,
  exclude = [],
  viteConfigFilePath = './vite.config.ts',
  lockFilePath,
  debug,
}: RollupPluginOptions): Plugin {
  const root = normalizePath(process.cwd())
  let config: ResolvedConfig
  let server: ViteDevServer | undefined

  const virtualCssFiles = new Map<string, string>()

  const lockFileAbsPath = normalizePath(path.resolve(root, lockFilePath))

  const persistentCache = createPersistentCache({
    cacheFilePath: persistentCachePath,
    viteConfigFilePath: path.resolve(root, viteConfigFilePath),
    lockFilePath: lockFileAbsPath,
    rootDir: root,
    debug: false,
  })

  let fileDepHash: FileDepHashInstance

  function getVirtualName(id: string) {
    return `@linaria-css-cache/${slugify(id)}.css`
  }

  type StatsMode = 'create' | 'cached' | 'skiped'

  let logStats:
    | ((startTime: number, mode: StatsMode, file: string) => void)
    | null = null

  if (debug) {
    const stats: Record<
      `${StatsMode}Time` | `${StatsMode}Count` | 'total',
      number
    > = {
      total: 0,
      createTime: 0,
      cachedTime: 0,
      skipedTime: 0,
      createCount: 0,
      cachedCount: 0,
      skipedCount: 0,
    }

    const uncachedFiles: string[] = []
    const skipedFiles: string[] = []

    let statsTimeout: any
    logStats = (startTime, mode, file: string) => {
      const delta = Date.now() - startTime
      stats.total += delta
      stats[`${mode}Time`] += delta
      stats[`${mode}Count`]++

      if (mode === 'create') {
        uncachedFiles.push(file)
      }

      if (mode === 'skiped') {
        skipedFiles.push(file)
      }

      clearTimeout(statsTimeout)
      statsTimeout = setTimeout(() => {
        console.log(stats, file)

        fs.writeFileSync(
          'linaria-plugin-stats.json',
          JSON.stringify(stats, null, 2),
        )
      }, 2000)
    }
  }

  return {
    name: 'linaria',
    configResolved(resolvedConfig) {
      config = resolvedConfig

      fileDepHash = createFileDepHash({
        rootDir: root,
        aliases: config.resolve.alias,
        include,
        exclude,
      })
    },
    configureServer(_server) {
      server = _server
    },
    load(id: string) {
      return virtualCssFiles.get(id)
    },
    resolveId(importee: string) {
      if (virtualCssFiles.has(importee)) return importee

      if (importee.startsWith('/linaria-css-cache/')) {
        return importee.replace('/linaria-css-cache/', '@linaria-css-cache/')
      }

      return
    },
    transform(code: string, id: string) {
      if (
        id.includes('node_modules') ||
        virtualCssFiles.has(id) ||
        !code.includes('@linaria/')
      ) {
        return
      }

      const startTime = Date.now()

      const isDevMode = config.command === 'serve'
      const enablePersistentCache = isDevMode && !disableDevPersistentCache

      let hash: string | false = false

      if (enablePersistentCache) {
        hash = fileDepHash.getHash(id, code).hash

        const cached = hash && persistentCache.getFile(hash)

        if (cached) {
          const virtualName = getVirtualName(id)

          virtualCssFiles.set(virtualName, cached.cssText)

          logStats?.(startTime, 'cached', id)

          return cached
        }
      }

      const originalResolver = Module._resolveFilename

      Module._resolveFilename = aliasResolver(config, originalResolver, root)

      const result = transform(code, {
        filename: id,
        pluginOptions: {
          displayName: isDevMode,
        },
      })

      Module._resolveFilename = originalResolver

      if (!result.cssText) {
        logStats?.(startTime, 'skiped', id)

        return
      }

      let { cssText } = result

      const virtualName = getVirtualName(id)

      if (sourceMap && result.cssSourceMapText) {
        const map = Buffer.from(result.cssSourceMapText).toString('base64')
        cssText += `/*# sourceMappingURL=data:application/json;base64,${map}*/`
      }

      if (server) {
        const module = server.moduleGraph.getModuleById(virtualName)

        if (module) {
          server.moduleGraph.invalidateModule(module)

          console.log(module.id)

          server.ws.send({
            type: 'update',
            updates: [
              {
                acceptedPath: module.id!,
                path: module.id!,
                timestamp: Date.now(),
                type: 'js-update',
              },
            ],
          })
        }
      }

      virtualCssFiles.set(virtualName, cssText)

      result.code += `\nimport "${virtualName}";\n`

      if (hash) {
        persistentCache.addFile(hash, id, {
          code: result.code,
          cssText,
          map: result.sourceMap,
        })
      }

      logStats?.(startTime, 'create', id)

      return { code: result.code, map: result.sourceMap }
    },
    handleHotUpdate({ file }) {
      fileDepHash.cleanCacheForFile(file)
      // FIX: eval cache is working?
      EvalCache.clearForFile(file)

      if (file === lockFileAbsPath) {
        persistentCache.checkConfigFiles()
      }
    },
    buildStart() {
      persistentCache.checkConfigFiles()
    },
  }
}

type ResolveFilename = (
  id: string,
  options: { id: string; filename: string; paths: string[] },
) => string

function aliasResolver(
  config: ResolvedConfig,
  originalResolveFilename: ResolveFilename,
  root: string,
): ResolveFilename {
  return (id, options) => {
    let aliasedPath: string | undefined = undefined

    for (const { find, replacement } of config.resolve.alias) {
      const matches =
        typeof find === 'string' ? id.startsWith(find) : find.test(id)

      if (matches) {
        aliasedPath = id.replace(find, replacement)
        break
      }
    }

    const finalPath = aliasedPath
      ? originalResolveFilename(path.join(root, aliasedPath), options)
      : originalResolveFilename(id, options)

    return finalPath
  }
}
