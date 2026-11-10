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
for(const kind of ['radar','duel','sea']){
  const f=makeTacticalFlight(base,fighter,kind,0,true,false);
  assert.equal(tacticalFire(f),false);
  assert.equal(f.tactical.notice,'先開啟雷達');
  const heading=f.heading+1.05;
  Object.assign(f,{heading,vx:Math.sin(heading)*155,vz:-Math.cos(heading)*155});
  f.tactical.radar=true;
  f.tactical.armed=true;
  step(f,false);
  assert(f.tactical.selected);
  assert.equal(tacticalFire(f),false);
  for(let i=0;i<18/simTick&&f.tactical.lock<1&&!f.finished;i++) step(f,true);
  assert.equal(f.tactical.lock,1,kind+' acquires the target after starting off-axis');
  assert.equal(f.tactical.shots,0,kind+' assist never fires');
  assert(tacticalFire(f));
  for(let i=0;i<12/simTick&&!f.tactical.hits&&!f.finished;i++) step(f,false);
  assert.equal(f.tactical.hits,1,kind+' hit');
  assert.equal(f.tactical.ammo,5);
  console.log(kind,'off-axis acquisition, manual fire and hit passed');
}
