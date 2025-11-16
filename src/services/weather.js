
import { cachedJson } from '../utils/cachedJson'
import { nameToCoords } from './geocode'
export async function getWeather({destination,coords,unit='celsius'}){
  let lat,lon;
  if(coords?.lat&&coords?.lon){lat=coords.lat;lon=coords.lon}
  else { const g = await nameToCoords(destination||'Almuñécar'); lat=g.lat; lon=g.lon }
  const params = new URLSearchParams({latitude:lat,longitude:lon,hourly:'temperature_2m',daily:'temperature_2m_min,temperature_2m_max',timezone:'auto'})
  const {data} = await cachedJson(`wx:${lat},${lon}`, async()=>{
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`); return r.json()
  }, 30*60*1000)
  const tmin = data?.daily?.temperature_2m_min?.[0]; const tmax=data?.daily?.temperature_2m_max?.[0];
  return { lat,lon,tmin,tmax }
}
