const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations']){
  vm.runInThisContext(fs.readFileSync('dist/'+file+'.js','utf8'),{filename:file+'.js'});
}
const from=taiwanAirports.find(a=>a.code==='RCTP'),to=taiwanAirports.find(a=>a.code==='RCKH');
const plane=fleet.find(a=>a.id==='a320neo');
for(const skip of [false,true]){
  const f=makePassengerFlight(from,to,plane,0,7000,'0','13:00');
  Object.assign(f,airportPoint(to,150,0),{airborne:true,landed:true,touchdown:{along:150},
    heading:to.heading,y:to.elevation+plane.gearHeight,parkingBrake:false,fuel:5100,vx:8});
  f.service.boarded=f.passengers;
  f.service.pushed=true;
  updateRegionalFlight(f,()=>true);
  assert(!requestGateTow(f),'moving aircraft cannot tow');
  f.vx=0;
  assert(requestGateTow(f));
  assert(f.tow.arrival);
  if(skip) assert(finishRunwayTow(f));
  else for(let tick=0;tick<60000&&f.tow;tick++) stepRunwayTow(f,simTick);
  assert(!f.tow&&f.awaitingService&&f.parkingBrake);
  assert.deepEqual({x:f.x,z:f.z},parkingPoint(to));
  assert.equal(f.service.boarded,f.passengers);
  assert.equal(f.fuel,5100);
  f.engines.fill(false);
  f.bridge=true;
  setPassengerDoor(f,true);
  updatePassengerService(f,60);
  assert.equal(f.service.delivered,f.passengers);
  assert.equal(f.service.boarded,0);
  setPassengerDoor(f,false);
  f.bridge=false;
  updateRegionalFlight(f,(_,result)=>{assert.equal(result,'任務完成');return true;});
  assert(f.finished&&f.recorded);
}
console.log('Arrival tow, gate skip, boarding data and deplaning passed.');
