'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
for(const wind of [0,60,-60]){
  const f=makeCruiseTrial(taiwanAirports.find(a=>a.code==='RCTP'),taiwanAirports.find(a=>a.code==='RCKH'),
    fleet.find(a=>a.id==='b773'),wind);
  const start={x:f.x,z:f.z};
  const target=f.route[0];
  const initialRange=Math.hypot(target.x-f.x,target.z-f.z);
  for(let i=0;i<600*120;i++) stepTrainer(f,{...cruiseControls(f),roll:0,rudder:0,trim:0,brake:false});
  const {mach,gs,tas,ias}=flightSpeeds(f);
  const distance=Math.hypot(f.x-start.x,f.z-start.z);
  const fuel=f.fuelStart-f.fuel;
  const eta=Math.hypot(target.x-f.x,target.z-f.z)/gs/60;
  console.log({wind,mach,gs:gs*knotsPerMps,tas:tas*knotsPerMps,ias:ias*knotsPerMps,altitude:f.y,distanceNM:distance/1852,fuel,eta});
  assert(Math.abs(mach-.84)<.015);
  assert(Math.abs(f.y-10668)<120);
  assert(Math.abs(distance-f.elapsed*gs)<3500);
  assert(fuel>400&&fuel<2200);
  assert(eta<initialRange/gs/60-9);
  if(wind>0) assert(gs*knotsPerMps>500&&gs*knotsPerMps<600);
}
const from=taiwanAirports.find(a=>a.code==='RCTP');
const to=taiwanAirports.find(a=>a.code==='RCKH');
for(const plane of benchmarkFleet.filter(aircraft=>aircraft.cruiseMach)){
  const f=makeRegionalFlight(from,to,plane,'runway',0,[]);
  let roll=0;
  for(let i=0;i<120*1800;i++){
    const speeds=flightSpeeds(f);
    const ias=speeds.ias*knotsPerMps;
    if(!f.ground && f.y>from.elevation+40) f.gear=false;
    if(!f.hold && f.airborne && !f.gear && f.y>from.elevation+150 && ias>plane.rotation+15){
      f.hold={heading:f.heading,altitude:35000*.3048,mach:plane.cruiseMach,climb:true};
    }
    const pitch=ias<plane.rotation?0:f.ground?.55:f.vy>8?.23:.44;
    stepTrainer(f,{pitch,throttle:1,...(f.hold?climbCruiseControls(f):{}),trim:0,rudder:0,roll:0,brake:false});
    if(f.ground) roll=runwayCoordinates(f.x,f.z,from).along+from.length/2-95;
    if(f.ended||f.hold?.levelOff&&Math.abs(f.y-f.hold.altitude)<50&&Math.abs(speeds.mach-plane.cruiseMach)<.008){
      break;
    }
  }
  const speeds=flightSpeeds(f);
  console.log(plane.id,{roll:Math.round(roll),seconds:Math.round(f.elapsed),altitudeFt:Math.round(f.y/.3048),
    mach:speeds.mach.toFixed(3),gsKt:Math.round(speeds.gs*knotsPerMps)});
  assert(f.airborne&&!f.ended&&f.hold?.levelOff,plane.id);
  assert(roll>0&&roll<from.length-95,plane.id);
  assert(Math.abs(f.y-f.hold.altitude)<50,plane.id);
  assert(Math.abs(speeds.mach-plane.cruiseMach)<.008,plane.id);
}
