export const valuePatterns = {
  number: {},
}

function isObject(value: any): value is Record<string, any> {
  return !Array.isArray(value) && typeof value === 'object' && value !== null
}

export function matchValuePattern(
  value: unknown,
  pattern: unknown,
  path = '',
): true | string {
  if (pattern === valuePatterns.number) {
    if (typeof value !== 'number') {
      return `Expected "${path}" to be a number`
    }

    return true
  }

  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) {
      return `"${path}" is not an array`
    }

    for (let i = 0; i < value.length; i++) {
      const isOk = matchValuePattern(value[i], pattern[i], `${path}[${i}]`)

      if (isOk !== true) {
        return isOk
      }
    }

    return true
  }

  if (isObject(pattern)) {
    if (!isObject(value)) {
      return `"${path}" is not an object`
    }

    const patternKeys = new Set(Object.keys(pattern))

    for (const [key, objValue] of Object.entries(value)) {
      const newPath = path ? `${path}.${key}` : key

      if (!patternKeys.has(key)) {
        return `"${newPath}" is not in pattern`
      }

      const valueToCompare = pattern[key]

      const isOk = matchValuePattern(objValue, valueToCompare, newPath)

      if (isOk !== true) {
        return isOk
      }

      patternKeys.delete(key)
    }

    if (patternKeys.size > 0) {
      return `"${path}" is missing key: ${Array.from(patternKeys).join(', ')}`
    }

    return true
  }

  if (pattern !== value) {
    return `Expected "${path}" to be "${pattern}" but received "${value}"`
  }

  return true
}
