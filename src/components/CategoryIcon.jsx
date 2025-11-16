import React from 'react'
const MAP = {
  restaurant: '/icons/restaurant.svg',
  bar: '/icons/bar.svg',
  cafe: '/icons/cafe.svg',
  ice_cream: '/icons/icecream.svg',
  hotel: '/icons/hotel.svg'
}
export default function CategoryIcon({ type='restaurant', className='w-4 h-4 opacity-70' }){
  const src = MAP[type] || MAP.restaurant
  return <img src={src} alt="" className={className} />
}
