// src/components/AutoFill.jsx
import React, { useMemo, useState } from 'react'
import { getNearbySights } from '../services/wikipedia'
import { buildMapsRoute } from '../utils/route'
import { t } from '../i18n/strings'
import FavoriteButton from './FavoriteButton.jsx'

function formatMeters(m) {
  if (m == null) return ''
  if (m < 1000) return `${m} m`
  return `${(m / 1000).toFixed(1)} km`
}

// Utvidet radius med 30 / 50 / 100 km (label),
// men API tåler maks ~10 000 m (10 km)
const RADIUS_OPTIONS = [
  { label: '1 km',   value: 1000 },
  { label: '3 km',   value: 3000 },
  { label: '5 km',   value: 5000 },
  { label: '10 km',  value: 10000 },
  { label: '30 km',  value: 30000 },
  { label: '50 km',  value: 50000 },
  { label: '100 km', value: 100000 },
]

// Wikipedia / geosearch maks-radius (sikkerhetsgrense)
const MAX_API_RADIUS = 10000 // 10 km

export default function AutoFill({ destination = 'Almuñécar', coords = null }) {
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState(null)
  const [radius, setRadius]     = useState(3000)
  const [sortBy, setSortBy]     = useState('nearest')
  const [error, setError]       = useState('')

  async function run() {
    setLoading(true)
    setData(null)
    setError('')

    try {
      // 👇 Viktig: ikke send mer enn API tåler
      const effectiveRadius = Math.min(radius, MAX_API_RADIUS)

      const sights = await getNearbySights({
        destination,
        coords,
        radius: effectiveRadius,
        language: 'no',
      })
      setData({ sights })
    } catch (e) {
      console.warn(e)
      setData(null)
      setError(
        e?.message ||
        t('error_fetch_sights') ||
        'Kunne ikke hente severdigheter. Prøv igjen.'
      )
    } finally {
      setLoading(false)
    }
  }

  const sightsSorted = useMemo(() => {
    const list = data?.sights ? [...data.sights] : []
    if (!list.length) return list

    if (sortBy === 'nearest') {
      list.sort(
        (a, b) =>
          (a.distanceMeters ?? 1e12) - (b.distanceMeters ?? 1e12)
      )
    } else if (sortBy === 'alpha') {
      list.sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'no')
      )
    } else {
      // random
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
    }
    return list
  }, [data?.sights, sortBy])

  function openRoute() {
    const points = (sightsSorted || []).slice(0, 10)
    if (!points.length) {
      alert(
        t('route_no_sights') ||
          'Ingen severdigheter å lage rute til enda. Hent severdigheter først.'
      )
      return
    }

    if (!coords || coords.lat == null || coords.lon == null) {
      alert(
        t('route_needs_position') ||
          'For å lage rute må du bruke "Bruk min posisjon" først.'
      )
      return
    }

    try {
      const url = buildMapsRoute({ origin: coords, points })
      if (!url) {
        alert(
          t('route_build_failed') ||
            'Kunne ikke bygge rute. Prøv igjen senere.'
        )
        return
      }
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      console.warn(e)
      alert(
        t('route_build_failed') ||
          'Kunne ikke bygge rute. Prøv igjen senere.'
      )
    }
  }

  return (
    <div className="space-y-3">
      {/* Kontroller-linje */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={run}
          disabled={loading}
          className="btn"
        >
          {loading ? t('fetching') : t('fetch_sights')}
        </button>

        <label className="text-xs flex items-center gap-1">
          {t('radius')}:
          <select
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="text-xs border rounded-md px-2 py-1"
          >
            {RADIUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs flex items-center gap-1">
          {t('sort')}:
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs border rounded-md px-2 py-1"
          >
            <option value="nearest">{t('nearest')}</option>
            <option value="alpha">{t('alpha')}</option>
            <option value="random">{t('random')}</option>
          </select>
        </label>

        <button className="btn" onClick={openRoute}>
          {t('show_route')}
        </button>

        <span className="text-[11px] text-gray-500">
          {t('no_key_needed')}
        </span>
      </div>

      {/* Feilvisning */}
      {error && (
        <div className="text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {/* Resultater */}
      {sightsSorted && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {sightsSorted.slice(0, 12).map((s, i) => (
            <div
              key={i}
              className="card p-3 flex gap-3 items-start justify-between border-emerald-200"
            >
              <div className="flex-1">
                <div className="font-medium">{s.name}</div>

                {s.distanceMeters != null && (
                  <div className="text-xs text-gray-500">
                    {formatMeters(s.distanceMeters)}
                  </div>
                )}

                {s.desc && (
                  <div className="text-xs text-gray-600 mt-1 line-clamp-3">
                    {s.desc}
                  </div>
                )}

                <div className="mt-1">
                  <a
                    className="badge border-gray-200"
                    href={s.map}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('open_in_maps')}
                  </a>
                </div>
              </div>

              <FavoriteButton item={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
