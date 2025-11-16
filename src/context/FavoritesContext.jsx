
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
const Ctx = createContext(null)
export function FavoritesProvider({ children }){
  const [items, setItems] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('favorites')||'[]') }catch{ return [] } })
  useEffect(()=>{ try{ localStorage.setItem('favorites', JSON.stringify(items)) }catch{} }, [items])
  function toggle(item){
    setItems(prev => {
      const key = item.name + '|' + (item.type || item.category || '')
      const idx = prev.findIndex(x => (x.name + '|' + (x.type||x.category||'')) === key)
      if (idx >= 0) return [...prev.slice(0,idx), ...prev.slice(idx+1)]
      return [...prev, item]
    })
  }
  const value = useMemo(()=>({ items, toggle, clear: ()=> setItems([]) }), [items])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useFavorites(){ return useContext(Ctx) }
