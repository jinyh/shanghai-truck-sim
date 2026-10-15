// A local SVG viewport: no tile service, tracking, or network dependency.
export function mapControls(svg, controls, onChange=()=>{}) {
 const original=[0,0,1000,600];let box=[...original],pointers=new Map(),moved=false;
 const apply=()=>{svg.setAttribute('viewBox',box.join(' '));const out=controls.querySelector('output');if(out)out.textContent=`${Math.round(100000/box[2])}%`;onChange([...box]);};
 const point=(x,y)=>{const m=svg.getScreenCTM();return m?new DOMPoint(x,y).matrixTransform(m.inverse()):new DOMPoint();};
 const zoom=(factor,x=box[0]+box[2]/2,y=box[1]+box[3]/2)=>{const w=Math.max(80,Math.min(1600,box[2]/factor)),f=w/box[2];box=[x+(box[0]-x)*f,y+(box[1]-y)*f,w,box[3]*f];apply();};
 svg.style.touchAction='none';svg.setAttribute('tabindex','0');
 svg.addEventListener('wheel',e=>{e.preventDefault();const p=point(e.clientX,e.clientY);zoom(Math.exp(-e.deltaY*.0015),p.x,p.y);},{passive:false});
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;if(!e.target.closest('[data-station]'))svg.setPointerCapture(e.pointerId);});
 svg.addEventListener('pointermove',e=>{
  const old=pointers.get(e.pointerId);if(!old)return;
  const current={x:e.clientX,y:e.clientY};const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)?.[1];
  if(Math.hypot(current.x-old.x,current.y-old.y)>2){moved=true;svg.setPointerCapture(e.pointerId);}
  if(other){const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(current.x-other.x,current.y-other.y);const p=point((current.x+other.x)/2,(current.y+other.y)/2);if(before>0)zoom(after/before,p.x,p.y);}
  else{const a=point(old.x,old.y),b=point(current.x,current.y);box[0]+=a.x-b.x;box[1]+=a.y-b.y;apply();}
  pointers.set(e.pointerId,current);
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(event,e=>pointers.delete(e.pointerId));
 svg.addEventListener('click',e=>{if(moved){e.stopImmediatePropagation();e.preventDefault();moved=false;}},true);
 svg.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){zoom(1.35);}else if(e.key==='-'){zoom(1/1.35);}else if(e.key==='Home'){box=[...original];apply();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){box[0]+=({'ArrowLeft':-1,'ArrowRight':1}[e.key]||0)*box[2]*.1;box[1]+=({'ArrowUp':-1,'ArrowDown':1}[e.key]||0)*box[3]*.1;apply();}else return;e.preventDefault();});
 controls.querySelector('[data-zoom-in]')?.addEventListener('click',()=>zoom(1.4));
 controls.querySelector('[data-zoom-out]')?.addEventListener('click',()=>zoom(1/1.4));
 controls.querySelector('[data-map-reset]')?.addEventListener('click',()=>{box=[...original];apply();});
 return {restore(values){if(values?.length===4&&values.every(Number.isFinite)&&values[2]>=80&&values[2]<=1600&&values[3]>0&&values[3]<=960&&Math.abs(values[0])<10000&&Math.abs(values[1])<10000){box=[...values];apply();}},reset(){box=[...original];apply();}};
}
