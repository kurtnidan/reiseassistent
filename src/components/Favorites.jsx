import React from 'react'

export default function Favorites({ destination, coords, setDestination, setCoords }) {
  const [list, setList]   = React.useState([])
  const [query, setQuery] = React.useState('')
  const [sortBy, setSortBy] = React.useState(localStorage.getItem('fav:sortBy') || 'recent') // recent | name | category

  // -- Utilities --
  function load() {
    try {
      setList(JSON.parse(localStorage.getItem('fav') || '[]'))
    } catch {
      setList([])
    }
  }

  function save(next) {
    try {
      localStorage.setItem('fav', JSON.stringify(next))
      setList(next)
      // gi beskjed til andre komponenter (i tilfelle)
      window.dispatchEvent(new CustomEvent('fav:changed'))
    } catch {}
  }

  React.useEffect(() => {
    load()
    const onFav = () => load()
    const onStorage = (e) => { if (e.key === 'fav') load() }
    window.addEventListener('fav:changed', onFav)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('fav:changed', onFav)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  function clearAll() {
    if (!confirm('Slette alle favoritter?')) return
    save([])
  }

  function key(p, i) {
    return ['fav', p.name || '', p.category || '', p.map || ''].join('|') || String(i)
  }

  React.useEffect(() => { localStorage.setItem('fav:sortBy', sortBy) }, [sortBy])

  function normalizeStr(s) { return (s || '').toString().toLowerCase() }

  const filtered = React.useMemo(() => {
    const q = normalizeStr(query)
    if (!q) return list
    return list.filter(p => {
      const hay = [p.name, p.category, p.desc].map(normalizeStr).join(' ')
      return hay.includes(q)
    })
  }, [list, query])

  const sorted = React.useMemo(() => {
    if (sortBy === 'name') {
      return [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    if (sortBy === 'category') {
      const byCat = (a, b) =>
        (a.category || '').localeCompare(b.category || '') ||
        (a.name || '').localeCompare(b.name || '')
      return [...filtered].sort(byCat)
    }
    return filtered // recent: behold rekkefølgen
  }, [filtered, sortBy])

  // Slett én favoritt
  function removeOne(item) {
    const next = list.filter(
      x => !(x.name === item.name && x.category === item.category && (x.map || '') === (item.map || ''))
    )
    save(next)
  }

  // ⭐ Legg til nåværende destinasjon som favoritt
  function addCurrentDestination() {
    if (!destination || !destination.trim()) return

    const name = destination.trim()

    const newFav = {
      name,
      category: 'Destinasjon',
      desc: '',
      map: (coords && coords.lat && coords.lon)
        ? `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lon}#map=13/${coords.lat}/${coords.lon}`
        : `https://www.google.com/maps/search/${encodeURIComponent(name)}`
    }

    const exists = list.some(p =>
      p.name === newFav.name &&
      (p.category || '') === newFav.category &&
      (p.map || '') === newFav.map
    )
    if (exists) return

    // Nyeste først = legg inn først i lista
    const next = [newFav, ...list]
    save(next)
  }

  // 🔁 Klikk på favoritt → sett destinasjon (og coords hvis mulig)
  function applyFavorite(item) {
    if (!item || !item.name) return

    setDestination(item.name)

    if (item.map && item.map.includes('mlat=')) {
      try {
        const url = new URL(item.map)
        const lat = url.searchParams.get('mlat')
        const lon = url.searchParams.get('mlon')
        if (lat && lon) {
          setCoords({ lat: Number(lat), lon: Number(lon) })
        }
      } catch {
        // hvis URL-parsing feiler, gjør vi ingenting
      }
    }
  }

  // 🎨 Er gjeldende destinasjon allerede en favoritt?
  const isCurrentDestinationFavorite = React.useMemo(() => {
    const name = (destination || '').trim().toLowerCase()
    if (!name) return false
    return list.some(p => (p.name || '').trim().toLowerCase() === name)
  }, [list, destination])

  return (
    <div className="card p-3 border border-yellow-200 rounded-2xl">
      <div className="flex flex-wrap items-center gap-2 justify-between mb-2">
        <div className="text-sm font-medium">Favoritter</div>
        <div className="flex items-center gap-2">
          <input
            className="input h-8"
            placeholder="Søk (navn, kategori, beskrivelse)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Søk i favoritter"
          />
          <select
            className="select h-8"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            aria-label="Sorter favoritter"
          >
            <option value="recent">Nyeste først</option>
            <option value="name">Navn (A–Å)</option>
            <option value="category">Kategori</option>
          </select>

          {/* ⭐ Knapp: lag favoritt fra feltet "Destinasjon" */}
          <button
            className={
              'inline-flex items-center rounded-lg border px-2 py-1 text-xs ' +
              (isCurrentDestinationFavorite
                ? 'border-yellow-400 bg-yellow-50'
                : 'border-gray-200')
            }
            onClick={addCurrentDestination}
            disabled={!destination || isCurrentDestinationFavorite}
            title={
              isCurrentDestinationFavorite
                ? 'Denne destinasjonen er allerede en favoritt'
                : 'Legg nåværende destinasjon til som favoritt'
            }
          >
            {isCurrentDestinationFavorite ? '⭐ Favoritt' : `⭐ Legg til ${destination ? `"${destination}"` : 'destinasjon'}`}
          </button>

          <button
            className="inline-flex items-center rounded-lg border px-2 py-1 text-xs border-gray-200"
            onClick={clearAll}
            title="Tøm alle favoritter"
          >
            Tøm
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-xs text-gray-500">
          Ingen favoritter{query ? ' som matcher søket.' : ' ennå.'}
        </div>
      ) : (
        <ul className="space-y-2 text-sm">
          {sorted.map((p, i) => {
            // robust map-URL: bruk p.map hvis satt, ellers Google Maps-søk for destinasjoner
            const mapUrl = (p.map && String(p.map).trim())
              ? p.map
              : (p.category === 'Destinasjon' && p.name
                  ? `https://www.google.com/maps/search/${encodeURIComponent(p.name)}`
                  : null)

            return (
              <li
                key={key(p, i)}
                className="flex items-center justify-between gap-3 bg-white rounded-xl border p-2 cursor-pointer hover:bg-gray-50"
                onClick={() => applyFavorite(p)}
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    {p.category || ''}{p.desc ? ` • ${p.desc}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {mapUrl && (
                    <a
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs border-gray-200 hover:bg-gray-100"
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()} // ikke trigge applyFavorite
                      title="Åpne kart"
                    >
                      🗺 Kart
                    </a>
                  )}
                  {/* Slett-ikon */}
                  <button
                    className="inline-flex items-center rounded-lg border px-2 py-0.5 text-xs border-gray-200"
                    onClick={e => { e.stopPropagation(); removeOne(p) }}
                    title="Slett denne favoritten"
                    aria-label="Slett favoritt"
                  >
                    🗑
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
