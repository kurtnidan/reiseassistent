
# Reiseassistent – komplett
- PWA offline (Workbox)
- Auto språk (NO/EN)
- Wikipedia-severdigheter (avstand + Google Maps)
- Google Nearby (krever VITE_GOOGLE_API_KEY)
- Vær (Open-Meteo) + Valuta (exchangerate.host)
- Favoritter + PDF/Markdown-eksport
- Rute til Google Maps
- Innbyggere (lav/høy sesong)
- Overnatting (Airbnb/Booking/Hotels)

## Start (dev)
```
npm install
npm run dev
```

## Miljøvariabler
`.env` i prosjektroten:
```
VITE_GOOGLE_API_KEY=DIN_GOOGLE_PLACES_NØKKEL
```
Aktiver i Google Cloud: *Places API* og *Maps JavaScript API* + billing.
