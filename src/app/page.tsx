Copy everything between the triple backticks and paste it into GitHub replacing the entire page.tsx:
'use client'

import { useEffect, useState, useCallback } from 'react'

type Page = 'overview' | 'changes' | 'status'
type SiteKey = 'corby' | 'desborough' | 'oundle' | 'stamford' | 'leicester'

const SITE_KEYS: SiteKey[] = ['corby', 'desborough', 'oundle', 'stamford', 'leicester']
const SITE_LABELS: Record<SiteKey, string> = {
  corby: 'Corby', desborough: 'Desborough', oundle: 'Oundle', stamford: 'Stamford', leicester: 'Leicester'
}

const fmt = (n: number) => `£${Number(n).toFixed(2)}`

export default function Dashboard() {
  const [sites, setSites] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeSite, setActiveSite] = useState<SiteKey>('corby')
  const [page, setPage] = useState<Page>('overview')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/data')
      const json = await res.json()
      setSites(json.sites || {})
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function triggerRefresh() {
    setRefreshing(true)
    try {
      const secret = prompt('Enter refresh secret:')
      if (!secret) return
      await fetch(`/api/scrape?secret=${secret}&site=${activeSite}`, { method: 'POST' })
      await fetchData()
    } finally {
      setRefreshing(false)
    }
  }

  const data = sites[activeSite]
  const smartbox = data?.smartbox || { prices: [], ok: false }
  const competitors = data?.competitors || []
  const changes = data?.changes || []
  const todayChanges = changes.filter((c: any) => c.date === data?.date)

  const allSizes = Array.from(new Set([
    ...(smartbox.prices || []).map((p: any) => p.sqft),
    ...competitors.flatMap((c: any) => (c.prices || []).map((p: any) => p.sqft))
  ])).sort((a: any, b: any) => a - b)

  let above = 0, below = 0, level = 0
  allSizes.forEach((size: any) => {
    const our = (smartbox.prices || []).find((p: any) => p.sqft === size)
    const vals = competitors.flatMap((c: any) => (c.prices || []).filter((p: any) => p.sqft === size).map((p: any) => p.perWeek))
    if (!our || !vals.length) return
    const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length
    const diff = (our.perWeek - avg) / avg * 100
    if (diff > 5) above++
    else if (diff < -5) below++
    else level++
  })

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0d0d0d'}}>
      <div style={{fontFamily:'serif',fontSize:'28px',fontWeight:'800',color:'white',marginBottom:'8px'}}>Smartbox</div>
      <div style={{fontFamily:'monospace',fontSize:'11px',color:'#444'}}>Loading pricing data…</div>
    </div>
  )

  return (
    <div style={{display:'grid',gridTemplateColumns:'200px 1fr',minHeight:'100vh',fontFamily:'system-ui,sans-serif'}}>
      <aside style={{background:'#0d0d0d',padding:'20px 12px',display:'flex',flexDirection:'column',gap:'2px'}}>
        <div style={{fontFamily:'serif',fontWeight:'800',fontSize:'15px',color:'white',marginBottom:'2px'}}>Smartbox</div>
        <div style={{fontFamily:'monospace',fontSize:'9px',color:'#444',letterSpacing:'1px',marginBottom:'24px'}}>PRICING INTEL</div>

        <div style={{fontFamily:'monospace',fontSize:'9px',color:'#333',letterSpacing:'1px',margin:'12px 0 4px 8px'}}>VIEWS</div>
        {(['overview','changes','status'] as Page[]).map(p => (
          <button key={p} onClick={() => setPage(p)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'4px',border:'none',background:page===p?'#c8401a':'none',color:page===p?'white':'#666',fontSize:'12px',cursor:'pointer',textAlign:'left',width:'100%'}}>
            {p.charAt(0).toUpperCase()+p.slice(1)}
          </button>
        ))}

        <div style={{fontFamily:'monospace',fontSize:'9px',color:'#333',letterSpacing:'1px',margin:'12px 0 4px 8px'}}>SITES</div>
        {SITE_KEYS.map(k => (
          <button key={k} onClick={() => setActiveSite(k)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 10px',borderRadius:'4px',border:'none',background:activeSite===k?'#1f1f1f':'none',color:activeSite===k?'white':'#555',fontSize:'12px',cursor:'pointer',textAlign:'left',width:'100%'}}>
            <span>{SITE_LABELS[k]}</span>
            {(sites[k]?.changes||[]).filter((c:any)=>c.date===sites[k]?.date).length > 0 && (
              <span style={{background:'#f39c12',color:'white',fontSize:'9px',padding:'1px 5px',borderRadius:'8px'}}>
                {(sites[k]?.changes||[]).filter((c:any)=>c.date===sites[k]?.date).length}
              </span>
            )}
          </button>
        ))}

        <div style={{marginTop:'auto',paddingTop:'14px',borderTop:'1px solid #1a1a1a',fontFamily:'monospace',fontSize:'10px',color:'#333',lineHeight:'1.8'}}>
          <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:'#27ae60',marginRight:'4px'}}></span>Live<br/>
          Last scraped:<br/>
          <span style={{color:'#444'}}>{data ? new Date(smartbox.scrapedAt||Date.now()).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</span>
        </div>
      </aside>

      <main style={{padding:'26px 30px',background:'#f4f1eb'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'22px'}}>
          <div>
            <div style={{fontFamily:'serif',fontSize:'24px',fontWeight:'700'}}>{SITE_LABELS[activeSite]} — {page.charAt(0).toUpperCase()+page.slice(1)}</div>
            <div style={{fontFamily:'monospace',fontSize:'11px',color:'#888',marginTop:'3px'}}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
          </div>
          <button onClick={triggerRefresh} disabled={refreshing} style={{padding:'8px 14px',background:'#0d0d0d',color:'white',border:'none',borderRadius:'4px',fontFamily:'monospace',fontSize:'11px',cursor:'pointer'}}>
            {refreshing ? '↻ Scraping…' : '↻ Refresh prices'}
          </button>
        </div>

        {!data && (
          <div style={{background:'#fff4e0',borderLeft:'4px solid #f39c12',padding:'12px 16px',borderRadius:'0 6px 6px 0',marginBottom:'20px',fontSize:'13px',color:'#b36a00'}}>
            No data for {SITE_LABELS[activeSite]} yet — click "Refresh prices" to run the first scrape.
          </div>
        )}

        {page === 'overview' && data && <>
          <div style={{background:todayChanges.length?'#fff4e0':'#e8f4ee',borderLeft:`4px solid ${todayChanges.length?'#f39c12':'#27ae60'}`,padding:'12px 16px',borderRadius:'0 6px 6px 0',marginBottom:'20px',fontSize:'13px'}}>
            <strong>{todayChanges.length ? `⚡ ${todayChanges.length} price change${todayChanges.length!==1?'s':''} today` : '✓ No price changes today'}</strong>
            {todayChanges.length > 0 && <div style={{fontSize:'12px',marginTop:'2px',color:'#666'}}>{todayChanges.slice(0,2).map((c:any)=>`${c.site} ${c.sqft}sqft ${fmt(c.newPw)}/wk`).join(' · ')}</div>}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'22px'}}>
            {[['Above Market',above,'#c0392b'],['Below Market',below,'#27ae60'],['At Market',level,'#b36a00'],['Competitors',competitors.filter((c:any)=>c.ok).length,'#2563eb']].map(([label,val,color]) => (
              <div key={label as string} style={{background:'white',border:'1px solid #dedad2',borderRadius:'6px',padding:'13px 15px'}}>
                <div style={{fontFamily:'monospace',fontSize:'9px',letterSpacing:'1px',color:'#999',marginBottom:'5px'}}>{label as string}</div>
                <div style={{fontFamily:'serif',fontSize:'28px',fontWeight:'700',color:color as string,lineHeight:'1'}}>{val as number}</div>
              </div>
            ))}
          </div>

          <div style={{fontFamily:'serif',fontSize:'14px',fontWeight:'600',marginBottom:'10px'}}>Price comparison <span style={{fontFamily:'monospace',fontSize:'10px',color:'#aaa',fontWeight:'400'}}>per week</span></div>
          <div style={{background:'white',border:'1px solid #dedad2',borderRadius:'6px',overflow:'hidden',marginBottom:'22px',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  <th style={{padding:'9px 11px',background:'#f4f1eb',fontFamily:'monospace',fontSize:'10px',letterSpacing:'1px',color:'#888',borderBottom:'1px solid #dedad2',textAlign:'left'}}>Size</th>
                  <th style={{padding:'9px 11px',background:'#f4f1eb',fontFamily:'monospace',fontSize:'10px',letterSpacing:'1px',color:'#0d0d0d',borderBottom:'1px solid #dedad2',textAlign:'left'}}>Smartbox</th>
                  {competitors.map((c:any) => <th key={c.name} style={{padding:'9px 11px',background:'#f4f1eb',fontFamily:'monospace',fontSize:'10px',letterSpacing:'1px',color:'#888',borderBottom:'1px solid #dedad2',textAlign:'right',whiteSpace:'nowrap'}}>{c.name}</th>)}
                  <th style={{padding:'9px 11px',background:'#f4f1eb',fontFamily:'monospace',fontSize:'10px',letterSpacing:'1px',color:'#888',borderBottom:'1px solid #dedad2',textAlign:'right'}}>Avg</th>
                </tr>
              </thead>
              <tbody>
                {allSizes.map((size:any) => {
                  const our = (smartbox.prices||[]).find((p:any) => p.sqft === size)
                  const compPrices = competitors.map((c:any) => (c.prices||[]).find((p:any) => p.sqft === size))
                  const vals = compPrices.filter(Boolean).map((p:any) => p.perWeek)
                  const avg = vals.length ? vals.reduce((a:number,b:number)=>a+b,0)/vals.length : null
                  let badge = ''
                  if (our && avg) {
                    const diff = (our.perWeek - avg) / avg * 100
                    if (diff > 5) badge = ` ▲+${Math.round(diff)}%`
                    else if (diff < -5) badge = ` ▼${Math.round(Math.abs(diff))}%`
                    else badge = ' ≈'
                  }
                  return (
                    <tr key={size} style={{borderBottom:'1px solid #ece9e2'}}>
                      <td style={{padding:'10px 11px',fontFamily:'monospace',fontSize:'12px',fontWeight:'500'}}>{size} sq ft</td>
                      <td style={{padding:'10px 11px',fontWeight:'600',fontSize:'13px'}}>{our ? `${fmt(our.perWeek)}/wk${badge}` : '—'}</td>
                      {compPrices.map((p:any, i:number) => {
                        const ch = todayChanges.find((c:any) => c.site === competitors[i]?.name && c.sqft === size)
                        return (
                          <td key={i} style={{padding:'10px 11px',textAlign:'right',fontFamily:'monospace',fontSize:'12px',color:ch?(ch.up?'#c0392b':'#27ae60'):'#555'}}>
                            {p ? `${ch?.up?'▲ ':ch?'▼ ':''}${fmt(p.perWeek)}/wk` : '—'}
                          </td>
                        )
                      })}
                      <td style={{padding:'10px 11px',textAlign:'right',fontFamily:'monospace',fontSize:'11px',color:'#aaa'}}>{avg ? fmt(avg)+'/wk' : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>}

        {page === 'changes' && (
          <div style={{background:'white',border:'1px solid #dedad2',borderRadius:'6px',overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {['Date','Competitor','Size','Was','','Now','Δ'].map(h => <th key={h} style={{padding:'9px 11px',background:'#f4f1eb',fontFamily:'monospace',fontSize:'10px',color:'#888',borderBottom:'1px solid #dedad2',textAlign:'left'}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {changes.length === 0 ? (
                  <tr><td colSpan={7} style={{padding:'32px',textAlign:'center',color:'#aaa',fontSize:'13px'}}>No changes yet — history builds up over time</td></tr>
                ) : changes.map((c:any, i:number) => (
                  <tr key={i} style={{borderBottom:'1px solid #ece9e2'}}>
                    <td style={{padding:'9px 11px',fontFamily:'monospace',fontSize:'11px',color:'#aaa'}}>{c.date}</td>
                    <td style={{padding:'9px 11px',fontWeight:'500'}}>{c.site}</td>
                    <td style={{padding:'9px 11px',fontFamily:'monospace',fontSize:'12px'}}>{c.sqft} sqft</td>
                    <td style={{padding:'9px 11px',fontFamily:'monospace',fontSize:'12px',color:'#aaa'}}>{fmt(c.oldPw)}/wk</td>
                    <td style={{fontSize:'16px',color:c.up?'#c0392b':'#27ae60'}}>{c.up?'▲':'▼'}</td>
                    <td style={{padding:'9px 11px',fontFamily:'monospace',fontSize:'12px',fontWeight:'600',color:c.up?'#c0392b':'#27ae60'}}>{fmt(c.newPw)}/wk</td>
                    <td style={{padding:'9px 11px',fontFamily:'monospace',fontSize:'11px',color:'#aaa'}}>{c.up?'+':'-'}{fmt(Math.abs(c.newPw-c.oldPw))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {page === 'status' && data && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            {[smartbox, ...competitors].map((s:any) => (
              <div key={s.name} style={{background:'white',border:'1px solid #dedad2',borderRadius:'6px',padding:'12px 14px',display:'flex',alignItems:'center',gap:'10px'}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:s.ok?'#27ae60':'#c0392b',flexShrink:0}}></div>
                <div>
                  <div style={{fontSize:'13px',fontWeight:'500'}}>{s.name}</div>
                  <div style={{fontFamily:'monospace',fontSize:'10px',color:'#aaa',marginTop:'1px'}}>{s.ok?`${(s.prices||[]).length} prices found`:`FAILED: ${s.error||'no prices found'}`}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
