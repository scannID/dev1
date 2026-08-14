/**
 * Generates PNG favicon files from kode-icon.svg using @resvg/resvg-js.
 * Run once: node scripts/gen-favicons.mjs
 *
 * Outputs to public/:
 *   kode-icon-512.png  — for manifest + generic large icon
 *   kode-icon-192.png  — for Android home screen / PWA
 *   apple-touch-icon.png (180×180) — for iOS add-to-home-screen
 */

import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'kode-icon.svg')
const svgData = readFileSync(svgPath, 'utf-8')

const sizes = [
  { name: 'kode-icon-512.png',    size: 512 },
  { name: 'kode-icon-192.png',    size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  const resvg = new Resvg(svgData, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  })
  const png = resvg.render().asPng()
  const outPath = join(root, 'public', name)
  writeFileSync(outPath, png)
  console.log(`✓ ${name} (${size}×${size})`)
}

console.log('Done — favicon PNGs written to public/')
