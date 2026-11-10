'use strict';
const benchmarkFleet=[
  {id:'sf15',name:'SF-15 Eagle · 外部 3D 模型',reference:'F-15 style CC0 model',type:'雙發制空戰鬥機',role:'fighter',
    mass:18000,wingArea:56.5,inertia:[42000,160000,180000],cgOffset:.022,gearHeight:2.3,stallAngle:.37,
    rotation:135,approach:150,geometry:[9.73,1.15,6.52,-.22,2,2.3],thrust:150000,boostThrust:90000,jet:true,externalModel:'models/f15.glb'},

  {id:'sf16',name:'SF-16 Kestrel',reference:'F-16C Block 50',type:'單發戰鬥訓練機',role:'fighter',
    mass:10950,wingArea:27.87,inertia:[14000,70000,80000],cgOffset:.022,gearHeight:1.85,stallAngle:.37,
    rotation:126,approach:142,geometry:[7.40,.85,4.90,-.22,1,1.65],thrust:78000,boostThrust:42000,jet:true},
  {id:'f5e',name:'Northrop F-5E Tiger II',type:'雙發輕型戰鬥機',role:'fighter',
    mass:6800,wingArea:17.28,inertia:[8400,43600,49200],cgOffset:.022,gearHeight:1.46,stallAngle:.34,
    rotation:138,approach:151,geometry:[7.23,.69,4.06,-.21,2,1.52],thrust:31000,boostThrust:13500,
    jet:true,sideIntakes:true,maxMach:1.6,trimColor:0x64775e},
  {id:'f16v',name:'F-16V 戰隼',reference:'F-16V family',type:'臺灣機隊 · 單發多用途戰鬥機',role:'fighter',
    mass:11600,wingArea:27.87,inertia:[15200,75000,85000],cgOffset:.020,gearHeight:1.85,stallAngle:.37,
    rotation:132,approach:143,geometry:[7.51,.85,4.72,-.22,1,1.65],thrust:79000,boostThrust:50000,
    jet:true,f16Family:true,maxMach:2.0,noWinglet:true,trimColor:0x526b80},
  {id:'fck1',name:'F-CK-1 經國號',reference:'F-CK-1A',type:'臺灣機隊 · 雙發輕型戰鬥機',role:'fighter',
    mass:9100,wingArea:24.26,inertia:[10600,55100,65000],cgOffset:.020,gearHeight:1.54,stallAngle:.37,
    rotation:131,approach:145,geometry:[7.01,.81,4.72,-.25,2,1.82],thrust:54000,boostThrust:28300,
    jet:true,sideIntakes:true,wideIntakes:true,noWinglet:true,maxMach:1.6,trimColor:0x68766f},
  {id:'m2000',name:'幻象 2000-5 · Mirage',reference:'Mirage 2000-5 single-seat',type:'臺灣機隊 · 單發無尾三角翼戰鬥機',role:'fighter',
    mass:10150,wingArea:41,inertia:[12700,62500,75000],cgOffset:.018,gearHeight:1.70,stallAngle:.40,
    rotation:133,approach:140,geometry:[7.15,.82,4.55,-.20,1,4.9],thrust:64000,boostThrust:34000,
    jet:true,sideIntakes:true,delta:true,noWinglet:true,maxMach:2.2,trimColor:0x5b7c93},
  {id:'sa380',name:'SA-380 Horizon',reference:'A380-800',type:'四發雙層廣體客機',role:'passenger',
    mass:378000,wingArea:845,inertia:[52000000,84000000,115000000],cgOffset:.13,gearHeight:5.1,stallAngle:.28,
    rotation:146,approach:146,geometry:[36.36,3.57,39.875,-1.0,4,12.1],thrust:1280000,jet:true,cruiseMach:.85,maxMach:.89,cleanDrag:.020,fuelIdle:.42,fuelPower:4.5},
  {id:'a223',name:'Airbus A220-300',type:'雙發支線噴射客機',role:'passenger',
    mass:60500,wingArea:112.3,inertia:[1510000,3900000,4700000],cgOffset:.034,gearHeight:2.12,stallAngle:.28,
    rotation:132,approach:131,geometry:[19.35,1.76,17.55,-.54,2,4.4],thrust:205000,jet:true,
    passengers:140,missionFuel:13000,nacelleRadius:.96,cruiseMach:.78,maxMach:.82,cleanDrag:.020,
    fuelIdle:.16,fuelPower:1.08,regionalGates:true,seatColumns:[2,3],trimColor:0x185b82},
  {id:'a320neo',name:'Airbus A320neo',type:'雙發窄體客機',role:'passenger',
    mass:70000,wingArea:122.6,inertia:[1800000,4300000,5700000],cgOffset:.04,gearHeight:2.25,stallAngle:.28,
    rotation:139,approach:138,geometry:[18.79,1.98,17.9,-.55,2,5.1],thrust:240000,jet:true,
    passengers:174,missionFuel:14000,nacelleRadius:1.02,cruiseMach:.78,maxMach:.82,cleanDrag:.021,fuelIdle:.18,fuelPower:1.25},
  {id:'b38m',name:'Boeing 737 MAX 8',type:'雙發窄體客機 · 分叉翼尖',role:'passenger',
    mass:71000,wingArea:127,inertia:[1640000,4480000,4960000],cgOffset:.042,gearHeight:2.08,stallAngle:.28,
    rotation:142,approach:141,geometry:[19.735,1.88,17.96,-.57,2,5.5],thrust:252000,jet:true,
    passengers:178,missionFuel:14500,nacelleRadius:1.07,cruiseMach:.79,maxMach:.82,cleanDrag:.020,
    fuelIdle:.17,fuelPower:1.30,splitWinglet:true,mainAxles:1,trimColor:0x3d5185},
  {id:'b763er',name:'Boeing 767-300ER',type:'雙發廣體客機 · 2-3-2 客艙',role:'passenger',
    mass:151000,wingArea:283.3,inertia:[13500000,27800000,35100000],cgOffset:.078,gearHeight:3.52,stallAngle:.29,
    rotation:144,approach:149,geometry:[27.47,2.515,23.785,-.77,2,9.1],thrust:557000,jet:true,
    passengers:217,missionFuel:33500,nacelleRadius:1.30,cruiseMach:.80,maxMach:.86,cleanDrag:.022,
    fuelIdle:.25,fuelPower:2.23,seatColumns:[2,2],centerSeats:3,noWinglet:true,trimColor:0x245374},
  {id:'b773',name:'Boeing 777-300ER',type:'雙發廣體客機',role:'passenger',
    mass:260000,wingArea:436.8,inertia:[28500000,54000000,73000000],cgOffset:.07,gearHeight:4.1,stallAngle:.28,
    rotation:149,approach:151,geometry:[36.93,3.10,32.4,-.95,2,10.5],thrust:965000,jet:true,
    passengers:360,missionFuel:45000,nacelleRadius:1.88,mainAxles:3,rakedTip:true,cruiseMach:.84,maxMach:.89,cleanDrag:.022,fuelIdle:.32,fuelPower:2.6},
  {id:'b744',name:'Boeing 747-400',type:'四發客機 · 加長上層客艙',role:'passenger',
    mass:250000,wingArea:541.2,inertia:[36000000,66000000,95000000],cgOffset:.067,gearHeight:4.62,stallAngle:.29,
    rotation:151,approach:152,geometry:[35.335,3.25,32.22,-.91,4,11.55],
    thrust:1040000,nacelleRadius:1.34,jet:true,upperDeck:'long',passengers:416,missionFuel:58000,
    cruiseMach:.85,maxMach:.92,cleanDrag:.023,fuelIdle:.41,fuelPower:3.75,seatColumns:[3,3],centerSeats:4,trimColor:0x294c88},
  {id:'b763f',name:'Boeing 767-300F',type:'雙發側門貨機',role:'cargo',
    mass:139000,wingArea:283.3,inertia:[12500000,27000000,33700000],cgOffset:.075,gearHeight:3.5,stallAngle:.29,
    rotation:142,approach:152,geometry:[27.47,2.515,23.785,-.76,2,9.1],thrust:560000,jet:true,
    cargoLimit:52700,cargoSlotLimit:21000,sideCargo:true,nacelleRadius:1.27,
    cruiseMach:.80,maxMach:.86,cleanDrag:.023,trimColor:0x87523b},
  {id:'sf748',name:'Boeing 747-8F · Atlas',reference:'747-8F',type:'四發廣體貨機 · 機鼻貨門',role:'cargo',
    mass:286000,wingArea:554,inertia:[35000000,68000000,91000000],cgOffset:.11,gearHeight:4.6,stallAngle:.29,
    rotation:142,approach:148,geometry:[38.15,3.25,34.2,-1.1,4,13],thrust:1180000,jet:true,
    upperDeck:'short',rakedTip:true,nacelleRadius:1.53,cruiseMach:.85,maxMach:.90,cleanDrag:.022,cargoLimit:95000},
  {id:'an124',name:'Antonov An-124-100 Ruslan',type:'上單翼四發重型運輸機 · 前艙坡道',role:'cargo',
    mass:255000,wingArea:628,inertia:[46500000,78000000,107000000],cgOffset:.066,gearHeight:4.48,stallAngle:.31,
    rotation:149,approach:148,geometry:[34.55,3.56,36.65,2.87,4,10.15],
    thrust:915000,nacelleRadius:1.43,jet:true,antonov:true,noWinglet:true,
    cruiseMach:.72,maxMach:.78,cleanDrag:.029,fuelIdle:.45,fuelPower:4.1,cargoLimit:120000,cargoSlotLimit:44000}
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
  const problems=cargo.map((value,index)=>value<0||value>(f.aircraft.cargoSlotLimit??38000)?palletStations[index].name:null).filter(Boolean);
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
function setCargoManifest(f,masses){
  if(f.finished||!groundServiceAllowed(f)||!(f.noseDoor||f.sideDoor)) return false;
  if(masses.length!==palletStations.length||masses.some(mass=>!Number.isFinite(mass))) return false;
  const balance=cargoBalance({...f,pallets:masses});
  if(balance.problems.length) return false;
  f.pallets=[...masses];
  f.cargoState=balance;
  if(f.phase==='cold'&&balance.mass>0) f.loadedAtDeparture=true;
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
  if(role==='cargo'){
    west.reverse();
    if(from.code==='RCKH'){
      west.unshift(
        {name:'高雄東南離場',...geoPoint(22.47,120.45)},
        {name:'小琉球外海',...geoPoint(22.33,120.30)}
      );
    }
  }
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


