'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ownPlane=process.argv.includes('--owned');
const storage=new Map([['skybound.money',ownPlane?'161000':'6000']]);
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
for(const file of ['elevation','physics','regional-elevation','kinmen-elevation','region','fleet','benchmarks','operations']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const benchmarkSource=fs.readFileSync('verify-benchmarks.cjs','utf8');
const regionalSource=fs.readFileSync('verify-regional.cjs','utf8');
const source=benchmarkSource.slice(benchmarkSource.indexOf('const controller='),benchmarkSource.indexOf('vm.runInThisContext(controller);'));
vm.runInThisContext(new Function('source',source+'return controller;')(regionalSource));
const aircraft=fleet.find(p=>p.id===(ownPlane?'b38m':'a320neo'));
if(ownPlane){
  assert(purchaseHangar(aircraft,'plane'));
  const old=readCareer();
  assert.equal(hangarCondition(old,aircraft.id),100);
  assert.equal(old.money,6000);
}
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
assert.equal(f.service.boarded,aircraft.passengers);
assert.equal(f.fuel,f.fuelStart);
assert(flightMass(f)>emptyMass+10000);
f.service.door=false;f.bridge=false;f.service.mode=null;f.service.pushing=18;
for(let i=0;i<120*12;i++) updatePassengerService(f,simTick);
assert(f.service.pushed);
savePassenger(f);
f=readCareer().active;
assert(f.service.pushed&&f.service.boarded===aircraft.passengers);
if(ownPlane) assert(!serviceHangar(aircraft));
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
assert.equal(f.service.delivered,aircraft.passengers);
const career=readCareer();
assert(!career.active);
assert(f.receipt.net>0);
assert.equal(career.money,6000+f.receipt.net);
f.rewardPaid=false;
recordFlight(f,'任務完成');
assert.equal(readCareer().money,career.money);
if(ownPlane){
  const quote=maintenanceQuote(readCareer(),aircraft);
  assert(quote.owned&&quote.condition<100&&quote.cost>0&&!quote.busy);
  assert.equal(f.receipt.condition,quote.condition);
  assert.equal(f.receipt.rent,0);
  assert(serviceHangar(aircraft));
  assert.equal(hangarCondition(readCareer(),aircraft.id),100);
  assert.equal(readCareer().money,career.money-quote.cost);
  assert(!serviceHangar(aircraft));
  assert.equal(readCareer().money,career.money-quote.cost);
  const worn=readCareer();
  worn.condition[aircraft.id]=59;
  localStorage.setItem(careerKey,JSON.stringify(worn));
  assert.throws(()=>makePassengerFlight(from,to,aircraft,0,0,'0','13:00'),/60%/);
  assert(serviceHangar(aircraft));
  assert(makePassengerFlight(from,to,aircraft,0,brief.estimated+brief.reserve,'0','13:00').service.owned);
}
console.log('PASS',JSON.stringify({fuelLoaded:f.fuelStart,fuelRemaining:Math.round(f.fuel),elapsed:Math.round(f.elapsed),balance:career.money,receipt:f.receipt}));
