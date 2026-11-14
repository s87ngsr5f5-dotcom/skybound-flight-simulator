const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const c=vm.createContext({console,Math,module:{exports:{}},regionalHeight:()=>4,groundHeight:()=>4,flightWind:()=>({x:0,z:0}),fleet:[],
  runwayCoordinates:()=>({along:0,cross:0})});
vm.runInContext(fs.readFileSync('dist/physics.js','utf8'),c);
vm.runInContext(fs.readFileSync('dist/helicopter.js','utf8'),c);
const make=()=>vm.runInContext(`configureHelicopterFlight({aircraft:helicopterProfile,start:'runway',departure:{elevation:4},destination:{},regional:true,
  x:0,y:5.4,z:0,vx:0,vy:0,vz:0,windVector:{x:0,z:0},heading:0,pitch:0,bank:0,pitchRate:0,bankRate:0,yawRate:0,
  power:0,engines:[true],battery:true,fuel:280,fuelStart:280,elapsed:0,ground:true,parkingBrake:false})`,c);
const input={pitch:0,roll:0,rudder:0,throttle:0,trim:0};
function run(f,seconds,control=input){c.f=f;c.control=control;vm.runInContext(`for(let i=0;i<${Math.round(seconds*120)};i++)stepTrainer(f,control,1/120);`,c);}
const f=make();f.power=.62;run(f,6);assert.ok(!f.ground&&f.y>8);
f.power=.55;const before=f.y;run(f,8);assert.ok(Math.abs(f.y-before)<25);
c.f=f;vm.runInContext('toggleHelicopterHover(f)',c);run(f,15);assert.ok(Math.abs(f.vy)<.2);assert.ok(f.hover);
const heading=f.heading;run(f,2,{...input,rudder:.65});assert.ok(Math.abs(f.heading-heading)>.2&&!f.hover);
run(f,4,{...input,pitch:.6});assert.ok(Math.hypot(f.vx,f.vz)>2);
// High collective climbs strongly even while pitching forward across all helicopter weights
for(const profileName of ['helicopterProfile','uh60Profile','ah64Profile','aw101Profile']){
  const h=vm.runInContext(`configureHelicopterFlight({aircraft:${profileName},start:'runway',departure:{elevation:4},destination:{},regional:true,
    x:0,y:4+${profileName}.gearHeight,z:0,vx:0,vy:0,vz:0,windVector:{x:0,z:0},heading:0,pitch:0,bank:0,pitchRate:0,bankRate:0,yawRate:0,
    power:.82,engines:[true],battery:true,fuel:${profileName}.missionFuel,fuelStart:${profileName}.missionFuel,elapsed:0,ground:true,parkingBrake:true})`,c);
  run(h,6,{...input,pitch:.45});
  assert.ok(!h.ground && !h.ended && h.y > 25 && Math.hypot(h.vx,h.vz) > 5, `${profileName} failed climb/takeoff: y=${h.y}, ground=${h.ground}, ended=${h.ended}`);
  const hAir=vm.runInContext(`configureHelicopterFlight({aircraft:${profileName},start:'air',departure:{elevation:4},destination:{},regional:true,
    x:0,y:4,z:0,vx:0,vy:0,vz:0,windVector:{x:0,z:0},heading:0,pitch:0,bank:0,pitchRate:0,bankRate:0,yawRate:0,
    engines:[true],battery:true,fuel:${profileName}.missionFuel,fuelStart:${profileName}.missionFuel,elapsed:0,ground:false,parkingBrake:false})`,c);
  assert.ok(hAir.y >= 460, `${profileName} air start too low: ${hAir.y}`);
}
f.vx=f.vz=0;f.pitch=f.bank=f.pitchRate=f.bankRate=0;f.power=.55;c.f=f;vm.runInContext('toggleHelicopterHover(f)',c);run(f,10);
f.hover=null;f.power=.50;run(f,100);assert.ok(f.landed&&f.ground&&!f.ended);assert.ok(f.fuel<280&&f.rotorRPM>.99);
const cold=make();cold.start='cold';cold.engines=[false];cold.rotorRPM=0;cold.power=.9;run(cold,5);assert.ok(cold.ground);
const a=make(),b=make();a.power=b.power=.61;run(a,6);for(let i=0;i<60;i++)run(b,.1);assert.ok(Math.abs(a.y-b.y)<1e-9);
c.f=f;c.saves=0;f.parkingBrake=true;f.engines=[false];vm.runInContext('updateHelicopterFlight(f,()=>{saves++;return true});updateHelicopterFlight(f,()=>{saves++;return true});',c);
assert.equal(c.saves,1);assert.ok(f.finished&&f.recorded);
console.log('Helicopter lift-off, hover, yaw, cyclic, landing, fuel and fixed-step replay passed', {fuel:f.fuel,y:f.y});
