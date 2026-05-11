Copy everything between the triple backticks and paste it into the GitHub editor:
// src/lib/storage.ts
// Uses Vercel KV for storage (free tier)
// Falls back to in-memory cache if KV not configured

import type { ScrapeResult, SiteKey } from './scraper'

const memStore: Record<string, string> = {}

async function kvSet(key: string, value: string) {
  try {
    const url = process.env.KV_REST_API_URL
    const token = process.env.KV_REST_API_TOKEN
    if (!url || !token) { memStore[key] = value; return }
    await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    })
  } catch { memStore[key] = value }
}

async function kvGet(key: string): Promise<string | null> {
  try {
    const url = process.env.KV_REST_API_URL
    const token = process.env.KV_REST_API_TOKEN
    if (!url || !token) return memStore[key] || null
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return memStore[key] || null
    const data = await res.json()
    return data.result || null
  } catch { return memStore[key] || null }
}

async function kvKeys(pattern: string): Promise<string[]> {
  try {
    const url = process.env.KV_REST_API_URL
    const token = process.env.KV_REST_API_TOKEN
    if (!url || !token) return Object.keys(memStore).filter(k => k.startsWith(pattern.replace('*','')))
    const res = await fetch(`${url}/keys/${encodeURIComponent(pattern)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.result || []
  } catch { return [] }
}

export async function saveResult(siteKey: SiteKey, result: ScrapeResult) {
  const key = `smartbox:${siteKey}:${result.date}`
  const latest = `smartbox:${siteKey}:latest`
  const val = JSON.stringify(result)
  await kvSet(key, val)
  await kvSet(latest, val)
}

export async function loadResult(siteKey: SiteKey, date: string): Promise<ScrapeResult | null> {
  const raw = await kvGet(`smartbox:${siteKey}:${date}`)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function loadLatest(siteKey: SiteKey): Promise<ScrapeResult | null> {
  const raw = await kvGet(`smartbox:${siteKey}:latest`)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function loadAllLatest(): Promise<Record<string, ScrapeResult | null>> {
  const keys: SiteKey[] = ['corby', 'desborough', 'oundle', 'stamford', 'leicester']
  const results = await Promise.all(keys.map(k => loadLatest(k)))
  return Object.fromEntries(keys.map((k, i) => [k, results[i]]))
}

export async function loadHistory(siteKey: SiteKey, days = 30): Promise<ScrapeResult[]> {
  const pattern = `smartbox:${siteKey}:2*`
  const keys = await kvKeys(pattern)
  const sorted = keys.sort().reverse().slice(0, days)
  const results = await Promise.all(sorted.map(async k => {
    const raw = await kvGet(k)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }))
  return results.filter(Boolean) as ScrapeResult[]
}

export async function getYesterdayPrices(siteKey: SiteKey): Promise<Record<string, Record<number, number>>> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]
  const result = await loadResult(siteKey, dateStr)
  if (!result) return {}
  const out: Record<string, Record<number, number>> = {}
  for (const site of [result.smartbox, ...result.competitors]) {
    out[site.name] = Object.fromEntries(site.prices.map(p => [p.sqft, p.perWeek]))
  }
  return out
}
