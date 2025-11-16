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

export default function Overnatting({ destination='Almuñécar' }){
  // last tidligere valg for gjeldende destinasjon om de finnes
  const storageKey = keyFor(destination)
  const [checkin, setCheckin]   = React.useState('')
  const [checkout, setCheckout] = React.useState('')
  const [guests, setGuests]     = React.useState(2)
  const [airbnbType, setAirbnbType] = React.useState('any') // any | entire | private | hotel

  // last lagrede preferanser når destinasjon endres
  React.useEffect(()=>{
    try{
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      if (saved.checkin) setCheckin(saved.checkin)
      if (saved.checkout) setCheckout(saved.checkout)
      if (saved.guests) setGuests(saved.guests)
      if (saved.airbnbType) setAirbnbType(saved.airbnbType)
    }catch{}
  }, [storageKey])

  // lagre ved endring
  React.useEffect(()=>{
    const payload = { checkin, checkout, guests, airbnbType }
    try { localStorage.setItem(storageKey, JSON.stringify(payload)) } catch {}
  }, [storageKey, checkin, checkout, guests, airbnbType])

  const q = encodeURIComponent(destination)

  // --- Airbnb ---
  // NB: Airbnb endrer av og til parameternavn; disse fungerer stabilt i praksis.
  const airbnbBase = `https://www.airbnb.com/s/${q}/homes?query=${q}`
  const airbnbDates = (checkin && checkout) ? `&checkin=${fmt(checkin)}&checkout=${fmt(checkout)}` : ''
  const airbnbGuests = `&adults=${guests}`
  const airbnbTypeParam =
    airbnbType === 'entire'  ? `&room_types[]=Entire%20home/apt` :
    airbnbType === 'private' ? `&room_types[]=Private%20room` :
    airbnbType === 'hotel'   ? `&category_tag=Tag:8225` : // "Hotels" kategori
    ''
  const airbnbUrl = `${airbnbBase}${airbnbDates}${airbnbGuests}${airbnbTypeParam}`

  // --- Booking.com ---
  const bookingBase = `https://www.booking.com/searchresults.html?ss=${q}`
  const bookingDates = (checkin && checkout)
    ? `&checkin=${fmt(checkin)}&checkout=${fmt(checkout)}`
    : ''
  const bookingGuests = `&group_adults=${guests}`
  const bookingUrl = `${bookingBase}${bookingDates}${bookingGuests}`

  // --- Google Hotels ---
  const ghotelsUrl = `https://www.google.com/travel/hotels/${q}`

  // Beskrivelseslinje som lagres i favoritt
  const desc = [
    (checkin && checkout) ? `Dato: ${fmt(checkin)} → ${fmt(checkout)}` : null,
    guests ? `Gjester: ${guests}` : null,
    airbnbType !== 'any' ? `Airbnb-type: ${airbnbType}` : null,
  ].filter(Boolean).join(' • ')

  // Favoritt-objekter: bruker "map" til URL så knappen i Favoritter blir "Åpne"
  const favAirbnb = { name: `Airbnb – ${destination}`, category: 'Overnatting', desc, map: airbnbUrl }
  const favBooking = { name: `Booking.com – ${destination}`, category: 'Overnatting', desc, map: bookingUrl }
  const favHotels  = { name: `Google Hotels – ${destination}`, category: 'Overnatting', desc, map: ghotelsUrl }

  return (
    <div className="space-y-3">
      {/* Skjema */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <label className="text-xs">Innsjekk
          <input className="input mt-1 w-full" type="date" value={checkin} onChange={e=>setCheckin(e.target.value)} />
        </label>
        <label className="text-xs">Utsjekk
          <input className="input mt-1 w-full" type="date" value={checkout} onChange={e=>setCheckout(e.target.value)} />
        </label>
        <label className="text-xs">Gjester
          <select className="select mt-1 w-full" value={guests} onChange={e=>setGuests(Number(e.target.value)||1)}>
            {[1,2,3,4,5,6,7,8].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-xs">Airbnb-type
          <select className="select mt-1 w-full" value={airbnbType} onChange={e=>setAirbnbType(e.target.value)}>
            <option value="any">Alle typer</option>
            <option value="entire">Hele bolig</option>
            <option value="private">Privat rom</option>
            <option value="hotel">Hotell</option>
          </select>
        </label>
      </div>

      {/* Kort med lenker + favoritt */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="card p-3 border-indigo-200">
          <div className="text-sm font-medium mb-2">Airbnb</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={airbnbUrl} target="_blank" rel="noreferrer">Åpne Airbnb</a>
            <FavoriteButton item={favAirbnb} />
          </div>
          {desc && <div className="text-xs text-gray-500 mt-2">{desc}</div>}
        </div>

        <div className="card p-3 border-emerald-200">
          <div className="text-sm font-medium mb-2">Booking.com</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={bookingUrl} target="_blank" rel="noreferrer">Åpne Booking.com</a>
            <FavoriteButton item={favBooking} />
          </div>
          {desc && <div className="text-xs text-gray-500 mt-2">{desc}</div>}
        </div>

        <div className="card p-3 border-rose-200">
          <div className="text-sm font-medium mb-2">Google Hotels</div>
          <div className="flex items-center gap-2">
            <a className="btn flex-1" href={ghotelsUrl} target="_blank" rel="noreferrer">Åpne Google Hotels</a>
            <FavoriteButton item={favHotels} />
          </div>
          {desc && <div className="text-xs text-gray-500 mt-2">{desc}</div>}
        </div>
      </div>
    </div>
  )
}
