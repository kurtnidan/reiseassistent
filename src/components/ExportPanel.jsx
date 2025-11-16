
import React from 'react'
import { useFavorites } from '../context/FavoritesContext'
import { downloadText } from '../utils/download'
import jsPDF from 'jspdf'
import { buildMapsRoute } from '../utils/route'
import { t } from '../i18n/strings'

function readPop(destination){ try{ const raw=localStorage.getItem('pop:'+destination); if(!raw) return null; return JSON.parse(raw) }catch{ return null } }
function makeMarkdown(destination, favorites){
  const groups = favorites.reduce((acc,it)=>{ const g=it.category||it.type||'Other'; (acc[g]=acc[g]||[]).push(it); return acc },{})
  let md = `# Favorites – ${destination}\n\n`
  const pop = readPop(destination); if(pop&&(pop.low||pop.high)) md += `**Residents:** ${pop.low||0}–${pop.high||0} (season)\n\n`
  for(const [group,items] of Object.entries(groups)){
    md += `## ${group}\n`
    for(const it of items){ const meta=[]; if(it.price) meta.push(it.price); if(it.rating) meta.push(`${it.rating}/5`); const metaStr=meta.length?` (${meta.join(' • ')})`:''; md += `- **${it.name}**${metaStr}${it.desc?` — ${it.desc}`:''}\n` }
    md += `\n`
  }
  return md
}
export default function ExportPanel({ destination='Almuñécar', origin=null }){
  const { items, clear } = useFavorites()
  function exportMd(){ downloadText(`favorites-${destination}.md`, makeMarkdown(destination, items)) }
  function exportPdf(){ const doc=new jsPDF({unit:'pt',format:'a4'}); const md=makeMarkdown(destination,items); const lines=doc.splitTextToSize(md.replace(/\*/g,''),520); doc.setFont('helvetica','normal'); doc.setFontSize(12); doc.text(lines,40,60); doc.save(`favorites-${destination}.pdf`) }
  function openFavRoute(){ const pts=items.filter(i=>i.lat&&i.lon).slice(0,10); if(pts.length<2) return alert('Need at least 2 favorites with coordinates.'); const url=buildMapsRoute({origin,points:pts}); if(!url) return alert('Could not build route.'); window.open(url,'_blank','noopener') }
  return (<div className="card p-4">
    <div className="flex items-center justify-between mb-2"><h3 className="font-medium">{t('favorites')}</h3><button onClick={clear} className="badge border-gray-200">Clear</button></div>
    {items.length===0? <div className="text-sm text-gray-500">{t('empty_favs')}</div> :
      <><ul className="text-sm text-gray-800 list-disc ml-5 mb-3">{items.map((it,i)=><li key={i}>{it.name} <span className="text-xs text-gray-500">• {it.category||it.type||'Other'}</span></li>)}</ul>
      <div className="flex gap-2 flex-wrap"><button onClick={exportMd} className="btn">{t('export_md')}</button><button onClick={exportPdf} className="btn">{t('export_pdf')}</button><button onClick={openFavRoute} className="btn">{t('open_route_favs')}</button></div></>}
  </div>)
}
