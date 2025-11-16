// src/components/Population.jsx
import React, { useEffect, useState } from "react";
import { nameToCoords } from "../services/geocode";

export default function Population({ destination, coords }) {
  const [population, setPopulation] = useState(null);
  const [year, setYear] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchPopulation(name) {
    try {
      setLoading(true);
      const query = `
        SELECT ?population ?year WHERE {
          ?place rdfs:label "${name}"@en;
                 wdt:P1082 ?population.
          OPTIONAL { ?place p:P1082 ?popStatement.
                     ?popStatement pq:P585 ?year. }
        } LIMIT 1
      `;
      const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
      const r = await fetch(url);
      const j = await r.json();

      if (j.results.bindings.length > 0) {
        const b = j.results.bindings[0];
        const pop = b.population?.value || null;
        const yr = b.year?.value ? new Date(b.year.value).getFullYear() : null;

        if (pop) {
          setPopulation(Number(pop).toLocaleString("no-NO"));
          setYear(yr || null);
          try {
            localStorage.setItem(
              `pop:${name.toLowerCase()}`,
              JSON.stringify({ official: pop, source: { year: yr } })
            );
          } catch {}
        }
      }
    } catch (e) {
      console.warn("Feil i befolkning:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!destination) return;
    const key = `pop:${destination.toLowerCase()}`;
    const saved = JSON.parse(localStorage.getItem(key) || "{}");

    if (saved?.official) {
      setPopulation(Number(saved.official).toLocaleString("no-NO"));
      setYear(saved.source?.year || null);
    } else {
      fetchPopulation(destination);
    }
  }, [destination]);

  if (loading) return <div className="text-sm text-gray-500">Henter data...</div>;
  if (!population) return <div className="text-sm text-gray-400">Ingen data tilgjengelig.</div>;

  return (
    <div className="text-sm">
      <div>
        <b>Innbyggere:</b> {population}
        {year ? ` (${year})` : ""}
      </div>
    </div>
  );
}
