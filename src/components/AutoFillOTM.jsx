// src/components/AutoFillOTM.jsx
import React, { useState, useMemo } from "react";
import FavoriteButton from "./FavoriteButton.jsx";
import { nameToCoords } from "../services/geocode";

// TRYGG "kinds" – fungerer på Free-plan
const SAFE_KINDS =
  "natural,beaches,other_places,interesting_places,historic,architecture,museums,amusements";

// radius
const RADIUS_OPTIONS = [
  { label: "1 km", value: 1000 },
  { label: "3 km", value: 3000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "20 km", value: 20000 },
  { label: "30 km", value: 30000 },
];

// kategorier + etiketter
const CATEGORY_FILTERS = [
  { key: "Strand", label: "Strender" },
  { key: "Natur", label: "Natur" },
  { key: "Park", label: "Parker" },
  { key: "Historisk", label: "Historisk" },
  { key: "Kultur", label: "Kultur" },
  { key: "Severdighet", label: "Andre severdigheter" },
];

function fmt(m) {
  if (m == null) return "";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function classifyKinds(kinds = "") {
  const k = String(kinds).toLowerCase();

  if (k.includes("beach")) return { category: "Strand", icon: "🏖️" };
  if (k.includes("natural")) return { category: "Natur", icon: "⛰️" };
  if (k.includes("park")) return { category: "Park", icon: "🌳" };
  if (
    k.includes("historic") ||
    k.includes("castle") ||
    k.includes("fortification") ||
    k.includes("monument")
  )
    return { category: "Historisk", icon: "🏛️" };
  if (
    k.includes("museum") ||
    k.includes("cultural") ||
    k.includes("temple") ||
    k.includes("church")
  )
    return { category: "Kultur", icon: "🎭" };

  return { category: "Severdighet", icon: "📍" };
}

export default function AutoFillOTM({
  destination = "Almuñécar",
  coords = null,
}) {
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(3000);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // filtre
  const [minRating, setMinRating] = useState(0); // 0 = ingen filter
  const [onlyWithImage, setOnlyWithImage] = useState(false);
  const [catFilter, setCatFilter] = useState(() =>
    Object.fromEntries(CATEGORY_FILTERS.map((c) => [c.key, true])),
  );

  function toggleCategory(key) {
    setCatFilter((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setAllCategories(on) {
    const next = Object.fromEntries(
      CATEGORY_FILTERS.map((c) => [c.key, !!on]),
    );
    setCatFilter(next);
  }

  async function run() {
    setLoading(true);
    setResults(null);
    setErrorMsg("");

    try {
      // coords → fra GPS
      let lat = coords?.lat;
      let lon = coords?.lon;

      // hvis ikke GPS: geokod destinasjonstekst
      if (!lat || !lon) {
        const g = await nameToCoords(destination);
        lat = g.lat;
        lon = g.lon;
      }

      const key = import.meta.env.VITE_OPENTRIPMAP_API_KEY;
      if (!key) {
        setErrorMsg("Mangler OTM API key i .env (VITE_OPENTRIPMAP_API_KEY).");
        return;
      }

      // HENT LISTE (radius)
      const url =
        `https://api.opentripmap.com/0.1/en/places/radius?apikey=${key}` +
        `&radius=${radius}` +
        `&lon=${lon}` +
        `&lat=${lat}` +
        `&limit=40&format=json&kinds=${SAFE_KINDS}`;

      const raw = await fetch(url);
      const data = await raw.json();

      if (!Array.isArray(data) || data.length === 0) {
        setErrorMsg("Ingen treff innen valgt radius.");
        setResults([]);
        return;
      }

      // Hent detaljer for de første 20
      const details = [];
      for (const item of data.slice(0, 20)) {
        try {
          const detUrl =
            `https://api.opentripmap.com/0.1/en/places/xid/${item.xid}?apikey=${key}`;
          const detRaw = await fetch(detUrl);
          const det = await detRaw.json();

          const kinds = det.kinds || item.kinds || "";
          const { category, icon } = classifyKinds(kinds);

          details.push({
            name: det.name || "(uten navn)",
            desc:
              det.wikipedia_extracts?.text ||
              det.info?.descr ||
              det.info?.descr?.short ||
              det.info?.summary ||
              "",
            map:
              det.otm ||
              (det.point
                ? `https://www.google.com/maps?q=${det.point.lat},${det.point.lon}`
                : ""),
            distanceMeters: Math.round(item.dist || 0),
            rating: det.rate ?? null,
            image: det.preview?.source || null,
            category,
            icon,
          });
        } catch (e) {
          console.warn("OTM detalj-feil for ett sted:", e);
        }
      }

      setResults(details);
    } catch (e) {
      console.error(e);
      setErrorMsg("OTM-feil. Sjekk destinasjon eller API-nøkkel.");
    } finally {
      setLoading(false);
    }
  }

  const filteredSorted = useMemo(() => {
    if (!results) return null;

    const filtered = results.filter((r) => {
      if (catFilter[r.category] === false) return false;
      if (minRating > 0 && (r.rating ?? 0) < minRating) return false;
      if (onlyWithImage && !r.image) return false;
      return true;
    });

    const list = [...filtered];
    list.sort(
      (a, b) => (a.distanceMeters || 1e9) - (b.distanceMeters || 1e9),
    );
    return list;
  }, [results, catFilter, minRating, onlyWithImage]);

  return (
    <div className="space-y-3">
      {/* Toppkontroller */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" disabled={loading} onClick={run}>
          {loading ? "Henter…" : "Hent severdigheter (OpenTripMap)"}
        </button>

        <label className="text-xs flex items-center gap-1">
          Radius:
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="text-xs border rounded-md px-2 py-1"
          >
            {RADIUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {/* Min. rating */}
        <label className="text-xs flex items-center gap-1">
          Min. rating:
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="text-xs border rounded-md px-2 py-1"
          >
            <option value={0}>Ingen</option>
            <option value={3}>3+</option>
            <option value={4}>4+</option>
          </select>
        </label>

        {/* Kun med bilde */}
        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            className="checkbox"
            checked={onlyWithImage}
            onChange={(e) => setOnlyWithImage(e.target.checked)}
          />
          Kun med bilde
        </label>
      </div>

      {/* Kategorifilter */}
      <div className="card p-2">
        <div className="text-[11px] mb-1 text-gray-600">Filtrer kategorier:</div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((c) => (
            <label
              key={c.key}
              className="inline-flex items-center gap-1 text-xs cursor-pointer"
            >
              <input
                type="checkbox"
                className="checkbox"
                checked={!!catFilter[c.key]}
                onChange={() => toggleCategory(c.key)}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-1 flex gap-2 text-[11px]">
          <button
            className="btn btn-sm"
            onClick={() => setAllCategories(true)}
          >
            Merk alle
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setAllCategories(false)}
          >
            Fjern alle
          </button>
        </div>
      </div>

      {errorMsg && <div className="text-red-600 text-sm">⚠️ {errorMsg}</div>}

      {/* Resultater */}
      {filteredSorted && filteredSorted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSorted.map((s, i) => (
            <div
              key={i}
              className="card p-3 border-emerald-200 flex justify-between items-start gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <div className="font-medium">{s.name}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {s.category}
                  {s.distanceMeters != null && <> • {fmt(s.distanceMeters)}</>}
                  {s.rating != null && <> • Rating: {s.rating}</>}
                </div>

                {s.desc && (
                  <div className="text-xs mt-1 text-gray-600 line-clamp-3">
                    {s.desc}
                  </div>
                )}

                {s.image && (
                  <div className="mt-2">
                    <img
                      src={s.image}
                      alt={s.name}
                      className="rounded-md max-h-40 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                {s.map && (
                  <a
                    className="badge mt-1 border-gray-200"
                    target="_blank"
                    rel="noreferrer"
                    href={s.map}
                  >
                    Åpne i kart
                  </a>
                )}
              </div>

              <FavoriteButton item={s} />
            </div>
          ))}
        </div>
      )}

      {!loading && !errorMsg && filteredSorted && filteredSorted.length === 0 && (
        <div className="text-sm text-gray-500">
          Ingen treff etter filtrering. Prøv større radius eller slå av noen filtre.
        </div>
      )}
    </div>
  );
}
