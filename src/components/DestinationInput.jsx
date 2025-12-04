import React, { useState, useEffect, useRef } from "react";
import { nameToCoords, coordsToName } from "../services/geocode";

export default function DestinationInput({
  destination,
  setDestination,
  setCoords,
  coords,
}) {
  const [query, setQuery] = useState(destination || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1); // tastaturnavigasjon
  const [hasFocus, setHasFocus] = useState(false);          // om feltet er aktivt
  const abortRef = useRef(null);
  const wrapperRef = useRef(null);

  // 🔁 Hold input-feltet i sync med destination-prop
  useEffect(() => {
    setQuery(destination || "");
  }, [destination]);

  // 🔍 Søk etter forslag (debounce + avbryt tidligere søk)
  useEffect(() => {
    const trimmed = (query || "").trim();

    // Bare søk når feltet faktisk er i fokus
    if (!hasFocus || !trimmed || trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      setHighlightIndex(-1);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            trimmed
          )}&addressdetails=1&limit=6`,
          {
            signal: controller.signal,
            headers: { "User-Agent": "Reiseassistent" },
          }
        );

        if (!r.ok) return;
        const data = await r.json();

        const list = data.map((d) => ({
          name: d.display_name,
          lat: Number(d.lat),
          lon: Number(d.lon),
        }));

        setResults(list);
        setOpen(list.length > 0);
        setHighlightIndex(list.length > 0 ? 0 : -1);
      } catch {
        // ignorér avbrutt/feil
      }
    }, 250); // debounce

    return () => {
      clearTimeout(timer);
      if (controller) controller.abort();
    };
  }, [query, hasFocus]);

  // Når et forslag velges
  function apply(item) {
    if (!item) return;
    setOpen(false);
    setResults([]);
    setHighlightIndex(-1);
    setQuery(item.name);
    setDestination(item.name);
    setCoords({ lat: item.lat, lon: item.lon });
  }

  // Klikk utenfor → lukk liste
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setHighlightIndex(-1);
        setHasFocus(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ⌨️ Tastaturnavigasjon i autoforslag
  function handleKeyDown(e) {
    if (!open || results.length === 0) {
      if (e.key === "Escape") {
        setOpen(false);
        setHighlightIndex(-1);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => {
        if (prev < 0) return 0;
        return (prev + 1) % results.length;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => {
        if (prev < 0) return results.length - 1;
        return (prev - 1 + results.length) % results.length;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = highlightIndex >= 0 ? highlightIndex : 0;
      const item = results[idx];
      if (item) apply(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlightIndex(-1);
    }
  }

  // ⭐ Legg inn nåværende tekst som favoritt i localStorage – med kartlenke hvis coords finnes
  function addCurrentAsFavorite() {
    const name = (query || "").trim();
    if (!name) return;

    const mapUrl =
      coords && coords.lat && coords.lon
        ? `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lon}#map=13/${coords.lat}/${coords.lon}`
        : `https://www.google.com/maps/search/${encodeURIComponent(name)}`;

    const newFav = {
      name,
      category: "Destinasjon",
      desc: "",
      map: mapUrl,
    };

    let list = [];
    try {
      list = JSON.parse(localStorage.getItem("fav") || "[]");
    } catch {
      list = [];
    }

    // Unngå duplikater på navn + kategori + map
    const exists = list.some(
      (p) =>
        (p.name || "").trim().toLowerCase() === name.toLowerCase() &&
        (p.category || "") === newFav.category &&
        (p.map || "") === newFav.map
    );
    if (exists) return;

    const next = [newFav, ...list];

    try {
      localStorage.setItem("fav", JSON.stringify(next));
      // gi beskjed til Favorites-komponenten (den lytter på fav:changed)
      window.dispatchEvent(new CustomEvent("fav:changed"));
    } catch {
      // hvis localStorage feiler, gjør vi bare ingenting
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="text-sm block">
        Destinasjon
        <div className="relative mt-1">
          <input
            className="input w-full pr-10"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDestination(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setHasFocus(true);
              if (results.length > 0) setOpen(true);
            }}
            placeholder="F.eks. Almuñécar, Bergen, Oslo…"
          />

          {/* ⭐ knapp inne i samme felt */}
          <button
            type="button"
            onClick={addCurrentAsFavorite}
            disabled={!query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-lg disabled:opacity-40"
            title="Legg denne destinasjonen til som favoritt"
          >
            ⭐
          </button>
        </div>
      </label>

      {hasFocus && open && results.length > 0 && (
        <div className="absolute z-20 w-full bg-white border rounded-md shadow-md max-h-60 overflow-auto">
          {results.map((item, i) => (
            <button
              key={i}
              type="button"
              className={
                "w-full text-left px-3 py-2 text-sm " +
                (i === highlightIndex
                  ? "bg-gray-100"
                  : "hover:bg-gray-100")
              }
              onClick={() => apply(item)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      {hasFocus && open && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-20 w-full bg-white border rounded-md shadow-md p-3 text-sm text-gray-500">
          Ingen treff
        </div>
      )}
    </div>
  );
}
