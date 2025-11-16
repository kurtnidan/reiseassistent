
import React, { useEffect, useState } from 'react'
import { getFx } from '../services/fx'
import { t } from '../i18n/strings'
export default function Fx({ base='NOK', target='EUR' }){
  const [fx, setFx] = useState({status:'loading', rate:0})
  useEffect(()=>{ let ok=true; getFx(base,target).then(r=> ok && setFx({status:'ready', rate:r.rate})).catch(()=> ok && setFx({status:'error'})); return ()=>{ ok=false } },[base,target])
  if (fx.status==='loading') return <div className="text-sm text-gray-500">{t('fx_loading')}</div>
  if (fx.status==='error') return <div className="text-sm text-red-600">{t('fx_error')}</div>
  return <div className="text-sm">1 {base} ≈ <b>{fx.rate.toFixed(3)}</b> {target}</div>
}
