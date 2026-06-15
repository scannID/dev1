import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const dbPath = join(currentDir, '..', 'data', 'db.json')

export async function readDb() {
  const contents = await readFile(dbPath, 'utf8')
  return JSON.parse(contents)
}

export async function writeDb(db) {
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`)
  return db
}

export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function makeCode(prefix, value) {
  const letters = value
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X')
  return `${prefix}-${letters}-${Date.now().toString().slice(-6)}`
}

export function buildStarterItems(type, businessId) {
  const starters = {
    Restaurant: [
      ['Main meal', 'Meals', 15000, 'Starter food item ready for pricing.'],
      ['Fresh juice', 'Drinks', 5000, 'Starter drink item ready for pricing.'],
    ],
    Bar: [
      ['House drink', 'Drinks', 10000, 'Starter drink item ready for pricing.'],
      ['Event ticket', 'Tickets', 25000, 'Starter ticket item ready for ticketing.'],
    ],
    School: [
      ['Lunch plate', 'Meals', 8000, 'Starter canteen item ready for pricing.'],
      ['Term event ticket', 'Tickets', 10000, 'Starter school ticket ready for events.'],
    ],
    Boutique: [
      ['Featured item', 'Goods', 35000, 'Starter retail item ready for pricing.'],
      ['Delivery booking', 'Services', 5000, 'Starter service item ready for orders.'],
    ],
  }

  return (starters[type] ?? starters.Restaurant).map(([name, category, price, description], index) => ({
    id: `${businessId}-${index + 1}`,
    name,
    category,
    price,
    description,
    available: true,
  }))
}
