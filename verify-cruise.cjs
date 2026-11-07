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
