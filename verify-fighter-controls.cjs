const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','fleet','benchmarks','controls']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const degrees=180/Math.PI;
function start(aircraft,extra={}){
  return {...createTrainer(false,0),aircraft,x:0,y:3500,z:0,heading:0,ground:false,
    airborne:true,gear:false,vz:-155,power:.72,...extra};
}
function steer(f,seconds,axes){
  const input={pitch:0,roll:0,rudder:0,trim:0,throttle:0,response:.55,maneuver:.82,...axes};
  for(let i=0;i<Math.round(seconds/simTick);i++) stepTrainer(f,smoothControls(f,input,simTick));
}
function fullRoll(aircraft,direction){
  const f=start(aircraft,{y:6000,vz:-180});
  let travelled=0,previous=f.bank,maxYawStep=0,previousHeading=f.heading;
  for(let i=0;i<120*35&&Math.abs(travelled)<Math.PI*2+.15;i++){
    steer(f,simTick,{roll:direction});
    travelled+=wrapAngle(f.bank-previous);previous=f.bank;
    maxYawStep=Math.max(maxYawStep,Math.abs(wrapAngle(f.heading-previousHeading)));previousHeading=f.heading;
    assert.ok([f.bank,f.bankRate,f.heading,f.y,f.vx,f.vy,f.vz].every(Number.isFinite),aircraft.id+' finite state');
  }
  assert.ok(travelled*direction>Math.PI*2,aircraft.id+' complete roll '+direction);
  assert.ok(maxYawStep<.03,aircraft.id+' no heading snap at knife edge');
  const bank=f.bank;steer(f,2,{});
  assert.ok(Math.abs(f.bankRate)<.02,aircraft.id+' released aileron stops roll rate');
  assert.ok(Math.abs(wrapAngle(f.bank-bank))<.75,aircraft.id+' no automatic upright snap');
  return travelled*degrees;
}
for(const aircraft of fleet.filter(a=>a.role==='fighter')){
  const turn=start(aircraft);
  steer(turn,.15,{roll:1});
  assert(turn.bank*degrees>0&&turn.bank*degrees<8,aircraft.id+' short tap');
  const rightRoll=fullRoll(aircraft,1),leftRoll=fullRoll(aircraft,-1);
  const level=start(aircraft,{bank:.8});steer(level,4,{autoLevel:true});
  assert(Math.abs(level.bank*degrees)<3,aircraft.id+' optional wings-level assistance');
  const climb=start(aircraft);
  steer(climb,2,{pitch:1});
  assert(climb.pitch*degrees>25&&climb.vy>0,aircraft.id+' climb');
  const dive=start(aircraft);
  steer(dive,2,{pitch:-1});
  assert(dive.pitch*degrees<-22&&dive.vy<0,aircraft.id+' dive');
  const inverted=start(aircraft,{bank:Math.PI});steer(inverted,.8,{pitch:1});
  assert(inverted.pitch<-.1,aircraft.id+' pulling while inverted pitches toward aircraft roof');
  for(const extra of [{hold:{heading:0,altitude:3500}}]){
    const restrained=start(aircraft,extra);
    steer(restrained,4,{roll:1});
    assert(restrained.bank*degrees<35,aircraft.id+' approach and autopilot response');
  }
  console.log(aircraft.id,{rightRoll:Math.round(rightRoll),leftRoll:Math.round(leftRoll),climbPitch:Math.round(climb.pitch*degrees)});
}
for(const aircraft of fleet.filter(a=>a.role!=='fighter'&&!a.helicopter)){
  console.log(aircraft.id,{rightRoll:Math.round(fullRoll(aircraft,1)),leftRoll:Math.round(fullRoll(aircraft,-1))});
}
for(const aircraft of fleet.filter(a=>!a.helicopter)){
  for(const sign of [-1,1]){
    const rudder=start(aircraft);steer(rudder,.8,{rudder:sign});
    assert.ok(wrapAngle(rudder.heading)*sign>.025,aircraft.id+' rudder sign '+sign);
    const bank=start(aircraft);steer(bank,1,{roll:sign});
    assert.ok(bank.bank*sign>0&&wrapAngle(bank.heading)*sign>0,aircraft.id+' bank/heading sign '+sign);
  }
}
