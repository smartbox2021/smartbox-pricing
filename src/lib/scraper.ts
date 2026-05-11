import { parse } from 'node-html-parser'

export type SiteKey = 'corby' | 'desborough' | 'oundle' | 'stamford' | 'leicester'

export interface PriceEntry { sqft: number; perWeek: number; perMonth: number; raw?: string }
export interface SiteResult { name: string; url: string; ok: boolean; error: string; prices: PriceEntry[]; scrapedAt: string }
export interface PriceChange { site: string; sqft: number; oldPw: number; newPw: number; up: boolean; date: string }
export interface ScrapeResult { date: string; site: string; smartbox: SiteResult; competitors: SiteResult[]; changes: PriceChange[] }

export const ALL_SITES: Record<SiteKey, { label: string; smartbox: { name: string; url: string }; competitors: { name: string; url: string }[] }> = {
  corby: { label: 'Corby', smartbox: { name: 'Smartbox Corby', url: 'https://smartboxselfstorage.uk/rent-self-storage/corby-eismann-way/prices/' }, competitors: [{ name: 'The Storage Team', url: 'https://thestorageteam.co.uk/locations/storage-corby/' }, { name: 'Optima Self Store', url: 'https://bookings.optimaselfstore.co.uk/sites/optima-self-store-corby-self-storage-units' }, { name: 'Ready Steady Store', url: 'https://www.readysteadystore.com/self-storage/corby/' }] },
  desborough: { label: 'Desborough', smartbox: { name: 'Smartbox Desborough', url: 'https://smartboxselfstorage.uk/rent-self-storage/desborough-pipewell-road/prices/' }, competitors: [{ name: 'The Storage Team', url: 'https://thestorageteam.co.uk/locations/storage-corby/' }, { name: 'Storage at Sandy Hill', url: 'https://bookings.storageatsandyhill.co.uk/sites/storage-at-sandy-hill-self-storage-units' }, { name: 'Bluebear Storage', url: 'https://bluebearstorage.co.uk/book?location=corby' }] },
  oundle: { label: 'Oundle', smartbox: { name: 'Smartbox Oundle', url: 'https://smartboxselfstorage.uk/rent-self-storage/oundle-20-nene-valley-business-park/prices/' }, competitors: [{ name: 'The Storage Team', url: 'https://thestorageteam.co.uk/locations/storage-corby/' }, { name: 'Weldon Self Storage', url: 'https://weldonselfstorage.co.uk/prices' }, { name: '1st Access Self Storage', url: 'https://www.1staccessselfstorage.co.uk/quote/' }] },
  stamford: { label: 'Stamford', smartbox: { name: 'Smartbox Stamford', url: 'https://smartboxselfstorage.uk/rent-self-storage/stamford-uffington-road/prices/' }, competitors: [{ name: 'Optima Stamford', url: 'https://bookings.optimaselfstore.co.uk/sites/stamford-self-storage-units' }, { name: 'Rutland Self Store', url: 'https://www.rutlandselfstore.co.uk/pricing' }] },
  leicester: { label: 'Leicester', smartbox: { name: 'Smartbox Leicester', url: 'https://smartboxselfstorage.uk/rent-self-storage/leicester-11-putney-road/prices/' }, competitors: [{ name: 'Safestore Leicester', url: 'https://www.safestore.co.uk/get-a-quote/?siteid=080P2DDK120820090001' }, { name: 'Shurgard Leicester', url: 'https://www.shurgard.com/en-gb/available-units?searchLocation=Leicester&type=new' }, { name: 'Storage Giant Leicester', url: 'https://www.storagegiant.co.uk/instant-quote/' }] },
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-GB', 'Cache-Control': 'no-cache' }, next: { revalidate: 0 } })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch (e: any) { return null }
}

function extractPrices(html: string): PriceEntry[] {
  const root = parse(html)
  root.querySelectorAll('script, style, noscript').forEach(el => el.remove())
  const text = root.text.replace(/\s+/g, ' ')
  const found: Record<number, PriceEntry> = {}
  const sizeRegex = /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft)/gi
  let m: RegExpExecArray | null
  while ((m = sizeRegex.exec(text)) !== null) {
    const sqft = Math.round(parseFloat(m[1]))
    if (sqft < 10 || sqft > 500 || sqft in found) continue
    const start = Math.max(0, m.index - 250)
    const end = Math.min(text.length, m.index + 250)
    const window = text.slice(start, end)
    const priceMatch = window.match(/£\s*([\d,]+(?:\.\d{1,2})?)/)
    if (!priceMatch) continue
    const price = parseFloat(priceMatch[1].replace(/,/g, ''))
    if (price < 2 || price > 5000) continue
    const isMonthly = /per\s*month|\/month|\bmonth/i.test(window)
    const perWeek = isMonthly ? parseFloat((price * 12 / 52).toFixed(2)) : price
    const perMonth = isMonthly ? price : parseFloat((price * 52 / 12).toFixed(2))
    found[sqft] = { sqft, perWeek, perMonth, raw: priceMatch[0] }
  }
  return Object.values(found).sort((a, b) => a.sqft - b.sqft)
}

async function scrapeSite(name: string, url: string): Promise<SiteResult> {
  const result: SiteResult = { name, url, ok: false, error: '', prices: [], scrapedAt: new Date().toISOString() }
  const html = await fetchPage(url)
  if (!html) { result.error = 'Page fetch failed'; return result }
  const prices = extractPrices(html)
  if (prices.length > 0) { result.prices = prices; result.ok = true }
  else { result.error = 'No prices found — may use JavaScript rendering' }
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
  const [smartbox, ...competitors] = await Promise.all([scrapeSite(config.smartbox.name, config.smartbox.url), ...config.competitors.map(c => scrapeSite(c.name, c.url))])
  const changes = detectChanges([smartbox, ...competitors], yesterday)
  return { date: dateStr, site: siteKey, smartbox, competitors, changes }
}

export async function scrapeAll(yesterday: Record<string, Record<string, Record<number, number>>> = {}): Promise<Record<SiteKey, ScrapeResult>> {
  const keys = Object.keys(ALL_SITES) as SiteKey[]
  const results = await Promise.all(keys.map(k => scrapeSiteKey(k, yesterday[k] || {})))
  return Object.fromEntries(keys.map((k, i) => [k, results[i]])) as Record<SiteKey, ScrapeResult>
}
