// src/lib/scraper.ts
import { parse } from 'node-html-parser'

export interface PriceEntry {
  sqft: number
  perWeek: number
  perMonth: number
  raw?: string
}

export interface SiteResult {
  name: string
  url: string
  ok: boolean
  error: string
  prices: PriceEntry[]
  scrapedAt: string
}

export interface ScrapeResult {
  date: string
  site: string
  smartbox: SiteResult
  competitors: SiteResult[]
  changes: PriceChange[]
}

export interface PriceChange {
  site: string
  sqft: number
  oldPw: number
  newPw: number
  up: boolean
  date: string
}

export type SiteKey = 'corby' | 'desborough' | 'oundle' | 'stamford' | 'leicester'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export const ALL_SITES: Record<SiteKey, {
  label: string
  smartbox: { name: string; url: string }
  competitors: { name: string; url: string; scraper?: string }[]
}> = {
  corby: {
    label: 'Corby',
    smartbox: { name: 'Smartbox Corby', url: 'https://smartboxselfstorage.uk/rent-self-storage/corby-eismann-way/prices/' },
    competitors: [
      { name: 'The Storage Team', url: 'https://thestorageteam.co.uk/locations/storage-corby/' },
      { name: 'Optima Self Store', url: 'https://bookings.optimaselfstore.co.uk/sites/optima-self-store-corby-self-storage-units' },
      { name: 'Ready Steady Store', url: 'https://www.readysteadystore.com/self-storage/corby/' },
    ],
  },
  desborough: {
    label: 'Desborough',
    smartbox: { name: 'Smartbox Desborough', url: 'https://smartboxselfstorage.uk/rent-self-storage/desborough-pipewell-road/prices/' },
    competitors: [
      { name: 'The Storage Team', url: 'https://thestorageteam.co.uk/locations/storage-corby/' },
      { name: 'Storage at Sandy Hill', url: 'https://bookings.storageatsandyhill.co.uk/sites/storage-at-sandy-hill-self-storage-units' },
      { name: 'Bluebear Storage', url: 'https://bluebearstorage.co.uk/book?location=corby' },
    ],
  },
  oundle: {
    label: 'Oundle',
    smartbox: { name: 'Smartbox Oundle', url: 'https://smartboxselfstorage.uk/rent-self-storage/oundle-20-nene-valley-business-park/prices/' },
    competitors: [
      { name: 'The Storage Team', url: 'https://thestorageteam.co.uk/locations/storage-corby/' },
      { name: 'Weldon Self Storage', url: 'https://weldonselfstorage.co.uk/prices' },
      { name: '1st Access Self Storage', url: 'https://www.1staccessselfstorage.co.uk/quote/' },
    ],
  },
  stamford: {
    label: 'Stamford',
    smartbox: { name: 'Smartbox Stamford', url: 'https://smartboxselfstorage.uk/rent-self-storage/stamford-uffington-road/prices/' },
    competitors: [
      { name: 'Optima Stamford', url: 'https://bookings.optimaselfstore.co.uk/sites/stamford-self-storage-units' },
      { name: 'Rutland Self Store', url: 'https://www.rutlandselfstore.co.uk/pricing' },
    ],
  },
  leicester: {
    label: 'Leicester',
    smartbox: { name: 'Smartbox Leicester', url: 'https://smartboxselfstorage.uk/rent-self-storage/leicester-11-putney-road/prices/' },
    competitors: [
      { name: 'Safestore Leicester', url: 'https://www.safestore.co.uk/get-a-quote/?siteid=080P2DDK120820090001' },
      { name: 'Shurgard Leicester', url: 'https://www.shurgard.com/en-gb/self-storage-uk/leicester/leicester', scraper: 'shurgard' },
      { name: 'Storage Giant Leicester', url: 'https://www.storagegiant.co.uk/instant-quote/' },
    ],
  },
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      next: { revalidate: 0 }
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch (e: any) {
    return null
  }
}

function extractSmartboxPrices(html: string): PriceEntry[] {
  const root = parse(html)
  const found: Record<number, PriceEntry> = {}

  root.querySelectorAll('.current-price').forEach(priceEl => {
    const priceText = priceEl.text.trim()
    const priceM = priceText.match(/([\d,]+(?:\.\d{1,2})?)/)
    if (!priceM) return
    const price = parseFloat(priceM[1].replace(/,/g, ''))
    if (price < 2 || price > 500) return

    let node: any = priceEl
    for (let i = 0; i < 8; i++) {
      node = node?.parentNode
      if (!node) break
      const nodeText = node.text || ''
      const sizeM = nodeText.match(/(\d+(?:\.\d+)?)\s*sq\.?\s*ft/i)
      if (sizeM) {
        const sqft = Math.round(parseFloat(sizeM[1]))
        if (sqft >= 10 && sqft <= 500 && !(sqft in found)) {
          found[sqft] = { sqft, perWeek: price, perMonth: parseFloat((price * 52 / 12).toFixed(2)), raw: priceText }
        }
        break
      }
    }
  })

  if (Object.keys(found).length === 0) {
    const text = root.text.replace(/\s+/g, ' ')
    const sizeRegex = /(\d+(?:\.\d+)?)\s*sq\.?\s*ft/gi
    let m: RegExpExecArray | null
    while ((m = sizeRegex.exec(text)) !== null) {
      const sqft = Math.round(parseFloat(m[1]))
      if (sqft < 10 || sqft > 500 || sqft in found) continue
      const window = text.slice(m.index, Math.min(text.length, m.index + 300))
      const prices = [...window.matchAll(/£\s*([\d,]+(?:\.\d{1,2})?)/g)]
      if (!prices.length) continue
      const priceVals = prices.map(p => parseFloat(p[1].replace(/,/g, ''))).filter(p => p >= 2 && p <= 500)
      if (!priceVals.length) continue
      const price = Math.min(...priceVals)
      found[sqft] = { sqft, perWeek: price, perMonth: parseFloat((price * 52 / 12).toFixed(2)), raw: `£${price}` }
    }
  }

  return Object.values(found).sort((a, b) => a.sqft - b.sqft)
}

function extractShurgardPrices(html: string): PriceEntry[] {
  const root = parse(html)
  const found: Record<number, PriceEntry> = {}

  root.querySelectorAll('.price-current, [class*="price-current"]').forEach(priceEl => {
    const priceM = priceEl.text.match(/([\d,]+(?:\.\d{1,2})?)/)
    if (!priceM) return
    const price = parseFloat(priceM[1].replace(/,/g, ''))
    if (price < 2 || price > 1000) return

    let node: any = priceEl
    for (let i = 0; i < 8; i++) {
      node = node?.parentNode
      if (!node) break
      const nodeText = node.text || ''
      const sizeM = nodeText.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|m²)/i)
      if (sizeM) {
        let sqft = Math.round(parseFloat(sizeM[1]))
        if (/m²/i.test(sizeM[0])) sqft = Math.round(sqft * 10.764)
        if (sqft >= 10 && sqft <= 500 && !(sqft in found)) {
          found[sqft] = { sqft, perWeek: price, perMonth: parseFloat((price * 52 / 12).toFixed(2)), raw: priceEl.text.trim() }
        }
        break
      }
    }
  })

  return Object.values(found).sort((a, b) => a.sqft - b.sqft)
}

function extractGenericPrices(html: string): PriceEntry[] {
  const root = parse(html)
  root.querySelectorAll('script, style, noscript, s, del').forEach(el => el.remove())
  const text = root.text.replace(/\s+/g, ' ')
  const found: Record<number, PriceEntry> = {}
  const sizeRegex = /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft)/gi
  let m: RegExpExecArray | null

  while ((m = sizeRegex.exec(text)) !== null) {
    const sqft = Math.round(parseFloat(m[1]))
    if (sqft < 10 || sqft > 500 || sqft in found) continue
    const start = Math.max(0, m.index - 50)
    const end = Math.min(text.length, m.index + 300)
    const window = text.slice(start, end)
    const prices = [...window.matchAll(/£\s*([\d,]+(?:\.\d{1,2})?)/g)]
    if (!prices.length) continue
    const priceVals = prices.map(p => parseFloat(p[1].replace(/,/g, ''))).filter(p => p >= 2 && p <= 5000)
    if (!priceVals.length) continue
    const price = Math.min(...priceVals)
    const isMonthly = /per\s*month|\/month|\bmonth/i.test(window)
    const perWeek = isMonthly ? parseFloat((price * 12 / 52).toFixed(2)) : price
    const perMonth = isMonthly ? price : parseFloat((price * 52 / 12).toFixed(2))
    found[sqft] = { sqft, perWeek, perMonth, raw: `£${price}` }
  }

  return Object.values(found).sort((a, b) => a.sqft - b.sqft)
}

async function scrapeSite(name: string, url: string, scraperType?: string): Promise<SiteResult> {
  console.log(`Scraping ${name}...`)
  const result: SiteResult = { name, url, ok: false, error: '', prices: [], scrapedAt: new Date().toISOString() }
  const html = await fetchPage(url)
  if (!html) { result.error = 'Page fetch failed — site may block automated requests'; return result }

  let prices: PriceEntry[]
  if (name.toLowerCase().includes('smartbox')) {
    prices = extractSmartboxPrices(html)
  } else if (scraperType === 'shurgard' || name.toLowerCase().includes('shurgard')) {
    prices = extractShurgardPrices(html)
  } else {
    prices = extractGenericPrices(html)
  }

  if (prices.length > 0) { result.prices = prices; result.ok = true; console.log(`  ✓ ${name}: ${prices.length} prices`) }
  else { result.error = 'No prices found — site may use JavaScript rendering'; console.log(`  ✗ ${name}: no prices found`) }
  return result
}

function detectChanges(today: SiteResult[], yesterday: Record<string, Record<number, number>>): PriceChange[] {
  const changes: PriceChange[] = []
  const dateStr = new Date().toISOString().split('T')[0]
  for (const site of today) {
    const prev = yesterday[site.name] || {}
    for (const p of site.prices) {
      const old = prev[p.sqft]
      if (old !== undefined && Math.abs(old - p.perWeek) > 0.01) {
        changes.push({ site: site.name, sqft: p.sqft, oldPw: old, newPw: p.perWeek, up: p.perWeek > old, date: dateStr })
      }
    }
  }
  return changes
}

export async function scrapeSiteKey(siteKey: SiteKey, yesterday: Record<string, Record<number, number>> = {}): Promise<ScrapeResult> {
  const config = ALL_SITES[siteKey]
  const dateStr = new Date().toISOString().split('T')[0]
  const [smartbox, ...competitors] = await Promise.all([
    scrapeSite(config.smartbox.name, config.smartbox.url),
    ...config.competitors.map(c => scrapeSite(c.name, c.url, c.scraper)),
  ])
  const changes = detectChanges([smartbox, ...competitors], yesterday)
  return { date: dateStr, site: siteKey, smartbox, competitors, changes }
}

export async function scrapeAll(yesterday: Record<string, Record<string, Record<number, number>>> = {}): Promise<Record<SiteKey, ScrapeResult>> {
  const keys = Object.keys(ALL_SITES) as SiteKey[]
  const results = await Promise.all(keys.map(k => scrapeSiteKey(k, yesterday[k] || {})))
  return Object.fromEntries(keys.map((k, i) => [k, results[i]])) as Record<SiteKey, ScrapeResult>
}
