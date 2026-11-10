'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','regional-elevation','island-elevation','region','fleet','benchmarks','operations','taiwan-satellite-data','taiwan-satellite']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const trainerPlane=fleet.find(a=>a.id==='c172s');
const taitung=taiwanAirports.find(a=>a.code==='RCFN');
const request=new URL(satelliteTileURL({key:'0_0',origin:{value:{x:0,y:0}}},'high'));
assert.equal(request.searchParams.get('width'),'1152');
const [south,west,north,east]=request.searchParams.get('bbox').split(',').map(Number);
assert(south<north&&west<east);
assert(Math.abs(north-regionalOrigin.lat)<1e-8&&Math.abs(west-regionalOrigin.lon)<1e-8);
for(const code of ['RCGI','RCLY']){
  const island=taiwanAirports.find(a=>a.code===code);
  const tile=Math.floor(island.x/11520)+'_'+Math.floor(island.z/11520);
  assert(taiwanSatelliteData.baked.includes(tile));
  assert(fs.existsSync('dist/satellite/'+tile+'.webp'));
  assert.equal(regionalHeight(island.x,island.z),island.elevation);
  const park=parkingPoint(island);
  assert.equal(regionalHeight(park.x,park.z),island.elevation);
  const cold=makeRegionalFlight(island,taitung,trainerPlane,'cold',0,regionalRoute(island,taitung));
  assert(requestRunwayTow(cold));
  assert(finishRunwayTow(cold));
  assert.equal(cold.heading,island.heading);
  cold.battery=true;
  assert(startEngine(cold,0));
  cold.parkingBrake=false;
  for(let i=0;i<120*65&&cold.ground;i++){
    const pitch=flightSpeeds(cold).ias*knotsPerMps>trainerPlane.rotation?.50:0;
    stepTrainer(cold,{roll:0,rudder:0,pitch,throttle:1,trim:0});
  }
  assert(cold.airborne&&runwayCoordinates(cold.x,cold.z,island).along<island.length/2-40);
  const f=makeRegionalFlight(taitung,island,trainerPlane,'air',0,regionalRoute(taitung,island));
  const speed=(trainerPlane.approach+9)/knotsPerMps;
  Object.assign(f,airportPoint(island,-island.length/2-2850,0),{
    heading:island.heading,y:island.elevation+155,vx:Math.sin(island.heading)*speed,
    vz:-Math.cos(island.heading)*speed,power:.24,fastCruise:true,hold:{nav:true,altitude:island.elevation+155}
  });
  let input;
  for(let i=0;i<120*360&&f.hold&&!f.ended;i++){
    if(i%4===0) input={rudder:0,trim:0,...navigationControls(f,activeTarget(f))};
    stepTrainer(f,input);
    updateRegionalFlight(f,()=>true);
  }
  assert(f.landed&&f.parkingBrake,JSON.stringify({code,position:latLon(f.x,f.z),touchdown:f.touchdown,message:f.navMessage}));
  assert(Math.abs(f.touchdown.cross)<island.width/2);
  console.log(code,'takeoff and automatic landing passed');
}
