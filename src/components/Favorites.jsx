import React from 'react'

export default function Favorites(){
  const [list,setList]   = React.useState([])
  const [query,setQuery] = React.useState('')
  const [sortBy,setSortBy] = React.useState(localStorage.getItem('fav:sortBy') || 'recent') // recent | name | category

  // -- Utilities --
  function load(){
    try { setList(JSON.parse(localStorage.getItem('fav')||'[]')) }catch{ setList([]) }
  }
  function save(next){
    try {
      localStorage.setItem('fav', JSON.stringify(next))
      setList(next)
      // gi beskjed til andre komponenter (i tilfelle)
      window.dispatchEvent(new CustomEvent('fav:changed'))
    } catch {}
  }

  React.useEffect(()=>{
    load()
    const onFav = ()=> load()
    const onStorage = (e)=> { if (e.key==='fav') load() }
    window.addEventListener('fav:changed', onFav)
    window.addEventListener('storage', onStorage)
    return ()=>{
      window.removeEventListener('fav:changed', onFav)
      window.removeEventListener('storage', onStorage)
    }
  },[])

  function clearAll(){
    if (!confirm('Slette alle favoritter?')) return
    save([])
  }

  function key(p,i){
    return ['fav', p.name||'', p.category||'', p.map||''].join('|') || String(i)
  }

  React.useEffect(()=>{ localStorage.setItem('fav:sortBy', sortBy) }, [sortBy])
  function normalizeStr(s){ return (s||'').toString().toLowerCase() }

  const filtered = React.useMemo(()=>{
    const q = normalizeStr(query)
    if (!q) return list
    return list.filter(p => {
      const hay = [p.name, p.category, p.desc].map(normalizeStr).join(' ')
      return hay.includes(q)
    })
  }, [list, query])

  const sorted = React.useMemo(()=>{
    if (sortBy === 'name') {
      return [...filtered].sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    }
    if (sortBy === 'category') {
      const byCat = (a,b)=> (a.category||'').localeCompare(b.category||'') || (a.name||'').localeCompare(b.name||'')
      return [...filtered].sort(byCat)
    }
    return filtered // recent: behold rekkefølgen
  }, [filtered, sortBy])

  // Slett én favoritt
  function removeOne(item){
    const next = list.filter(x => !(x.name===item.name && x.category===item.category && (x.map||'')===(item.map||'')))
    save(next)
  }

  return (
    <div className="card p-3 border border-yellow-200 rounded-2xl">
      <div className="flex flex-wrap items-center gap-2 justify-between mb-2">
        <div className="text-sm font-medium">Favoritter</div>
        <div className="flex items-center gap-2">
          <input
            className="input h-8"
            placeholder="Søk (navn, kategori, beskrivelse)"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            aria-label="Søk i favoritter"
          />
          <select
            className="select h-8"
            value={sortBy}
            onChange={e=>setSortBy(e.target.value)}
            aria-label="Sorter favoritter"
          >
            <option value="recent">Nyeste først</option>
            <option value="name">Navn (A–Å)</option>
            <option value="category">Kategori</option>
          </select>
          <button
            className="inline-flex items-center rounded-lg border px-2 py-1 text-xs border-gray-200"
            onClick={clearAll}
            title="Tøm alle favoritter"
          >
            Tøm
          </button>
        </div>
      </div>

      {sorted.length===0 ? (
        <div className="text-xs text-gray-500">Ingen favoritter{query ? ' som matcher søket.' : ' ennå.'}</div>
      ) : (
        <ul className="space-y-2 text-sm">
          {sorted.map((p,i)=>(
            <li
              key={key(p,i)}
              className="flex items-center justify-between gap-3 bg-white rounded-xl border p-2"
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">
                  {p.category || ''}{p.desc ? ` • ${p.desc}` : ''}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {p.map && (
                  <a
                    className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs border-gray-200"
                    href={p.map}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {p.category === 'Overnatting' ? 'Åpne' : 'Kart'}
                  </a>
                )}
                {/* Slett-ikon */}
                <button
                  className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs border-gray-200"
                  onClick={()=>removeOne(p)}
                  title="Slett denne favoritten"
                  aria-label="Slett favoritt"
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
