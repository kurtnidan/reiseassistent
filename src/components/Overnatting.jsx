import React from 'react'
import FavoriteButton from './FavoriteButton.jsx'

/** Format YYYY-MM-DD fra <input type="date"> verdi */
function fmt(d){
  if(!d) return ''
  const dt = new Date(d)
  if (isNaN(+dt)) return '' // robust mot ugyldig dato
  const y = dt.getFullYear()
  const m = String(dt.getMonth()+1).padStart(2,'0')
  const dd = String(dt.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}

/** Nøkkel i localStorage per destinasjon */
function keyFor(dest){ return `lodging:${(dest||'').trim().toLowerCase()}` }

function buildGoogleUrl(destination, googleType) {
  const dest = (destination || '').trim()
  if (!dest) return 'https://www.google.com/maps'

  const enc = (s) => encodeURIComponent(s)
  const baseMaps = 'https://www.google.com/maps/search/'

  switch (googleType) {
    case 'hotel':
      return `https://www.google.com/travel/hotels/${enc(dest)}`
    case 'camping':
      return `${baseMaps}${enc(`camping nær ${dest}`)}`
    case 'rv':
      return `${baseMaps}${enc(`bobilplass OR caravan park nær ${dest}`)}`
    case 'cabin':
      return `${baseMaps}${enc(`hytte overnatting nær ${dest}`)}`
    case 'all':
    default:
      return `${baseMaps}${enc(`overnatting nær ${dest}`)}`
  }
}

export default function Overnatting({ destination='Almuñécar' }){
  const storageKey = keyFor(destination)

  const [checkin, setCheckin]   = React.useState('')
  const [checkout, setCheckout] = React.useState('')
  const [guests, setGuests]     = React.useState(2)

  // Airbnb-type flyttes ned i Airbnb-kortet ✔
  const [airbnbType, setAirbnbType] = React.useState('any')

  // Google-type i Google-kortet
  const [googleType, setGoogleType] = React.useState('all')

  // last lagrede preferanser når destinasjon endres
  React.useEffect(()=>{
    try{
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      if (saved.checkin) setCheckin(saved.checkin)
      if (saved.checkout) setCheckout(saved.checkout)
      if (saved.guests) setGuests(saved.guests)
      if (saved.airbnbType) setAirbnbType(saved.airbnbType)
      if (saved.googleType) setGoogleType(saved.googleType)
    }catch{}
  }, [storageKey])

  // lagre ved endring
  React.useEffect(()=>{
    const payload = { checkin, checkout, guests, airbnbType, googleType }
    try { localStorage.setItem(storageKey, JSON.stringify(payload)) } catch {}
  }, [storageKey, checkin, checkout, guests, airbnbType, googleType])

  const q = encodeURIComponent(destination)

  // --- Airbnb ---
  const airbnbBase = `https://www.airbnb.com/s/${q}/homes?query=${q}`
  const airbnbDates = (checkin && checkout) ? `&checkin=${fmt(checkin)}&checkout=${fmt(checkout)}` : ''
  const airbnbGuests = `&adults=${guests}`
  const airbnbTypeParam =
    airbnbType === 'entire'  ? `&room_types[]=Entire%20home/apt` :
    airbnbType === 'private' ? `&room_types[]=Private%20room` :
    airbnbType === 'hotel'   ? `&category_tag=Tag:8225` :
    ''
  const airbnbUrl = `${airbnbBase}${airbnbDates}${airbnbGuests}${airbnbTypeParam}`

  // --- Booking.com ---
  const bookingBase = `https://www.booking.com/searchresults.html?ss=${q}`
  const bookingDates = (checkin && checkout)
    ? `&checkin=${fmt(checkin)}&checkout=${fmt(checkout)}`
    : ''
  const bookingGuests = `&group_adults=${guests}`
  const bookingUrl = `${bookingBase}${bookingDates}${bookingGuests}`

  // --- Google ---
  const gLodgingUrl = buildGoogleUrl(destination, googleType)

  const descParts = [
    (checkin && checkout) ? `Dato: ${fmt(checkin)} → ${fmt(checkout)}` : null,
    guests ? `Gjester: ${guests}` : null,
    airbnbType !== 'any' ? `Airbnb-type: ${airbnbType}` : null,
  ]
  const desc = descParts.filter(Boolean).join(' • ')

  const favAirbnb  = { name: `Airbnb – ${destination}`,            category: 'Overnatting', desc, map: airbnbUrl }
  const favBooking = { name: `Booking.com – ${destination}`,        category: 'Overnatting', desc, map: bookingUrl }
  const favGoogle  = { name: `Google overnatting – ${destination}`, category: 'Overnatting', desc, map: gLodgingUrl }

  return (
    <div className="space-y-3">

      {/* Skjema (bare dato og gjester nå) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-xs">
          Innsjekk
          <input
            className="input mt-1 w-full"
            type="date"
            value={checkin}
            onChange={e=>setCheckin(e.target.value)}
          />
        </label>

        <label className="text-xs">
          Utsjekk
          <input
            className="input mt-1 w-full"
            type="date"
            value={checkout}
            onChange={e=>setCheckout(e.target.value)}
          />
        </label>

        <label className="text-xs">
          Gjester
          <select
            className="select mt-1 w-full"
            value={guests}
            onChange={e=>setGuests(Number(e.target.value)||1)}
          >
            {[1,2,3,4,5,6,7,8].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {/* Overnatting-kort */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

        {/* Airbnb */}
        <div className="card p-3 border-indigo-200 space-y-2">
          <div className="text-sm font-medium">Airbnb</div>

          {/* Airbnb-type FLYTTET HIT ✔ */}
          <label className="text-xs block">
            Airbnb-type
            <select
              className="select mt-1 w-full"
              value={airbnbType}
              onChange={e => setAirbnbType(e.target.value)}
            >
              <option value="any">Alle typer</option>
              <option value="entire">Hele bolig</option>
              <option value="private">Privat rom</option>
              <option value="hotel">Hotell</option>
            </select>
          </label>

          <div className="flex items-center gap-2 pt-1">
            <a className="btn flex-1" href={airbnbUrl} target="_blank" rel="noreferrer">
              Åpne Airbnb
            </a>
            <FavoriteButton item={favAirbnb} />
          </div>

          {desc && <div className="text-xs text-gray-500">{desc}</div>}
        </div>

        {/* Booking.com */}
        <div className="card p-3 border-emerald-200 space-y-2">
          <div className="text-sm font-medium">Booking.com</div>

          <div className="flex items-center gap-2 pt-1">
            <a className="btn flex-1" href={bookingUrl} target="_blank" rel="noreferrer">
              Åpne Booking.com
            </a>
            <FavoriteButton item={favBooking} />
          </div>

          {desc && <div className="text-xs text-gray-500">{desc}</div>}
        </div>

        {/* Google overnatting */}
        <div className="card p-3 border-rose-200 space-y-2">
          <div className="text-sm font-medium">Google overnatting</div>

          {/* Google-type valg */}
          <label className="text-xs block">
            Google-type
            <select
              className="select mt-1 w-full"
              value={googleType}
              onChange={e => setGoogleType(e.target.value)}
            >
              <option value="all">Alle overnattingstyper</option>
              <option value="hotel">Hotell (Google Hotels)</option>
              <option value="camping">Camping</option>
              <option value="rv">Bobil / caravan</option>
              <option value="cabin">Hytte / lodge</option>
            </select>
          </label>

          <div className="flex items-center gap-2 pt-1">
            <a className="btn flex-1" href={gLodgingUrl} target="_blank" rel="noreferrer">
              Åpne Google
            </a>
            <FavoriteButton item={favGoogle} />
          </div>

          {desc && <div className="text-xs text-gray-500">{desc}</div>}
        </div>
      </div>
    </div>
  )
}
