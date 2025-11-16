import React from 'react'

export default function FavoriteButton({ item }){
  const [on,setOn] = React.useState(false)

  React.useEffect(()=>{
    try {
      const list = JSON.parse(localStorage.getItem('fav')||'[]')
      setOn(list.some(x => x.name===item.name && x.category===item.category))
    } catch {}
  }, [item])

  function toggle(){
    try {
      const key = 'fav'
      const list = JSON.parse(localStorage.getItem(key)||'[]')
      const idx = list.findIndex(x => x.name===item.name && x.category===item.category)
      if (idx>=0) list.splice(idx,1)
      else list.push(item)
      localStorage.setItem(key, JSON.stringify(list))
      setOn(idx<0)
      // 🔔 Varsle resten av appen at favoritter endret seg
      window.dispatchEvent(new CustomEvent('fav:changed'))
    } catch {}
  }

  return (
    <button
      className={'inline-flex items-center rounded-lg border px-2 py-0.5 text-xs ' + (on?'border-yellow-400':'border-gray-200')}
      onClick={toggle}
      title="Lagre som favoritt"
    >
      {on ? '★' : '☆'} Favoritt
    </button>
  )
}
