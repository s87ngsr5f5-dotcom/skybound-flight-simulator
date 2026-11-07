'use strict';
const naritaAirport=airport('RJAA','成田',35+(45+31.88/60)/60,140+(22+46.255/60)/60,329.51,4000,60,41,'34L','16R',-205);
const allAirports=[...taiwanAirports,naritaAirport];
const cargoVoyageKey='skybound.narita.replay.v1';
const cargoVoyageRoute=[
  {name:'東海航段',...geoPoint(27.55,126.30)},
  {name:'琉球東方航段',...geoPoint(29.68,131.37)},
  {name:'四國南方航段',...geoPoint(31.97,135.30)},
  {name:'房總外海下降點',...geoPoint(34.83,140.65)},
  {name:'成田進場定位點',...airportPoint(naritaAirport,-15500,0)},
  {name:'成田 34L',...airportPoint(naritaAirport,-1720,0)}
];
function naritaHeight(x,z){
  const {lat,lon}=latLon(x,z);
  const u=(lon-140)/.003,v=(35.97-lat)/.003;
  const i=Math.floor(u),j=Math.floor(v);
  if(i<0||j<0||i>=200||j>=180) return 0;
  const a=u-i,b=v-j,k=j*201+i;
  return (naritaElevation[k]*(1-a)+naritaElevation[k+1]*a)*(1-b)+
    (naritaElevation[k+201]*(1-a)+naritaElevation[k+202]*a)*b;
}
function makeCargoVoyage(departure,profile,node,wind){
  const f=makeRegionalFlight(departure,naritaAirport,profile,'cold',wind,cargoVoyageRoute);
  Object.assign(f,{voyage:true,mission:'cargo',node,fuel:56000,sideDoor:false});
  if(node!=='load'){
    f.pallets=[9000,18000,8000];
    f.loadedAtDeparture=true;
  }
  if(node==='taxi'){
    f.battery=true;f.engines.fill(true);f.lights=true;
  }
  if(node==='descent'||node==='approach'){
    const initial=node==='descent'?cargoVoyageRoute[3]:airportPoint(naritaAirport,-11600,0);
    const heading=node==='approach'?naritaAirport.heading:Math.atan2(cargoVoyageRoute[4].x-initial.x,initial.z-cargoVoyageRoute[4].z);
    const speed=node==='approach'?83:118;
    Object.assign(f,{x:initial.x,z:initial.z,y:node==='approach'?530:3250,heading,
      vx:Math.sin(heading)*speed,vz:-Math.cos(heading)*speed,vy:-2,
      speed,power:.28,ground:false,airborne:true,battery:true,lights:true,parkingBrake:false,
      phase:node==='approach'?'approach':'cruise',waypoint:node==='approach'?5:4,
      flaps:node==='approach'?1:0,gear:node==='approach'});
    f.fuel=42000;
    f.engines.fill(true);
  }
  if(node==='warning'){
    f.noseDoor=true;f.battery=true;f.lights=true;
  }
  return f;
}
const replayFields=['x','y','z','heading','pitch','bank','vx','vy','vz','speed','vs','power','flaps','trim',
  'fuel','waypoint','taxiIndex','phase','gear','lights','noseDoor','sideDoor','battery','parkingBrake','ground',
  'landed','ended','finished','awaitingService','reverse','spoilers','pallets','engines','arrivalTaxi','touchdown'];
function captureVoyage(f,frames,force=false){
  const previous=frames.at(-1);
  const sampleInterval=f.ground||f.phase==='approach'?1:10;
  if(previous&&!force&&f.elapsed-previous[0]<sampleInterval) return;
  if(previous&&f.elapsed<=previous[0]&&!force) return;
  frames.push([f.elapsed,...replayFields.map(key=>{
    const value=f[key];
    return typeof value==='number'?Math.round(value*10000)/10000:Array.isArray(value)?value.slice():value;
  })]);
}
function applyVoyageFrame(f,frames,time){
  let lo=0,hi=frames.length-1;
  while(lo<hi){
    const middle=Math.ceil((lo+hi)/2);
    if(frames[middle][0]<=time) lo=middle;else hi=middle-1;
  }
  const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)];
  const fraction=a===b?0:limit((time-a[0])/(b[0]-a[0]),0,1);
  replayFields.forEach((key,i)=>{
    const from=a[i+1],to=b[i+1];
    if(key==='heading') f[key]=from+wrapAngle(to-from)*fraction;
    else if(i<14) f[key]=from+(to-from)*fraction;
    else f[key]=from;
  });
  f.elapsed=time;
  return f;
}
function storeVoyage(frames,f){
  try{
    localStorage.setItem(cargoVoyageKey,JSON.stringify({frames,wind:f.wind,time:f.voyageTime,node:f.node}));
    return true;
  }catch{return false;}
}
function loadVoyage(){
  try{
    const value=JSON.parse(localStorage.getItem(cargoVoyageKey)||'null');
    return value?.frames?.length>1?value:null;
  }catch{return null;}
}
if(typeof module!=='undefined') Object.assign(globalThis,{naritaAirport,naritaHeight,makeCargoVoyage,captureVoyage,applyVoyageFrame,cargoVoyageRoute});

