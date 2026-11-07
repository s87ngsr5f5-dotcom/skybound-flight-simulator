'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','regional-elevation','region','fleet','operations']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const clampValue=(n,a,b)=>Math.max(a,Math.min(b,n));
const bearingTo=(f,p)=>Math.atan2(p.x-f.x,f.z-p.z);
function pilot(f){
  const target=activeTarget(f);
  const speed=Math.hypot(f.vx,f.vz);
  const targetSpeed=f.aircraft.approach/1.94384;
  const final=f.phase==='approach';
  const frame=runwayCoordinates(f.x,f.z,f.destination);
  const departure=runwayCoordinates(f.x,f.z,f.departure);
  let heading=f.ground?f.departure.heading:bearingTo(f,target);
  let power=1, pitch=0, brake=false, roll=0;
  if(f.phase==='taxi'||f.phase==='arrival'){
    const distance=Math.hypot(f.x-target.x,f.z-target.z);
    heading=bearingTo(f,target);
    const delta=Math.abs(wrapAngle(heading-f.heading));
    const desired=f.phase==='arrival'&&f.taxiIndex===2?Math.min(6,distance*.22):Math.min(7,distance*.28);
    const taxiSpeed=delta>.42?Math.min(desired,2.8):desired;
    power=clampValue(.09+(taxiSpeed-speed)*.085,0,.34);
    brake=speed>taxiSpeed+1.4;
    if(f.phase==='arrival'&&f.taxiIndex===2&&distance<16){f.parkingBrake=true;power=0;brake=true;}
  }else if(f.ground){
    heading=f.departure.heading-Math.atan2(departure.cross,160);
    const aligned=Math.abs(wrapAngle(heading-f.heading))<.09;
    power=aligned?1:.20;
    brake=!aligned&&speed>4;
    pitch=aligned&&speed>f.aircraft.rotation/1.94384?.82:0;
  }else{
    const desiredAltitude=final?Math.max(f.destination.elevation-12,
      f.destination.elevation+(-f.destination.length/2+200-frame.along)*.048):
      f.waypoint===f.route.length-2&&Math.hypot(target.x-f.x,target.z-f.z)<14000?440:1050;
    if(final){
      heading=f.destination.heading-Math.atan2(frame.cross,300);
      f.flaps=2;f.gear=true;
    }else if(f.aircraft.retract&&f.y>f.departure.elevation+70) f.gear=false;
    const goalSpeed=final?targetSpeed:Math.max(43,targetSpeed*1.25);
    power=clampValue((final?.19:.54)+(goalSpeed-f.speed)*.095,0,1);
    const targetVS=clampValue((desiredAltitude-f.y)*.17,-4.4,4.6);
    const q=.5*1.225*Math.exp(-f.y/8500)*Math.max(22,f.speed)**2;
    const lift=f.aircraft.mass*(9.81+clampValue((targetVS-f.vy)*1.45,-4,4))/(q*f.aircraft.wingArea*Math.cos(f.bank));
    const attitude=Math.atan2(f.vy,speed)+(lift-.27-f.aircraft.flapLift[f.flaps])/5.05-.036;
    pitch=clampValue((attitude-.015-f.flaps*.008)/.24,-1,1);
    roll=clampValue(wrapAngle(heading-f.heading)*2.7,-1,1);
  }
  return {pitch,roll,rudder:f.ground?clampValue(wrapAngle(heading-f.heading)*3,-1,1):0,trim:0,brake,
    throttle:Math.abs(f.power-power)<.006?0:Math.sign(power-f.power)};
}
function verifyFlight(from,to,aircraft){
  const departure=taiwanAirports.find(a=>a.code===from), destination=taiwanAirports.find(a=>a.code===to);
  const f=makeRegionalFlight(departure,destination,aircraft,'cold',0,regionalRoute(departure,destination));
  assert(!startEngine(f,0));f.battery=true;
  f.engines.forEach((_,i)=>assert(startEngine(f,i)));
  f.parkingBrake=false;
  const visited=new Set();
  let saved, event='', takeoff=null;
  const save=(_,result)=>{saved=result;return true;};
  for(let i=0;i<120*6500&&!f.finished;i++){
    updateRegionalFlight(f,save);
    visited.add(f.phase);
    if(f.airborne&&takeoff===null) takeoff=runwayCoordinates(f.x,f.z,departure).along+departure.length/2;
    if(f.phase+f.waypoint+f.taxiIndex!==event){
      event=f.phase+f.waypoint+f.taxiIndex;
    }
    stepTrainer(f,pilot(f));
  }
  const p=latLon(f.x,f.z);
  const result={from,to,model:aircraft.id,seconds:Math.round(f.elapsed),visited:[...visited],takeoff,phase:f.phase,waypoint:f.waypoint,parkIndex:f.taxiIndex,
    saved,touchdown:f.touchdown,position:p,heading:f.heading,altitude:f.y,speed:f.speed};
  console.log(JSON.stringify(result));
  assert.equal(saved,'已落地並停妥');
  return result;
}
if(require.main===module){
  verifyFlight('RCSS','RCYU',fleet[0]);
  if(process.argv.includes('--all')){
    for(const aircraft of fleet.slice(1)) verifyFlight('RCSS','RCYU',aircraft);
    verifyFlight('RCKH','RCQC',fleet[0]);
  }
}


