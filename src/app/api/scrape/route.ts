// src/app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { scrapeSiteKey, scrapeAll, ALL_SITES } from '@/lib/scraper'
import type { SiteKey } from '@/lib/scraper'
import { saveResult, getYesterdayPrices } from '@/lib/storage'
import { sendDailyEmail } from '@/lib/email'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const siteParam = req.nextUrl.searchParams.get('site') as SiteKey | null

  try {
    if (siteParam && ALL_SITES[siteParam]) {
      const yesterday = await getYesterdayPrices(siteParam)
      const result = await scrapeSiteKey(siteParam, yesterday)
      await saveResult(siteParam, result)
      return NextResponse.json({ success: true, site: siteParam, prices: result.smartbox.prices.length })
    }

    console.log('Starting full scrape of all 5 sites...')
    const keys = Object.keys(ALL_SITES) as SiteKey[]
    const yesterdays = await Promise.all(keys.map(k => getYesterdayPrices(k)))
    const yesterday = Object.fromEntries(keys.map((k, i) => [k, yesterdays[i]]))

    const allResults = await scrapeAll(yesterday)

    await Promise.all(keys.map(k => saveResult(k, allResults[k])))
    await sendDailyEmail(allResults)

    const summary = keys.map(k => ({
      site: k,
      smartboxOk: allResults[k].smartbox.ok,
      smartboxPrices: allResults[k].smartbox.prices.length,
      competitors: allResults[k].competitors.map(c => ({ name: c.name, ok: c.ok, prices: c.prices.length })),
      changes: allResults[k].changes.length,
    }))

    return NextResponse.json({ success: true, summary })
  } catch (e: any) {
    console.error('Scrape error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
