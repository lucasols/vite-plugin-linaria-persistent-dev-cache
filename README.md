# vite-plugin-linaria-persistent-dev-cache

A vite plugin for linaria that uses persistent file cache in dev mode, which improves a lot the initial build time

# Limitations

Because of the performance improvements the plugin has some known limitations:
- Files with relative imports can't be optimized

Other limitations or Pending improvements:
- SSR it's not tested and may not work
