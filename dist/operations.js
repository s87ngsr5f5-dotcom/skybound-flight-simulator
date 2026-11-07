'use strict';
const flightLogKey='skybound.flightLog.v2';
function readFlightLog(){
  try {return JSON.parse(localStorage.getItem(flightLogKey)||'[]');} catch {return [];}
}
function recordFlight(f,result){
  const row={aircraft:f.aircraft.name,departure:f.departure.code,destination:f.destination.code,
    seconds:Math.round(f.elapsed),date:new Date().toISOString(),result};
  try {localStorage.setItem(flightLogKey,JSON.stringify([row,...readFlightLog()].slice(0,50)));}
  catch {return false;}
  return true;
}
function makeRegionalFlight(departure,destination,aircraft,start,wind,waypoints){
  const air=start==='air', cold=start==='cold';
  const position=cold?parkingPoint(departure):airportPoint(departure,air?1700:-departure.length/2+95,0);
  const heading=cold?wrapAngle(departure.heading+Math.PI):departure.heading;
  const speed=air?aircraft.approach*.66:0;
  const first=airportPoint(departure,-departure.length/2+135,departure.apron);
  const holding=airportPoint(departure,-departure.length/2+135,0);
  return {
    ...position,heading,pitch:0,bank:0,pitchRate:0,bankRate:0,yawRate:0,
    y:air?950:departure.elevation+aircraft.gearHeight,
    vx:Math.sin(heading)*speed,vy:0,vz:-Math.cos(heading)*speed,
    trim:0,power:air?.58:0,flaps:0,ground:!air,landed:false,ended:false,
    stall:false,speed,vs:0,wind,elapsed:0,airborne:air,touchdown:null,
    aircraft,departure,destination,start,regional:true,
    battery:!cold,engines:Array(aircraft.geometry[4]).fill(!cold),
    lights:false,parkingBrake:cold,gear:!air||!aircraft.retract,reverse:false,spoilers:false,
    route:waypoints,waypoint:0,pallets:[0,0,0],noseDoor:false,boost:false,bridge:false,awaitingService:false,taxi:[{name:'滑行至跑道端',...first},{name:'轉入跑道',...holding}],
    taxiIndex:0,arrivalTaxi:null,phase:cold?'cold':air?'cruise':'takeoff',recorded:false,finished:false
  };
}
function startEngine(f,index){
  if(f.engines[index]){
    f.engines[index]=false;
    return true;
  }
  if(!f.battery || f.power>.13 || f.noseDoor || f.sideDoor || (f.mission==='cargo'&&f.phase==='cold'&&!f.pallets.some(Boolean)) || (f.aircraft.cargoLimit&&cargoBalance(f).problems.length)) return false;
  f.engines[index]=true;
  return true;
}
function updateRegionalFlight(f,save=recordFlight){
  if(f.finished) return;
  if(f.ended){
    f.finished=true;
    f.recorded=save(f,'落地失敗');
    return;
  }
  if(f.landed){
    if(!f.arrivalTaxi){
      const end=f.touchdown.along<40?440:Math.min(f.destination.length/2-90,950);
      f.arrivalTaxi=[
        {name:'滑行至跑道出口',...airportPoint(f.destination,end,0)},
        {name:'滑出跑道',...airportPoint(f.destination,end,f.destination.apron)},
        {name:'滑至停機位',...parkingPoint(f.destination)}
      ];
      f.taxiIndex=0;
    }
    f.phase='arrival';
    const target=f.arrivalTaxi[f.taxiIndex];
    if(Math.hypot(f.x-target.x,f.z-target.z)<(f.taxiIndex===2?22:16)){
      if(f.taxiIndex<2) f.taxiIndex++;
      else if(Math.hypot(f.vx,f.vz)<1 && f.parkingBrake){
        if(f.mission==='passenger'||f.mission==='cargo'){
          f.awaitingService=true;
          const done=!f.engines.some(Boolean)&&(f.mission==='passenger'?f.bridge:f.loadedAtDeparture&&!f.pallets.some(Boolean)&&!f.noseDoor&&!f.sideDoor);
          if(!done) return;
        }
        f.finished=true;
        f.recorded=save(f,f.mission?'任務完成':'已落地並停妥');
      }
    }
    return;
  }
  if(f.airborne){
    f.phase=f.waypoint>=f.route.length-1?'approach':'cruise';
    if(f.mission==='fighter'&&f.waypoint===0&&f.y<610) return;
    const target=f.route[f.waypoint];
    if(f.waypoint<f.route.length-1&&Math.hypot(f.x-target.x,f.z-target.z)<(f.waypoint===f.route.length-2?1100:1900)) f.waypoint++;
    return;
  }
  if(f.start!=='cold') return;
  if(!f.engines.some(Boolean)){f.phase='cold';return;}
  if(f.taxiIndex>=f.taxi.length){f.phase='takeoff';return;}
  f.phase='taxi';
  const target=f.taxi[f.taxiIndex];
  if(Math.hypot(f.x-target.x,f.z-target.z)<16){ f.taxiIndex++; if(f.taxiIndex===f.taxi.length) f.phase="takeoff"; }
}
function activeTarget(f){
  if(f.phase==='arrival') return f.arrivalTaxi[f.taxiIndex];
  if(f.phase==='taxi'||f.phase==='cold') return f.taxi[f.taxiIndex];
  return f.route[f.waypoint];
}
if(typeof module!=='undefined') Object.assign(globalThis,{makeRegionalFlight,startEngine,updateRegionalFlight,activeTarget,readFlightLog});


