'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm');
const stored=new Map();
globalThis.localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)};
globalThis.clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
for(const file of ['elevation','physics','regional-elevation','kinmen-elevation','region','fleet','benchmarks','operations','tactical']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const airport=taiwanAirports.find(a=>a.code==='RCMQ'), profile=benchmarkFleet.find(a=>a.id==='sf16');
const create=kind=>makeTacticalFlight(airport,profile,kind,0,true,false);
function tick(f,seconds){
  for(let i=0;i<Math.round(seconds*120)&&!f.finished;i++) stepTactical(f,1/120);
}
function ready(f){
  f.tactical.radar=true;
  f.tactical.armed=true;
  tick(f,1.2);
  assert.equal(f.tactical.lock,1);
}
const radar=create('radar');
ready(radar);
radar.heading+=Math.PI;
tick(radar,.1);
assert.equal(radar.tactical.lock,0);
assert(radar.tactical.events.some(e=>e.label==='鎖定中斷'));
assert(!tacticalFire(radar));
const duel=create('duel');
ready(duel);
tick(duel,9);
assert(duel.tactical.enemyWarning>0);
assert(duel.tactical.missiles.some(m=>m.owner==='enemy'));
assert(tacticalFire(duel));
assert.equal(duel.tactical.ammo,5);
assert(duel.tactical.frames.at(-1).missiles.some(m=>m[5]==='player'));
tick(duel,9);
assert.equal(duel.tactical.air,1);
assert(duel.tactical.health<100);
tacticalFinish(duel,tacticalOutcome(duel.tactical),'返場停妥',true);
assert.equal(duel.tactical.result.outcome,'成功');
assert.equal(duel.tactical.result.receipt.landing,650);
const balance=readCareer().money;
tacticalFinish(duel,'成功','重複結算');
assert.equal(readCareer().money,balance);
const sea=create('sea');
ready(sea);
assert(tacticalFire(sea));
tick(sea,6);
assert.equal(sea.tactical.sea,1);
Object.assign(sea,sea.tactical.exit);
tick(sea,.1);
assert.equal(sea.tactical.result.outcome,'成功');
const neutral=create('sea');
ready(neutral);
selectTacticalTarget(neutral.tactical,3);
tick(neutral,1.2);
assert(tacticalFire(neutral));
tick(neutral,7);
assert.equal(neutral.tactical.result.outcome,'失敗');
assert.equal(neutral.tactical.result.receipt.net,0);
const intercept=create('intercept');
assert(intercept.ground);
intercept.tactical.air=1;
assert.equal(tacticalOutcome(intercept.tactical),'部分完成');
assert.equal(create('escort').tactical.targets.filter(t=>t.team==='friendly').length,1);
console.log('PASS: lock loss, enemy warning and damage, rack launch, air and sea hits, settlement, neutral penalty, partial outcome, duplicate reward');
