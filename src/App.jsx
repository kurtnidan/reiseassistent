import React from 'react'
import Weather from './components/Weather.jsx'
import CurrencyConverter from './components/CurrencyConverter.jsx'
import Accordion from './components/Accordion.jsx'
import Population from './components/Population.jsx'
import AutoFill from './components/AutoFill.jsx'
import Nearby from './components/Nearby.jsx'
import Favorites from './components/Favorites.jsx'
import { coordsToName } from './services/geocode'
import Overnatting from './components/Overnatting.jsx'
import Trails from './components/Trails.jsx'
import AutoFillOSM from './components/AutoFillOSM.jsx'
import DestinationInput from "./components/DestinationInput.jsx"



export default function App(){
  // --- State ---
  const [destination, setDestination] = React.useState('Almuñécar')
  const [coords, setCoords] = React.useState(null) // { lat, lon }

  // 🔹 Innbyggere i toppkortet
  const [population, setPopulation] = React.useState(null) // formatert
  const [popYear, setPopYear] = React.useState(null)

  // Hjelper: last fra localStorage for gitt dest
function loadPopulationFor(dest) {
  try {
    if (!dest) {
      setPopulation(null)
      setPopYear(null)
      return
    }

    // full dest, f.eks. "almuñécar, spain"
    const raw = dest.toLowerCase()
    const rawKey = 'pop:' + raw.trim()

    // kort variant = før første komma, f.eks. "almuñécar"
    const short = raw.split(',')[0].trim()
    const shortKey = short ? 'pop:' + short : null

    const keysToTry = []
    if (rawKey.trim()) keysToTry.push(rawKey)
    if (shortKey && shortKey !== rawKey) keysToTry.push(shortKey)

    let found = null

    for (const k of keysToTry) {
      const txt = localStorage.getItem(k)
      if (!txt) continue

      try {
        const data = JSON.parse(txt)

        // prøv flere mulige feltnavn
        const n = Number(
          data.official ??
          data.value ??
          data.population
        )

        if (Number.isFinite(n) && n > 0) {
          found = {
            n,
            year: data.year || data.yearLabel || data?.source?.year || null
          }
          break
        }
      } catch (e) {
        console.error('Kunne ikke tolke innbyggertall fra key', k, e)
      }
    }

    if (found) {
      // formatér tallet med tusenskille på norsk
      setPopulation(found.n.toLocaleString('nb-NO'))
      setPopYear(found.year)
    } else {
      setPopulation(null)
      setPopYear(null)
    }
  } catch (err) {
    console.error('Feil ved lesing av innbyggertall fra localStorage', err)
    setPopulation(null)
    setPopYear(null)
  }
}


  // 🔎 Hjelpere: hent offisielt tall fra Wikidata ved navn
  async function wdSearchQidByName(name){
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&language=no&format=json&origin=*&search=${encodeURIComponent(name)}`
    const r = await fetch(url)
    if (!r.ok) throw new Error('Wikidata søk feilet')
    const j = await r.json()
    return j?.search?.[0]?.id || null
  }
  async function wdFetchLatestPopulation(qid){
    if (!qid) return null
    const entUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json?flavor=simple&origin=*`
    const r = await fetch(entUrl)
    if (!r.ok) throw new Error('Wikidata entity feilet')
    const j = await r.json()
    const entity = j?.entities?.[qid]
    const claims = entity?.claims || {}
    const pops = claims.P1082 || []
    const rows = []
    for (const c of pops){
      const mainsnak = c?.mainsnak || c
      const val = mainsnak?.datavalue?.value
      const amount = Number((val?.amount ?? val?.numericValue ?? '').toString().replace(/^\+/, ''))
      let time = c?.qualifiers?.P585?.[0]?.datavalue?.value?.time || val?.time || null
      if (time && /^[-+]\d{4}-\d{2}-\d{2}T/.test(time)) time = time.slice(1,11)
      if (Number.isFinite(amount)) rows.push({ amount, time })
    }
    if (!rows.length) return null
    rows.sort((a,b)=>{
      if (a.time && b.time) return (a.time > b.time ? -1 : (a.time < b.time ? 1 : 0))
      if (a.time) return -1
      if (b.time) return 1
      return (b.amount - a.amount)
    })
    const best = rows[0]
    return { pop: best.amount, year: best.time ? (best.time.match(/(\d{4})/)?.[1] || null) : null }
  }

  // Debounce når bruker skriver
  const debounceRef = React.useRef(null)

  // Når destinasjon endres: les fra storage, ellers hent automatisk fra Wikidata og lagre
   // 🔹 Les innbyggere fra localStorage – tåler både "Almuñécar" og
  // "Almuñécar, Comarca de la Costa Granadina, ...".
React.useEffect(() => {
  // hver gang destination endres, forsøk å lese innbyggertall
  loadPopulationFor(destination)
}, [destination])



  // Lytt på manuelle endringer fra Innbyggere
React.useEffect(() => {
  const onPopChanged = () => loadPopulationFor(destination)
  const onStorage = (e) => {
    if (e.key && e.key.startsWith('pop:')) loadPopulationFor(destination)
  }
  window.addEventListener('pop:changed', onPopChanged)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('pop:changed', onPopChanged)
    window.removeEventListener('storage', onStorage)
  }
}, [destination])

// ——— Hjelpere for å hente og lagre populasjon (Wikidata nær koordinater) ———
async function wdqs(query){
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query)
  const r = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } })
  if(!r.ok) throw new Error('WDQS failed')
  return r.json()
}

async function fetchPopulationByCoords(lat, lon){
  const q = `
    SELECT ?item ?pop ?time WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?loc .
        bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "15".
      }
      VALUES ?classes { wd:Q515 wd:Q15284 wd:Q7930989 wd:Q1549591 wd:Q1637706 wd:Q3957 }
      ?item wdt:P31/wdt:P279* ?classes .
      ?item p:P1082 ?ps .
      ?ps ps:P1082 ?pop .
      OPTIONAL { ?ps pq:P585 ?time }
    }
    ORDER BY DESC(?time) DESC(?pop)
    LIMIT 1
  `
  const j = await wdqs(q)
  const b = j.results.bindings?.[0]
  if (!b) return null
  const pop = Number(b.pop?.value)
  const year = b.time?.value ? (b.time.value.match(/\\d{4}/)?.[0] || null) : null
  return Number.isFinite(pop) ? { pop, year } : null
}

function savePopulationFor(dest, payload){
  const key = 'pop:' + (dest || '').trim().toLowerCase()
  localStorage.setItem(key, JSON.stringify(payload))
  // oppdater toppkortet + andre lyttere
  window.dispatchEvent(new CustomEvent('pop:changed', { detail: { key } }))
  window.dispatchEvent(new Event('pop:changed'))
}

async function ensurePopulationFor(dest, coords){
  // prøv lagret først
  const key = 'pop:' + (dest || '').trim().toLowerCase()
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    if (data?.official > 0) return // allerede lagret
  } catch {}
  // hent nær koordinater (mest presist når du bruker «min posisjon»)
  if (coords?.lat && coords?.lon){
    const res = await fetchPopulationByCoords(coords.lat, coords.lon).catch(()=>null)
    if (res?.pop){
      savePopulationFor(dest, {
        official: res.pop,
        seasonHigh: 0,
        pct: '50',
        source: { year: res.year || null }
      })
    }
  }
}
// Når vi har både destinasjon og koordinater, prøv å hente og lagre innbyggertall
React.useEffect(() => {
  if (!destination || !coords) return

  // forsøk å hente fra Wikidata og lagre i localStorage
  ensurePopulationFor(destination, coords).catch(err => {
    console.warn('Klarte ikke å hente innbyggertall automatisk', err)
  })
}, [destination, coords])

 // --- Handlers ---
// I App.jsx – ERSTATT hele useMyLocation med denne:
async function useMyLocation() {
  if (!navigator.geolocation) {
    alert("Nettleseren støtter ikke posisjonstjenester.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      // Sett GPS-koordinater i appen (vær, OSM, Trails, Nearby)
      setCoords({ lat, lon });

      try {
        // Reverse geocoding fra Nominatim (inkl. bydel/suburb)
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Reiseassistent" },
        });
        const data = await res.json();
        const a = data.address || {};

        // 🔹 Vi prioriterer "bydel" fremfor små steder:
        //    suburb / city_district / district brukes først
        //    neighbourhood brukes bare hvis vi ikke har bydel
        const area =
          a.suburb ||          // f.eks. Hundvåg, Cotobro
          a.city_district ||   // bydel i større byer
          a.district ||        // kommune/bydel i noen land
          a.neighbourhood ||   // lite område, f.eks. Hunstein
          "";

        const city =
          a.city ||
          a.town ||
          a.village ||
          a.municipality ||
          "";

        // Unngå duplikat som "Stavanger, Stavanger"
        let pretty = "";
        if (area && city) {
          if (area.toLowerCase() === city.toLowerCase()) {
            pretty = city;
          } else {
            pretty = `${area}, ${city}`;
          }
        } else {
          pretty = area || city || "";
        }

        // Hvis vi fant noe pent → sett destinasjon
        if (pretty.length > 0) {
          setDestination(pretty);
        } else {
          setDestination(city || "Min posisjon");
        }
      } catch (err) {
        console.warn("Reverse-geocoding feilet", err);
        setDestination("Min posisjon");
      }
    },
    () => {
      alert("Kunne ikke hente posisjon.");
    }
  );
}


  // --- Render ---
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2">
  <div className="text-xl font-semibold">Reiseassistent</div>
  <div className="flex-1" />

  <button className="btn flex items-center gap-2" onClick={useMyLocation}>
    📍 Bruk min posisjon (sted)
  </button>
  {coords && destination && (
  <div className="text-xs text-gray-600 w-full">
    Nåværende posisjon: <b>{destination}</b> ({coords.lat.toFixed(4)}, {coords.lon.toFixed(4)})
  </div>
)}

</header>


      {/* Destinasjon */}
     <section className="card p-4">
  <DestinationInput
    destination={destination}
    setDestination={setDestination}
    setCoords={setCoords}
  />
</section>


      {/* Toppkort */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Weather destination={destination} coords={coords} />

        <CurrencyConverter />

        <div className="card p-4 border-fuchsia-200 space-y-1">
          <div className="text-sm font-medium">Område</div>

          {population && (
            <div className="text-sm text-gray-700">
              Innbyggere: {population}{popYear ? ` (${popYear})` : ''}
            </div>
          )}

          <div className="text-sm text-gray-600">
            Nå: <b>{destination}</b>
          </div>
        </div>
      </section>

      {/* Favoritter */}
      <section className="card p-4 border-yellow-200">
        <Favorites />
      </section>

      {/* Innbyggere *
      <section>
        <Accordion title="Innbyggere" defaultOpen={false}>
          <div className="card p-4 border-lime-200">
            <Population destination={destination} coords={coords} />
          </div>
        </Accordion>
      </section>
      */}

      {/* Se & gjøre */}
      <section>
        <Accordion title="Wikipedia" defaultOpen={false}>
          <div className="card p-4 border-rose-200">
            <h2 className="text-lg font-medium mb-2">Wikipedia</h2>
            <AutoFill destination={destination} />
          </div>
        </Accordion>
      </section>
      {/* Se & gjøre (OpenStreetMap) */}

{/* Se & gjøre (fra OpenStreetMap) */}
<section>
  <Accordion title="Se & gjøre (OpenStreetMap)" defaultOpen={false}>
    <div className="card p-4 border-rose-200">
      <h2 className="text-lg font-medium mb-2">Se & gjøre Se & gjøre (OpenStreetMap / Geoapify)
</h2>
      <AutoFillOSM destination={destination} coords={coords} />
    </div>
  </Accordion>
</section>




<section>
  <Accordion title="Trails" defaultOpen={false}>
  <div className="card p-4 border-emerald-200">
    <Trails
      key={(destination || '').trim().toLowerCase()}  // remount ved nytt sted
      destination={destination}
      coords={coords}                                  // GPS-pos (fallback)
    />
    </div>
  </Accordion>
</section>


      {/* Spise & drikke */}
      <section>
        <Accordion title="Spise & drikke" defaultOpen={false}>
          <div className="card p-4 border-sky-200">
            <h2 className="text-lg font-medium mb-2">Spise & drikke (Nearby)</h2>
            <Nearby destination={destination} coords={coords} radius={2500} />
          </div>
        </Accordion>
      </section>

      {/* Overnatting */}
      <section>
        <Accordion title="Overnatting" defaultOpen={false}>
          <div className="card p-4 border-indigo-200">
            <Overnatting destination={destination} />
          </div>
        </Accordion>
      </section>
    </div>
  )
}
