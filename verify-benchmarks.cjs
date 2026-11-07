'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const source=fs.readFileSync('verify-regional.cjs','utf8');
const controller=source.slice(source.indexOf('const clampValue='),source.indexOf('function verifyFlight'))
  .replace("Math.min(6,distance*.22):Math.min(7,distance*.28)","Math.min(5,distance*.19):Math.min(6,distance*.21)")
  .replace('power=clampValue(.09+(taxiSpeed-speed)*.085,0,.34)','power=clampValue(.065+(taxiSpeed-speed)*.10,0,.38)')
  .replace("f.destination.elevation-12","f.destination.elevation-28")
  .replace('(-f.destination.length/2+200-frame.along)*.048','(-f.destination.length/2+250-frame.along)*.036')
  .replace('14000?440:1050','16000?270:940')
  .replace('targetSpeed*1.25','targetSpeed*1.25')
  .replace('(final?.19:.54)+(goalSpeed-f.speed)*.095','(final?.14:.44)+(goalSpeed-f.speed)*.095');
vm.runInThisContext(controller);

function verifyBenchmark(profile,load){
  const mission=benchmarkMissions[profile.role];
  const from=taiwanAirports.find(a=>a.code===mission.from),to=taiwanAirports.find(a=>a.code===mission.to);
  const route=benchmarkRoute(profile.role,from,to);
  const f=makeRegionalFlight(from,to,profile,'cold',0,route);
  f.mission=profile.role;
  if(profile.role==='cargo'){
    assert(!setPallet(f,0,1000));
    f.noseDoor=true;
    assert(setPallet(f,0,38000));assert(cargoBalance(f).problems.length>0);
    load.forEach((mass,i)=>assert(setPallet(f,i,mass)));
    assert.equal(cargoBalance(f).problems.length,0);
    f.battery=true;
    assert(!startEngine(f,0));
    f.noseDoor=false;f.loadedAtDeparture=true;
  }
  const payload=profile.role==='cargo'?cargoBalance(f):{mass:0,shift:0};
  f.battery=true;f.engines.forEach((_,i)=>assert(startEngine(f,i)));
  f.parkingBrake=false;
  let result, startRoll=null,liftoff=null,climb=0,cruiseSpeed=0;
  const visited=new Set();
  const save=(_,value)=>{result=value;return true;};
  for(let i=0;i<120*6800&&!f.finished;i++){
    updateRegionalFlight(f,save);
    if(f.finished) break;
    visited.add(f.phase);
    if(f.phase==='takeoff'&&startRoll===null) startRoll=runwayCoordinates(f.x,f.z,from).along;
    if(f.airborne&&liftoff===null) liftoff=runwayCoordinates(f.x,f.z,from).along;
    if(f.airborne&&f.waypoint<f.route.length-1){climb=Math.max(climb,f.vy);if(f.y>800) cruiseSpeed=Math.max(cruiseSpeed,f.speed);}
    if(f.awaitingService&&Math.hypot(f.vx,f.vz)<.8){
      f.power=0;
      f.engines.forEach((on,index)=>{if(on) startEngine(f,index);});
      if(profile.role==='passenger'){assert(groundServiceAllowed(f));f.bridge=true;}
      if(profile.role==='cargo'){
        f.noseDoor=true;
        f.pallets.forEach((_,index)=>assert(setPallet(f,index,0)));
        f.noseDoor=false;
      }
    }
    stepTrainer(f,pilot(f));
  }
  console.log(JSON.stringify({id:profile.id,from:from.code,to:to.code,load:payload.mass,cg:payload.shift,seconds:Math.round(f.elapsed),result,
    roll:Math.round(liftoff-startRoll),climb:Math.round(climb*196.85),cruise:Math.round(cruiseSpeed*1.94384),
    visited:[...visited],waypoint:f.waypoint,taxi:f.taxiIndex,touchdown:f.touchdown,last:[Math.round(f.x),Math.round(f.y),Math.round(f.z),Math.round(f.speed)]}));
  assert.equal(result,'任務完成');
}
for(const plane of benchmarkFleet){
  if(process.argv.length>2&&!process.argv.includes(plane.id)) continue;
  verifyBenchmark(plane,[9000,18000,8000]);
  if(plane.role==='cargo') verifyBenchmark(plane,[26000,28000,30000]);
}



