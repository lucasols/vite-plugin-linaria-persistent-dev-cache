import { beforeEach, describe, expect, test } from 'vitest'
import { sortBy } from '../src/utils'
import { getSortedCodeDepsCache } from './utils/getSortedImports'
import { createFileDeepHashInstance, getFileDepHash } from './utils/setup'
import { order1, order2 } from './__mocks__/renderOrders'

const root = `${__dirname}/__mocks__/private2`

const fileDepHash = createFileDeepHashInstance(
  root,
  [
    /^@src\/state\//,
    /^@src\/api\//,
    /^@src\/utils\//,
    /^@utils\/i18n/,
    /^@src\/pages\/modals\/modalsConfig/,
    /^@src\/data\/fieldTypesConfig/,
    /^@src\/data\/componentTypes/,
  ],
  [
    ['@src', '/src'],
    ['@utils', '/utils-lib'],
  ],
)

function getPrivateFileDepHash(file: string) {
  return getFileDepHash(`./src/${file}`, root, fileDepHash)
}

function getSimplifiedSortedCodeDepsCache() {
  return getSortedCodeDepsCache(root + 'src/', fileDepHash)
}

beforeEach(() => {
  fileDepHash.resetCache()
  fileDepHash._resetDebug()
})

describe('hash do not change when files order is diff', () => {
  test('orders are right', () => {
    expect(order1).not.toStrictEqual(order2)
    expect(order1.length).toStrictEqual(order2.length)
  })

  const fileToTest = 'pages/object/object.tsx'

  const { hash1, hash2, cache1, cache2 } = getResults(fileToTest)

  test('hashs are not circular', () => {
    expect(hash1?.hash).toBeTruthy()
    expect(hash2?.hash).toBeTruthy()
  })

  test('caches are equal', () => {
    for (const cacheEntry of cache1) {
      const cache2Entry = cache2.find(
        (cacheEntry2) => cacheEntry.fileId === cacheEntry2.fileId,
      )

      if (cacheEntry?.imports && cache2Entry?.imports) {
        expect(cacheEntry.imports).toStrictEqual(cache2Entry.imports)
      }
    }
  })

  test('sorted imports are equal', () => {
    console.log('lenght', hash1?.importsMap.length)
    console.log(hash1?.debug)
    console.log(hash2?.debug)
    console.log(hash2?.hash)

    expect(
      sortBy(hash1?.importsMap || [], (item) => item.fileId),
    ).toStrictEqual(sortBy(hash2?.importsMap || [], (item) => item.fileId))
  })

  test('hashs are equal', () => {
    expect(hash2?.hash).toStrictEqual(hash1?.hash)
  })
})

describe('hash do not change when files order is diff 2', () => {
  test('orders are right', () => {
    expect(order1).not.toStrictEqual(order2)
    expect(order1.length).toStrictEqual(order2.length)
  })

  const fileToTest =
    'pages/modals/dashboardComponent/componentsEditor/NavigationBarComponentEditor/ActionsListInput.tsx'

  const { hash1, hash2, cache1, cache2 } = getResults(fileToTest)

  test('hashs are not circular', () => {
    expect(hash1?.hash).toBeTruthy()
    expect(hash2?.hash).toBeTruthy()
  })

  test('caches are equal', () => {
    for (const cacheEntry of cache1) {
      const cache2Entry = cache2.find(
        (cacheEntry2) => cacheEntry.fileId === cacheEntry2.fileId,
      )

      if (cacheEntry?.imports && cache2Entry?.imports) {
        expect(cacheEntry.imports).toStrictEqual(cache2Entry.imports)
      }
    }
  })

  test('sorted imports are equal', () => {
    console.log('lenght', hash1?.importsMap.length)
    console.log(hash1?.debug)
    console.log(hash2?.debug)
    console.log(hash2?.hash)

    expect(
      sortBy(hash1?.importsMap || [], (item) => item.fileId),
    ).toStrictEqual(sortBy(hash2?.importsMap || [], (item) => item.fileId))
  })

  test('hashs are equal', () => {
    expect(hash2?.hash).toStrictEqual(hash1?.hash)
  })
})

function getResults(fileToTest: string) {
  type CodeHashResult = ReturnType<typeof getPrivateFileDepHash>

  let hash1: CodeHashResult | null = null
  let hash2: CodeHashResult | null = null

  for (const file of order1) {
    const hash = getPrivateFileDepHash(file)

    if (file === fileToTest) {
      hash1 = hash
      break
    }
  }

  const cache1 = getSimplifiedSortedCodeDepsCache()

  fileDepHash.resetCache()
  fileDepHash._resetDebug()

  for (const file of order2) {
    const hash = getPrivateFileDepHash(file)

    if (file === fileToTest) {
      hash2 = hash
      break
    }
  }

  const cache2 = getSimplifiedSortedCodeDepsCache()

  return {
    cache1,
    cache2,
    hash1,
    hash2,
  }
}
