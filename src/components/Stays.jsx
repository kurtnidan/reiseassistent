
import React, { useMemo, useState } from "react";
import { getLang } from "../i18n/strings";
function addDays(iso,n){const d=new Date(iso);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
export default function Stays({ destination="Almuñécar" }){
  const lang=getLang();
  const [platform,setPlatform]=useState("airbnb"); const today=new Date().toISOString().slice(0,10);
  const [checkin,setCheckin]=useState(today); const [nights,setNights]=useState(5); const [adults,setAdults]=useState(2); const [children,setChildren]=useState(0); const [entire,setEntire]=useState(true);
  const checkout=useMemo(()=>addDays(checkin,Number(nights)||1),[checkin,nights]);
  function buildUrl(){ if(!destination) return "#";
    if(platform==="airbnb"){const base="https://www.airbnb.com/s"; const type=entire?"homes":"rooms"; const params=new URLSearchParams({query:destination,adults:String(adults||1),children:String(children||0),checkin,checkout}).toString(); return `${base}/${encodeURIComponent(destination)}/${type}?${params}`;}
    if(platform==="booking"){const params=new URLSearchParams({ss:destination,checkin,checkout,group_adults:String(adults||1),group_children:String(children||0),no_rooms:"1",lang:lang==="no"?"no":"en"}).toString(); return `https://www.booking.com/searchresults.html?${params}`;}
    if(platform==="hotels"){const params=new URLSearchParams({q:destination,checkIn:checkin,checkOut:checkout,adults:String(adults||1),children:String(children||0)}).toString(); return `https://www.hotels.com/Hotel-Search?${params}`;}
    return "#"; }
  function openSearch(){const url=buildUrl(); if(url==="#") return; window.open(url,"_blank","noopener")}
  // remember last selection
  React.useEffect(()=>{ try{ localStorage.setItem('stays:pref', JSON.stringify({platform,adults,children,nights,entire})) }catch{} },[platform,adults,children,nights,entire])
  React.useEffect(()=>{ try{ const raw=localStorage.getItem('stays:pref'); if(raw){ const p=JSON.parse(raw); setPlatform(p.platform||'airbnb'); setAdults(p.adults||2); setChildren(p.children||0); setNights(p.nights||5); setEntire(!!p.entire) } }catch{} },[])
  return (<div className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <label className="text-xs">Plattform<select className="w-full rounded-md border px-2 py-1 text-sm mt-1" value={platform} onChange={e=>setPlatform(e.target.value)}><option value="airbnb">Airbnb</option><option value="booking">Booking.com</option><option value="hotels">Hotels.com</option></select></label>
    <label className="text-xs">Destinasjon<input className="w-full rounded-md border px-2 py-1 text-sm mt-1" value={destination} readOnly/></label>
    <label className="text-xs">Innsjekk<input type="date" className="w-full rounded-md border px-2 py-1 text-sm mt-1" value={checkin} onChange={e=>setCheckin(e.target.value)}/></label>
    <label className="text-xs">Netter<select className="w-full rounded-md border px-2 py-1 text-sm mt-1" value={nights} onChange={e=>setNights(Number(e.target.value))}>{[1,2,3,4,5,7,10,14].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <label className="text-xs">Voksne<input type="number" min="1" className="w-full rounded-md border px-2 py-1 text-sm mt-1" value={adults} onChange={e=>setAdults(Number(e.target.value))}/></label>
    <label className="text-xs">Barn<input type="number" min="0" className="w-full rounded-md border px-2 py-1 text-sm mt-1" value={children} onChange={e=>setChildren(Number(e.target.value))}/></label>
    {platform==="airbnb" && (<label className="text-xs flex items-center gap-2"><input type="checkbox" className="mt-1" checked={entire} onChange={e=>setEntire(e.target.checked)}/>Hele sted (ikke delt)</label>)}
  </div><div className="text-xs text-gray-500">Åpner et trygt nettsøk – ingen scraping eller nøkkel kreves.</div><button className="btn" onClick={openSearch}>Søk overnatting</button></div>)}
