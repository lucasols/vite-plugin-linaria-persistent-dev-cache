/**
 * This file contains a Rollup loader for Linaria.
 * It uses the transform.ts function to generate class names from source code,
 * returns transformed code without template literals and attaches generated source maps
 */
import { EvalCache, Module, slugify, transform } from '@linaria/babel-preset'
import path from 'path'
import { Plugin, ResolvedConfig, normalizePath } from 'vite'
import { createPersistentCache } from './persistentCache'
import { createFileDepHash, FileDepHashInstance } from './fileDepHash'

type RollupPluginOptions = {
  sourceMap?: boolean
  persistentCachePath?: string
  disableDevPersistentCache?: boolean
  include?: RegExp[]
  exclude?: RegExp[]
  lockFilePath: string
  viteConfigFilePath?: string
}

export default function linaria({
  sourceMap,
  persistentCachePath = '.linaria-cache/cache.json',
  disableDevPersistentCache,
  include = [],
  exclude = [],
  viteConfigFilePath = 'vite.config.js',
  lockFilePath,
}: RollupPluginOptions): Plugin {
  const root = normalizePath(process.cwd())
  let config: ResolvedConfig

  const virtualCssFiles = new Map<string, string>()

  const persistentCache = createPersistentCache({
    cacheFilePath: persistentCachePath,
    viteConfigFilePath,
    lockFilePath,
    rootDir: root,
  })

  let fileDepHash: FileDepHashInstance

  function getVirtualName(slug: string) {
    return `@linaria-cache/${slug}.css`
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
        !code.includes('@linaria')
      ) {
        return
      }

      const isDevMode = config.command === 'serve'
      const enablePersistentCache = isDevMode && !disableDevPersistentCache

      let hash: string | false = false

      if (enablePersistentCache) {
        hash = fileDepHash.getHash(id, code).hash

        const cached = persistentCache.getFile(hash)

        if (cached) {
          const filename = getVirtualName(cached.cssSlug)

          virtualCssFiles.set(filename, cached.cssText)

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
        return
      }

      let { cssText } = result

      const slug = slugify(cssText)
      const filename = getVirtualName(slug)

      if (sourceMap && result.cssSourceMapText) {
        const map = Buffer.from(result.cssSourceMapText).toString('base64')
        cssText += `/*# sourceMappingURL=data:application/json;base64,${map}*/`
      }

      virtualCssFiles.set(filename, cssText)

      result.code += `\nimport ${JSON.stringify(filename)};\n`

      if (hash) {
        persistentCache.addFile(hash, id, {
          code: result.code,
          cssText,
          map: result.sourceMap,
          cssSlug: slug,
        })
      }

      return { code: result.code, map: result.sourceMap }
    },
    handleHotUpdate({ file }) {
      fileDepHash.cleanCacheForFile(file)
      // FIX: eval cache is working?
      EvalCache.clearForFile(file)

      if (file.endsWith(lockFilePath)) {
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
