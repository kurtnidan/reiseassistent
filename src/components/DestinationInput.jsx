import React, { useState, useEffect, useRef } from "react";
import { nameToCoords, coordsToName } from "../services/geocode";

export default function DestinationInput({ destination, setDestination, setCoords }) {
 const [query, setQuery] = useState(destination || "");
 const [results, setResults] = useState([]);
 const [open, setOpen] = useState(false);
 const abortRef = useRef(null);

// 🔁 Hold input-feltet i sync med destination-prop
useEffect(() => {
  setQuery(destination || "");
}, [destination]);


  // 🔍 Søk etter forslag (debounce + avbryt tidligere søk)
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=6`,
          { signal: controller.signal }
        );

        if (!r.ok) return;
        const data = await r.json();

        const list = data.map((d) => ({
          name: d.display_name,
          lat: Number(d.lat),
          lon: Number(d.lon),
        }));

        setResults(list);
        setOpen(true);
      } catch {
        /* ignorér avbrutt */
      }
    }, 250); // debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Når et forslag velges
  function apply(item) {
    setOpen(false);
    setQuery(item.name);
    setDestination(item.name);
    setCoords({ lat: item.lat, lon: item.lon });
  }

  // Klikk utenfor → lukk liste
  const wrapperRef = useRef(null);
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="text-sm">
        Destinasjon
        <input
          className="input w-full mt-1"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDestination(e.target.value);
          }}
          placeholder="F.eks. Almuñécar, Bergen, Oslo…"
        />
      </label>

      {open && results.length > 0 && (
        <div className="absolute z-20 w-full bg-white border rounded-md shadow-md max-h-60 overflow-auto">
          {results.map((item, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
              onClick={() => apply(item)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-20 w-full bg-white border rounded-md shadow-md p-3 text-sm text-gray-500">
          Ingen treff
        </div>
      )}
    </div>
  );
}
