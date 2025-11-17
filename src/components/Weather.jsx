// src/components/Weather.jsx
import React, { useEffect, useState } from "react";
import { nameToCoords } from "../services/geocode";

export default function Weather({ destination, coords }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchWeatherByCoords(lat, lon) {
    try {
      setLoading(true);
      setError("");

      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current_weather=true&timezone=auto`;

      const r = await fetch(url);
      if (!r.ok) throw new Error(`Feil: ${r.status}`);
      const j = await r.json();
      setData(j.current_weather); // inneholder: temperature, windspeed, winddirection, weathercode, is_day, time
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
      // 1) Hvis vi har GPS-koordinater (Bruk min posisjon)
      if (coords?.lat && coords?.lon) {
        await fetchWeatherByCoords(coords.lat, coords.lon);
        return;
      }

      // 2) Ellers bruk destinasjonsnavn
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

  // Enkle ikoner
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

  // Kort norsk tekst for værkode
  function describeWeather(code) {
    if (code === 0) return "Klarvær";
    if (code === 1) return "For det meste klart";
    if (code === 2) return "Delvis skyet";
    if (code === 3) return "Overskyet";
    if (code >= 45 && code <= 48) return "Tåke / dis";
    if (code >= 51 && code <= 57) return "Yr / lett nedbør";
    if (code >= 61 && code <= 65) return "Regn";
    if (code >= 66 && code <= 67) return "Underkjølt regn";
    if (code >= 71 && code <= 75) return "Snø";
    if (code >= 80 && code <= 82) return "Regnbyger";
    if (code >= 85 && code <= 86) return "Snøbyger";
    if (code >= 95 && code <= 99) return "Tordenbyger";
    return "Ukjent værtype";
  }

  // Vindretning i kompassretning
  function windDirection(deg) {
    if (typeof deg !== "number") return "";
    const dirs = ["N", "NØ", "Ø", "SØ", "S", "S V", "V", "N V"];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  }

  function formatTime(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleTimeString("nb-NO", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  // 🔲 Samme stil som andre "kort": ramme rundt værseksjonen
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm text-sm">
        <div className="text-gray-500">Henter værdata…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm text-sm">
        <div className="text-red-600">⚠️ {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm text-sm">
        <div className="text-gray-400">Ingen værdata tilgjengelig.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm text-sm space-y-3">
      {/* Topp: ikon + temperatur + kort tekst */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{getIcon(data.weathercode)}</span>
          <div>
            <div className="text-lg font-semibold">
              {Math.round(data.temperature)}°C
            </div>
            <div className="text-xs text-slate-600">
              {describeWeather(data.weathercode)}
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500 text-right">
          {data.is_day ? "Dag" : "Natt"}
          <br />
          Oppdatert: {formatTime(data.time)}
        </div>
      </div>

      {/* Flere parametre */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
        <div>
          Vind:{" "}
          <span className="font-medium">
            {Math.round(data.windspeed)} km/t
          </span>
        </div>
        <div>
          Retning:{" "}
          <span className="font-medium">
            {windDirection(data.winddirection)} ({Math.round(data.winddirection)}°)
          </span>
        </div>
      </div>
    </div>
  );
}
