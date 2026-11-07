'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const name of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations','narita-elevation','cargo-voyage']){
  vm.runInThisContext(fs.readFileSync('dist/'+name+'.js','utf8'),{filename:name+'.js'});
}
const test=fs.readFileSync('verify-benchmarks.cjs','utf8');
const original=fs.readFileSync('verify-regional.cjs','utf8');
const raw=original.slice(original.indexOf('const clampValue='),original.indexOf('function verifyFlight'));
const controller=raw
  .replace('power=clampValue(.09+(taxiSpeed-speed)*.085,0,.34)','power=clampValue(.065+(taxiSpeed-speed)*.10,0,.38)')
  .replace('f.destination.elevation-12','f.destination.elevation-28')
  .replace('(-f.destination.length/2+200-frame.along)*.048','(-f.destination.length/2+250-frame.along)*.036')
  .replace('14000?440:1050','18000?540:f.waypoint<4?3500:950')
  .replace('Math.max(43,targetSpeed*1.25)','(f.waypoint<4?151:Math.max(43,targetSpeed*1.25))')
  .replace('(final?.19:.54)+(goalSpeed-f.speed)*.095','(final?.14:.44)+(goalSpeed-f.speed)*.095');
vm.runInThisContext(controller);
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
const from=taiwanAirports.find(a=>a.code==='RCTP');
const profile=fleet.find(a=>a.id==='sf748');
for(const node of ['taxi','descent','approach','warning']){
  const one=makeCargoVoyage(from,profile,node,0);
  assert.deepEqual(one,makeCargoVoyage(from,profile,node,0));
}
for(const mass of [[9000,18000,8000],[26000,28000,30000]]){
  const f=makeCargoVoyage(from,profile,'load',0);
  f.fuelStart=f.fuel;
  attachContract(f,'cargo',40000);
  const beforeMoney=readCareer().money;
  const replay=[];
  captureVoyage(f,replay,true);
  f.battery=true;f.lights=true;f.noseDoor=true;
  mass.forEach((weight,i)=>assert(setPallet(f,i,weight)));
  const initial=cargoBalance(f);
  assert.equal(initial.problems.length,0);
  assert(!startEngine(f,0));
  captureVoyage(f,replay,true);
  f.noseDoor=false;f.loadedAtDeparture=true;
  f.engines.forEach((_,i)=>assert(startEngine(f,i)));
  f.parkingBrake=false;
  let result, rollStart, liftoff, climb=0, before='';
  const save=(flight,r)=>{result=r;return recordFlight(flight,r);};
  for(let tick=0;tick<120*32000&&!f.finished;tick++){
    updateRegionalFlight(f,save);
    const state=f.phase+f.waypoint+f.taxiIndex;
    if(state!==before){before=state;captureVoyage(f,replay,true);}
    if(f.finished) break;
    if(f.phase==='takeoff'&&rollStart===undefined) rollStart=runwayCoordinates(f.x,f.z,from).along;
    if(f.airborne&&liftoff===undefined) liftoff=runwayCoordinates(f.x,f.z,from).along;
    if(f.airborne&&f.waypoint<2) climb=Math.max(climb,f.vy);
    if(f.awaitingService&&Math.hypot(f.vx,f.vz)<.8){
      f.power=0;
      f.engines.forEach((on,i)=>{if(on) startEngine(f,i);});
      f.sideDoor=true;
      captureVoyage(f,replay,true);
      f.pallets.forEach((_,i)=>assert(setPallet(f,i,0)));
      f.sideDoor=false;
    }
    stepTrainer(f,pilot(f));
    captureVoyage(f,replay);
  }
  captureVoyage(f,replay,true);
  const restored=makeCargoVoyage(from,profile,'load',0);
  applyVoyageFrame(restored,replay,replay.at(-1)[0]);
  assert.deepEqual(restored.pallets,[0,0,0]);
  assert(restored.touchdown&&restored.finished);
  assert(replay.some(row=>row.includes('approach')));
  console.log(JSON.stringify({cargo:initial.mass,cg:initial.shift,seconds:Math.round(f.elapsed),remainingFuel:Math.round(f.fuel),roll:Math.round(liftoff-rollStart),climb:Math.round(climb*196.85),touchdown:f.touchdown,result,frames:replay.length,waypoint:f.waypoint,geo:latLon(f.x,f.z)}));
  assert.equal(result,'任務完成');
  assert.equal(f.contract.cargoAtTakeoff,initial.mass);
  assert.equal(f.receipt.base,40000+Math.round(initial.mass*.28));
  assert.equal(readCareer().money,beforeMoney+f.receipt.net);
  f.rewardPaid=false;
  recordFlight(f,'任務完成');
  assert.equal(readCareer().money,beforeMoney+f.receipt.net);
}

