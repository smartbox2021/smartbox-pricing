// src/lib/storage.ts
import { promises as fs } from 'fs'
import path from 'path'
import type { ScrapeResult } from './scraper'
import type { SiteKey } from './scraper'

const DATA_DIR = path.join(process.cwd(), 'data')

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

function filePath(siteKey: SiteKey, date: string) {
  return path.join(DATA_DIR, `${siteKey}-${date}.json`)
}

export async function saveResult(siteKey: SiteKey, result: ScrapeResult) {
  await ensureDir()
  await fs.writeFile(filePath(siteKey, result.date), JSON.stringify(result, null, 2))
}

export async function loadResult(siteKey: SiteKey, date: string): Promise<ScrapeResult | null> {
  try {
    return JSON.parse(await fs.readFile(filePath(siteKey, date), 'utf-8'))
  } catch { return null }
}

export async function loadLatest(siteKey: SiteKey): Promise<ScrapeResult | null> {
  await ensureDir()
  const files = (await fs.readdir(DATA_DIR))
    .filter(f => f.startsWith(`${siteKey}-`) && f.endsWith('.json'))
    .sort().reverse()
  if (!files.length) return null
  const date = files[0].replace(`${siteKey}-`, '').replace('.json', '')
  return loadResult(siteKey, date)
}

export async function loadAllLatest(): Promise<Record<string, ScrapeResult | null>> {
  const keys: SiteKey[] = ['corby', 'desborough', 'oundle', 'stamford', 'leicester']
  const results = await Promise.all(keys.map(k => loadLatest(k)))
  return Object.fromEntries(keys.map((k, i) => [k, results[i]]))
}

export async function loadHistory(siteKey: SiteKey, days = 30): Promise<ScrapeResult[]> {
  await ensureDir()
  const files = (await fs.readdir(DATA_DIR))
    .filter(f => f.startsWith(`${siteKey}-`) && f.endsWith('.json'))
    .sort().reverse().slice(0, days)
  const results = await Promise.all(
    files.map(f => loadResult(siteKey, f.replace(`${siteKey}-`, '').replace('.json', '')))
  )
  return results.filter(Boolean) as ScrapeResult[]
}

export async function getYesterdayPrices(siteKey: SiteKey): Promise<Record<string, Record<number, number>>> {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const dateStr = d.toISOString().split('T')[0]
  const result = await loadResult(siteKey, dateStr)
  if (!result) return {}
  const out: Record<string, Record<number, number>> = {}
  for (const site of [result.smartbox, ...result.competitors]) {
    out[site.name] = Object.fromEntries(site.prices.map(p => [p.sqft, p.perWeek]))
  }
  return out
}
