// src/components/Weather.jsx
import React, { useEffect, useState } from "react";
import { nameToCoords } from "../services/geocode";

const API_KEY = import.meta.env.VITE_OPEN_METEO_KEY || ""; // du trenger ingen key for open-meteo

export default function Weather({ destination, coords }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchWeatherByCoords(lat, lon) {
    try {
      setLoading(true);
      setError("");
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Feil: ${r.status}`);
      const j = await r.json();
      setData(j.current_weather);
    } catch (e) {
      console.error("Værfeil:", e);
      setError("Kunne ikke hente værdata.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function resolveAndFetch() {
      if (coords?.lat && coords?.lon) {
        await fetchWeatherByCoords(coords.lat, coords.lon);
        return;
      }

      if (destination) {
        try {
          const g = await nameToCoords(destination);
          if (!active) return;
          await fetchWeatherByCoords(g.lat, g.lon);
        } catch (err) {
          console.warn("Kunne ikke hente coords for vær:", err);
          if (active) setError("Ukjent sted for værmelding.");
        }
      }
    }

    resolveAndFetch();
    return () => {
      active = false;
    };
  }, [destination, coords?.lat, coords?.lon]);

  const icons = {
    sun: "☀️",
    cloud: "☁️",
    rain: "🌧️",
    snow: "❄️",
    wind: "💨",
  };

  function getIcon(code) {
    if (code >= 0 && code <= 1) return icons.sun;
    if (code === 2) return icons.cloud;
    if (code === 3) return icons.cloud;
    if (code >= 45 && code <= 67) return icons.rain;
    if (code >= 71 && code <= 86) return icons.snow;
    if (code >= 95) return icons.wind;
    return "🌤️";
  }

  if (loading) return <div className="text-sm text-gray-500">Henter værdata...</div>;
  if (error) return <div className="text-sm text-red-600">⚠️ {error}</div>;
  if (!data) return <div className="text-sm text-gray-400">Ingen værdata tilgjengelig.</div>;

  return (
    <div className="text-sm space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{getIcon(data.weathercode)}</span>
        <span className="font-medium">{Math.round(data.temperature)}°C</span>
      </div>
      <div className="text-gray-500">Vind: {Math.round(data.windspeed)} km/t</div>
    </div>
  );
}
