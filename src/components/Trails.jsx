// src/components/Trails.jsx
import React from 'react'
import FavoriteButton from './FavoriteButton.jsx'
import { nameToCoords } from '../services/geocode'

const RADIUS_OPTIONS = [
  { label:'500 m',  value: 500 },
  { label:'1 km',   value: 1000 },
  { label:'3 km',   value: 3000 },
  { label:'5 km',   value: 5000 },
  { label:'10 km',  value: 10000 },
  { label:'30 km',  value: 30000 },
  { label:'50 km',  value: 50000 },
]

const ACTIVITY = [
  { value:'hike', label:'Fottur' },
  { value:'mtb',  label:'Terrengsykkel' },
  { value:'road', label:'Landevei (sykkel)' },
  { value:'run',  label:'Løping' },
]

function lsKey(dest){ return 'trails:' + (dest||'').trim().toLowerCase() }
function metersToKm(m){ return Math.max(0.1, (Number(m)||1000)/1000) }
const fmt = (n)=> Number(n).toFixed(6)

// Tåler komma eller punktum og litt whitespace
function parseCoord(input){
  if (input == null) return NaN
  const s = String(input).trim().replace(',', '.')
  // støtt ev. grader-format veldig enkelt: 59°55' -> ta leading float
  const match = s.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : NaN
}

function zoomForWaymarked(m){
  const r = Number(m)||5000
  if (r <=   800) return 16
  if (r <=  1500) return 15
  if (r <=  3000) return 14
  if (r <=  6000) return 13
  if (r <= 12000) return 12
  if (r <= 25000) return 11
  if (r <= 40000) return 10
  if (r <= 60000) return 9
  return 8
}

// Norgeskart-zoom (unngå “200 m”-fella)
function zoomForNorgeskart(m){
  const r = Number(m)||5000
  if (r <=   500) return 16   // ~300 m
  if (r <=  1000) return 15   // ~600 m
  if (r <=  3000) return 14   // ~1.2 km
  if (r <=  5000) return 12   // ~5–6 km
  if (r <= 10000) return 11   // ~10–12 km
  if (r <= 30000) return 9    // ~40–50 km
  return 8                    // ~80–100 km
}

function stravaLayer(a){ return a === 'run' ? 'run' : 'ride' } // hike→run, mtb/road→ride

export default function Trails({ destination='Almuñécar', coords }){
  const [radius, setRadius]       = React.useState(5000)
  const [activity, setActivity]   = React.useState('hike')

  // Kildevalg: dest/gps/custom
  const [source, setSource]       = React.useState('dest')
  const [customLat, setCustomLat] = React.useState('')
  const [customLon, setCustomLon] = React.useState('')
  const [customErr, setCustomErr] = React.useState('')

  // Sted vi faktisk bruker (lat, lon)
  const [center, setCenter]       = React.useState(null)

  const storageKey = lsKey(destination)

  // last preferanser per dest (radius/aktivitet)
  React.useEffect(()=>{
    try{
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      if (saved?.radius) setRadius(saved.radius)
      if (saved?.activity) setActivity(saved.activity)
    }catch{}
  }, [storageKey])

  // Finn sted basert på kilde
  React.useEffect(()=>{
    let alive = true
    async function resolve(){
      try{
        setCustomErr('')
        if (source === 'custom'){
          const lat = parseCoord(customLat)
          const lon = parseCoord(customLon)
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            setCenter({ lat, lon }); return
          } else { setCenter(null); return }
        }
        if (source === 'dest'){
          if (destination && destination.trim()){
            const g = await nameToCoords(destination.trim())
            if (!alive) return
            setCenter({ lat: g.lat, lon: g.lon })
            return
          }
          // fallback til gps hvis dest tom
          if (coords?.lat && coords?.lon){ setCenter({ lat: coords.lat, lon: coords.lon }); return }
          setCenter(null); return
        }
        // source === 'gps'
        if (coords?.lat && coords?.lon){ setCenter({ lat: coords.lat, lon: coords.lon }); return }
        // fallback til dest hvis gps mangler
        if (destination && destination.trim()){
          const g = await nameToCoords(destination.trim())
          if (!alive) return
          setCenter({ lat: g.lat, lon: g.lon })
          return
        }
        setCenter(null)
      }catch{
        setCenter(null)
      }
    }
    resolve()
    return ()=>{ alive = false }
  }, [source, destination, coords?.lat, coords?.lon, customLat, customLon])

  // lagre radius/aktivitet
  React.useEffect(()=>{
    try{ localStorage.setItem(storageKey, JSON.stringify({ radius, activity })) }catch{}
  }, [storageKey, radius, activity])

  // effektive verdier
  const km     = metersToKm(radius)
  const zoomWM = zoomForWaymarked(radius)
  const zoomNK = zoomForNorgeskart(radius)
  const qEnc   = encodeURIComponent(destination || '')
  const lat    = center?.lat
  const lon    = center?.lon

  // Waymarked først
  const wmBase = (activity === 'hike' || activity === 'run')
    ? 'https://hiking.waymarkedtrails.org/#'
    : 'https://cycling.waymarkedtrails.org/#'
  const waymarkedUrl = (lat!=null && lon!=null)
    ? `${wmBase}?map=${zoomWM}!${fmt(lat)}!${fmt(lon)}`
    : wmBase

  // UT.no: kart hvis coords; ellers søk
  const utnoUrl = (lat!=null && lon!=null)
    ? `https://ut.no/kart?lat=${fmt(lat)}&lng=${fmt(lon)}&zoom=${zoomWM}`
    : `https://ut.no/sok?q=${qEnc}`

  // Norgeskart: lon før lat + markør
  const norgeskartUrl = (lat!=null && lon!=null)
    ? `https://norgeskart.no/#!?zoom=${zoomNK}` +
      `&lon=${fmt(lon)}&lat=${fmt(lat)}` +
      `&markerLon=${fmt(lon)}&markerLat=${fmt(lat)}` +
      `&markerIcon=0&showSelection=false`
    : `https://norgeskart.no/#!?sok=${qEnc}`

  // AllTrails: følger ALLTID destinasjon (tekst)
  const allTrailsUrl = `https://www.alltrails.com/explore?search=true&query=${qEnc}`
  // Ekstra: “nær valgt posisjon” via GMaps-søk (for GPS/custom)
  const allTrailsNearUrl = (lat!=null && lon!=null)
    ? `https://www.google.com/maps/search/${encodeURIComponent('alltrails near ' + fmt(lat) + ',' + fmt(lon))}`
    : allTrailsUrl

  // Komoot
  const komootSport = activity === 'hike' ? 'hike'
                    : activity === 'run'  ? 'run'
                    : activity === 'road' ? 'roadbike'
                    : 'mtb'
  const komootUrl = `https://www.komoot.com/discover?query=${qEnc}&sport=${komootSport}`

  // Google Maps (søk radius)
  const gQuery = activity === 'hike' ? `hiking trails within ${km} km of ${destination}`
               : activity === 'run'  ? `running routes within ${km} km of ${destination}`
               : activity === 'road' ? `road cycling routes within ${km} km of ${destination}`
               : `mountain bike trails within ${km} km of ${destination}`
  const gmapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(gQuery)}`

  // Strava Heatmap
  const stravaAct = (activity === 'run' ? 'run' : 'ride')
  const stravaUrl = (lat!=null && lon!=null)
    ? `https://www.strava.com/heatmap#${zoomWM}.00/${lat}/${lon}/hot/${stravaAct}`
    : 'https://www.strava.com/heatmap'

  // Favoritter
  const desc = `${ACTIVITY.find(a=>a.value===activity)?.label || 'Tur'} • radius ~ ${Math.round(km)} km`
  const favWaymarked  = { name:`Waymarked – ${destination}`,     category:'Trails', desc, map: waymarkedUrl }
  const favUT         = { name:`UT.no – ${destination}`,          category:'Trails', desc, map: utnoUrl }
  const favNorgeskart = { name:`Norgeskart – ${destination}`,     category:'Trails', desc, map: norgeskartUrl }
  const favAllTrails  = { name:`AllTrails – ${destination}`,      category:'Trails', desc, map: allTrailsUrl }
  const favAllTrailsN = { name:`AllTrails (nær posisjon)`,        category:'Trails', desc, map: allTrailsNearUrl }
  const favKomoot     = { name:`Komoot – ${destination}`,         category:'Trails', desc, map: komootUrl }
  const favGoogle     = { name:`Google Maps – ${destination}`,     category:'Trails', desc, map: gmapsUrl }
  const favStrava     = { name:`Strava Heatmap – ${destination}`,  category:'Trails', desc, map: stravaUrl }

  // Hjelpere
  function pasteGpsIntoCustom(){
    if (coords?.lat && coords?.lon){
      setCustomLat(String(coords.lat).replace('.', ','))
      setCustomLon(String(coords.lon).replace('.', ','))
      setSource('custom')
    } else {
      alert('Ingen GPS-posisjon tilgjengelig. Bruk “Bruk min posisjon” først.')
    }
  }

  function applyCustom(){
    const la = parseCoord(customLat)
    const lo = parseCoord(customLon)
    if (!Number.isFinite(la) || !Number.isFinite(lo)){
      setCustomErr('Ugyldig koordinat. Skriv f.eks. 59,9139 og 10,7522')
      return
    }
    setCustomErr('')
    setSource('custom')
    setCenter({ lat: la, lon: lo })
  }

  function onCustomKey(e){
    if (e.key === 'Enter') applyCustom()
  }

  return (
    <div className="space-y-3">
      {/* Kontroller */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        <label className="text-xs">Aktivitet
          <select className="select mt-1 w-full" value={activity} onChange={e=>setActivity(e.target.value)}>
            {ACTIVITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>

        <label className="text-xs">Radius
          <select className="select mt-1 w-full" value={radius} onChange={(e)=>setRadius(Number(e.target.value))}>
            {RADIUS_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>

        {/* Kildevalg */}
        <label className="text-xs">Kilde (destinasjon)
          <select className="select mt-1 w-full" value={source} onChange={e=>setSource(e.target.value)}>
            <option value="dest">Destinasjon</option>
            <option value="gps">GPS-posisjon</option>
            <option value="custom">Egne koordinater</option>
          </select>
        </label>

        {/* Vis/skriv koordinater */}
        <div className="text-xs">
          <div className="mb-1 text-gray-600">
            {center
              ? <>Destinasjon brukt: <b>{center.lat?.toFixed(5)}</b>, <b>{center.lon?.toFixed(5)}</b></>
              : <>Destinasjon brukt: <b>ukjent</b></>}
          </div>

          {source === 'custom' ? (
            <div className="space-y-1">
              <div className="flex gap-1">
                <input
                  className="input w-full"
                  placeholder="Lat (f.eks. 59,9139)"
                  value={customLat}
                  onChange={e=>setCustomLat(e.target.value)}
                  onKeyDown={onCustomKey}
                  inputMode="decimal"
                />
                <input
                  className="input w-full"
                  placeholder="Lon (f.eks. 10,7522)"
                  value={customLon}
                  onChange={e=>setCustomLon(e.target.value)}
                  onKeyDown={onCustomKey}
                  inputMode="decimal"
                />
              </div>
              {customErr && <div className="text-[11px] text-red-600">{customErr}</div>}
              <div className="flex gap-1">
                <button className="btn" onClick={applyCustom}>Bruk disse koordinatene</button>
                <button className="btn" onClick={pasteGpsIntoCustom}>Lim inn min GPS</button>
              </div>
              <div className="text-[11px] text-gray-500">Tips: Du kan bruke komma eller punktum som desimaltegn.</div>
            </div>
          ) : (
            <div className="flex gap-1">
              <button className="btn" onClick={()=>setSource('custom')}>Skriv inn egne koordinater</button>
              <button className="btn" onClick={pasteGpsIntoCustom}>Lim inn min GPS</button>
            </div>
          )}
        </div>
      </div>

      {/* Kort/lenker – Waymarked først */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <div className="card p-3 border-lime-200">
          <div className="text-sm font-medium mb-2">Waymarked Trails</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={waymarkedUrl} target="_blank" rel="noreferrer">Åpne Waymarked</a>
            <FavoriteButton item={favWaymarked} />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Kartlag for {activity==='hike'||activity==='run'?'fotturer':'sykkelruter'} sentrert på valgt destinasjon.
          </div>
        </div>

        <div className="card p-3 border-emerald-200">
          <div className="text-sm font-medium mb-2">UT.no (DNT)</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={utnoUrl} target="_blank" rel="noreferrer">
              {lat!=null ? 'Åpne kart (UT.no)' : 'Søk på UT.no'}
            </a>
            <FavoriteButton item={favUT} />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {lat!=null ? 'Direkte til kart for valgt destinasjon.' : 'Søkeresultater – velg kart derfra.'}
          </div>
        </div>

        <div className="card p-3 border-sky-200">
          <div className="text-sm font-medium mb-2">Norgeskart</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={norgeskartUrl} target="_blank" rel="noreferrer">
              {lat!=null ? 'Åpne kart (Norgeskart)' : 'Søk i Norgeskart'}
            </a>
            <FavoriteButton item={favNorgeskart} />
          </div>
          <div className="text:[11px] text-gray-500 mt-1">
            {lat!=null ? 'Kart sentrert + markør i riktig posisjon.' : 'Søk på destinasjon i kartet.'}
          </div>
        </div>

        <div className="card p-3 border-teal-200">
          <div className="text-sm font-medium mb-2">AllTrails (destinasjon)</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={allTrailsUrl} target="_blank" rel="noreferrer">Åpne AllTrails</a>
            <FavoriteButton item={favAllTrails} />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Søk basert på destinasjonsnavn (alltid).</div>
        </div>

        <div className="card p-3 border-teal-200">
          <div className="text-sm font-medium mb-2">AllTrails (nær posisjon)</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={allTrailsNearUrl} target="_blank" rel="noreferrer">
              Åpne (nær valgt posisjon)
            </a>
            <FavoriteButton item={favAllTrailsN} />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Bruker Google Maps-søk rundt posisjon (nyttig ved GPS/Egne koordinater).
          </div>
        </div>

        <div className="card p-3 border-fuchsia-200">
          <div className="text-sm font-medium mb-2">Komoot Discover</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={komootUrl} target="_blank" rel="noreferrer">Åpne Komoot</a>
            <FavoriteButton item={favKomoot} />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Filtrer på sport i Komoot.</div>
        </div>

        <div className="card p-3 border-rose-200">
          <div className="text-sm font-medium mb-2">Google Maps (søk)</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={gmapsUrl} target="_blank" rel="noreferrer">Åpne Google Maps</a>
            <FavoriteButton item={favGoogle} />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Søkestreng inkluderer radius i tekst.</div>
        </div>

        <div className="card p-3 border-indigo-200">
          <div className="text-sm font-medium mb-2">Strava Heatmap</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={stravaUrl} target="_blank" rel="noreferrer">Åpne Strava</a>
            <FavoriteButton item={favStrava} />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Krever innlogging. Viser aktivitetstetthet.</div>
        </div>
      </div>
    </div>
  )
}
