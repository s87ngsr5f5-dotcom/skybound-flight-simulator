'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const storage=new Map([['skybound.money','6000']]);
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const source=fs.readFileSync('verify-regional.cjs','utf8');
vm.runInThisContext(source.slice(source.indexOf('const clampValue='),source.indexOf('function verifyFlight')));
for(const kind of ['sightseeing','ferry']){
  let f=makeRegionalContract(kind,0);
  f.checkpointId=crypto.randomUUID();
  const options={lesson:kind,weather:"wet",time:"21:30"};
  const before=readMoney();
  f.battery=true;
  assert(startEngine(f,0));
  f.parkingBrake=false;
  for(let i=0;i<120*6500&&!f.finished;i++){
    stepTrainer(f,pilot(f));
    updateRegionalFlight(f);
    if(i===120*1000){
      assert(f.airborne);
      assert(writeMissionCheckpoint(f,options));
      const competing={...f,checkpointId:crypto.randomUUID()};
      assert(!writeMissionCheckpoint(competing,options));
      assert(!clearMissionCheckpoint(competing.checkpointId));
      const saved=readMissionCheckpoint();
      assert.deepEqual(saved.options,options);
      assert.deepEqual(saved.flight,f);
      f=saved.flight;
    }
  }
  console.log({kind,waypoint:f.waypoint,phase:f.phase,result:f.contract.result,
    seconds:Math.round(f.elapsed),fuel:Math.round(f.fuel),receipt:f.receipt,
    touchdown:f.touchdown,position:latLon(f.x,f.z)});
  assert(f.finished&&f.landed&&f.recorded);
  assert.equal(f.contract.result,'任務完成');
  assert.equal(readMissionCheckpoint(),null);
  assert(clearMissionCheckpoint(f.checkpointId));
  assert(f.fuel<f.fuelStart&&f.fuel>0);
  assert.equal(readMoney(),before+f.receipt.net);
  const duplicate=JSON.parse(JSON.stringify(f));
  duplicate.rewardPaid=false;
  recordFlight(duplicate,'任務完成');
  assert.equal(readMoney(),before+f.receipt.net);
}
