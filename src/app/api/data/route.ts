// src/app/api/data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { loadAllLatest, loadHistory } from '@/lib/storage'
import type { SiteKey } from '@/lib/scraper'

export async function GET(req: NextRequest) {
  const siteParam = req.nextUrl.searchParams.get('site') as SiteKey | null

  const [allLatest, history] = await Promise.all([
    loadAllLatest(),
    siteParam ? loadHistory(siteParam, 30) : Promise.resolve([]),
  ])

  return NextResponse.json({ sites: allLatest, history })
}
