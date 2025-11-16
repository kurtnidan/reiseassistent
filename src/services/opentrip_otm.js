// src/services/opentrip_otm.js
// Enkel klient for OpenTripMap Places API

const OTM_KEY = import.meta.env?.VITE_OPENTRIPMAP_API_KEY || ''
const API_ROOT = 'https://api.opentripmap.com/0.1/en'

if (!OTM_KEY) {
  console.warn(
    '[OpenTripMap] Mangler API-nøkkel. Sett VITE_OPENTRIPMAP_API_KEY i .env'
  )
}

/**
 * Bruk OpenTripMap sin egen geoname-tjeneste for å slå opp et sted.
 * Eks: /places/geoname?name=Almuñécar&apikey=...
 */
export async function fetchOTMGeoname(name) {
  if (!OTM_KEY) {
    throw new Error('Mangler OpenTripMap-nøkkel (.env: VITE_OPENTRIPMAP_API_KEY)')
  }
  if (!name || !name.trim()) {
    throw new Error('Tomt navn til geoname-oppslag.')
  }

  const params = new URLSearchParams({
    apikey: OTM_KEY,
    name: name.trim(),
  })

  const url = `${API_ROOT}/places/geoname?${params.toString()}`
  const resp = await fetch(url)
  const txt = await resp.text().catch(() => '')

  if (!resp.ok) {
    throw new Error(`OpenTripMap geoname-feil ${resp.status}: ${txt}`)
  }

  let data = null
  try {
    data = JSON.parse(txt)
  } catch {
    throw new Error('Klarte ikke å tolke svar fra OpenTripMap geoname.')
  }

  // Forventet: { name, lat, lon, ... }
  if (data && typeof data.lat === 'number' && typeof data.lon === 'number') {
    return {
      name: data.name || name,
      lat: data.lat,
      lon: data.lon,
    }
  }

  throw new Error('OpenTripMap fant ikke koordinater for destinasjonen.')
}

/**
 * Hent steder innen radius rundt et punkt.
 * Bruker /places/radius for å hente liste med ids (xid), navn, dist osv.
 */
export async function fetchOTMPlacesRadius({
  lat,
  lon,
  radius = 5000,
  limit = 30,
  kinds = '',
}) {
  if (!OTM_KEY) {
    throw new Error('Mangler OpenTripMap-nøkkel (.env: VITE_OPENTRIPMAP_API_KEY)')
  }
  if (lat == null || lon == null) {
    throw new Error('Mangler koordinater til OpenTripMap-søk.')
  }

  const params = new URLSearchParams({
    apikey: OTM_KEY,
    radius: String(radius),
    lon: String(lon),
    lat: String(lat),
    limit: String(limit),
    format: 'json',
    // ingen "rate" her – vi filtrerer heller i frontend
  })

  if (kinds && kinds.trim()) {
    params.set('kinds', kinds.trim())
  }

  const url = `${API_ROOT}/places/radius?${params.toString()}`
  const resp = await fetch(url)
  const txt = await resp.text().catch(() => '')

  if (!resp.ok) {
    throw new Error(`OpenTripMap radius-feil ${resp.status}: ${txt}`)
  }

  let data = null
  try {
    data = JSON.parse(txt)
  } catch {
    throw new Error('Klarte ikke å tolke svar fra OpenTripMap radius.')
  }

  return Array.isArray(data) ? data : []
}

/**
 * Hent detaljer for ett sted (beskrivelse, wikipedia, bilde osv.)
 */
export async function fetchOTMDetails(xid) {
  if (!OTM_KEY) {
    throw new Error('Mangler OpenTripMap-nøkkel (.env: VITE_OPENTRIPMAP_API_KEY)')
  }
  if (!xid) return null

  const params = new URLSearchParams({
    apikey: OTM_KEY,
  })
  const url = `${API_ROOT}/places/xid/${encodeURIComponent(xid)}?${params.toString()}`

  const resp = await fetch(url)
  const txt = await resp.text().catch(() => '')

  if (!resp.ok) {
    throw new Error(`OpenTripMap detalj-feil ${resp.status}: ${txt}`)
  }

  let data = null
  try {
    data = JSON.parse(txt)
  } catch {
    throw new Error('Klarte ikke å tolke svar fra OpenTripMap detaljer.')
  }

  return data
}
