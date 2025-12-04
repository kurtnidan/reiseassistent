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

// 🔑 Nøkler / klientnavn
const ENTUR_ENDPOINT = 'https://api.entur.io/journey-planner/v3/graphql'
const ENTUR_CLIENT_NAME = 'reiseassistent-kurt'
const GOOGLE_PLACES_KEY = 'AIzaSyAgJ1Ed13ORa6nq__9S91gWVvFkerOw5C0' // (ikke i bruk nå – CORS)

// 🎯 Smart busstopp: Entur (Norge) → gir kandidat, som vi senere sammenligner med OSM
async function fetchNearestBusStopSmart(lat, lon, country, distanceKmFn) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const countryName = (country || '').toLowerCase();
  const isNorway =
    countryName.includes('norge') ||
    countryName.includes('norway');

  if (!isNorway) return null; // Entur kun i Norge

  try {
    const query = `
      query NearestStops($lat: Float!, $lon: Float!, $radius: Int!) {
        nearest: nearest(
          latitude: $lat,
          longitude: $lon,
          maximumDistance: $radius,
          filterByPlaceTypes: [STOP_PLACE, QUAY]
        ) {
          edges {
            node {
              distance
              place {
                ... on StopPlace {
                  id
                  name
                  latitude
                  longitude
                }
                ... on Quay {
                  id
                  name
                  latitude
                  longitude
                }
              }
            }
          }
        }
      }
    `;
    const body = JSON.stringify({
      query,
      variables: { lat, lon, radius: 3000 }, // 3 km radius
    });

    const res = await fetch(ENTUR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ET-Client-Name': ENTUR_CLIENT_NAME,
      },
      body,
    });

    if (!res.ok) {
      console.warn('Entur svarte med status', res.status);
      return null;
    }

    const json = await res.json();
    const edges = json?.data?.nearest?.edges || [];
    const first = edges[0]?.node;
    const place = first?.place;

    if (!place || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
      return null;
    }

    const dKm = first.distance != null
      ? first.distance / 1000
      : distanceKmFn(lat, lon, place.latitude, place.longitude);

    return {
      name: place.name || 'Busstopp',
      distanceKm: dKm != null ? dKm : null,
      lat: place.latitude,
      lon: place.longitude,
    };
  } catch (e) {
    console.warn('Entur busstopp feilet', e);
    return null;
  }
}

export default function App() {
  // --- State ---
  const [destination, setDestination] = React.useState(() => {
    try {
      return localStorage.getItem('destination') || 'Almuñécar'
    } catch {
      return 'Almuñécar'
    }
  })

  const [coords, setCoords] = React.useState(null) // { lat, lon }

  // 🔹 Innbyggere i toppkortet
  const [population, setPopulation] = React.useState(null) // formatert
  const [popYear, setPopYear] = React.useState(null)

  // 🔹 Ekstra info til "Område"-kortet
  const [geoInfo, setGeoInfo] = React.useState({
    country: '',
    region: '',
    flagUrl: '',
    lat: null,
    lon: null,
  })

  const [miniWeather, setMiniWeather] = React.useState(null) // { temp, icon }
  const [areaExtra, setAreaExtra] = React.useState({
    elevation: null,
    sunrise: '',
    sunset: '',
    aqi: null,
    nearestBeach: null,      // { name, distanceKm, lat, lon }
    nearestShop: null,       // { name, distanceKm, lat, lon }
    nearestBus: null,        // { name, distanceKm, lat, lon }
    topPlaces: [],           // [{ name, distanceKm, lat, lon }]
  })

  // 🔁 Husk siste destinasjon i localStorage
  React.useEffect(() => {
    try {
      if (destination) {
        localStorage.setItem('destination', destination)
      } else {
        localStorage.removeItem('destination')
      }
    } catch {
      // ignorer hvis localStorage ikke er tilgjengelig
    }
  }, [destination])

  // Hjelper: last fra localStorage for gitt dest
  function loadPopulationFor(dest) {
    try {
      if (!dest) {
        setPopulation(null)
        setPopYear(null)
        return
      }

      const raw = dest.toLowerCase()
      const rawKey = 'pop:' + raw.trim()

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

          // 👉 bruk bare nytt felt "official" – ignorer gamle value/population
          const n = Number(data.official)
          if (!Number.isFinite(n) || n <= 0) continue

          found = {
            n,
            year: data.year || data.yearLabel || data?.source?.year || null
          }
          break
        } catch (e) {
          console.error('Kunne ikke tolke innbyggertall fra key', k, e)
        }
      }

      if (found) {
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
  async function wdSearchQidByName(name) {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&language=no&format=json&origin=*&search=${encodeURIComponent(name)}`
    const r = await fetch(url)
    if (!r.ok) throw new Error('Wikidata søk feilet')
    const j = await r.json()
    return j?.search?.[0]?.id || null
  }

  async function wdFetchLatestPopulation(qid) {
    if (!qid) return null
    const entUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json?flavor=simple&origin=*`
    const r = await fetch(entUrl)
    if (!r.ok) throw new Error('Wikidata entity feilet')
    const j = await r.json()
    const entity = j?.entities?.[qid]
    const claims = entity?.claims || {}
    const pops = claims.P1082 || []
    const rows = []
    for (const c of pops) {
      const mainsnak = c?.mainsnak || c
      const val = mainsnak?.datavalue?.value
      const amount = Number((val?.amount ?? val?.numericValue ?? '').toString().replace(/^\+/, ''))
      let time = c?.qualifiers?.P585?.[0]?.datavalue?.value?.time || val?.time || null
      if (time && /^[-+]\d{4}-\d{2}-\d{2}T/.test(time)) time = time.slice(1, 11)
      if (Number.isFinite(amount)) rows.push({ amount, time })
    }
    if (!rows.length) return null
    rows.sort((a, b) => {
      if (a.time && b.time) return (a.time > b.time ? -1 : (a.time < b.time ? 1 : 0))
      if (a.time) return -1
      if (b.time) return 1
      return (b.amount - a.amount)
    })
    const best = rows[0]
    return { pop: best.amount, year: best.time ? (best.time.match(/(\d{4})/)?.[1] || null) : null }
  }

  // Debounce (ikke brukt direkte nå, men beholdes)
  const debounceRef = React.useRef(null)

  // Når destinasjon endres: les fra storage + hent geo-info
  React.useEffect(() => {
    loadPopulationFor(destination)

    if (!destination || !destination.trim()) {
      setGeoInfo({ country: '', region: '', flagUrl: '', lat: null, lon: null })
      setMiniWeather(null)
      setAreaExtra({
        elevation: null,
        sunrise: '',
        sunset: '',
        aqi: null,
        nearestBeach: null,
        nearestShop: null,
        nearestBus: null,
        topPlaces: [],
      })
      return
    }

    ; (async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          destination
        )}&addressdetails=1&limit=1`
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Reiseassistent' },
        })
        if (!r.ok) {
          setGeoInfo({ country: '', region: '', flagUrl: '', lat: null, lon: null })
          return
        }
        const data = await r.json()
        const first = data[0]
        const a = first?.address || {}

        const country = a.country || ''
        const region =
          a.state ||
          a.region ||
          a.county ||
          a.province ||
          ''

        const cc = (a.country_code || '').toLowerCase()
        const flagUrl = cc
          ? `https://flagcdn.com/40x30/${cc}.png`
          : ''

        const lat = first?.lat ? Number(first.lat) : null
        const lon = first?.lon ? Number(first.lon) : null

        setGeoInfo({ country, region, flagUrl, lat, lon })
      } catch (e) {
        console.warn('Klarte ikke å hente geo-info for område', e)
        setGeoInfo({ country: '', region: '', flagUrl: '', lat: null, lon: null })
      }
    })()
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
  async function wdqs(query) {
    const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query)
    const r = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } })
    if (!r.ok) throw new Error('WDQS failed')
    return r.json()
  }

  async function fetchPopulationByCoords(lat, lon) {
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
    const year = b.time?.value ? (b.time.value.match(/\d{4}/)?.[0] || null) : null
    return Number.isFinite(pop) ? { pop, year } : null
  }

  function savePopulationFor(dest, payload) {
    const key = 'pop:' + (dest || '').trim().toLowerCase()
    localStorage.setItem(key, JSON.stringify(payload))
    window.dispatchEvent(new CustomEvent('pop:changed', { detail: { key } }))
    window.dispatchEvent(new Event('pop:changed'))
  }

  // 👉 NY LOGIKK: først forsøk Wikidata med navn, så fallback på koordinater
  async function ensurePopulationFor(dest, coords) {
    const key = 'pop:' + (dest || '').trim().toLowerCase()

    // 1) Har vi allerede et "official"-tall lagret? Da gjør vi ingenting
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}')
      if (Number.isFinite(Number(data.official)) && data.official > 0) return
    } catch { }

    const raw = (dest || '').trim()
    if (!raw) return

    const cityName = raw.split(',')[0].trim()
    let result = null

    // 2) Primærstrategi: Wikidata søk på bynavn
    try {
      const qid = await wdSearchQidByName(cityName)
      if (qid) {
        const p = await wdFetchLatestPopulation(qid)
        if (p?.pop) {
          result = p
        }
      }
    } catch (e) {
      console.warn('Wikidata-navnesøk feilet', e)
    }

    // 3) Fallback: hvis navnesøk feiler, prøv nær koordinater
    if (!result && coords?.lat && coords?.lon) {
      try {
        const byCoords = await fetchPopulationByCoords(coords.lat, coords.lon)
        if (byCoords?.pop) {
          result = byCoords
        }
      } catch (e) {
        console.warn('Wikidata nær koordinater feilet', e)
      }
    }

    // 4) Lagre hvis vi fant noe
    if (result?.pop) {
      savePopulationFor(dest, {
        official: result.pop,
        seasonHigh: 0,
        pct: '50',
        source: { year: result.year || null }
      })
    }
  }

  React.useEffect(() => {
    if (!destination || !coords) return
    ensurePopulationFor(destination, coords).catch(err => {
      console.warn('Klarte ikke å hente innbyggertall automatisk', err)
    })
  }, [destination, coords])

  // 🔹 Haversine – avstand i km
  function distanceKm(lat1, lon1, lat2, lon2) {
    if (
      typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
      typeof lat2 !== 'number' || typeof lon2 !== 'number'
    ) return null

    const R = 6371
    const toRad = (x) => x * Math.PI / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // 🔹 Hent vær + sol + høyde + AQI + nærmeste POIs for destinasjon
  React.useEffect(() => {
    // 1) Velg hvilke koordinater vi skal bruke:
    const baseLat = coords?.lat ?? geoInfo.lat;
    const baseLon = coords?.lon ?? geoInfo.lon;

    if (!baseLat || !baseLon) {
      setMiniWeather(null);
      setAreaExtra({
        elevation: null,
        sunrise: '',
        sunset: '',
        aqi: null,
        nearestBeach: null,
        nearestShop: null,
        nearestBus: null,
        topPlaces: [],
      });
      return;
    }

    (async () => {
      try {
        // 1) Vær + soloppgang/solnedgang
        const forecastUrl =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${baseLat}&longitude=${baseLon}` +
          `&current_weather=true` +
          `&daily=sunrise,sunset` +
          `&timezone=auto`;

        const fr = await fetch(forecastUrl);
        if (fr.ok) {
          const j = await fr.json();
          const cw = j.current_weather;
          const daily = j.daily || {};

          if (cw) {
            const code = cw.weathercode;
            const icon =
              code < 3 ? '☀️' :
              code < 50 ? '⛅' :
              code < 70 ? '🌧️' :
              '🌩️';
            setMiniWeather({ temp: cw.temperature, icon });
          } else {
            setMiniWeather(null);
          }

          let sunriseTxt = '';
          let sunsetTxt = '';
          if (daily.sunrise && daily.sunrise[0]) {
            const d = new Date(daily.sunrise[0]);
            sunriseTxt = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
          }
          if (daily.sunset && daily.sunset[0]) {
            const d = new Date(daily.sunset[0]);
            sunsetTxt = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
          }

          setAreaExtra(prev => ({
            ...prev,
            sunrise: sunriseTxt,
            sunset: sunsetTxt,
          }));
        }

        // 2) Høyde over havet
        try {
          const elevUrl = `https://api.open-meteo.com/v1/elevation?latitude=${baseLat}&longitude=${baseLon}`;
          const er = await fetch(elevUrl);
          if (er.ok) {
            const ej = await er.json();
            const val = ej?.elevation?.[0];
            setAreaExtra(prev => ({
              ...prev,
              elevation: Number.isFinite(Number(val)) ? Number(val) : null,
            }));
          }
        } catch (e) {
          console.warn('Klarte ikke å hente høyde', e);
        }

        // 3) Luftkvalitet (AQI)
        try {
          const aqUrl =
            `https://air-quality-api.open-meteo.com/v1/air-quality` +
            `?latitude=${baseLat}&longitude=${baseLon}` +
            `&hourly=us_aqi`;
          const ar = await fetch(aqUrl);
          if (ar.ok) {
            const aj = await ar.json();
            const hours = aj?.hourly || {};
            const aqiArr = hours.us_aqi || [];
            const lastIndex = aqiArr.length ? aqiArr.length - 1 : -1;
            const aqi = lastIndex >= 0 && aqiArr[lastIndex] != null
              ? Number(aqiArr[lastIndex])
              : null;

            setAreaExtra(prev => ({
              ...prev,
              aqi: Number.isFinite(aqi) ? aqi : null,
            }));
          }
        } catch (e) {
          console.warn('Klarte ikke å hente luftkvalitet', e);
        }

        // 4) OSM-POIs via Overpass (strand, butikk, buss, top 3 ting å gjøre)
        const overpass = async (query) => {
          const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
          const r = await fetch(url);
          if (!r.ok) return null;
          return r.json();
        };

        const pickNearest = (elements) => {
          if (!Array.isArray(elements) || !elements.length) return null;
          let best = null;
          for (const el of elements) {
            const elLat = el.lat ?? el.center?.lat;
            const elLon = el.lon ?? el.center?.lon;
            const d = distanceKm(baseLat, baseLon, elLat, elLon);
            if (!Number.isFinite(d)) continue;
            const name = el.tags?.name || 'Uten navn';
            if (!best || d < best.distanceKm) {
              best = {
                name,
                distanceKm: d,
                lat: elLat,
                lon: elLon,
              };
            }
          }
          return best;
        };

        const pickTopPlaces = (elements, max = 3) => {
          if (!Array.isArray(elements) || !elements.length) return [];
          const enriched = [];
          for (const el of elements) {
            const name = el.tags?.name;
            if (!name) continue;

            const elLat = el.lat ?? el.center?.lat;
            const elLon = el.lon ?? el.center?.lon;
            const d = distanceKm(baseLat, baseLon, elLat, elLon);
            if (!Number.isFinite(d)) continue;
            enriched.push({ name, distanceKm: d, lat: elLat, lon: elLon });
          }
          enriched.sort((a, b) => a.distanceKm - b.distanceKm);
          return enriched.slice(0, max);
        };

        const radius = 5000; // meter

        // Nærmeste strand
        try {
          const beachQuery = `
            [out:json][timeout:25];
            (
              node["natural"="beach"](around:${radius},${baseLat},${baseLon});
              way["natural"="beach"](around:${radius},${baseLat},${baseLon});
              relation["natural"="beach"](around:${radius},${baseLat},${baseLon});
            );
            out center 20;
          `;
          const bj = await overpass(beachQuery);
          const nearestBeach = pickNearest(bj?.elements || []);
          setAreaExtra(prev => ({ ...prev, nearestBeach }));
        } catch (e) {
          console.warn('Klarte ikke å hente strand fra OSM', e);
        }

        // Nærmeste butikk (supermarked)
        try {
          const shopQuery = `
            [out:json][timeout:25];
            (
              node["shop"="supermarket"](around:${radius},${baseLat},${baseLon});
              way["shop"="supermarket"](around:${radius},${baseLat},${baseLon});
            );
            out center 20;
          `;
          const sj = await overpass(shopQuery);
          const nearestShop = pickNearest(sj?.elements || []);
          setAreaExtra(prev => ({ ...prev, nearestShop }));
        } catch (e) {
          console.warn('Klarte ikke å hente butikk fra OSM', e);
        }

        // Nærmeste bussholdeplass – Entur + OSM, velg faktisk nærmeste
        try {
          // Entur-kandidat (kun Norge)
          const enturCandidate = await fetchNearestBusStopSmart(baseLat, baseLon, geoInfo.country, distanceKm);

          // OSM-kandidat
          const busQuery = `
            [out:json][timeout:25];
            (
              node["highway"="bus_stop"](around:${radius},${baseLat},${baseLon});
              node["public_transport"="platform"]["bus"="yes"](around:${radius},${baseLat},${baseLon});
            );
            out 40;
          `;
          const bj2 = await overpass(busQuery);
          const osmCandidate = pickNearest(bj2?.elements || []);

          const normalize = (c) => {
            if (!c) return null;
            const d = c.distanceKm ?? distanceKm(baseLat, baseLon, c.lat, c.lon);
            if (!Number.isFinite(d)) return null;
            return { ...c, distanceKm: d };
          };

          const eNorm = normalize(enturCandidate);
          const oNorm = normalize(osmCandidate);

          let best = null;
          if (eNorm && oNorm) {
            best = eNorm.distanceKm <= oNorm.distanceKm ? eNorm : oNorm;
          } else {
            best = eNorm || oNorm;
          }

          setAreaExtra(prev => ({ ...prev, nearestBus: best }));
        } catch (e) {
          console.warn('Klarte ikke å hente bussholdeplass', e);
        }

        // Top 3 ting å gjøre (attraksjoner, utsiktspunkt, parker)
        try {
          const poiQuery = `
            [out:json][timeout:25];
            (
              node["tourism"="attraction"](around:${radius},${baseLat},${baseLon});
              node["tourism"="viewpoint"](around:${radius},${baseLat},${baseLon});
              node["leisure"="park"](around:${radius},${baseLat},${baseLon});
            );
            out 50;
          `;
          const pj = await overpass(poiQuery);
          const topPlaces = pickTopPlaces(pj?.elements || [], 3);
          setAreaExtra(prev => ({ ...prev, topPlaces }));
        } catch (e) {
          console.warn('Klarte ikke å hente top places fra OSM', e);
        }

      } catch (e) {
        console.warn('Klarte ikke å hente område-tilleggsdata', e);
        setMiniWeather(null);
        setAreaExtra({
          elevation: null,
          sunrise: '',
          sunset: '',
          aqi: null,
          nearestBeach: null,
          nearestShop: null,
          nearestBus: null,
          topPlaces: [],
        });
      }
    })();
  }, [geoInfo.lat, geoInfo.lon, coords]);

  // 🔹 URL til Google Maps for Destinasjon-kortet
  const googleMapsUrl = React.useMemo(() => {
    if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
      return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lon}`
    }
    if (destination && destination.trim()) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
    }
    return 'https://www.google.com/maps'
  }, [coords, destination])

  // --- Handlers ---
  async function useMyLocation() {
    if (!navigator.geolocation) {
      alert("Nettleseren støtter ikke posisjonstjenester.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        setCoords({ lat, lon });

        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
          const res = await fetch(url, {
            headers: { "User-Agent": "Reiseassistent" },
          });
          const data = await res.json();
          const a = data.address || {};

          const area =
            a.suburb ||
            a.city_district ||
            a.district ||
            a.neighbourhood ||
            "";

          const city =
            a.city ||
            a.town ||
            a.village ||
            a.municipality ||
            "";

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
        <div className="flex justify-end mb-2">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="btn text-sm"
          >
            Åpne i Google Maps
          </a>
        </div>

        <DestinationInput
          destination={destination}
          setDestination={setDestination}
          setCoords={setCoords}
          coords={coords}
        />
      </section>

      {/* Toppkort */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Weather destination={destination} coords={coords} />

        <CurrencyConverter />

        <div className="card p-4 border-fuchsia-200 space-y-1 text-sm">
          <div className="text-sm font-medium">Område</div>

          {population && (
            <div className="text-gray-700">
              Innbyggere: {population}{popYear ? ` (${popYear})` : ''}
            </div>
          )}

          {geoInfo.country && (
            <div className="text-gray-700 flex items-center gap-1">
              <span>Land: {geoInfo.country}</span>
              {geoInfo.flagUrl && (
                <img
                  src={geoInfo.flagUrl}
                  alt={`Flagg for ${geoInfo.country}`}
                  className="inline-block h-4 w-auto rounded-sm border border-gray-200"
                  loading="lazy"
                />
              )}
            </div>
          )}

          {geoInfo.region && (
            <div className="text-gray-700">
              Region: {geoInfo.region}
            </div>
          )}

          {areaExtra.elevation != null && (
            <div className="text-gray-700">
              Høyde: {areaExtra.elevation.toFixed(0)} moh
            </div>
          )}

          {miniWeather && (
            <div className="text-gray-700">
              Vær nå: {miniWeather.temp}°C {miniWeather.icon}
            </div>
          )}

          {(areaExtra.sunrise || areaExtra.sunset) && (
            <div className="text-gray-700">
              Sol: {areaExtra.sunrise || '–'} / {areaExtra.sunset || '–'}
            </div>
          )}

          {areaExtra.aqi != null && (
            <div className="text-gray-700">
              Luftkvalitet (AQI): {areaExtra.aqi.toFixed(0)}
            </div>
          )}

          {areaExtra.nearestBeach && (
            <div className="text-gray-700">
              Nærmeste strand{' '}
              {typeof areaExtra.nearestBeach.lat === 'number' &&
               typeof areaExtra.nearestBeach.lon === 'number' ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${areaExtra.nearestBeach.lat},${areaExtra.nearestBeach.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {areaExtra.nearestBeach.name} ({areaExtra.nearestBeach.distanceKm.toFixed(1)} km)
                </a>
              ) : (
                <span>
                  {areaExtra.nearestBeach.name} ({areaExtra.nearestBeach.distanceKm.toFixed(1)} km)
                </span>
              )}
            </div>
          )}

          {areaExtra.nearestShop && (
            <div className="text-gray-700">
              Nærmeste butikk{' '}
              {typeof areaExtra.nearestShop.lat === 'number' &&
               typeof areaExtra.nearestShop.lon === 'number' ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${areaExtra.nearestShop.lat},${areaExtra.nearestShop.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {areaExtra.nearestShop.name} ({areaExtra.nearestShop.distanceKm.toFixed(1)} km)
                </a>
              ) : (
                <span>
                  {areaExtra.nearestShop.name} ({areaExtra.nearestShop.distanceKm.toFixed(1)} km)
                </span>
              )}
            </div>
          )}

          {areaExtra.nearestBus && (
            <div className="text-gray-700">
              Nærmeste busstopp{' '}
              {typeof areaExtra.nearestBus.lat === 'number' &&
               typeof areaExtra.nearestBus.lon === 'number' ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${areaExtra.nearestBus.lat},${areaExtra.nearestBus.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {areaExtra.nearestBus.name}{' '}
                  {areaExtra.nearestBus.distanceKm != null &&
                    `(${areaExtra.nearestBus.distanceKm.toFixed(1)} km)`}
                </a>
              ) : (
                <span>
                  {areaExtra.nearestBus.name}
                  {areaExtra.nearestBus.distanceKm != null &&
                    ` (${areaExtra.nearestBus.distanceKm.toFixed(1)} km)`}
                </span>
              )}
            </div>
          )}

          {areaExtra.topPlaces && areaExtra.topPlaces.length > 0 && (
            <div className="text-gray-700">
              Top 3 ting å gjøre:
              <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                {areaExtra.topPlaces.map((p, i) => {
                  const hasCoords =
                    typeof p.lat === 'number' && typeof p.lon === 'number'
                  const url = hasCoords
                    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${p.name} ${destination || ''}`
                      )}`

                  return (
                    <li key={i}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {p.name} ({p.distanceKm.toFixed(1)} km)
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="text-gray-600">
            Nå: <b>{destination}</b>
          </div>
        </div>
      </section>

      {/* Favoritter */}
      <section className="card p-4 border-yellow-200">
        <Favorites
          destination={destination}
          coords={coords}
          setDestination={setDestination}
          setCoords={setCoords}
        />
      </section>

      {/* Se & gjøre */}
      <section>
        <Accordion title="Wikipedia" defaultOpen={false}>
          <div className="card p-4 border-rose-200">
            <h2 className="text-lg font-medium mb-2">Wikipedia</h2>
            <AutoFill destination={destination} />
          </div>
        </Accordion>
      </section>

      {/* Se & gjøre (OpenStreetMap / Geoapify) */}
      <section>
        <Accordion title="Se & gjøre (OpenStreetMap)" defaultOpen={false}>
          <div className="card p-4 border-rose-200">
            <h2 className="text-lg font-medium mb-2">
              Se & gjøre Se & gjøre (OpenStreetMap / Geoapify)
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
