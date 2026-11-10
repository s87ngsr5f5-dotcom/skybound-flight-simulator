const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations']){
 vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const from=taiwanAirports.find(a=>a.code==='RCTP'),to=taiwanAirports.find(a=>a.code==='RCKH'),plane=fleet.find(a=>a.id==='b773');
const cold=makeRegionalFlight(from,to,plane,'cold',0,regionalRoute(from,to));
cold.power=.68;
assert(!startEngine(cold,0));
cold.battery=true;
assert(startEngine(cold,0)&&startEngine(cold,1));
assert.equal(cold.power,.68);
const trials=[[plane,'realistic',false],[plane,'autonav-fast',true],
  ...fleet.map(aircraft=>[aircraft,'fast',true])];
for(const [aircraft,mode,fast] of trials){
 const f=makeCruiseTrial(from,to,aircraft,0);
 f.fastCruise=fast;
 f.hold.mach=cruiseMachTarget(f);
 if(mode==='autonav-fast'){
  f.cruiseTrial=false;f.hold={nav:true,altitude:f.y};
  f.route=[...f.route,...regionalRoute(from,to)];
 }
 const start={x:f.x,z:f.z};
 let input;
 for(let i=0;i<120*240;i++){
  if(i%4===0) input={roll:0,rudder:0,brake:false,trim:0,...(f.hold.nav?navigationControls(f,activeTarget(f)):cruiseControls(f))};
  stepTrainer(f,input);
  if(mode==='autonav-fast') updateRegionalFlight(f,()=>true);
 }
 const {tas,gs,mach}=flightSpeeds(f),nmi=Math.hypot(f.x-start.x,f.z-start.z)/1852;
 console.log({aircraft:aircraft.id,mode,tas:tas*knotsPerMps,gs:gs*knotsPerMps,mach,nmi});
 assert(Math.abs(gs*knotsPerMps-tas*knotsPerMps)<1);
 assert.equal(f.power,1,aircraft.id+' '+mode+' full cruise throttle');
 assert(fast?Math.abs(tas*knotsPerMps-1000)<20&&nmi>58:tas*knotsPerMps<500&&nmi>29);
}
