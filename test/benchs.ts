import { writeFileSync } from 'fs'
import v8Profiler from 'v8-profiler-next'
import { testOnly } from '../src/file-dep-hash'
import { getFileDepHash } from './utils/setup'

const root = 'C:/Users/lucas/Github/file-dep-hash/test/___mocks___/private'

function getPrivateFileDepHash(file: string) {
  return getFileDepHash(file, root)
}

getPrivateFileDepHash('./src/components/Table/Table.tsx')
testOnly.resetCodeDepsCache()
getPrivateFileDepHash('./src/components/Table/Table.tsx')
testOnly.resetCodeDepsCache()

v8Profiler.setGenerateType(1)

const start = Date.now()

v8Profiler.startProfiling('table', true)

getPrivateFileDepHash('./src/components/Table/Table.tsx')

const profile = v8Profiler.stopProfiling('table')

const elapsed = Date.now() - start

console.log('elapsed ', elapsed, 'ms')

profile.export((err, result) => {
  writeFileSync(`table.cpuprofile`, result!)
})
