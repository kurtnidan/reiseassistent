// src/components/Weather.jsx
import React, { useEffect, useState } from "react";
import { nameToCoords } from "../services/geocode";

// Open-Meteo bruker WMO-koder – enkel tekst-tabell
const WMO_TEXT = {
  0: "Klar himmel",
  1: "For det meste klar",
  2: "Delvis skyet",
  3: "Overskyet",
  45: "Tåke",
  48: "Tåke (rim)",
  51: "Lett yr",
  53: "Yr",
  55: "Kraftig yr",
  56: "Lett yr (frysende)",
  57: "Yr (frysende)",
  61: "Lett regn",
  63: "Regn",
  65: "Kraftig regn",
  66: "Lett regn (frysende)",
  67: "Regn (frysende)",
  71: "Lett snø",
  73: "Snø",
  75: "Kraftig snø",
  77: "Snøkorn",
  80: "Lette regnbyger",
  81: "Regnbyger",
  82: "Kraftige regnbyger",
  85: "Snøbyger",
  86: "Kraftige snøbyger",
  95: "Tordenbyger",
  96: "Tordenbyger med hagl",
  99: "Kraftige tordenbyger med hagl",
};

// ikon-logikk: hvilke koder er sol, regn, snø, osv.
function iconFor(code) {
  // Snø / snøbyger
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  // Regn / yr / regnbyger
  if (
    [
      51, 53, 55, 56, 57,
      61, 63, 65, 66, 67,
      80, 81, 82,
    ].includes(code)
  ) {
    return "🌧️";
  }
  // Tåke
  if ([45, 48].includes(code)) return "🌫️";
  // Skyet
  if ([2, 3].includes(code)) return "☁️";
  // Kraftig tordenvær
  if (code >= 95) return "⛈️";
  // Klar / delvis klar
  return "☀️";
}

// Vindretning i tekst
function windDirText(deg) {
  if (deg == null || isNaN(deg)) return "";
  const dirs = ["N", "NØ", "Ø", "SØ", "S", "SV", "V", "NV"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

// Finn nærmeste time i hourly-dataene til current_weather.time
function pickHourlyForCurrent(current, hourly) {
  if (!current || !hourly || !Array.isArray(hourly.time)) return null;

  const t = current.time;
  if (!t) return null;

  const idx = hourly.time.indexOf(t);
  const i = idx !== -1 ? idx : 0;

  return {
    apparent_temperature:
      Array.isArray(hourly.apparent_temperature)
        ? hourly.apparent_temperature[i]
        : null,
    humidity:
      Array.isArray(hourly.relative_humidity_2m)
        ? hourly.relative_humidity_2m[i]
        : null,
    pressure:
      Array.isArray(hourly.pressure_msl)
        ? hourly.pressure_msl[i]
        : null,
    uv_index:
      Array.isArray(hourly.uv_index)
        ? hourly.uv_index[i]
        : null,
    gusts:
      Array.isArray(hourly.windgusts_10m)
        ? hourly.windgusts_10m[i]
        : null,
  };
}

export default function Weather({ destination, coords }) {
  const [data, setData] = useState(null); // { current, daily, hourly }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchWeatherByCoords(lat, lon) {
    try {
      setLoading(true);
      setError("");

      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current_weather=true` +
        `&timezone=auto` +
        `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&hourly=apparent_temperature,relative_humidity_2m,pressure_msl,uv_index,windgusts_10m`;

      const r = await fetch(url);
      if (!r.ok) throw new Error(`Feil: ${r.status}`);
      const j = await r.json();

      setData({
        current: j.current_weather || null,
        daily: j.daily || null,
        hourly: j.hourly || null,
      });
    } catch (e) {
      console.error("Værfeil:", e);
      setError("Kunne ikke hente værdata.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Finn koordinater (enten fra props.coords eller via navn) og hent vær
  useEffect(() => {
    let active = true;

    async function resolveAndFetch() {
      // 1) Hvis vi allerede har GPS-koordinater → bruk dem
      if (coords?.lat && coords?.lon) {
        await fetchWeatherByCoords(coords.lat, coords.lon);
        return;
      }

      // 2) Ellers prøv å geokode destinasjonen
      if (destination) {
        try {
          const g = await nameToCoords(destination);
          if (!active) return;
          await fetchWeatherByCoords(g.lat, g.lon);
        } catch (err) {
          console.warn("Kunne ikke hente coords for vær:", err);
          if (active) {
            setError("Ukjent sted for værmelding.");
            setData(null);
          }
        }
      } else {
        // ingen destinasjon
        setData(null);
      }
    }

    resolveAndFetch();
    return () => {
      active = false;
    };
  }, [destination, coords?.lat, coords?.lon]);

  // ---------- UI ----------

  if (loading) {
    return <div className="text-xs text-gray-500">Henter værdata…</div>;
  }
  if (error) {
    return <div className="text-xs text-red-600">⚠️ {error}</div>;
  }
  if (!data || !data.current) {
    return (
      <div className="text-xs text-gray-400">
        Ingen værdata tilgjengelig.
      </div>
    );
  }

  const current = data.current;
  const daily = data.daily;
  const hourly = data.hourly;

  const code = current.weathercode ?? null;
  const icon = iconFor(code);
  const text = WMO_TEXT[code] || "Værdata";

  const temp = Math.round(current.temperature);
  const windKmh = Math.round(current.windspeed);        // km/t fra API
  const windMs = Math.round((current.windspeed || 0) / 3.6); // m/s
  const dirDeg = Math.round(current.winddirection);
  const dirTxt = windDirText(dirDeg);

  const isDay = current.is_day === 1 ? "Dag" : "Natt";
  const updated =
    current.time &&
    new Date(current.time).toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // Ekstra-verdier fra hourly nær "nå"
  const extra = pickHourlyForCurrent(current, hourly) || {};
  const felt = extra.apparent_temperature != null
    ? Math.round(extra.apparent_temperature)
    : null;
  const humidity = extra.humidity != null
    ? Math.round(extra.humidity)
    : null;
  const pressure = extra.pressure != null
    ? Math.round(extra.pressure)
    : null;
  const uv = extra.uv_index != null
    ? Math.round(extra.uv_index)
    : null;
  const gust = extra.gusts != null
    ? Math.round(extra.gusts)
    : null;

  // Bygg 5-dagers varsel hvis vi har daily-data
  let days = [];
  if (daily && Array.isArray(daily.time)) {
    const len = Math.min(daily.time.length, 5);
    for (let i = 0; i < len; i++) {
      const dStr = daily.time[i];
      const d = new Date(dStr);
      const label = d.toLocaleDateString("nb-NO", {
        weekday: "short",
      });
      const dCode = daily.weathercode?.[i];
      const dIcon = iconFor(dCode);
      const tMax = daily.temperature_2m_max?.[i];
      const tMin = daily.temperature_2m_min?.[i];
      const rain = daily.precipitation_sum?.[i];

      days.push({
        label,
        icon: dIcon,
        tMax: tMax != null ? Math.round(tMax) : null,
        tMin: tMin != null ? Math.round(tMin) : null,
        rain: rain != null ? Math.round(rain) : null,
      });
    }
  }

  return (
    <div className="rounded-3xl border border-sky-100 bg-white/80 shadow-sm px-4 py-3 flex flex-col gap-3">
      {/* Topp: ikon + temp + tekst + dag/natt / oppdatert */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{icon}</div>
          <div>
            <div className="text-xl font-semibold">{temp}°C</div>
            <div className="text-xs text-gray-600">{text}</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-gray-500 space-y-1">
          <div>{isDay}</div>
          {updated && <div>Oppdatert: {updated}</div>}
        </div>
      </div>

      {/* Midten: vind + ekstra-verdier */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
        <div>
          Vind:{" "}
          <span className="font-medium">
            {windKmh} km/t ({windMs} m/s)
          </span>
        </div>
        <div>
          Retning:{" "}
          <span className="font-medium">
            {dirTxt} {dirDeg ? `(${dirDeg}°)` : ""}
          </span>
        </div>

        {felt != null && (
          <div>
            Følt temp:{" "}
            <span className="font-medium">{felt}°C</span>
          </div>
        )}
        {humidity != null && (
          <div>
            Luftfuktighet:{" "}
            <span className="font-medium">{humidity}%</span>
          </div>
        )}
        {pressure != null && (
          <div>
            Trykk:{" "}
            <span className="font-medium">{pressure} hPa</span>
          </div>
        )}
        {uv != null && (
          <div>
            UV-indeks:{" "}
            <span className="font-medium">{uv}</span>
          </div>
        )}
        {gust != null && (
          <div>
            Vindkast:{" "}
            <span className="font-medium">{gust} km/t</span>
          </div>
        )}
      </div>

      {/* 5-dagers varsel */}
      {days.length > 0 && (
        <div className="border-t border-sky-50 pt-2">
          <div className="text-[11px] text-gray-500 mb-1">
            5-dagers varsel
          </div>
          <div className="grid grid-cols-5 gap-1 text-[11px]">
            {days.map((d, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center gap-1 rounded-2xl bg-sky-50/70 px-1.5 py-1"
              >
                <div className="font-medium">{d.label}</div>
                <div className="text-lg">{d.icon}</div>
                <div className="flex gap-1">
                  {d.tMin != null && (
                    <span className="text-gray-500">
                      {d.tMin}°
                    </span>
                  )}
                  {d.tMax != null && (
                    <span className="font-semibold">
                      {d.tMax}°
                    </span>
                  )}
                </div>
                {d.rain != null && (
                  <div className="text-gray-500">
                    {d.rain} mm
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
