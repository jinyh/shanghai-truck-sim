// Connectivity and paths are derived exclusively from the registered network.
export function networkGraph(network){
 const edges=[...network.lines,...network.transformers],nodes=new Map(network.buses.map(b=>[b.id,{...b,children:[]}])) ,parents=new Map();
 for(const e of edges){if(!nodes.has(e.from_bus)||!nodes.has(e.to_bus))throw Error('网模存在未登记节点');if(parents.has(e.to_bus))throw Error('展示仅支持已登记的径向等值网络');parents.set(e.to_bus,e);nodes.get(e.from_bus).children.push(e.to_bus);}
 const roots=[...nodes.keys()].filter(id=>!parents.has(id));if(roots.length!==1)throw Error('网模源节点不唯一');
 const path=id=>{const result=[];const seen=new Set();while(parents.has(id)){if(seen.has(id))throw Error('网模存在环路');seen.add(id);const e=parents.get(id);result.unshift(e);id=e.from_bus;}return result;};for(const id of nodes.keys())path(id);
 return {nodes,edges,parents,root:roots[0],path};
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class NetworkView{
 constructor(el,onPick){this.el=el;this.onPick=onPick;}
 render(data,baseline,station,step,selected){const graph=networkGraph(data.network),bus=data.network.station_buses[station],stationPath=graph.path(bus);const feeder=stationPath.find(e=>graph.nodes.get(e.to_bus).kind==='feeder')?.to_bus;
 const leaves=[...graph.nodes.values()].filter(n=>!n.children.length&&graph.path(n.id).some(e=>e.to_bus===feeder));const paths=leaves.map(n=>graph.path(n.id));const edges=[...new Map(paths.flat().map(e=>[e.id,e])).values()];const pos=new Map();
 const place=(id,depth=0)=>{const children=edges.filter(e=>e.from_bus===id).map(e=>e.to_bus);const ys=children.map(c=>place(c,depth+1));const y=ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:55+leaves.findIndex(n=>n.id===id)*90;pos.set(id,{x:65+depth*220,y});return y;};place(graph.root);
 const number=x=>Number.isFinite(x)?x.toFixed(1)+'%':'未评估';const h=Math.max(300,leaves.length*90+30);
 this.el.innerHTML=`<div class="topology-heading"><b>${esc(feeder)} · 共享供电关系</b><p>按所选馈线展开 · 上级负荷含其他支路 · 点击查看配对读数；线条为供电关系示意</p></div><div class="topology-scroll"><svg viewBox="0 0 1080 ${h}" role="group" aria-label="登记电网连接关系">${edges.map(e=>{const a=pos.get(e.from_bus),b=pos.get(e.to_bus),v=data.equipment[e.id]?.loading_pct[step],before=baseline.equipment[e.id]?.loading_pct[step];return `<g tabindex="0" role="button" aria-label="${esc(e.id)}" data-object="${esc(e.id)}"><path d="M${a.x},${a.y} H${(a.x+b.x)/2} V${b.y} H${b.x}" fill="none" stroke="${v>100?'#b34836':'#7b9f97'}" stroke-width="${selected===e.id?5:2.5}"/><rect x="${b.x-176}" y="${b.y-33}" width="158" height="55" rx="9" fill="#ffffff" stroke="${v>100?'#c56b5d':'#d4e0dc'}"/><text x="${b.x-97}" y="${b.y-12}" text-anchor="middle" fill="#264d40" font-size="19">${esc(e.id)} · ${number(v)}</text><text x="${b.x-97}" y="${b.y+10}" text-anchor="middle" fill="#667b73" font-size="14">背景 ${number(before)}</text></g>`;}).join('')}${[...pos].map(([id,p])=>{const n=graph.nodes.get(id),v=data.trace[id]?.[step];return `<g tabindex="0" role="button" aria-label="${esc(n.name||id)}" data-object="${esc(id)}"><circle cx="${p.x}" cy="${p.y}" r="${selected===id?9:6}" fill="${v?.voltage_status==='exceeds_reference'?'#b34836':'#267761'}"/><text x="${p.x}" y="${p.y+38}" text-anchor="middle" fill="#29473c" font-size="18">${esc(n.name||id)}</text><text x="${p.x}" y="${p.y+58}" text-anchor="middle" fill="#667b73" font-size="14">${esc(id)}${v?' · '+v.voltage_min_pu.toFixed(3)+' pu':''}</text></g>`;}).join('')}</svg></div>`;
 this.el.querySelectorAll('[data-object]').forEach(el=>{el.onclick=()=>this.onPick(el.dataset.object);el.onkeydown=e=>{if(e.key==='Enter')el.click();};});
 }
}
