// src/lib/email.ts
import nodemailer from 'nodemailer'
import type { ScrapeResult } from './scraper'
import type { SiteKey } from './scraper'
import { ALL_SITES } from './scraper'

const fmt = (n: number) => `£${n.toFixed(2)}`

function positionBadge(ourPw: number, compPws: number[]): string {
  if (!compPws.length) return ''
  const avg = compPws.reduce((a, b) => a + b, 0) / compPws.length
  const diff = (ourPw - avg) / avg * 100
  if (diff > 5) return `<span style="background:#fceee9;color:#c0392b;padding:2px 7px;border-radius:3px;font-size:11px">▲ +${Math.round(diff)}%</span>`
  if (diff < -5) return `<span style="background:#e8f4ee;color:#1a6641;padding:2px 7px;border-radius:3px;font-size:11px">▼ ${Math.round(diff)}%</span>`
  return `<span style="background:#f0f0f0;color:#888;padding:2px 7px;border-radius:3px;font-size:11px">≈</span>`
}

function buildSiteSection(siteKey: SiteKey, data: ScrapeResult): string {
  const { smartbox, competitors, changes, date } = data
  const todayChanges = changes.filter(c => c.date === date)
  const label = ALL_SITES[siteKey].label

  const allSizes = Array.from(new Set([
    ...smartbox.prices.map(p => p.sqft),
    ...competitors.flatMap(c => c.prices.map(p => p.sqft))
  ])).sort((a, b) => a - b)

  const compHeaders = competitors.map(c =>
    `<th style="padding:8px 10px;background:#f8f9fa;text-align:right;font-size:11px;color:#888;white-space:nowrap">${c.name}</th>`
  ).join('')

  const rows = allSizes.map(size => {
    const our = smartbox.prices.find(p => p.sqft === size)
    const compPs = competitors.map(c => c.prices.find(p => p.sqft === size))
    const validPws = compPs.filter(Boolean).map(p => p!.perWeek)

    const ourCell = our
      ? `<td style="padding:8px 10px;font-weight:600;font-size:13px">${fmt(our.perWeek)}/wk ${positionBadge(our.perWeek, validPws)}</td>`
      : `<td style="padding:8px 10px;color:#ccc">—</td>`

    const compCells = compPs.map((p, i) => {
      if (!p) return `<td style="padding:8px 10px;text-align:right;color:#ccc">—</td>`
      const ch = todayChanges.find(c => c.site === competitors[i].name && c.sqft === size)
      const colour = ch ? (ch.up ? '#c0392b' : '#1a6641') : '#555'
      const arrow = ch ? (ch.up ? '▲ ' : '▼ ') : ''
      return `<td style="padding:8px 10px;text-align:right;font-size:12px;font-family:monospace;color:${colour}">${arrow}${fmt(p.perWeek)}/wk</td>`
    }).join('')

    const avg = validPws.length ? validPws.reduce((a, b) => a + b, 0) / validPws.length : null
    return `
    <tr style="border-bottom:1px solid #f5f5f5">
      <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:#777">${size} sqft</td>
      ${ourCell}
      ${compCells}
      <td style="padding:8px 10px;text-align:right;font-size:11px;font-family:monospace;color:#bbb">${avg ? fmt(avg) + '/wk' : '—'}</td>
    </tr>`
  }).join('')

  const changesNote = todayChanges.length
    ? `<span style="background:#fff8e1;color:#b36a00;padding:2px 8px;border-radius:3px;font-size:11px;margin-left:8px">⚡ ${todayChanges.length} change${todayChanges.length !== 1 ? 's' : ''}</span>`
    : `<span style="background:#e8f4ee;color:#1a6641;padding:2px 8px;border-radius:3px;font-size:11px;margin-left:8px">✓ no changes</span>`

  const statusPills = [smartbox, ...competitors].map(s =>
    `<span style="background:${s.ok ? '#27ae60' : '#c0392b'};color:white;font-size:10px;padding:1px 7px;border-radius:8px;margin-right:3px">${s.name.replace('Smartbox ', '')}: ${s.ok ? 'OK' : 'FAIL'}</span>`
  ).join('')

  return `
  <div style="margin-bottom:32px">
    <h2 style="font-size:16px;font-weight:700;color:#0d0d0d;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #0d0d0d">
      ${label} ${changesNote}
    </h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="padding:8px 10px;background:#f8f9fa;text-align:left;font-size:11px;color:#888">Size</th>
          <th style="padding:8px 10px;background:#f8f9fa;text-align:left;font-size:11px;color:#0d0d0d">Smartbox</th>
          ${compHeaders}
          <th style="padding:8px 10px;background:#f8f9fa;text-align:right;font-size:11px;color:#888">Avg</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:8px 0 0;font-size:10px;color:#ccc">${statusPills}</p>
  </div>`
}

export function buildEmailHtml(allData: Record<SiteKey, ScrapeResult>): string {
  const todayFmt = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const keys = Object.keys(allData) as SiteKey[]

  // Top summary: total changes today
  const totalChanges = keys.reduce((sum, k) => {
    const d = allData[k]
    return sum + d.changes.filter(c => c.date === d.date).length
  }, 0)

  const siteSections = keys.map(k => buildSiteSection(k, allData[k])).join('<hr style="border:none;border-top:1px solid #eee;margin:0 0 32px">')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="max-width:720px;margin:20px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

  <div style="background:#0d0d0d;padding:26px 28px">
    <p style="margin:0;color:#555;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-family:monospace">Smartbox Self Storage</p>
    <h1 style="margin:6px 0 0;color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px">Daily Pricing Report — All Sites</h1>
    <p style="margin:6px 0 0;color:#555;font-size:12px;font-family:monospace">${todayFmt}</p>
    ${totalChanges > 0
      ? `<p style="margin:10px 0 0;color:#f39c12;font-size:12px;font-family:monospace">⚡ ${totalChanges} price change${totalChanges !== 1 ? 's' : ''} across all sites today</p>`
      : `<p style="margin:10px 0 0;color:#27ae60;font-size:12px;font-family:monospace">✓ No price changes today</p>`
    }
  </div>

  <div style="padding:28px">
    ${siteSections}
  </div>
</div>
</body>
</html>`
}

export async function sendDailyEmail(allData: Record<SiteKey, ScrapeResult>): Promise<void> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  const to = process.env.EMAIL_TO || 'alex@smartboxselfstorage.uk,roger@smartboxselfstorage.uk'

  if (!user || !pass) {
    console.log('Email not configured — skipping. Set GMAIL_USER and GMAIL_APP_PASSWORD.')
    return
  }

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  await transporter.sendMail({
    from: `Smartbox Pricing <${user}>`,
    to,
    subject: `Smartbox — All Sites Pricing Report ${dateStr}`,
    html: buildEmailHtml(allData),
  })

  console.log(`Email sent to ${to}`)
}
