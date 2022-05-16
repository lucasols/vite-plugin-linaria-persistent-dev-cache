import { expect, test } from 'vitest'
import { matchValuePattern, valuePatterns } from './utils/matchValuePattern'

test('simple values', () => {
  expect(matchValuePattern('foo', 'foo')).toBe(true)
  expect(matchValuePattern('foo', 'bar')).not.toBe(true)

  expect(matchValuePattern(1, 1)).toBe(true)
  expect(matchValuePattern(1, 2)).not.toBe(true)
})

test('number pattern', () => {
  expect(matchValuePattern(1, valuePatterns.number)).toBe(true)
  expect(matchValuePattern(2, valuePatterns.number)).toBe(true)

  expect(matchValuePattern('1', valuePatterns.number)).not.toBe(true)
})

test('object', () => {
  expect(matchValuePattern({}, {})).toBe(true)
  expect(matchValuePattern({ a: 1 }, { a: 1 })).toBe(true)

  expect(matchValuePattern({ a: 1 }, { a: 2 })).not.toBe(true)
  expect(matchValuePattern({ a: 1 }, { b: 1 })).not.toBe(true)
})

test('array', () => {
  expect(matchValuePattern([], [])).toBe(true)
  expect(matchValuePattern([1], [1])).toBe(true)

  expect(matchValuePattern([1], [2])).not.toBe(true)
  expect(matchValuePattern([1], [])).not.toBe(true)
})

test('array and object', () => {
  expect(matchValuePattern([1], [{ a: 1 }])).not.toBe(true)

  expect(
    matchValuePattern(
      {
        a: [1, '2', 10, { b: 'c', d: 1, c: '5' }],
      },
      {
        a: [1, '2', valuePatterns.number, { b: 'c', d: 1 }],
      },
    ),
  ).toBe('"a[3].c" is not in pattern')

  expect(
    matchValuePattern(
      {
        a: ['2', { b: 'c', d: 1, c: 5 }],
      },
      {
        a: ['2', { b: 'c', d: 1, c: valuePatterns.number }],
      },
    ),
  ).toBe(true)
})
