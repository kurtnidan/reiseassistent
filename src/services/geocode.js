// src/services/geocode.js
// Bruker OpenStreetMap Nominatim til geokoding og reverse-geokoding.
// Ingen API-nøkkel trengs, men ikke spam altfor mye :)

const BASE = 'https://nominatim.openstreetmap.org'

async function fetchJson(url) {
  const resp = await fetch(url, {
    headers: {
      // Nominatim liker at klienten identifiserer seg
      'Accept': 'application/json',
      'User-Agent': 'reiseassistent-demo/1.0'
    }
  })
  if (!resp.ok) {
    throw new Error(`Nominatim-feil ${resp.status}`)
  }
  return resp.json()
}

// Navn → koordinater
export async function nameToCoords(name) {
  const q = (name || '').trim()
  if (!q) throw new Error('Tom destinasjon')

  const url =
    `${BASE}/search?format=jsonv2&limit=1&q=` +
    encodeURIComponent(q)

  const data = await fetchJson(url)
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Fant ikke sted i OpenStreetMap')
  }

  const first = data[0]
  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    name: first.display_name
  }
}

// Koordinater → "pent" stedsnavn
export async function coordsToName(lat, lon) {
  const url =
    `${BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`

  const data = await fetchJson(url)

  // Prøv å finne noe kort & hyggelig
  const addr = data.address || {}
  const pieces = [
    addr.city,
    addr.town,
    addr.village,
    addr.suburb,
    addr.municipality
  ].filter(Boolean)

  const place =
    pieces[0] ||
    data.name ||
    data.display_name ||
    `${lat.toFixed(4)}, ${lon.toFixed(4)}`

  return { name: place, raw: data }
}
