import { mapEmplace } from '../../src/utils'

export type Graph = Record<string, string[]>

const resolvedCache = new Map<string, Set<string> | 'circular'>()

type DeepFirstSearchResult = {
  deps: Set<string>
  hasCircularDep: boolean
  circularNodes: Map<string, CircularNode>
}

type CircularNode = {
  deps: Set<string>
  circular: Set<string>
}

export function deepFirstSearch(
  nodes: Graph,
  startNode: string,
  visited: Set<string> = new Set(),
  inPath: Set<string> = new Set(),
  deepth = 0,
  circularNodes = new Map<string, CircularNode>(),
): DeepFirstSearchResult {
  visited.add(startNode)
  inPath.add(startNode)

  const edges = nodes[startNode]!

  const deps = new Set<string>()

  let isCircular = false

  for (const edge of edges) {
    if (inPath.has(edge)) {
      isCircular = true

      addCircularDep(edge)

      continue
    }

    let edgeHasCircularDep = false

    if (!visited.has(edge)) {
      edgeHasCircularDep = deepFirstSearch(
        nodes,
        edge,
        visited,
        inPath,
        deepth + 1,
        circularNodes,
      ).hasCircularDep
    } else {
      edgeHasCircularDep = resolvedCache.get(edge) === 'circular'
    }

    if (edgeHasCircularDep) {
      isCircular = true

      addCircularDep(edge)

      continue
    }

    deps.add(edge)

    addEdgeDeps(edge, deps)
  }

  inPath.delete(startNode)

  if (deepth === 0) {
    visited.delete(startNode)
  }

  if (isCircular) {
    if (deepth === 0) {
      resolvedCache.set(startNode, visited)
    } else {
      resolvedCache.set(startNode, 'circular')

      const circularEntry = mapEmplace(circularNodes, startNode, {
        insert: () => ({
          deps: new Set(),
          circular: new Set(),
        }),
      })

      for (const dep of deps) {
        circularEntry.deps.add(dep)
      }
    }
  } else {
    resolvedCache.set(startNode, deps)
  }

  if (deepth === 0 && circularNodes.size > 0) {
    for (const [node, circularNode] of circularNodes) {
      if (resolvedCache.get(node) instanceof Set) {
        continue
      }

      const deps = new Set(circularNode.deps)

      for (const circularDep of circularNode.circular) {
        const circularResolvedDeps = resolvedCache.get(circularDep)

        if (circularResolvedDeps instanceof Set) {
          deps.add(circularDep)

          for (const dep of circularResolvedDeps) {
            if (dep !== node) {
              deps.add(dep)
            }
          }
        }
      }

      resolvedCache.set(node, deps)
    }
  }

  return { deps: visited, hasCircularDep: isCircular, circularNodes }

  function addCircularDep(edge: string) {
    const circularEntry = mapEmplace(circularNodes, startNode, {
      insert: () => ({
        deps: new Set(),
        circular: new Set(),
      }),
    })

    circularEntry.circular.add(edge)
  }

  function addEdgeDeps(edge: string, deps: Set<string>) {
    const edgeDeps = resolvedCache.get(edge)

    if (!edgeDeps || edgeDeps === 'circular') return

    for (const dep of edgeDeps) {
      deps.add(dep)
    }
  }
}

export function cleanResolvedCache() {
  resolvedCache.clear()
}

export function getResolvedCache() {
  return resolvedCache
}
