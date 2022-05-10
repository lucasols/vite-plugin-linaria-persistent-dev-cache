import { beforeEach, expect, test } from 'vitest'
import { cleanResolvedCache, deepFirstSearch } from './dfs/deepFirstSearch'
import { getDFSStableCache } from './utils/getSortedImports'

beforeEach(() => {
  cleanResolvedCache()
})

test('simple dep calc 1', () => {
  deepFirstSearch(
    {
      dep1: ['dep2'],
      dep2: ['dep3'],
      dep3: [],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3'] },
    { fileId: 'dep2', imports: ['dep3'] },
    { fileId: 'dep3', imports: [] },
  ])
})

test('simple dep calc 2', () => {
  deepFirstSearch(
    {
      dep1: ['dep2', 'dep4'],
      dep2: ['dep3'],
      dep3: [],
      dep4: ['dep5'],
      dep5: [],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3', 'dep4', 'dep5'] },
    { fileId: 'dep2', imports: ['dep3'] },
    { fileId: 'dep3', imports: [] },
    { fileId: 'dep4', imports: ['dep5'] },
    { fileId: 'dep5', imports: [] },
  ])
})

test('circular dep calc', () => {
  deepFirstSearch(
    {
      circular: ['dep1'],
      dep1: ['dep2'],
      dep2: ['circular'],
    },
    'circular',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'circular', imports: ['dep1', 'dep2'] },
    { fileId: 'dep1', imports: false },
    { fileId: 'dep2', imports: false },
  ])
})

test.todo('circular dep cache', () => {
  const result = deepFirstSearch(
    {
      circular: ['dep1'],
      dep1: ['dep2', 'dep3'],
      dep3: [],
      dep2: ['circular'],
    },
    'circular',
  )

  expect(result).toMatchInlineSnapshot(`
    Map {
      "dep2" => {
        "circular": Set {
          "circular",
        },
        "deps": Set {},
      },
      "dep1" => {
        "circular": Set {
          "dep2",
        },
        "deps": Set {
          "dep3",
        },
      },
      "circular" => {
        "circular": Set {
          "dep1",
        },
        "deps": Set {},
      },
    }
  `)

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'circular', imports: ['dep1', 'dep2', 'dep3'] },
    { fileId: 'dep1', imports: ['circular', 'dep2', 'dep3'] },
    { fileId: 'dep2', imports: ['circular', 'dep1', 'dep3'] },
    { fileId: 'dep3', imports: [] },
  ])
})

test('circular 2', () => {
  deepFirstSearch(
    {
      dep1: ['dep2'],
      dep2: ['dep3'],
      dep3: ['dep2'],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3'] },
    { fileId: 'dep2', imports: false },
    { fileId: 'dep3', imports: false },
  ])
})

test('circular 3', () => {
  deepFirstSearch(
    {
      dep1: ['dep2'],
      dep2: ['dep3', 'dep4'],
      dep3: ['dep2'],
      dep4: ['dep2', 'dep5'],
      dep5: ['dep1'],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3', 'dep4', 'dep5'] },
    { fileId: 'dep2', imports: false },
    { fileId: 'dep3', imports: false },
    { fileId: 'dep4', imports: false },
    { fileId: 'dep5', imports: false },
  ])
})

test('circular 4', () => {
  deepFirstSearch(
    {
      dep1: ['dep2'],
      dep2: ['dep3', 'dep4'],
      dep3: ['dep2'],
      dep4: ['dep2', 'dep5'],
      dep5: ['dep3'],
    },
    'dep1',
  )

  expect(getDFSStableCache()).toStrictEqual([
    { fileId: 'dep1', imports: ['dep2', 'dep3', 'dep4', 'dep5'] },
    { fileId: 'dep2', imports: false },
    { fileId: 'dep3', imports: false },
    { fileId: 'dep4', imports: false },
    { fileId: 'dep5', imports: false },
  ])
})

test('non cyclic graph', () => {
  const result = deepFirstSearch(
    {
      a: ['b', 'c'],
      b: ['d'],
      c: ['d'],
      d: [],
    },
    'a',
  )

  expect(result.deps).toMatchInlineSnapshot(`
    Set {
      "b",
      "d",
      "c",
    }
  `)

  expect(getDFSStableCache()).toStrictEqual([
    {
      fileId: 'a',
      imports: ['b', 'c', 'd'],
    },
    {
      fileId: 'b',
      imports: ['d'],
    },
    {
      fileId: 'c',
      imports: ['d'],
    },
    {
      fileId: 'd',
      imports: [],
    },
  ])
})

test('circular 5', () => {
  const result = deepFirstSearch(
    {
      dropdown: ['popover', 'typings', 'uOCO', 'uDVU'],
      popover: ['portalLayer'],
      portalLayer: [],
      typings: [],
      uOCO: [],
      uDVU: ['useTimout'],
      useTimout: ['typings'],
    },
    'dropdown',
  )

  expect(result.deps).toMatchInlineSnapshot(`
    Set {
      "popover",
      "portalLayer",
      "typings",
      "uOCO",
      "uDVU",
      "useTimout",
    }
  `)

  expect(getDFSStableCache()).toStrictEqual([
    {
      fileId: 'dropdown',
      imports: [
        'popover',
        'portalLayer',
        'typings',
        'uDVU',
        'uOCO',
        'useTimout',
      ],
    },
    {
      fileId: 'popover',
      imports: ['portalLayer'],
    },
    {
      fileId: 'portalLayer',
      imports: [],
    },
    {
      fileId: 'typings',
      imports: [],
    },
    {
      fileId: 'uDVU',
      imports: ['typings', 'useTimout'],
    },
    {
      fileId: 'uOCO',
      imports: [],
    },
    {
      fileId: 'useTimout',
      imports: ['typings'],
    },
  ])
})
