const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations']){
 vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const {smoothControls}=require('./dist/controls.js');
const from=taiwanAirports.find(a=>a.code==='RCTP'), to=taiwanAirports.find(a=>a.code==='RCKH');
for(const id of ['b744','sf748','an124']){
 const plane=fleet.find(a=>a.id===id),f=makeRegionalFlight(from,to,plane,'runway',0,regionalRoute(from,to));
 assert.equal(f.engines.length,4);
 const start=runwayCoordinates(f.x,f.z,from).along;
 for(let i=0;i<120*105&&f.ground;i++){
  const pitch=flightSpeeds(f).ias*knotsPerMps>=plane.rotation?.62:0;
  stepTrainer(f,smoothControls(f,{rudder:0,roll:0,pitch,throttle:1,trim:0},simTick));
 }
 const distance=runwayCoordinates(f.x,f.z,from).along-start;
 assert(f.airborne&&distance<from.length-280,JSON.stringify({id,distance,speed:f.speed,y:f.y}));
 console.log({id,takeoffDistance:Math.round(distance)});
}
for(const [id,wind,distance,height] of [['a223',0,5500,350],['a320neo',5.144,7500,440],['b773',0,9000,530],
 ['b744',0,9000,530],['sf748',0,9000,530],['an124',0,9000,530],['a223',0,0,1100]]){
 const plane=fleet.find(a=>a.id===id),route=regionalRoute(from,to);
 const f=makeRegionalFlight(from,to,plane,'air',wind,route);
 f.fuel=10000;
 if(distance){
  const speed=(plane.approach+30)/knotsPerMps;
  Object.assign(f,airportPoint(to,-to.length/2-distance,10),{heading:to.heading,y:to.elevation+height,vx:Math.sin(to.heading)*speed,vz:-Math.cos(to.heading)*speed});
 }else{
  f.y=height;
  f.heading=Math.atan2(to.x-f.x,f.z-to.z);
  f.vx=Math.sin(f.heading)*106; f.vz=-Math.cos(f.heading)*106;
 }
 f.hold={nav:true,altitude:f.y};
 let input;
 for(let i=0;i<120*3300&&f.hold&&!f.ended;i++){
  if(i%4===0)input={rudder:0,...navigationControls(f,activeTarget(f)),trim:0};
  stepTrainer(f,smoothControls(f,input,simTick));
  updateRegionalFlight(f,()=>true);
 }
 const frame=runwayCoordinates(f.x,f.z,to); assert(f.landed&&f.parkingBrake&&Math.abs(frame.cross)<to.width/2, JSON.stringify({id,distance,wind,frame,msg:f.navMessage}));
 console.log({id,wind,distance,landed:f.landed,parked:f.parkingBrake,elapsed:Math.round(f.elapsed),stage:f.hold?.stage,touchdown:f.touchdown,frame,y:f.y,heading:f.heading,message:f.navMessage});
}
