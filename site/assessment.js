// Display-only projections of recorded results. No solver or threshold inference.
export const finite = Number.isFinite;
export const number = (v, digits=1) => finite(v) ? v.toLocaleString('zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits}) : '未评估';
export const escape = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const stamp = v => v ? v.slice(5,16).replace('T',' ')+' +08' : '未评估';
export function extreme(rows,key,direction='min') {
  return (rows || []).filter(r=>finite(r[key])).reduce((best,r)=>!best || (direction==='min' ? r[key]<best[key] : r[key]>best[key]) ? r : best,null);
}
export function qualitySummary(c,baseline) {
  const q=c.power_quality, nodes=q.nodes || [], pairs=q.paired_deltas || [];
  const complete=q.status==='completed' && !(q.failures || []).length;
  const covered=kind=>complete && nodes.length>0 && nodes.every(n=>finite(n[kind==='voltage'?'voltage_min_pu':'max_thdu_pct']) && finite(n[kind==='voltage'?'voltage_exceedance_steps':'harmonic_exceedance_steps']) && (kind==='voltage'?finite(n.criteria?.voltage_min_pu)&&finite(n.criteria?.voltage_max_pu):finite(n.criteria?.thdu_pct)&&Object.keys(n.criteria?.individual_harmonic_pct||{}).length===24));
  const status=kind=>!covered(kind)?'未完整评估':nodes.some(n=>n[kind==='voltage'?'voltage_exceedance_steps':'harmonic_exceedance_steps']>0)?'超出参考范围':'登记参考范围内';
  const worstAsset=[...(c.metrics.assets||[])].filter(a=>a.type!=='station'&&finite(a.max_loading_pct)).sort((a,b)=>b.max_loading_pct-a.max_loading_pct)[0];
  const users=nodes.filter(n=>['industrial','residential','commercial','mixed'].includes(n.kind));
  const nodeCount=field=>pairs.filter(p=>finite(p[field])&&p[field]>0).length;
  return {complete,voltageStatus:status('voltage'),harmonicStatus:status('harmonic'),worstAsset,users,
    backgroundVoltageNodes:covered('voltage')?nodeCount('background_voltage_exceedance_steps'):null,
    addedVoltageNodes:covered('voltage')?nodeCount('new_voltage_exceedance_steps'):null,
    addedHarmonicNodes:covered('harmonic')?nodeCount('new_harmonic_exceedance_steps'):null,
    backgroundHarmonicNodes:covered('harmonic')?(baseline?.power_quality.nodes||[]).filter(n=>n.harmonic_exceedance_steps>0).length:null,
    vmin:extreme(nodes,'voltage_min_pu'),thdmax:extreme(nodes,'max_thdu_pct','max')};
}
export function nodeImpact(c,baseline,id,step) {
  const info=c.power_quality.nodes.find(n=>n.id===id), rows=c.power_quality.trace[id]||[];
  const now=rows.find(r=>r.step===step), before=(baseline?.power_quality.trace[id]||[]).find(r=>r.step===step);
  const diff=key=>finite(now?.[key])&&finite(before?.[key])?now[key]-before[key]:null;
  return {info,now,before,voltageDelta:diff('voltage_min_pu'),thdDelta:diff('thdu_pct'),minimum:extreme(rows,'voltage_min_pu'),maximum:extreme(rows,'thdu_pct','max'),paired:c.power_quality.paired_deltas?.find(p=>p.node_id===id)};
}
export function capacitySummary(r) {
  const assets=r.metrics.assets || [], worst=[...assets].filter(a=>finite(a.max_loading_pct)).sort((a,b)=>b.max_loading_pct-a.max_loading_pct)[0];
  const capacity=assets.length&&assets.every(a=>finite(a.max_excess_kw))?(assets.some(a=>a.max_excess_kw>1e-4)?'存在容量越限':'登记有功限额内'):'未完整评估';
  return {worst,capacity,service:finite(r.metrics.shortfall_kwh)?(r.metrics.shortfall_kwh>.001?'存在车辆欠充':'运输电量满足'):'未评估'};
}
export function readState(defaults,allowed={}) {
  const p=new URLSearchParams(location.search), out={...defaults};
  for(const [k,initial] of Object.entries(defaults)) {
    if(!p.has(k))continue;
    const raw=p.get(k); if(allowed[k]&&!allowed[k].includes(raw))continue;
    if(typeof initial==='number'){const n=Number(raw);if(Number.isInteger(n)&&n>=0)out[k]=n;}
    else out[k]=raw;
  }
  return out;
}
export function saveState(state,replace=false) {
  const url=new URL(location.href);url.search=new URLSearchParams(Object.entries(state).map(([k,v])=>[k,String(v)])).toString();
  if(url.href!==location.href)history[replace?'replaceState':'pushState'](null,'',url);
}
export function coverageHTML({capacity,voltage,harmonics,service}) {
  return `<div class="coverage-grid">${[['运输履约',service],['容量边界',capacity],['稳态电压',voltage],['2—25次谐波',harmonics],['谐波电流分配','未评估'],['短路 / 保护','未评估'],['转供 / 可靠性','未评估'],['闪变 / 暂降','未评估']].map(([k,v])=>`<div><span>${escape(k)}</span><b class="${/越限|超出|欠充/.test(v)?'bad':/未|失败/.test(v)?'neutral':''}">${escape(v)}</b></div>`).join('')}</div>`;
}
