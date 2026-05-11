'use client'

import { useEffect, useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ScrapeResult } from '@/lib/scraper'
import type { SiteKey } from '@/lib/scraper'

type Page = 'overview' | 'changes' | 'history' | 'status'

const SITE_KEYS: SiteKey[] = ['corby', 'desborough', 'oundle', 'stamford', 'leicester']
const SITE_LABELS: Record<SiteKey, string> = {
  corby: 'Corby', desborough: 'Desborough', oundle: 'Oundle', stamford: 'Stamford', leicester: 'Leicester'
}
const COMP_COLOURS = ['#c8401a', '#2563eb', '#7c3aed', '#0891b2']

const fmt = (n: number) => `£${n.toFixed(2)}`

function marketAvg(sqft: number, competitors: ScrapeResult['competitors']): number | null {
  const vals = competitors.flatMap(c => c.prices.filter(p => p.sqft === sqft).map(p => p.perWeek))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function PositionBadge({ our, avg }: { our: number; avg: number | null }) {
  if (!avg) return null
  const diff = (our - avg) / avg * 100
  if (diff > 5) return <span className="badge above">▲ +{Math.round(diff)}%</span>
  if (diff < -5) return <span className="badge below">▼ {Math.round(Math.abs(diff))}%</span>
  return <span className="badge level">≈</span>
}

const SIZE_NAMES: Record<number, string> = {
  15: 'Locker', 20: 'Locker', 25: 'Small', 35: 'Small',
  50: 'Garage', 65: 'Medium', 75: 'Medium', 100: 'Large', 150: 'XL', 200: 'XXL'
}

export default function Dashboard() {
  const [sites, setSites] = useState<Record<string, ScrapeResult | null>>({})
  const [history, setHistory] = useState<ScrapeResult[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeSite, setActiveSite] = useState<SiteKey>('corby')
  const [page, setPage] = useState<Page>('overview')

  const fetchData = useCallback(async (site?: SiteKey) => {
    const url = site ? `/api/data?site=${site}` : '/api/data'
    const res = await fetch(url)
    const json = await res.json()
    setSites(json.sites || {})
    if (json.history) setHistory(json.history)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Refetch history when site changes
  useEffect(() => {
    fetch(`/api/data?site=${activeSite}`)
      .then(r => r.json())
      .then(j => { if (j.history) setHistory(j.history) })
  }, [activeSite])

  async function triggerRefresh() {
    setRefreshing(true)
    try {
      const secret = prompt('Enter refresh secret:')
      if (!secret) return
      await fetch(`/api/scrape?secret=${secret}&site=${activeSite}`, { method: 'POST' })
      await fetchData(activeSite)
    } finally {
      setRefreshing(false)
    }
  }

  const data = sites[activeSite] as ScrapeResult | null

  // Stats for active site
  let above = 0, below = 0, level = 0
  if (data) {
    const sizes = new Set([...data.smartbox.prices.map(p => p.sqft), ...data.competitors.flatMap(c => c.prices.map(p => p.sqft))])
    sizes.forEach(size => {
      const our = data.smartbox.prices.find(p => p.sqft === size)
      const avg = marketAvg(size, data.competitors)
      if (!our || !avg) return
      const diff = (our.perWeek - avg) / avg * 100
      if (diff > 5) above++
      else if (diff < -5) below++
      else level++
    })
  }

  const todayChanges = data?.changes.filter(c => c.date === data.date) || []
  const allChanges = data?.changes || []

  // Network-wide stats (for sidebar badges)
  const totalChangesToday = SITE_KEYS.reduce((sum, k) => {
    const d = sites[k]
    return sum + (d ? d.changes.filter(c => c.date === d.date).length : 0)
  }, 0)

  // History chart
  const chartData = history.slice().reverse().map(day => {
    const pt: Record<string, any> = {
      date: new Date(day.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    }
    day.competitors.forEach(c => {
      const p50 = c.prices.find(p => p.sqft === 50)
      if (p50) pt[c.name] = p50.perWeek
    })
    const sb50 = day.smartbox.prices.find(p => p.sqft === 50)
    if (sb50) pt['Smartbox'] = sb50.perWeek
    return pt
  })

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">Smartbox</div>
      <div className="loading-sub">Loading pricing data…</div>
    </div>
  )

  const allSizes = data ? Array.from(new Set([
    ...data.smartbox.prices.map(p => p.sqft),
    ...data.competitors.flatMap(c => c.prices.map(p => p.sqft))
  ])).sort((a, b) => a - b) : []

  return (
    <div className="shell">
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        :root{
          --ink:#0d0d0d;--paper:#f4f1eb;--paper-2:#ece9e2;--paper-3:#dedad2;
          --accent:#c8401a;--green:#1a6641;--green-bg:#e8f4ee;
          --red:#c8401a;--red-bg:#fceee9;--amber:#b36a00;--amber-bg:#fff4e0;
          --mono:'DM Mono','Courier New',monospace;--display:'Syne','Georgia',serif;
        }
        body{background:var(--paper);color:var(--ink);font-family:'DM Sans',system-ui,sans-serif}
        .shell{display:grid;grid-template-columns:210px 1fr;min-height:100vh}

        /* Sidebar */
        .sidebar{background:var(--ink);padding:22px 14px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
        .logo{font-family:var(--display);font-weight:800;font-size:16px;color:white;margin-bottom:2px}
        .logo-sub{font-family:var(--mono);font-size:9px;color:#444;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:24px}
        .nav-group{font-family:var(--mono);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#333;margin:16px 0 5px;padding-left:10px}
        .nav-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 10px;border-radius:4px;border:none;background:none;color:#666;font-size:12px;cursor:pointer;text-align:left;transition:all .12s}
        .nav-btn:hover{background:#1a1a1a;color:#ccc}
        .nav-btn.active{background:var(--accent);color:white}
        .nav-btn.site-active{background:#1f1f1f;color:white}
        .nav-badge{background:#f39c12;color:white;font-size:9px;padding:1px 5px;border-radius:8px;font-family:var(--mono)}
        .sidebar-footer{margin-top:auto;padding-top:14px;border-top:1px solid #1a1a1a;font-family:var(--mono);font-size:10px;color:#333;line-height:1.8}
        .dot-ok{display:inline-block;width:6px;height:6px;border-radius:50%;background:#27ae60;margin-right:4px}

        /* Main */
        .main{padding:26px 30px}
        .page-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;gap:12px}
        .page-title{font-family:var(--display);font-size:24px;font-weight:700;letter-spacing:-0.5px}
        .page-date{font-family:var(--mono);font-size:11px;color:#888;margin-top:3px}
        .refresh-btn{padding:8px 14px;background:var(--ink);color:white;border:none;border-radius:4px;font-family:var(--mono);font-size:11px;cursor:pointer;white-space:nowrap}
        .refresh-btn:disabled{opacity:0.5}

        /* Alert */
        .alert{border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:20px;display:flex;gap:10px}
        .alert.amber{background:var(--amber-bg);border-left:4px solid #f39c12}
        .alert.green{background:var(--green-bg);border-left:4px solid #27ae60}
        .alert-title{font-size:13px;font-weight:600;margin-bottom:2px}
        .alert-body{font-size:12px;color:#666}

        /* Stats */
        .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
        .stat-card{background:white;border:1px solid var(--paper-3);border-radius:6px;padding:13px 15px}
        .stat-label{font-family:var(--mono);font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#999;margin-bottom:5px}
        .stat-value{font-family:var(--display);font-size:28px;font-weight:700;line-height:1;margin-bottom:2px}
        .stat-value.red{color:var(--red)} .stat-value.green{color:var(--green)} .stat-value.amber{color:var(--amber)} .stat-value.blue{color:#2563eb}
        .stat-sub{font-size:11px;color:#aaa}

        /* Table */
        .section-title{font-family:var(--display);font-size:14px;font-weight:600;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
        .section-tag{font-family:var(--mono);font-size:10px;color:#aaa;font-weight:400}
        .table-card{background:white;border:1px solid var(--paper-3);border-radius:6px;overflow:hidden;margin-bottom:22px;overflow-x:auto}
        table{width:100%;border-collapse:collapse}
        thead th{padding:9px 11px;background:var(--paper);font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#888;border-bottom:1px solid var(--paper-3);text-align:left;white-space:nowrap}
        thead th:not(:first-child):not(:nth-child(2)){text-align:right}
        tbody tr{border-bottom:1px solid var(--paper-2)}
        tbody tr:last-child{border-bottom:none}
        tbody tr:hover{background:var(--paper)}
        td{padding:10px 11px;font-size:13px;vertical-align:middle}
        td:not(:first-child):not(:nth-child(2)){text-align:right;font-family:var(--mono);font-size:12px;color:#555}
        .size-cell{font-family:var(--mono);font-size:12px;font-weight:500}
        .size-sub{font-size:10px;color:#bbb;display:block}
        .our-price{font-weight:600}
        .price-up{color:var(--red)!important} .price-down{color:var(--green)!important} .price-na{color:#ddd!important}
        .badge{display:inline-block;font-family:var(--mono);font-size:10px;padding:2px 6px;border-radius:3px;margin-left:5px}
        .badge.above{background:var(--red-bg);color:var(--red)} .badge.below{background:var(--green-bg);color:var(--green)} .badge.level{background:var(--paper-2);color:#888}

        /* Status */
        .status-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:22px}
        .status-card{background:white;border:1px solid var(--paper-3);border-radius:6px;padding:12px 14px;display:flex;align-items:center;gap:10px}
        .status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .status-dot.ok{background:#27ae60} .status-dot.fail{background:var(--red)}
        .status-name{font-size:13px;font-weight:500}
        .status-detail{font-family:var(--mono);font-size:10px;color:#aaa;margin-top:1px}

        /* Loading */
        .loading-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:var(--ink)}
        .loading-logo{font-family:var(--display);font-size:28px;font-weight:800;color:white;margin-bottom:8px}
        .loading-sub{font-family:var(--mono);font-size:11px;color:#444;letter-spacing:1px}

        .empty{text-align:center;padding:40px;color:#aaa;font-size:13px}
        .chart-card{background:white;border:1px solid var(--paper-3);border-radius:6px;padding:20px;margin-bottom:22px}
      `}</style>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">Smartbox</div>
        <div className="logo-sub">Pricing Intel</div>

        <div className="nav-group">Views</div>
        {(['overview','changes','history','status'] as Page[]).map(p => (
          <button key={p} className={`nav-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>
            <span>{{'overview':'▦','changes':'↕','history':'◷','status':'◉'}[p]} {p.charAt(0).toUpperCase()+p.slice(1)}</span>
          </button>
        ))}

        <div className="nav-group">Sites</div>
        {SITE_KEYS.map(k => {
          const d = sites[k]
          const changes = d ? d.changes.filter(c => c.date === d.date).length : 0
          return (
            <button key={k} className={`nav-btn ${activeSite === k ? 'site-active' : ''}`} onClick={() => setActiveSite(k)}>
              <span>{activeSite === k ? '◎' : '○'} {SITE_LABELS[k]}</span>
              {changes > 0 && <span className="nav-badge">{changes}</span>}
            </button>
          )
        })}

        <div className="sidebar-footer">
          <span className="dot-ok"></span>Live<br />
          Last scraped:<br />
          <span style={{color:'#555'}}>{data ? new Date(data.smartbox.scrapedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</span>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="page-head">
          <div>
            <div className="page-title">{SITE_LABELS[activeSite]} — {page.charAt(0).toUpperCase()+page.slice(1)}</div>
            <div className="page-date">{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
          </div>
          <button className="refresh-btn" onClick={triggerRefresh} disabled={refreshing}>
            {refreshing ? '↻ Scraping…' : '↻ Refresh prices'}
          </button>
        </div>

        {!data && (
          <div className="alert amber">
            <div>
              <div className="alert-title">No data for {SITE_LABELS[activeSite]} yet</div>
              <div className="alert-body">Click "Refresh prices" to run the first scrape.</div>
            </div>
          </div>
        )}

        {/* OVERVIEW */}
        {page === 'overview' && data && <>
          <div className={`alert ${todayChanges.length ? 'amber' : 'green'}`}>
            <div>
              <div className="alert-title">
                {todayChanges.length ? `⚡ ${todayChanges.length} price change${todayChanges.length!==1?'s':''} today` : '✓ No price changes today'}
              </div>
              <div className="alert-body">
                {todayChanges.length
                  ? todayChanges.slice(0,2).map(c=>`${c.site} ${c.sqft}sqft ${c.up?'▲':'▼'} ${fmt(c.newPw)}/wk`).join(' · ')
                  : 'All competitor prices unchanged since yesterday.'}
              </div>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card"><div className="stat-label">Above Market</div><div className="stat-value red">{above}</div><div className="stat-sub">unit sizes</div></div>
            <div className="stat-card"><div className="stat-label">Below Market</div><div className="stat-value green">{below}</div><div className="stat-sub">unit sizes</div></div>
            <div className="stat-card"><div className="stat-label">At Market</div><div className="stat-value amber">{level}</div><div className="stat-sub">unit sizes</div></div>
            <div className="stat-card"><div className="stat-label">Competitors</div><div className="stat-value blue">{data.competitors.filter(c=>c.ok).length}</div><div className="stat-sub">tracked today</div></div>
          </div>

          <div className="section-title">Price comparison <span className="section-tag">per week</span></div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Smartbox</th>
                  {data.competitors.map(c=><th key={c.name} style={{textAlign:'right'}}>{c.name}</th>)}
                  <th style={{textAlign:'right'}}>Market Avg</th>
                </tr>
              </thead>
              <tbody>
                {allSizes.map(size => {
                  const our = data.smartbox.prices.find(p=>p.sqft===size)
                  const avg = marketAvg(size, data.competitors)
                  return (
                    <tr key={size}>
                      <td className="size-cell">{size} sq ft<span className="size-sub">{SIZE_NAMES[size]||''}</span></td>
                      <td className="our-price">
                        {our ? <>{fmt(our.perWeek)}/wk <PositionBadge our={our.perWeek} avg={avg}/></> : <span className="price-na">—</span>}
                      </td>
                      {data.competitors.map(c => {
                        const p = c.prices.find(x=>x.sqft===size)
                        const ch = todayChanges.find(x=>x.site===c.name && x.sqft===size)
                        return (
                          <td key={c.name} className={ch?(ch.up?'price-up':'price-down'):p?'':'price-na'}>
                            {p ? `${ch?.up?'▲ ':ch?'▼ ':''}${fmt(p.perWeek)}/wk` : '—'}
                          </td>
                        )
                      })}
                      <td>{avg ? fmt(avg)+'/wk' : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>}

        {/* CHANGES */}
        {page === 'changes' && <>
          <div className="section-title">All recorded price changes</div>
          <div className="table-card">
            <table>
              <thead><tr><th>Date</th><th>Competitor</th><th>Size</th><th>Was</th><th></th><th>Now</th><th style={{textAlign:'right'}}>Δ</th></tr></thead>
              <tbody>
                {allChanges.length === 0
                  ? <tr><td colSpan={7} className="empty">No changes recorded yet — history builds up over time</td></tr>
                  : allChanges.map((c,i) => (
                    <tr key={i}>
                      <td style={{fontFamily:'var(--mono)',fontSize:'11px',color:'#aaa'}}>{new Date(c.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</td>
                      <td style={{fontWeight:500}}>{c.site}</td>
                      <td style={{fontFamily:'var(--mono)',fontSize:'12px'}}>{c.sqft} sqft</td>
                      <td style={{fontFamily:'var(--mono)',fontSize:'12px',color:'#aaa'}}>{fmt(c.oldPw)}/wk</td>
                      <td style={{fontSize:'16px',color:c.up?'var(--red)':'var(--green)'}}>{c.up?'▲':'▼'}</td>
                      <td style={{fontFamily:'var(--mono)',fontSize:'12px',fontWeight:600,color:c.up?'var(--red)':'var(--green)'}}>{fmt(c.newPw)}/wk</td>
                      <td style={{fontFamily:'var(--mono)',fontSize:'11px',color:'#aaa',textAlign:'right'}}>{c.up?'+':'-'}{fmt(Math.abs(c.newPw-c.oldPw))}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </>}

        {/* HISTORY */}
        {page === 'history' && <>
          <div className="section-title">Price history — 50 sq ft weekly <span className="section-tag">{SITE_LABELS[activeSite]}</span></div>
          {chartData.length < 2
            ? <div className="chart-card"><div className="empty">History builds up automatically as daily scrapes run.<br/>Check back tomorrow.</div></div>
            : <div className="chart-card">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{fontSize:10,fontFamily:'var(--mono)'}} />
                    <YAxis tick={{fontSize:10,fontFamily:'var(--mono)'}} tickFormatter={v=>`£${v}`} />
                    <Tooltip formatter={(v:any)=>`£${Number(v).toFixed(2)}/wk`} />
                    <Legend />
                    {data?.competitors.map((c,i) => (
                      <Line key={c.name} type="monotone" dataKey={c.name} stroke={COMP_COLOURS[i]} dot={false} strokeWidth={2} />
                    ))}
                    <Line type="monotone" dataKey="Smartbox" stroke="#0d0d0d" dot={false} strokeWidth={2} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
          }
        </>}

        {/* STATUS */}
        {page === 'status' && data && <>
          <div className="section-title">Scrape status — {SITE_LABELS[activeSite]}</div>
          <div className="status-grid">
            {[data.smartbox, ...data.competitors].map(s => (
              <div key={s.name} className="status-card">
                <div className={`status-dot ${s.ok?'ok':'fail'}`}></div>
                <div>
                  <div className="status-name">{s.name}</div>
                  <div className="status-detail">{s.ok ? `${s.prices.length} prices found` : `FAILED: ${s.error}`}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="section-title">Scrape log</div>
          <div className="table-card" style={{padding:'14px 16px',fontFamily:'var(--mono)',fontSize:'11px',color:'#666',lineHeight:2}}>
            {[data.smartbox, ...data.competitors].map(s => (
              <div key={s.name}>
                <span style={{color:s.ok?'#27ae60':'var(--red)'}}>● </span>
                {new Date(s.scrapedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} — {s.name} — {s.ok?`OK, ${s.prices.length} prices`:`FAILED: ${s.error}`}
              </div>
            ))}
          </div>
        </>}
      </main>
    </div>
  )
}
