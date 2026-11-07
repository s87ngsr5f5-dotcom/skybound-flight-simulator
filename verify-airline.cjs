'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const storage=new Map([['skybound.money','6000']]);
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
for(const file of ['elevation','physics','regional-elevation','kinmen-elevation','region','fleet','benchmarks','operations']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const benchmarkSource=fs.readFileSync('verify-benchmarks.cjs','utf8');
const regionalSource=fs.readFileSync('verify-regional.cjs','utf8');
const source=benchmarkSource.slice(benchmarkSource.indexOf('const controller='),benchmarkSource.indexOf('vm.runInThisContext(controller);'));
vm.runInThisContext(new Function('source',source+'return controller;')(regionalSource));
const aircraft=fleet.find(p=>p.id==='a320neo');
const from=taiwanAirports.find(p=>p.code==='RCTP'),to=taiwanAirports.find(p=>p.code==='RCKH');
const brief=passengerBrief(aircraft,from,to);
assert.throws(()=>makePassengerFlight(from,to,aircraft,0,1,'0','13:00'));
let f=makePassengerFlight(from,to,aircraft,0,brief.estimated+brief.reserve,'0','13:00');
f.battery=true;
assert.equal(readCareer().money,6000);
assert(!startEngine(f,0));
const emptyMass=flightMass(f);
f.bridge=true;f.service.door=true;f.service.mode='board';f.service.pumping=true;
for(let i=0;i<120*150;i++) updatePassengerService(f,simTick);
assert.equal(f.service.boarded,174);
assert.equal(f.fuel,f.fuelStart);
assert(flightMass(f)>emptyMass+10000);
f.service.door=false;f.bridge=false;f.service.mode=null;f.service.pushing=18;
for(let i=0;i<120*12;i++) updatePassengerService(f,simTick);
assert(f.service.pushed);
savePassenger(f);
f=readCareer().active;
assert(f.service.pushed&&f.service.boarded===174);
f.engines.forEach((_,i)=>assert(startEngine(f,i)));
f.parkingBrake=false;
for(let i=0;i<120*7200&&!f.finished;i++){
  if(f.awaitingService){
    if(!f.service.delivered){
      f.power=0;f.engines.forEach((on,index)=>{if(on) startEngine(f,index);});
      f.bridge=true;f.service.door=true;f.service.mode='exit';
    }
    if(f.service.delivered===f.passengers){f.bridge=false;f.service.door=false;}
  }
  stepTrainer(f,pilot(f));
  updatePassengerService(f,simTick);
  updateRegionalFlight(f);
}
assert(f.finished&&f.landed);
assert.equal(f.service.delivered,174);
const career=readCareer();
assert(!career.active);
assert(f.receipt.net>0);
assert.equal(career.money,6000+f.receipt.net);
f.rewardPaid=false;
recordFlight(f,'任務完成');
assert.equal(readCareer().money,career.money);
console.log('PASS',JSON.stringify({fuelLoaded:f.fuelStart,fuelRemaining:Math.round(f.fuel),elapsed:Math.round(f.elapsed),balance:career.money,receipt:f.receipt}));
