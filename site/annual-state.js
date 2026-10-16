// Preserve original step IDs; missing electrical solves remain explicit gaps.
export function expandTrace(columns,periods){
 const rows=Array.isArray(columns)?columns:(columns.step||[]).map((_,i)=>Object.fromEntries(Object.entries(columns).map(([k,v])=>[k,['harmonic_voltage_pct','voltage_phase_pu'].includes(k)?v.map(a=>a[i]):v[i]])));
 const result=Array.from({length:periods},(_,step)=>({step,voltage_min_pu:null,voltage_max_pu:null,thdu_pct:null,harmonic_voltage_pct:[],voltage_phase_pu:[],voltage_status:'not_evaluated',harmonic_status:'not_evaluated'}));
 const seen=new Set();for(const row of rows){if(!Number.isInteger(row.step)||row.step<0||row.step>=periods||seen.has(row.step))throw Error('时序记录重复或超出评价窗口');seen.add(row.step);result[row.step]=row;}
 return result;
}
export const pairedDifference=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a-b:null;

export function extremeStep(trace,field,direction){
 let best=null;for(const row of trace)if(Number.isFinite(row?.[field])&&(best===null||direction*row[field]>direction*best[field]))best=row;
 return best?.step??null;
}
