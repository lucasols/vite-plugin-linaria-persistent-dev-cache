/**
 * This file contains a Rollup loader for Linaria.
 * It uses the transform.ts function to generate class names from source code,
 * returns transformed code without template literals and attaches generated source maps
 */
import { EvalCache, Module, slugify, transform } from '@linaria/babel-preset'
import path from 'path'
import { Plugin, ResolvedConfig, normalizePath } from 'vite'
import { createPersistentCache } from './createPersistentCache'
import { cleanCodeDepsCacheForFile, getCodeHash } from './file-dep-hash'

type RollupPluginOptions = {
  sourceMap?: boolean
  persistentCachePath?: string
  disableDevPersistentCache?: boolean
  include?: RegExp[]
  exclude?: RegExp[]
  viteConfigFilePath?: string
  packageJsonPath?: string
  packageJsonDependencies?: string[]
}

export default function linaria({
  sourceMap,
  persistentCachePath = '.linaria-cache/cache.json',
  disableDevPersistentCache,
  include = [],
  exclude = [],
  viteConfigFilePath = 'vite.config.js',
  packageJsonPath = 'package.json',
  packageJsonDependencies = [],
}: RollupPluginOptions = {}): Plugin {
  const root = process.cwd()
  let config: ResolvedConfig

  const virtualCssFiles = new Map<string, string>()

  const persistentCache = createPersistentCache({
    cacheFilePath: persistentCachePath,
    viteConfigFilePath,
    packageJsonPath,
    packageJsonDependencies,
  })

  function getVirtualName(slug: string) {
    return `@linaria-cache/${slug}.css`
  }

  return {
    name: 'linaria',
    configResolved(resolvedConfig) {
      config = resolvedConfig
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
        cleanCodeDepsCacheForFile(id)

        hash = getCodeHash(
          id,
          code,
          include,
          exclude,
          config.resolve.alias,
          normalizePath(root),
        ).hash

        const cached = persistentCache.getFile(hash)

        if (cached) {
          const filename = getVirtualName(cached.cssSlug)

          virtualCssFiles.set(filename, cached.cssText)

          return cached
        }
      }

      persistentCache.removeFile(id)
      EvalCache.clearForFile(id)

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
        persistentCache.addFile(hash, {
          code: result.code,
          cssText,
          map: result.sourceMap,
          cssSlug: slug,
        })
      }

      return { code: result.code, map: result.sourceMap }
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
