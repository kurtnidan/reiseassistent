// src/components/AutoFillOSM.jsx
import React, { useState, useMemo } from "react";
import FavoriteButton from "./FavoriteButton.jsx";
import { nameToCoords } from "../services/geocode";

// ---------- Hjelpefunksjoner ----------

function formatMeters(m) {
  if (m == null) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const RADIUS_OPTIONS = [
  { label: "1 km", value: 1000 },
  { label: "3 km", value: 3000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "30 km", value: 30000 },
];

const SORT_OPTIONS = [
  { value: "nearest", label: "Nærmest først" },
  { value: "alpha", label: "Navn A–Å" },
  { value: "random", label: "Tilfeldig" },
];

const UI_CATEGORIES = [
  { key: "beach", label: "Strender" },
  { key: "nature", label: "Natur" },
  { key: "park", label: "Parker" },
  { key: "historic", label: "Historisk" },
  { key: "culture", label: "Kultur" },
  { key: "other", label: "Andre severdigheter" },
];

// Gyldige Geoapify-kategorier (sjekket mot dokumentasjonen)
const GEOAPIFY_BASE_CATEGORIES =
  "tourism.sights,tourism.attraction,leisure.park,natural,beach";

// Klassifiserer Geoapify-kategorier til våre UI-kategorier
function classifyTags(categories) {
  const cats = Array.isArray(categories) ? categories : [];
  const tags = [];

  if (cats.some((c) => c.startsWith("beach"))) tags.push("beach");
  if (cats.some((c) => c.startsWith("natural"))) tags.push("nature");
  if (cats.some((c) => c.startsWith("leisure.park"))) tags.push("park");
  if (cats.some((c) => c.startsWith("tourism.sights"))) tags.push("historic");
  if (cats.some((c) => c.startsWith("tourism.attraction"))) tags.push("culture");

  if (!tags.length) tags.push("other");
  return tags;
}

// ---------- Komponent ----------

export default function AutoFillOSM({ destination = "Almuñécar", coords = null }) {
  const [radius, setRadius] = useState(3000);
  const [sortBy, setSortBy] = useState("nearest");
  const [onlyWithWiki, setOnlyWithWiki] = useState(false);

  // kategori-filter i UI
  const [catFilter, setCatFilter] = useState(() => {
    const initial = {};
    UI_CATEGORIES.forEach((c) => {
      initial[c.key] = true;
    });
    return initial;
  });

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [lastCenter, setLastCenter] = useState(null); // {lat, lon}

  // ----------- Hent data fra Geoapify -----------

  async function run() {
    setError(null);
    setLoading(true);
    setItems([]);

    try {
      // 1) Finn koordinater for gjeldende søk
      let centerLat = null;
      let centerLon = null;

      if (coords && typeof coords.lat === "number" && typeof coords.lon === "number") {
        centerLat = coords.lat;
        centerLon = coords.lon;
      } else if (destination && destination.trim()) {
        const g = await nameToCoords(destination.trim());
        centerLat = g.lat;
        centerLon = g.lon;
      }

      if (centerLat == null || centerLon == null) {
        setError("Fant ikke koordinater for destinasjonen.");
        setLoading(false);
        return;
      }

      setLastCenter({ lat: centerLat, lon: centerLon });

      // 2) Bygg Geoapify-request
      const apiKey = import.meta.env.VITE_GEOAPIFY_KEY;
      if (!apiKey) {
        setError("Mangler VITE_GEOAPIFY_KEY i .env-filen.");
        setLoading(false);
        return;
      }

      const url =
        "https://api.geoapify.com/v2/places" +
        `?apiKey=${encodeURIComponent(apiKey)}` +
        `&categories=${encodeURIComponent(GEOAPIFY_BASE_CATEGORIES)}` +
        `&filter=circle:${centerLon},${centerLat},${radius}` +
        `&bias=proximity:${centerLon},${centerLat}` +
        `&limit=80&lang=no`;

      console.log("[Geoapify URL]", url);

      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text();
        console.error("Geoapify error", res.status, txt);
        throw new Error(`Geoapify svarte ${res.status}`);
      }

      const json = await res.json();
      const feats = Array.isArray(json.features) ? json.features : [];

      const mapped = feats.map((f, idx) => {
        const p = f.properties || {};
        const g = f.geometry || {};
        const coordsArr = Array.isArray(g.coordinates) ? g.coordinates : [null, null];
        const lon = coordsArr[0];
        const lat = coordsArr[1];

        const dist =
          typeof p.distance === "number" && !Number.isNaN(p.distance)
            ? p.distance
            : lat != null && lon != null
            ? haversineMeters(centerLat, centerLon, lat, lon)
            : null;

        const tags = classifyTags(p.categories);
        const mainTag = tags[0] || "other";

        const name =
          p.name ||
          p.address_line1 ||
          p.address_line2 ||
          `Uten navn`;

        const mapUrl =
          lat != null && lon != null
            ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`
            : null;

        const wikiId = p.datasource && p.datasource.wikidata;
        const wikiUrl = wikiId ? `https://www.wikidata.org/wiki/${wikiId}` : null;

        return {
          id: p.place_id || p.osm_id || `poi-${idx}`,
          name,
          distanceMeters: dist,
          tags,
          mainTag,
          categoryHuman:
            mainTag === "beach"
              ? "Strand"
              : mainTag === "nature"
              ? "Natur"
              : mainTag === "park"
              ? "Park"
              : mainTag === "historic"
              ? "Historisk"
              : mainTag === "culture"
              ? "Kultur"
              : "Annet",
          map: mapUrl,
          wiki: wikiUrl,
          raw: p,
        };
      });

      setItems(mapped);
    } catch (e) {
      console.error("Geoapify-feil", e);
      setError(e.message || "Noe gikk galt mot Geoapify.");
    } finally {
      setLoading(false);
    }
  }

  // ----------- Avledede & filtrerte data -----------

  const visibleItems = useMemo(() => {
    let list = [...items];

    if (onlyWithWiki) {
      list = list.filter((it) => !!it.wiki);
    }

    const activeTags = Object.entries(catFilter)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (activeTags.length) {
      list = list.filter((it) => it.tags.some((t) => activeTags.includes(t)));
    }

    if (sortBy === "nearest") {
      list.sort(
        (a, b) =>
          (a.distanceMeters ?? Number.POSITIVE_INFINITY) -
          (b.distanceMeters ?? Number.POSITIVE_INFINITY)
      );
    } else if (sortBy === "alpha") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "no"));
    } else if (sortBy === "random") {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }

    return list;
  }, [items, onlyWithWiki, catFilter, sortBy]);

  // ----------- UI-hjelpere -----------

  function toggleCat(key) {
    setCatFilter((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function markAll() {
    const all = {};
    UI_CATEGORIES.forEach((c) => (all[c.key] = true));
    setCatFilter(all);
  }

  function clearAll() {
    const none = {};
    UI_CATEGORIES.forEach((c) => (none[c.key] = false));
    setCatFilter(none);
  }

  // ----------- Render -----------

  return (
    <div className="space-y-3">
      {/* Topplinje: knapp + radius + sortering + wiki-filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={run} disabled={loading} className="btn">
          {loading ? "Henter severdigheter…" : "Hent severdigheter (OSM)"}
        </button>

        <label className="text-xs flex items-center gap-1">
          Radius:
          <select
            className="text-xs border rounded-md px-2 py-1"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs flex items-center gap-1">
          Sorter:
          <select
            className="text-xs border rounded-md px-2 py-1"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            className="checkbox"
            checked={onlyWithWiki}
            onChange={(e) => setOnlyWithWiki(e.target.checked)}
          />
          Kun steder med Wikipedia-lenke
        </label>

        <span className="text-[11px] text-gray-500">
          Data fra Geoapify Places (OSM)
        </span>
      </div>

      {/* Info om senterpunkt */}
      {lastCenter && (
        <div className="text-[11px] text-gray-500">
          Søk-sentrum: lat {lastCenter.lat.toFixed(5)}, lon {lastCenter.lon.toFixed(5)}
        </div>
      )}

      {/* Kategori-filtre */}
      <div className="text-xs border rounded-lg px-3 py-2 bg-slate-50 flex flex-wrap items-center gap-2">
        <span className="font-medium mr-1">Filtrer kategorier:</span>
        {UI_CATEGORIES.map((c) => (
          <label key={c.key} className="flex items-center gap-1">
            <input
              type="checkbox"
              className="checkbox"
              checked={!!catFilter[c.key]}
              onChange={() => toggleCat(c.key)}
            />
            {c.label}
          </label>
        ))}
        <button type="button" className="ml-2 text-[11px] underline" onClick={markAll}>
          Merk alle
        </button>
        <button
          type="button"
          className="text-[11px] underline"
          onClick={clearAll}
        >
          Fjern alle
        </button>
      </div>

      {/* Feilmelding */}
      {error && (
        <div className="text-xs text-red-600 flex items-center gap-1">
          ⚠️ {error}
        </div>
      )}

      {/* Resultatliste */}
      {visibleItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {visibleItems.slice(0, 40).map((s) => (
            <div
              key={s.id}
              className="card p-3 flex gap-3 items-start justify-between border-emerald-200"
            >
              <div className="flex-1">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">
                  {s.categoryHuman}
                  {s.distanceMeters != null && ` • ${formatMeters(s.distanceMeters)}`}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {s.map && (
                    <a
                      className="badge border-gray-200"
                      href={s.map}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Åpne i kart
                    </a>
                  )}
                  {s.wiki && (
                    <a
                      className="badge border-gray-200"
                      href={s.wiki}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Les på Wikipedia
                    </a>
                  )}
                </div>
              </div>
              <FavoriteButton item={s} />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-xs text-gray-500">
          Ingen treff ennå. Velg radius og trykk{" "}
          <span className="font-medium">Hent severdigheter (OSM)</span>.
        </div>
      )}
    </div>
  );
}
