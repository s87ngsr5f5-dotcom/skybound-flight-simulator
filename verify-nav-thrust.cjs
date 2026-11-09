const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations']){
 vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const from=taiwanAirports.find(a=>a.code==='RCTP'), to=taiwanAirports.find(a=>a.code==='RCKH');
const plane=fleet.find(a=>a.id==='b773');
const f=makeCruiseTrial(from,to,plane,0);
Object.assign(f,{cruiseTrial:false,route:regionalRoute(from,to),hold:{nav:true,altitude:f.y}});
const mins={route:1,descent:1,final:1};
let input;
for(let i=0;i<120*4000&&f.hold&&!f.ended;i++){
 if(i%4===0) input={rudder:0,...navigationControls(f,activeTarget(f)),trim:0};
 const distance=-runwayCoordinates(f.x,f.z,to).along-to.length/2;
 if(f.hold?.stage in mins && !f.landed && !(distance<0&&f.y-to.elevation-plane.gearHeight<12)){
  const stage=f.hold.stage;
  mins[stage]=Math.min(mins[stage],f.power);
 }
 stepTrainer(f,input);
 updateRegionalFlight(f,()=>true);
 if(i===120*180){
  const {ias,mach}=flightSpeeds(f);
  console.log('777 cruise 180s',{ias:ias*knotsPerMps,mach,power:f.power,stage:f.hold.stage,y:f.y});
  assert(f.power>.18&&ias*knotsPerMps>250);
 }
}
console.log({mins,touchdown:f.touchdown,landed:f.landed,parked:f.parkingBrake,frame:runwayCoordinates(f.x,f.z,to),ias:flightSpeeds(f).ias*knotsPerMps,flaps:f.flaps, message:f.navMessage,elapsed:f.elapsed,y:f.y});
assert(mins.route>=.18&&mins.descent>=.12&&mins.final>=.12);
assert(f.landed&&f.parkingBrake);
