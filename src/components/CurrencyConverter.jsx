// src/components/CurrencyConverter.jsx
import React, { useState } from "react";

// 🔹 La til AUD her
const CURRENCIES = ["NOK", "EUR", "USD", "GBP", "SEK", "DKK", "AUD"];
const API = "https://api.frankfurter.app/latest";

export default function CurrencyConverter() {
  const [amount, setAmount] = useState(1);
  const [from, setFrom] = useState("NOK");
  const [to, setTo] = useState("EUR");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function convert() {
    const a = Number(amount);

    setError("");
    setResult(null);

    if (!Number.isFinite(a) || a <= 0) {
      setError("Beløpet må være et positivt tall.");
      return;
    }

    if (from === to) {
      setResult(a);
      return;
    }

    try {
      setLoading(true);

      const url =
        `${API}?amount=${encodeURIComponent(a)}` +
        `&from=${encodeURIComponent(from)}` +
        `&to=${encodeURIComponent(to)}`;

      const resp = await fetch(url);

      if (!resp.ok) {
        throw new Error(`Valutaserver svarte ${resp.status}`);
      }

      const json = await resp.json();
      // Forventet format: { amount, base, date, rates: { [to]: number } }
      const rateValue =
        json &&
        json.rates &&
        typeof json.rates[to] === "number"
          ? json.rates[to]
          : null;

      if (rateValue == null) {
        console.warn("Valuta – uventet JSON", json);
        throw new Error("Kunne ikke lese data fra valutaserver.");
      }

      setResult(rateValue);
    } catch (e) {
      console.error("Valuta-feil", e);
      setError(e.message || "Uventet feil fra valutaserver.");
    } finally {
      setLoading(false);
    }
  }

  function swap() {
    setFrom(to);
    setTo(from);
    setResult(null);
    setError("");
  }

  return (
    <div className="card p-4 border-emerald-200 space-y-2">
      <div className="text-sm font-medium">Valutaomregner</div>

      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
        {/* Beløp */}
        <label className="text-xs">
          Beløp
          <input
            className="input w-full mt-1"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        {/* Midtknapp: bytt */}
        <div className="flex flex-col items-center gap-1 mb-1">
          <button type="button" className="btn text-xs" onClick={swap}>
            Bytt ⇄
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Fra */}
          <label className="text-xs">
            Fra
            <select
              className="select w-full mt-1"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setResult(null);
                setError("");
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {/* Til */}
          <label className="text-xs">
            Til
            <select
              className="select w-full mt-1"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setResult(null);
                setError("");
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex justify-between items-center mt-1">
        <button
          type="button"
          className="btn text-sm"
          onClick={convert}
          disabled={loading}
        >
          {loading ? "Regner…" : "Regn ut"}
        </button>

        {result != null && !error && (
          <div className="text-sm font-semibold">
            ≈ {result.toFixed(2)} {to}
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 mt-1">
          ⚠️ {error}
        </div>
      )}

      <div className="text-[11px] text-gray-500">
        Kurser fra api.frankfurter.app (ECB).
      </div>
    </div>
  );
}
