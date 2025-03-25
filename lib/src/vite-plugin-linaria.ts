/**
 * This file contains a Rollup loader for Linaria.
 * It uses the transform.ts function to generate class names from source code,
 * returns transformed code without template literals and attaches generated source maps
 */
import { EvalCache, Module, slugify, transform } from '@linaria/babel-preset'
import fs from 'fs'
import path from 'path'
import {
  Alias,
  normalizePath,
  Plugin,
  ResolvedConfig,
  ViteDevServer,
} from 'vite'
import { createFileDepHash, FileDepHashInstance } from './fileDepHash'
import { createPersistentCache } from './persistentCache'

type RollupPluginOptions = {
  sourceMap?: boolean
  persistentCachePath?: string
  disableDevPersistentCache?: boolean
  cacheReadonly?: boolean
  include: RegExp[]
  exclude?: RegExp[]
  lockFilePath: string
  viteConfigFilePath?: string
  alias?: Alias[]
  debug?: boolean
}

export function linaria({
  sourceMap,
  persistentCachePath = './node_modules/.linaria-cache/cache.json',
  disableDevPersistentCache,
  include,
  cacheReadonly,
  exclude = [],
  viteConfigFilePath = './vite.config.ts',
  lockFilePath,
  alias,
  debug,
}: RollupPluginOptions): Plugin {
  const root = normalizePath(process.cwd())
  let config: ResolvedConfig
  let server: ViteDevServer | undefined

  const virtualCssFiles = new Map<string, string>()

  const lockFileAbsPath = normalizePath(path.resolve(root, lockFilePath))

  let persistentCache: ReturnType<typeof createPersistentCache> | null = null

  let fileDepHash: FileDepHashInstance

  let resolvedAliases: Alias[] = []

  function getVirtualName(id: string) {
    return `/@linaria-css-cache/${slugify(id)}.css`
  }

  type StatsMode = 'create' | 'cached' | 'skiped'

  const debugStats: Record<
    `${StatsMode}Time` | `${StatsMode}Count` | 'total' | 'hashingTime',
    number
  > = {
    total: 0,
    createTime: 0,
    cachedTime: 0,
    skipedTime: 0,
    createCount: 0,
    cachedCount: 0,
    skipedCount: 0,
    hashingTime: 0,
  }

  const uncachedFiles: Record<string, number> = {}
  const uncachedFileHashs: Record<string, string> = {}
  const skipedFiles: Record<string, number> = {}

  let statsTimeout: any
  function logStats(
    startTime: number,
    mode: StatsMode,
    file: string,
    hash: string | false,
  ) {
    if (!debug) return

    const delta = Date.now() - startTime
    debugStats.total += delta
    debugStats[`${mode}Time`] += delta
    debugStats[`${mode}Count`]++

    if (mode === 'create') {
      uncachedFiles[file] = delta

      if (hash) {
        uncachedFileHashs[file] = hash
      }
    }

    if (mode === 'skiped') {
      skipedFiles[file] = delta
    }

    clearTimeout(statsTimeout)
    statsTimeout = setTimeout(() => {
      console.info(debugStats, file)

      fs.writeFileSync(
        'linaria-plugin-stats.json',
        JSON.stringify(
          {
            stats: debugStats,
            uncachedFiles,
            skipedFiles,
            uncachedFileHashs,
            deepHashStats: fileDepHash.getStats(),
          },
          null,
          2,
        ),
      )
    }, 2000)
  }

  return {
    name: 'linaria',
    enforce: 'pre',
    configResolved(resolvedConfig) {
      config = resolvedConfig

      resolvedAliases = alias || config.resolve.alias

      fileDepHash = createFileDepHash({
        rootDir: root,
        aliases: resolvedAliases,
        include,
        exclude,
      })

      if (config.command === 'serve' && !disableDevPersistentCache) {
        persistentCache = createPersistentCache({
          cacheFilePath: persistentCachePath,
          viteConfigFilePath: path.resolve(root, viteConfigFilePath),
          lockFilePath: lockFileAbsPath,
          rootDir: root,
          debug,
          readonly: cacheReadonly,
        })
      }
    },
    configureServer(_server) {
      server = _server
    },
    load(id: string) {
      return virtualCssFiles.get(id)
    },
    resolveId(importee: string) {
      if (virtualCssFiles.has(importee)) return importee

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

      let hash: string | false = false

      if (persistentCache) {
        hash = fileDepHash.getHash(id, code).hash

        if (debug) {
          debugStats.hashingTime += Date.now() - startTime
        }

        const cached = persistentCache.getFile(hash)

        if (cached) {
          const virtualName = getVirtualName(id)

          virtualCssFiles.set(virtualName, cached.cssText)

          logStats(startTime, 'cached', id, hash)

          return cached
        }
      }

      const originalResolver = Module._resolveFilename

      Module._resolveFilename = aliasResolver(
        resolvedAliases,
        originalResolver,
        root,
      )

      const result = transform(code, {
        filename: id,
        pluginOptions: {
          displayName: isDevMode,
        },
      })

      Module._resolveFilename = originalResolver

      if (!result.cssText) {
        logStats(startTime, 'skiped', id, hash)

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
        persistentCache?.addFile(hash, id, {
          code: result.code,
          cssText,
          map: result.sourceMap,
        })
      }

      logStats(startTime, 'create', id, hash)

      return { code: result.code, map: result.sourceMap }
    },
    handleHotUpdate({ file }) {
      fileDepHash.cleanCacheForFile(file)
      // FIX: eval cache is working?
      EvalCache.clearForFile(file)

      if (file === lockFileAbsPath) {
        persistentCache?.checkConfigFiles()
      }
    },
    buildStart() {
      persistentCache?.checkConfigFiles()
    },
  }
}

type ResolveFilename = (
  id: string,
  options: { id: string; filename: string; paths: string[] },
) => string

function aliasResolver(
  aliases: Alias[],
  originalResolveFilename: ResolveFilename,
  root: string,
): ResolveFilename {
  return (id, options) => {
    let aliasedPath: string | undefined = undefined

    for (const { find, replacement } of aliases) {
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
