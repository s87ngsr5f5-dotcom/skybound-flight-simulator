'use strict';
const benchmarkFleet=[
  {id:'sf16',name:'SF-16 Kestrel',reference:'F-16C Block 50',type:'單發戰鬥訓練機',role:'fighter',
    mass:10950,wingArea:27.87,inertia:[14000,70000,80000],cgOffset:.022,gearHeight:1.85,stallAngle:.37,
    rotation:126,approach:142,geometry:[7.40,.85,4.90,-.22,1,1.65],thrust:78000,boostThrust:42000,jet:true},
  {id:'sa380',name:'SA-380 Horizon',reference:'A380-800',type:'四發雙層廣體客機',role:'passenger',
    mass:378000,wingArea:845,inertia:[52000000,84000000,115000000],cgOffset:.13,gearHeight:5.1,stallAngle:.28,
    rotation:146,approach:146,geometry:[36.36,3.57,39.875,-1.0,4,12.1],thrust:1280000,jet:true},
  {id:'a320neo',name:'Airbus A320neo',type:'雙發窄體客機',role:'passenger',
    mass:70000,wingArea:122.6,inertia:[1800000,4300000,5700000],cgOffset:.04,gearHeight:2.25,stallAngle:.28,
    rotation:139,approach:138,geometry:[18.79,1.98,17.9,-.55,2,5.1],thrust:240000,jet:true,
    passengers:174,missionFuel:14000,nacelleRadius:1.02},
  {id:'b773',name:'Boeing 777-300ER',type:'雙發廣體客機',role:'passenger',
    mass:260000,wingArea:436.8,inertia:[28500000,54000000,73000000],cgOffset:.07,gearHeight:4.1,stallAngle:.28,
    rotation:149,approach:151,geometry:[36.93,3.10,32.4,-.95,2,10.5],thrust:965000,jet:true,
    passengers:360,missionFuel:45000,nacelleRadius:1.69},
  {id:'sf748',name:'SF-748 Atlas',reference:'747-8F',type:'四發廣體貨機',role:'cargo',
    mass:286000,wingArea:554,inertia:[35000000,68000000,91000000],cgOffset:.11,gearHeight:4.6,stallAngle:.29,
    rotation:142,approach:148,geometry:[38.15,3.25,34.2,-1.1,4,13],thrust:1180000,jet:true,cargoLimit:95000}
].map(profile=>({...profile,glass:true,retract:true,reverse:profile.role!=='fighter',flapLift:[0,.25,.49],
  flapDrag:[0,.035,.085],brakeForce:profile.mass*4.8,rollingResistance:profile.mass*.15}));
fleet.push(...benchmarkFleet);

const benchmarkMissions={
  'fighter':{label:'戰鬥訓練 · 爬升與轉彎返場',from:'RCMQ',to:'RCMQ'},
  'passenger':{label:'雙層客運 · 桃園至高雄',from:'RCTP',to:'RCKH'},
  'cargo':{label:'鼻門貨運 · 高雄至桃園',from:'RCKH',to:'RCTP'}
};
const palletStations=[{name:'前艙 A',arm:-11,size:'3.35 × 3.8 m'},{name:'中艙 B',arm:0,size:'3.35 × 3.8 m'},{name:'後艙 C',arm:13,size:'3.35 × 3.8 m'}];
function cargoBalance(f){
  const cargo=f.pallets||[0,0,0];
  const mass=cargo.reduce((total,value)=>total+value,0);
  const shift=cargo.reduce((total,value,index)=>total+value*palletStations[index].arm,0)/(f.aircraft.mass+mass);
  const problems=cargo.map((value,index)=>value<0||value>38000?palletStations[index].name:null).filter(Boolean);
  if(mass>f.aircraft.cargoLimit) problems.push('總載重');
  if(Math.abs(shift)>1.2) problems.push(palletStations[shift>0?2:0].name+' 重心');
  return {mass,shift,problems};
}
function groundServiceAllowed(f){
  return f.ground&&f.parkingBrake&&Math.hypot(f.vx,f.vz)<.8&&!f.engines.some(Boolean)&&
    (f.phase==='cold'||f.awaitingService);
}
function setPallet(f,index,mass){
  if(!(f.noseDoor||f.sideDoor)||!groundServiceAllowed(f)||!Number.isFinite(mass)||index<0||index>2) return false;
  f.pallets[index]=mass;
  f.cargoState=cargoBalance(f);
  return true;
}
function trainingRoute(airport){
  return [
    {name:'爬升至 2,000 呎以上',...airportPoint(airport,10500,0)},
    {name:'轉彎訓練',...airportPoint(airport,10600,9000)},
    {name:'順風返場',...airportPoint(airport,-12500,9000)},
    {name:'截獲進場定位點',...airportPoint(airport,-10000,0)},
    {name:'跑道進場',...airportPoint(airport,-airport.length/2+240,0)}
  ];
}
function benchmarkRoute(role,from,to){
  if(role==='fighter') return trainingRoute(from);
  const west=[
    {name:'北部海岸外海',...geoPoint(25.15,121.07)},
    {name:'中部外海',...geoPoint(24.08,120.10)},
    {name:'西南外海',...geoPoint(23.11,119.98)},
    {name:'高雄外海',...geoPoint(22.58,120.09)}
  ];
  if(role==='cargo') west.reverse();
  return [...west,...regionalRoute(from,to).slice(-2)];
}
function approachGuidance(f){
  const a=f.destination;
  const {along,cross}=runwayCoordinates(f.x,f.z,a);
  const distance=Math.max(0,-along-a.length/2);
  const path=a.elevation+15+distance*Math.tan(Math.PI/60);
  return {distance,cross,height:f.y-path,heading:a.heading,valid:distance<16000&&distance>0&&Math.abs(cross)<2500};
}
if(typeof module!=='undefined') Object.assign(globalThis,{benchmarkFleet,benchmarkMissions,cargoBalance,groundServiceAllowed,setPallet,trainingRoute,benchmarkRoute,approachGuidance});


