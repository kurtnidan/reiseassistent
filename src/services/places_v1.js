// Google Places API v1 (HTTP REST)
// Krever .env i prosjektroten med: VITE_GOOGLE_API_KEY=DIN_NOKKEL
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''

function requireKey() {
  if (!GOOGLE_KEY) {
    throw new Error('VITE_GOOGLE_API_KEY mangler (.env). Aktiver også Places API i Google Cloud + Billing.')
  }
}

function mapPlace(p) {
  const name = p?.displayName?.text || p?.name || 'Uten navn'
  const rating = p?.rating ?? null
  const reviews = p?.userRatingCount ?? null
  const addr = p?.formattedAddress || ''
  const lat = p?.location?.latitude
  const lon = p?.location?.longitude
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + addr)}`
  return { name, rating, reviews, desc: addr, lat, lon, map }
}

/**
 * Nearby-søk med inkluderte typer (restaurant, cafe, etc.)
 * places:searchNearby STØTTER IKKE textQuery
 */
export async function searchNearby({
  coords,              // { lat, lon }
  includedTypes = [],  // f.eks. ['restaurant']
  radius = 2500,
  maxResultCount = 20
}) {
  requireKey()
  if (!coords?.lat || !coords?.lon) {
    throw new Error('Mangler koordinater for Nearby.')
  }

  const body = {
    maxResultCount,
    locationRestriction: {
      circle: { center: { latitude: coords.lat, longitude: coords.lon }, radius }
    }
  }
  if (includedTypes.length) body.includedTypes = includedTypes

  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      // FieldMask MÅ settes – velg kun feltene du trenger
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.location'
    },
    body: JSON.stringify(body)
  })

  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Nearby failed ${r.status}: ${text}`)
  }

  const j = await r.json()
  return (j?.places || []).map(mapPlace)
}

/**
 * Tekst-søk for ting som ikke dekkes av includedTypes (f.eks. "wine bar", "ice cream")
 * Brukes via places:searchText
 */
export async function searchText({
  coords,              // { lat, lon }
  textQuery,           // f.eks. 'wine bar'
  radius = 2500,
  maxResultCount = 20
}) {
  requireKey()
  if (!coords?.lat || !coords?.lon) {
    throw new Error('Mangler koordinater for Text-søk.')
  }
  if (!textQuery) {
    throw new Error('textQuery mangler for searchText.')
  }

  const body = {
    textQuery,
    maxResultCount,
    // Bruk locationBias for å “dra” treff nær et punkt innen en sirkel
    locationBias: {
      circle: { center: { latitude: coords.lat, longitude: coords.lon }, radius }
    }
  }

  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.location'
    },
    body: JSON.stringify(body)
  })

  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Text failed ${r.status}: ${text}`)
  }

  const j = await r.json()
  return (j?.places || []).map(mapPlace)
}
