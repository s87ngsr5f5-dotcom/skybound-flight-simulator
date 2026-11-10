const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations','controls']){
 vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const from=taiwanAirports.find(a=>a.code==='RCTP'),to=taiwanAirports.find(a=>a.code==='RCKH'),plane=fleet.find(a=>a.id==='b773');
const mirage=fleet.find(a=>a.id==='m2000');
const reverseRunway={...from,heading:from.heading+Math.PI};
const low=makeRegionalFlight(reverseRunway,to,mirage,'runway',0,regionalRoute(reverseRunway,to));
low.fastCruise=true;
const controls={roll:0,rudder:0,trim:0,throttle:1};
for(let i=0;i<120*150&&!low.ended&&flightSpeeds(low).ias*3.6<2000;i++){
 const speed=flightSpeeds(low).ias*3.6;
 const pitch=low.ground?speed>knotsToKmh(mirage.rotation)?.50:0:
   low.y<210?.20:speed<510?.03:0;
 stepTrainer(low,{...controls,pitch});
}
const beforeBrake=flightSpeeds(low).ias*3.6;
assert(low.airborne&&!low.ended&&beforeBrake>=2000&&low.y<650,{beforeBrake,y:low.y});
for(let i=0;i<120*12;i++) stepTrainer(low,{...controls,pitch:0,brake:true});
const afterBrake=flightSpeeds(low).ias*3.6;
assert(low.airBrake&&!low.ended&&afterBrake<beforeBrake-360&&low.power===1);
stepTrainer(low,{...controls,pitch:0});
assert.equal(low.airBrake,false);
console.log({mode:'runway-to-IAS',aircraft:mirage.id,y:low.y,beforeBrake,afterBrake});

for(const wind of [-50,50]){
 const aircraft=fleet.find(a=>a.id==='fck1');
 const f=makeCruiseTrial(from,to,aircraft,wind,true,true);
 const start=flightSpeeds(f).ias*3.6;
 assert(start<1800);
 let input;
 for(let i=0;i<120*95;i++){
  if(i%4===0) input={roll:0,rudder:0,brake:false,trim:0,...cruiseControls(f)};
  stepTrainer(f,input);
 }
 const {ias,tas,gs,mach}=flightSpeeds(f);
 console.log({mode:'indicated',wind,ias:ias*3.6,tas:tas*3.6,gs:gs*3.6,mach,y:f.y});
 assert(ias*3.6>=2000&&ias*3.6<=2040,'IAS must come from measured flight state');
 assert(Math.abs((gs-tas)-wind/knotsPerMps)<1);
 assert(Math.abs(f.y-2500)<150);
 const heading=f.heading;
 const manual={roll:.55,pitch:.10,rudder:0,trim:0,throttle:0};
 f.hold=null;
 for(let i=0;i<120*4;i++) stepTrainer(f,smoothControls(f,manual,simTick));
 assert(f.bank>.10&&f.bank<.42&&wrapAngle(f.heading-heading)>0);
 const centered={...manual,roll:0,pitch:0};
 for(let i=0;i<120*3;i++) stepTrainer(f,smoothControls(f,centered,simTick));
 assert(Math.abs(f.bank)<.02&&flightSpeeds(f).ias*3.6>1950&&f.y<2675);
}
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
 const {ias,tas,gs,mach}=flightSpeeds(f),nmi=Math.hypot(f.x-start.x,f.z-start.z)/1852;
 console.log({aircraft:aircraft.id,mode,tas:tas*knotsPerMps,gs:gs*knotsPerMps,mach,nmi});
 assert(Math.abs(gs*knotsPerMps-tas*knotsPerMps)<1);
 assert.equal(f.power,1,aircraft.id+' '+mode+' full cruise throttle');
 assert(fast?ias*3.6>=fastCruiseKmh&&ias*3.6<fastCruiseKmh+40&&nmi>61:tas*knotsPerMps<500&&nmi>29);
}
