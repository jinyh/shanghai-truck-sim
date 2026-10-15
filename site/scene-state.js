// Pure replay math shared by the renderer and independent verification.
export function vehicleState(vehicle, time, data) {
 const step=Math.max(0,Math.min(data.timestamps.length-1,Math.floor(time)));
 let energy=vehicle.initial_kwh,last=null;
 for(const trip of vehicle.trips){
  if(time<trip.start_step)break;
  const ledger=trip.ledger,session=trip.session;
  if(trip.route_status!=='routed')return {id:vehicle.id,status:'failed',energy:ledger.before_kwh,power:0,trip,step};
  if(time<trip.arrival_step){
   const progress=Math.max(0,Math.min(1,(time-trip.start_step)/(trip.arrival_step-trip.start_step)));
   return {id:vehicle.id,status:ledger.after_trip_kwh<0?'energy_failure':'driving',progress,energy:ledger.before_kwh-trip.energy_kwh*(step-trip.start_step)/(trip.arrival_step-trip.start_step),power:0,trip,step};
  }
  energy=ledger.after_trip_kwh;
  const end=Math.min(step,session?.departure_step??step);
  for(let t=session?.arrival_step??end;t<end;t++)energy+=(trip.power_kw[t]||0)*data.step_minutes/60*data.charging_efficiency;
  if(time<trip.departure_step){
   const power=trip.power_kw[step]||0;
   return {id:vehicle.id,status:time<(session?.connected_step??Infinity)?'waiting':power>1e-6?'charging':'connected',energy,power,port:session?.port,trip,step};
  }
  energy=ledger.after_charge_kwh;last=trip;
 }
 return {id:vehicle.id,status:'offsite',energy,power:0,trip:last,step};
}

export function routePosition(route, progress, project) {
 // Route cycles retain their recorded node order; distance weights prevent speed jumps.
 const outward=route.outward_coordinates.map(project),inward=route.inward_coordinates.map(project);
 const points=[...outward,...inward.slice(1)];if(points.length<2)return null;
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
 const fraction=Math.min(.999999,Math.max(0,progress)*(route.round_trips||1)%1),distance=fraction*lengths.at(-1);
 let i=1;while(i<lengths.length-1&&lengths[i]<distance)i++;
 const f=(distance-lengths[i-1])/(lengths[i]-lengths[i-1]||1),a=points[i-1],b=points[i];
 return {x:a[0]+(b[0]-a[0])*f,z:a[1]+(b[1]-a[1])*f,heading:Math.atan2(-(b[0]-a[0]),-(b[1]-a[1]))};
}

export function assessmentFor(catalog,caseId,plan,station,id=null) {
 const matches=catalog.records.filter(r=>r.case_id===caseId&&r.proposal.id===plan&&r.station.id===station);
 return id?matches.find(r=>r.assessment_id===id):matches.sort((a,b)=>b.evaluated_at.localeCompare(a.evaluated_at))[0];
}
