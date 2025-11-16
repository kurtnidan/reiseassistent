// src/components/Nearby.jsx
import React from 'react'
import FavoriteButton from './FavoriteButton.jsx'
import { nameToCoords } from '../services/geocode'

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_API_KEY // <- .env

// Små, “Apple-aktige” emoji-ikoner
const ICONS = {
  restaurant:   '🍽️',
  cafe:         '☕',
  bar:          '🍸',
  bakery:       '🥐',
  fast_food:    '🍔',
  grocery:      '🛒',
  liquor_store: '🍷',

  wine_bar:     '🍷',
  cocktail:     '🍹',
  brewery:      '🍺',
  pub:          '🍻',
  ice_cream:    '🍦',
  seafood:      '🦞',
  pizza:        '🍕',
  sushi:        '🍣',
  vegetarian:   '🥗',
}

// Radius i meter (inkl. 100 m)
const RADIUS_OPTIONS = [
  { label:'100 m', value: 100 },
  { label:'500 m', value: 500 },
  { label:'1 km',  value: 1000 },
  { label:'3 km',  value: 3000 },
  { label:'5 km',  value: 5000 },
  { label:'10 km', value: 10000 },
  { label:'30 km', value: 30000 },
  { label:'50 km', value: 50000 },
]

// Kategorier: “nearby” => places:searchNearby, “text” => places:searchText
const CATEGORIES = [
  { key:'restaurant',   label:'Restaurant',        nearby:['restaurant'] },
  { key:'cafe',         label:'Kafé',              nearby:['cafe'] },
  { key:'bar',          label:'Bar',               nearby:['bar'] },
  { key:'bakery',       label:'Bakeri',            nearby:['bakery'] },
  { key:'fast_food',    label:'Fastfood',          nearby:['meal_takeaway','restaurant'] },
  { key:'grocery',      label:'Matbutikk',         nearby:['supermarket','grocery_store','convenience_store'] },
  { key:'liquor_store', label:'Vin/Brus butikk',   nearby:['liquor_store'] },

  { key:'wine_bar',     label:'Vinbar',            text:'wine bar' },
  { key:'cocktail',     label:'Cocktailbar',       text:'cocktail bar' },
  { key:'brewery',      label:'Bryggeri',          text:'brewery' },
  { key:'pub',          label:'Pub',               text:'pub' },
  { key:'ice_cream',    label:'Iskrem',            text:'ice cream' },
  { key:'seafood',      label:'Sjømat',            text:'seafood restaurant' },
  { key:'pizza',        label:'Pizza',             text:'pizza restaurant' },
  { key:'sushi',        label:'Sushi',             text:'sushi restaurant' },
  { key:'vegetarian',   label:'Vegetar/Vegan',     text:'vegetarian OR vegan restaurant' },
]

// Sorteringsvalg (klient-side, + styrer rankPreference for Nearby)
const SORT_OPTIONS = [
  { value:'DISTANCE',      label:'Avstand' },
  { value:'POPULARITY',    label:'Popularitet' },
  { value:'RATING_DESC',   label:'Rating (høyest først)' },
  { value:'RATING_COUNT',  label:'Antall vurderinger' },
  { value:'NAME',          label:'Navn A–Å' },
]

function clamp(n,a,b){ return Math.max(a, Math.min(b, n)) }
function toRad(d){ return d * Math.PI / 180 }
function haversine(lat1, lon1, lat2, lon2){
  const R = 6371000
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.sqrt(a))
}
function fmtKm(m){ return m < 950 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km` }

// --- Lagringsnøkkel per destinasjon ---
function storageKeyFor(dest){
  return 'nearby:' + String(dest||'').trim().toLowerCase()
}

export default function Nearby({ destination='Almuñécar', coords, radius=2500 }){
  const [center, setCenter]     = React.useState(null) // { lat, lon }
  const [rad, setRad]           = React.useState(radius)
  const [sortMode, setSortMode] = React.useState('DISTANCE')
  const [loading, setLoading]   = React.useState(false)
  const [error, setError]       = React.useState('')
  const [results, setResults]   = React.useState([])

  // Flervalg (default: restaurant på)
  const defaultSelected = React.useMemo(
    ()=>Object.fromEntries(CATEGORIES.map(c => [c.key, c.key === 'restaurant'])),
    []
  )
  const [selected, setSelected] = React.useState(defaultSelected)

  // ===== 1) Last inn preferanser når destinasjon endres =====
  React.useEffect(()=>{
    const key = storageKeyFor(destination)
    try{
      const raw = localStorage.getItem(key)
      if (!raw) {
        setSelected(defaultSelected)
        setRad(radius || 2500)
        setSortMode('DISTANCE')
        return
      }
      const data = JSON.parse(raw)
      if (data && typeof data === 'object'){
        if (data.selected && typeof data.selected === 'object'){
          const nextSel = { ...defaultSelected }
          for (const k of Object.keys(nextSel)){
            if (k in data.selected) nextSel[k] = !!data.selected[k]
          }
          setSelected(nextSel)
        } else {
          setSelected(defaultSelected)
        }
        if (Number.isFinite(data.rad)) setRad(data.rad)
        else setRad(radius || 2500)
        if (typeof data.sortMode === 'string') setSortMode(data.sortMode)
        else setSortMode('DISTANCE')
      }
    }catch{
      setSelected(defaultSelected)
      setRad(radius || 2500)
      setSortMode('DISTANCE')
    }
  }, [destination, defaultSelected, radius])

  // ===== 2) Lagre preferanser når noe endres =====
  React.useEffect(()=>{
    const key = storageKeyFor(destination)
    try{
      const payload = { selected, rad, sortMode }
      localStorage.setItem(key, JSON.stringify(payload))
    }catch{}
  }, [destination, selected, rad, sortMode])

  // ===== 3) Finn koordinater: GPS → ellers geokode destinasjon =====
  React.useEffect(()=>{
    let alive = true
    async function resolveCenter(){
      setError('')
      try{
        if (coords?.lat && coords?.lon){
          if (!alive) return
          setCenter({ lat: coords.lat, lon: coords.lon })
          return
        }
        if (destination && destination.trim()){
          const g = await nameToCoords(destination.trim())
          if (!alive) return
          setCenter({ lat: g.lat, lon: g.lon })
          return
        }
        setCenter(null)
      }catch(e){
        setCenter(null)
        setError('Kunne ikke finne koordinater for destinasjonen.')
      }
    }
    resolveCenter()
    return ()=>{ alive = false }
  }, [destination, coords?.lat, coords?.lon])

  function toggleAll(on){
    const next = Object.fromEntries(CATEGORIES.map(c => [c.key, !!on]))
    setSelected(next)
  }
  function toggleKey(k){
    setSelected(prev => ({ ...prev, [k]: !prev[k] }))
  }

  async function fetchNearbyTypes(includedTypes, center, radiusM, catKey){
    const url = `https://places.googleapis.com/v1/places:searchNearby?key=${encodeURIComponent(GOOGLE_KEY)}`
    const rankPreference = (sortMode === 'POPULARITY') ? 'POPULARITY' : 'DISTANCE'
    const body = {
      includedTypes,
      maxResultCount: 20,
      rankPreference,
      locationRestriction: {
        circle: { center: { latitude:center.lat, longitude:center.lon }, radius: radiusM }
      },
      languageCode: 'no'
    }
    const resp = await fetch(url, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount'
      },
      body: JSON.stringify(body)
    })
    if (!resp.ok){
      const t = await resp.text().catch(()=> '')
      throw new Error(`Nearby failed ${resp.status}: ${t}`)
    }
    const data = await resp.json()
    return (data?.places || []).map(p => ({ __cat: catKey, place:p }))
  }

  async function fetchTextQuery(textQuery, center, radiusM, catKey){
    const url = `https://places.googleapis.com/v1/places:searchText?key=${encodeURIComponent(GOOGLE_KEY)}`
    const body = {
      textQuery,
      maxResultCount: 20,
      languageCode: 'no',
      locationBias: {
        circle: { center: { latitude:center.lat, longitude:center.lon }, radius: radiusM }
      }
    }
    const resp = await fetch(url, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount'
      },
      body: JSON.stringify(body)
    })
    if (!resp.ok){
      const t = await resp.text().catch(()=> '')
      throw new Error(`Text failed ${resp.status}: ${t}`)
    }
    const data = await resp.json()
    return (data?.places || []).map(p => ({ __cat: catKey, place:p }))
  }

  async function search(){
    setLoading(true)
    setError('')
    setResults([])

    try{
      if (!GOOGLE_KEY){ setError('Mangler Google API-nøkkel (.env: VITE_GOOGLE_API_KEY).'); return }
      if (!center?.lat || !center?.lon){ setError('Mangler koordinater (GPS eller destinasjon).'); return }

      const radiusM = clamp(Number(rad)||2500, 1, 50000)
      const active = CATEGORIES.filter(c => selected[c.key])
      if (active.length === 0){ setError('Velg minst én kategori.'); return }

      // Kjør alle valgte kategorier
      const promises = active.map(c => {
        if (c.nearby) return fetchNearbyTypes(c.nearby, center, radiusM, c.key)
        if (c.text)   return fetchTextQuery(c.text, center, radiusM, c.key)
        return Promise.resolve([])
      })

      const chunks = await Promise.all(promises)
      const rawTagged = chunks.flat() // [{__cat, place}]

      // Normaliser + avstand + link + ikon-kategori
      const mapped = rawTagged.map(({__cat, place: p})=>{
        const lat = p?.location?.latitude
        const lon = p?.location?.longitude
        const dist = (lat!=null && lon!=null) ? haversine(center.lat, center.lon, lat, lon) : null
        const link = (p?.id && lat!=null && lon!=null)
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${p.id}`
          : (lat!=null && lon!=null)
            ? `https://www.google.com/maps/?q=${lat},${lon}`
            : `https://www.google.com/maps/search/${encodeURIComponent(p?.displayName?.text || '')}`

        return {
          id: p?.id || `${p?.displayName?.text}-${lat},${lon}`,
          name: p?.displayName?.text || 'Uten navn',
          address: p?.formattedAddress || '',
          lat, lon,
          dist,
          rating: p?.rating,
          count: p?.userRatingCount,
          link,
          catKey: __cat,
          icon: ICONS[__cat] || '•'
        }
      })

      // --- HARD radiusfiltrering (løser at searchText kan returnere utenfor bias) ---
      const within = mapped.filter(it =>
        Number.isFinite(it.lat) &&
        Number.isFinite(it.lon) &&
        Number.isFinite(it.dist) &&
        it.dist <= radiusM
      )

      // Dedupliser
      const seen = new Set()
      const uniq = []
      for (const it of within){
        const key = it.id || `${it.name}-${it.lat}-${it.lon}`
        if (seen.has(key)) continue
        seen.add(key)
        uniq.push(it)
      }

      // Sortér lokalt
      let sorted = uniq.slice()
      switch (sortMode){
        case 'DISTANCE':
          sorted.sort((a,b)=>(a.dist||1e9)-(b.dist||1e9)); break
        case 'POPULARITY':
          sorted.sort((a,b)=>(b.count||0)-(a.count||0)); break
        case 'RATING_DESC':
          sorted.sort((a,b)=>(b.rating||0)-(a.rating||0)); break
        case 'RATING_COUNT':
          sorted.sort((a,b)=>(b.count||0)-(a.count||0)); break
        case 'NAME':
          sorted.sort((a,b)=>String(a.name).localeCompare(String(b.name),'no')); break
      }

      setResults(sorted)
    }catch(e){
      console.error(e)
      setError(e.message || 'Ukjent feil mot Google Places.')
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Kontroller: to spalter på store skjermer */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Kategorier (venstre) */}
        <div className="lg:col-span-3 card p-3">
          <div className="text-xs font-medium mb-2">Kategorier (flervalg)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
            {CATEGORIES.map(c=>(
              <label key={c.key} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={!!selected[c.key]}
                  onChange={()=>toggleKey(c.key)}
                />
                <span className="text-lg leading-none">{ICONS[c.key] || '•'}</span>
                <span className="text-sm">{c.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button className="btn btn-sm" onClick={()=>toggleAll(true)}>Merk alle</button>
            <button className="btn btn-sm" onClick={()=>toggleAll(false)}>Fjern alle</button>
          </div>
        </div>

        {/* Radius/Sortering/Knapp (høyre) */}
        <div className="lg:col-span-2 lg:border-l lg:pl-4 flex flex-col gap-3">
          <label className="text-xs">Radius
            <select className="select mt-1 w-full" value={rad} onChange={e=>setRad(Number(e.target.value))}>
              {RADIUS_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>

          <label className="text-xs">Sorter etter
            <select className="select mt-1 w-full" value={sortMode} onChange={e=>setSortMode(e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <button className="btn" onClick={search} disabled={loading || !center}>
            {loading ? 'Henter…' : 'Hent fra Google (Nearby)'}
          </button>

          <div className="text-[12px] text-gray-600">
            {center
              ? <>Søker rundt: <b>{center.lat?.toFixed(5)}</b>, <b>{center.lon?.toFixed(5)}</b> ({coords?.lat && coords?.lon ? 'min posisjon' : 'destinasjon'})</>
              : <>Ingen koordinater enda – skriv en destinasjon eller bruk min posisjon.</>}
          </div>
          {error && <div className="text-sm text-red-600">⚠️ {error}</div>}
        </div>
      </div>

      {/* Resultater med ikoner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {results.map(item=>(
          <div key={item.id} className="card p-3 border-sky-100">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <div className="text-xl leading-none mt-0.5">{item.icon}</div>
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-600">{item.address}</div>
                  <div className="text-xs text-gray-600 flex flex-wrap gap-x-2">
                    {item.dist!=null && <span>Avstand: {fmtKm(item.dist)}</span>}
                    {item.rating!=null && <span>Rating: {item.rating} ({item.count||0})</span>}
                  </div>
                </div>
              </div>
              <FavoriteButton item={{
                name: `${item.name}`,
                category: 'Spise & drikke',
                desc: item.address || '',
                map: item.link
              }}/>
            </div>
            <div className="mt-2 flex gap-2">
              <a className="btn" href={item.link} target="_blank" rel="noreferrer">Åpne i Google Maps</a>
            </div>
          </div>
        ))}
        {!loading && !error && results.length===0 && (
          <div className="text-sm text-gray-500">Ingen treff i dette området for valgt(e) kategori(er).</div>
        )}
      </div>
    </div>
  )
}
