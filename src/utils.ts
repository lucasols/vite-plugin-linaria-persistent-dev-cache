import crypto from 'crypto'

export function mapEmplace<K, V>(
  map: Map<K, V>,
  key: K,
  methods: {
    insert?: (key: K, map: Map<K, V>) => V
    update?: (existings: V, key: K, map: Map<K, V>) => V
  },
): V {
  let calledAMethod = false

  if (map.has(key)) {
    if (methods.update) {
      calledAMethod = true
      const newValue = methods.update(map.get(key)!, key, map)

      map.set(key, newValue)
    }
  } else if (methods.insert) {
    calledAMethod = true
    const newValue = methods.insert(key, map)

    map.set(key, newValue)
  }

  return map.get(key)!
}

export function generateStringHash(str: string) {
  return crypto.createHash('sha1').update(str).digest('hex')
}
