
import { nameToCoords } from './geocode'
import { cachedJson } from '../utils/cachedJson'
const WIKI = 'https://{lang}.wikipedia.org/w/api.php';
const REST = 'https://{lang}.wikipedia.org/api/rest_v1';
function pickLang(language){ const lang=(language||'no').toLowerCase(); return ['no','nb','nn','en'].includes(lang)?lang:'en'; }
function haversine(a,b){ const R=6371000,toRad=x=>x*Math.PI/180; const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon); const la1=toRad(a.lat),la2=toRad(b.lat); const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2; return Math.round(2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))); }
export async function getNearbySights({ destination='Almuñécar', coords=null, radius=3000, language='no' }){
  let lat,lon; if(coords?.lat&&coords?.lon){lat=coords.lat;lon=coords.lon}else{const g=await nameToCoords(destination);lat=g.lat;lon=g.lon}
  const origin={lat,lon}; const lang=pickLang(language); const base=WIKI.replace('{lang}',lang);
  const url=`${base}?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${radius}&gslimit=30&format=json&origin=*`;
  const {data}=await cachedJson(`wiki:gs:${lang}:${lat.toFixed(3)},${lon.toFixed(3)}:${radius}`,async()=>{const r=await fetch(url);return r.json()},900000);
  const pages=(data?.query?.geosearch||[]).slice(0,30);
  return Promise.all(pages.map(async p=>{
    const title=encodeURIComponent(p.title);
    const sumUrl=`${REST.replace('{lang}',lang)}/page/summary/${title}?redirect=true`;
    let js=null; try{const s=await fetch(sumUrl,{headers:{'Accept':'application/json'}}); js=s.ok?await s.json():null;}catch{}
    const placeCoord=(p.lat&&p.lon)?{lat:p.lat,lon:p.lon}:null;
    const distanceMeters=placeCoord? haversine(origin,placeCoord):null;
    const map=placeCoord?`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`:(js?.content_urls?.desktop?.page||js?.content_urls?.mobile?.page||'');
    return { name: js?.title||p.title, area: destination, type: js?.description||'Attraction', category:'See & do', desc: js?.extract||'', map, image: js?.thumbnail?.source||null, distanceMeters, lat:p.lat||null, lon:p.lon||null };
  }));
}
