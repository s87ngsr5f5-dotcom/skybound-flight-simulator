'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const storage=new Map();
globalThis.localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,value),
  removeItem:key=>storage.delete(key)
};
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const {smoothControls}=require('./dist/controls.js');
const departure=taiwanAirports.find(a=>a.code==='RCKH');
const destination=taiwanAirports.find(a=>a.code==='RCTP');
const aircraft=fleet.find(a=>a.id==='an124');
const route=benchmarkRoute('cargo',departure,destination);
const options={lesson:'benchmark',weather:'clear',time:'13:00'};
let f=makeRegionalFlight(departure,destination,aircraft,'cold',0,route);
Object.assign(f,{mission:'cargo',fuel:18000,fuelStart:18000,checkpointId:crypto.randomUUID()});
attachContract(f,'cargo',9500);
const startingBalance=readMoney();
assert(!requestRunwayTow(f));
assert(!setCargoManifest(f,[24000,30000,20000]));
f.noseDoor=true;
assert(!setCargoManifest(f,[24000,30000,90000]));
assert.deepEqual(f.pallets,[0,0,0]);
assert(setCargoManifest(f,[24000,30000,20000]));
assert.equal(cargoBalance(f).mass,74000);
assert(cargoBalance(f).shift<0);
assert(!requestRunwayTow(f));
f.noseDoor=false;
assert(writeMissionCheckpoint(f,options));
f=readMissionCheckpoint(f.checkpointId).flight;
assert.deepEqual(f.pallets,[24000,30000,20000]);
assert(requestRunwayTow(f));
assert(finishRunwayTow(f));
assert(!startEngine(f,0));
f.battery=true;
f.engines.forEach((_,index)=>assert(startEngine(f,index)));
f.parkingBrake=false;
for(let i=0;i<120*135&&f.y<departure.elevation+460&&!f.ended;i++){
  const pitch=flightSpeeds(f).ias*knotsPerMps>=aircraft.rotation?.62:0;
  stepTrainer(f,smoothControls(f,{pitch,roll:0,rudder:0,throttle:1,trim:0},simTick));
  updateRegionalFlight(f);
}
assert(f.airborne&&!f.ended&&f.y>=departure.elevation+450,JSON.stringify({y:f.y,position:latLon(f.x,f.z),speed:f.speed}));
f.gear=false;
f.hold={nav:true,altitude:departure.elevation+1800};
let input;
for(let i=0;i<120*4200&&f.hold&&!f.ended;i++){
  if(i%4===0) input={rudder:0,...navigationControls(f,activeTarget(f)),trim:0};
  stepTrainer(f,smoothControls(f,input,simTick));
  updateRegionalFlight(f);
}
assert(f.landed&&!f.ended&&f.parkingBrake,JSON.stringify({
  waypoint:f.waypoint,seconds:f.elapsed,y:f.y,position:latLon(f.x,f.z),
  ias:flightSpeeds(f).ias*knotsPerMps,stage:f.hold?.stage,message:f.navMessage
}));
assert.equal(f.waypoint,route.length-1);
assert.equal(f.contract.cargoAtTakeoff,74000);
assert(f.fuel>0&&f.fuel<f.fuelStart);
assert(requestGateTow(f));
for(let tick=0;tick<90000&&f.tow;tick++) stepRunwayTow(f,simTick);
assert(f.awaitingService&&!f.tow&&f.parkingBrake);
assert.deepEqual({x:f.x,z:f.z},parkingPoint(destination));
assert.deepEqual(f.pallets,[24000,30000,20000]);
f.engines.fill(false);
f.noseDoor=true;
assert(setCargoManifest(f,[0,0,0]));
updateRegionalFlight(f);
assert(!f.finished);
f.noseDoor=false;
updateRegionalFlight(f);
assert(f.finished&&f.recorded&&f.rewardPaid);
assert.equal(f.contract.result,'任務完成');
assert.equal(readFlightLog()[0].destination,'RCTP');
assert.equal(readMoney(),startingBalance+f.receipt.net);
assert(f.receipt.net>0);
updateRegionalFlight(f);
assert.equal(readFlightLog().length,1);
assert.equal(readMoney(),startingBalance+f.receipt.net);
console.log({cargoKg:74000,seconds:Math.round(f.elapsed),fuelKg:Math.round(f.fuel),receipt:f.receipt,touchdown:f.touchdown});
