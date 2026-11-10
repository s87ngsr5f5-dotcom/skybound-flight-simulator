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
for(const aircraft of fleet.filter(a=>a.role==='fighter')){
  const turn=start(aircraft);
  steer(turn,.15,{roll:1});
  assert(turn.bank*degrees>0&&turn.bank*degrees<8,aircraft.id+' short tap');
  steer(turn,3.85,{roll:1});
  assert(turn.bank*degrees>65&&turn.heading*degrees>25,aircraft.id+' sustained right turn');
  const rightBank=turn.bank*degrees;
  steer(turn,1.5,{roll:-1});
  assert(turn.bank*degrees<-60,aircraft.id+' left reversal');
  steer(turn,1.5,{});
  assert(Math.abs(turn.bank*degrees)<5,aircraft.id+' release levels wings');
  const climb=start(aircraft);
  steer(climb,2,{pitch:1});
  assert(climb.pitch*degrees>25&&climb.vy>0,aircraft.id+' climb');
  const dive=start(aircraft);
  steer(dive,2,{pitch:-1});
  assert(dive.pitch*degrees<-22&&dive.vy<0,aircraft.id+' dive');
  for(const extra of [{gear:true},{flaps:1},{hold:{heading:0,altitude:3500}}]){
    const restrained=start(aircraft,extra);
    steer(restrained,4,{roll:1});
    assert(restrained.bank*degrees<35,aircraft.id+' approach and autopilot response');
  }
  console.log(aircraft.id,{rightBank:Math.round(rightBank),climbPitch:Math.round(climb.pitch*degrees)});
}
