import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { once } from 'node:events'
import { finished } from 'node:stream/promises'
import { createInterface } from 'node:readline'

function argument(name) {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

async function write(stream, text) {
  if (!stream.write(text)) await once(stream, 'drain')
}

async function main() {
  const input = argument('input')
  const mainOutput = argument('main-out')
  const trafficOutput = argument('traffic-out')
  if (!input || !mainOutput || !trafficOutput) {
    throw new Error('Use --input=<d1-import.sql> --main-out=<main.sql> --traffic-out=<traffic.sql>')
  }

  const resolvedInput = path.resolve(input)
  const resolvedMain = path.resolve(mainOutput)
  const resolvedTraffic = path.resolve(trafficOutput)
  if (new Set([resolvedInput, resolvedMain, resolvedTraffic]).size !== 3) {
    throw new Error('Input and output paths must be different')
  }

  await Promise.all([
    mkdir(path.dirname(resolvedMain), { recursive: true }),
    mkdir(path.dirname(resolvedTraffic), { recursive: true }),
  ])

  const [tableSchema, indexes] = await Promise.all([
    readFile(path.resolve('lib/db/traffic-migrations/0000_traffic.sql'), 'utf8'),
    readFile(path.resolve('lib/db/traffic-migrations/0001_traffic_indexes.sql'), 'utf8'),
  ])
  const mainStream = createWriteStream(resolvedMain, { flags: 'w' })
  const trafficStream = createWriteStream(resolvedTraffic, { flags: 'w' })
  const lines = createInterface({ input: createReadStream(resolvedInput), crlfDelay: Infinity })
  let trafficStatement = false
  let trafficRowsSeen = false

  try {
    await write(trafficStream, `PRAGMA defer_foreign_keys=ON;\n${tableSchema.trim()}\n`)
    for await (const line of lines) {
      const withNewline = `${line}\n`
      if (line.startsWith('INSERT INTO "traffic_accidents" ')) {
        trafficStatement = true
        trafficRowsSeen = true
      }
      if (trafficStatement) {
        await write(trafficStream, withNewline)
        if (line.endsWith(';')) trafficStatement = false
        continue
      }
      if (line === 'DELETE FROM "traffic_accidents";') continue
      await write(mainStream, withNewline)
    }
    if (trafficStatement) throw new Error('Traffic INSERT statement was not terminated')
    if (!trafficRowsSeen) throw new Error('No traffic_accidents INSERT statements were found')
    await write(trafficStream, `${indexes.trim()}\nPRAGMA defer_foreign_keys=OFF;\n`)
  } finally {
    lines.close()
    const mainDone = finished(mainStream)
    const trafficDone = finished(trafficStream)
    mainStream.end()
    trafficStream.end()
    await Promise.all([mainDone, trafficDone])
  }

  console.log(`Main D1 import: ${resolvedMain}`)
  console.log(`Traffic D1 import: ${resolvedTraffic}`)
}

void main().catch((error) => {
  console.error('[split-traffic-d1]', error instanceof Error ? error.message : 'unknown error')
  process.exitCode = 1
})
