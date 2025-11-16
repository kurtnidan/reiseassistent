import React from 'react'
export default function Accordion({ title, defaultOpen=false, children }){
  const [open,setOpen] = React.useState(defaultOpen)
  return (
    <div className="border rounded-2xl bg-white">
      <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={()=>setOpen(o=>!o)}>
        <span className="font-medium">{title}</span>
        <span className="text-gray-500">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
