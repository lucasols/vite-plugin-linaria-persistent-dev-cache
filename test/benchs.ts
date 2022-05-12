import fs from 'fs'
import v8Profiler from 'v8-profiler-next'
import { resetCodeDepsCache, testOnly } from '../src/file-dep-hash'
import { getFileDepHash } from './utils/setup'

const root = 'C:/Users/lucas/Github/file-dep-hash/test/___mocks___/private'

function getPrivateFileDepHash(file: string) {
  return getFileDepHash(file, root)
}

for (let i = 0; i < 10; i++) {
  getPrivateFileDepHash('./src/components/Table/Table.tsx')
  resetCodeDepsCache()
}

v8Profiler.setGenerateType(1)

const start = Date.now()

v8Profiler.startProfiling('table', true)

getPrivateFileDepHash('./src/components/Table/Table.tsx')

const profile = v8Profiler.stopProfiling('table')

const elapsed = Date.now() - start

console.log('elapsed ', elapsed, 'ms')

profile.export((err, result) => {
  fs.writeFileSync(`table.cpuprofile`, result!)
})

let previousBenchResults: Record<string, number> = {}

try {
  previousBenchResults = JSON.parse(fs.readFileSync('benchs.json', 'utf8'))
} catch (error) {}

previousBenchResults[new Date().toISOString().substring(0, 19)] = elapsed

fs.writeFileSync('benchs.json', JSON.stringify(previousBenchResults, null, 2))
