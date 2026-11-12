const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations','controls','tactical']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const base=taiwanAirports.find(a=>a.code==='RCMQ');
const fighter=fleet.find(a=>a.id==='sf16');
function step(f,assist){
  const controls=assist?tacticalAssistControls(f):null;
  const axes={roll:0,rudder:0,pitch:0,throttle:0,trim:0,response:.55,...controls};
  stepTrainer(f,smoothControls(f,axes,simTick));
  stepTactical(f,simTick);
}
for(const kind of ['radar','duel','sea','melee','swarm','canyon','headon']){
  const f=makeTacticalFlight(base,fighter,kind,0,true,false);
  const initialAmmo=f.tactical.ammo;
  assert.equal(tacticalFire(f),false);
  assert.equal(f.tactical.notice,'先開啟雷達');
  const heading=f.heading+1.05;
  Object.assign(f,{heading,vx:Math.sin(heading)*155,vz:-Math.cos(heading)*155});
  f.tactical.radar=true;
  f.tactical.armed=true;
  step(f,false);
  assert(f.tactical.selected, kind+' auto-selects contact');
  assert.equal(tacticalFire(f),false);
  for(let i=0;i<22/simTick&&f.tactical.lock<1&&!f.finished;i++) step(f,true);
  assert.equal(f.tactical.lock,1,kind+' acquires the target after starting off-axis');
  assert.equal(f.tactical.shots,0,kind+' assist never fires');
  assert(tacticalFire(f), kind+' manual fire');
  for(let i=0;i<22/simTick&&!f.tactical.hits&&!f.finished;i++) step(f,false);
  assert.equal(f.tactical.hits,1,kind+' hit');
  assert.equal(f.tactical.ammo,initialAmmo-1,kind+' ammo decremented');
  console.log(kind,'off-axis acquisition, manual fire and hit passed');
}

// Dogfight (BFM Guns Only) verification
{
  const f=makeTacticalFlight(base,fighter,'dogfight',0,true,false);
  assert.equal(f.tactical.gunsOnly,true,'dogfight is guns-only');
  assert.equal(f.tactical.ammo,0,'dogfight starts with 0 missiles');
  f.tactical.radar=true;
  f.tactical.armed=true;
  assert.equal(tacticalFire(f),false,'cannot fire missile in guns-only dogfight');
  assert.equal(f.tactical.notice,'純機砲模式 · 禁用飛彈，請使用機砲！');
  step(f,false);
  assert(f.tactical.selected,'target selected');
  const target=tacticalTarget(f);
  assert(target,'has target');
  const lead=tacticalGunLead(f,target);
  assert(lead&&typeof lead.x==='number','lead indicator calculated');
  assert.equal(f.tactical.gunBursts,0);
  assert(tacticalGun(f),'gun fires burst');
  assert.equal(f.tactical.gunBursts,1,'burst counted');
  assert(f.tactical.notice.includes('機砲'),'notice tracks gun status');
  console.log('dogfight guns-only mode, gun lead calculation and burst passed');
}

// Scenarios target counts & outcome validation
for(const [kind,expectedCount] of Object.entries({dogfight:1,melee:3,swarm:6,canyon:2,headon:1})){
  const f=makeTacticalFlight(base,fighter,kind,0,true,false);
  assert.equal(f.tactical.targets.length,expectedCount,kind+' targets count');
  assert.equal(tacticalScenarios[kind].count,expectedCount);
  f.tactical.air=expectedCount;
  assert.equal(tacticalOutcome(f.tactical),'成功',kind+' all destroyed gives 成功 outcome');
}
console.log('all new combat modes outcome and targets verification passed');
