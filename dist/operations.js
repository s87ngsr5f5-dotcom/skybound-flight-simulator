'use strict';
const flightLogKey='skybound.flightLog.v2';
function readFlightLog(){
  try {return JSON.parse(localStorage.getItem(flightLogKey)||'[]');} catch {return [];}
}
const careerKey='skybound.career.v1';
function readCareer(){
  try{
    const saved=JSON.parse(localStorage.getItem(careerKey)||'null');
    if(saved) return saved;
    return {money:Math.max(0,Number(localStorage.getItem('skybound.money'))||0),active:null,receipts:{}};
  }catch{return {money:0,active:null,receipts:{}};}
}
function readMoney(){return readCareer().money;}
const hangarPrices={sa380:420000,b773:290000};
const liveryPrice=6000;
function purchaseHangar(aircraft,item){
  const career=readCareer();
  const collection=item==='livery'?'liveries':'owned';
  const price=item==='livery'?liveryPrice:hangarPrices[aircraft.id];
  if(!price) return false;
  const inventory=career[collection]??={};
  if(inventory[aircraft.id]) return true;
  if(career.money<price) return false;
  career.money-=price;
  inventory[aircraft.id]=true;
  try{localStorage.setItem(careerKey,JSON.stringify(career));return true;}catch{return false;}
}
function savePassenger(f){
  const career=readCareer();
  if(f.finished||career.receipts[f.service.id]) return;
  career.active=f;
  try{localStorage.setItem(careerKey,JSON.stringify(career));}catch{}
}
function passengerBrief(aircraft,departure,destination){
  const passengers=aircraft.passengers??320;
  const route=destination.code==='RJAA'?cargoVoyageRoute:
    departure.code==='RCTP'?benchmarkRoute('passenger',departure,destination):regionalRoute(departure,destination);
  const distance=route.reduce((sum,point,i)=>{
    const previous=i?route[i-1]:departure;
    return sum+Math.hypot(point.x-previous.x,point.z-previous.z)/1852;
  },0);
  const hourlyFuel=((aircraft.fuelIdle??.30)+(aircraft.fuelPower??3.3)*.61)*3600;
  const cruiseKnots=destination.code==='RJAA'?450:195;
  const enrouteHours=distance/cruiseKnots+.22;
  const estimated=Math.ceil(hourlyFuel*enrouteHours/100)*100;
  const reserve=Math.ceil(hourlyFuel*.45/100)*100;
  return {passengers,distance,estimated,reserve,hourlyFuel,capacity:aircraft.missionFuel??56000,
    schedule:Math.ceil((enrouteHours+.53)*60),base:passengers*180,route};
}
function makePassengerFlight(departure,destination,aircraft,wind,fuel,weather,time){
  const brief=passengerBrief(aircraft,departure,destination);
  if(!Number.isFinite(fuel)||fuel<brief.estimated+brief.reserve||fuel>brief.capacity){
    throw new Error('請選擇足夠的航程及備用燃油，並符合本航班的加油上限。');
  }
  const f=makeRegionalFlight(departure,destination,aircraft,'cold',wind,brief.route);
  const rent=hangarPrices[aircraft.id]&&!readCareer().owned?.[aircraft.id]?4500:0;
  return Object.assign(f,{mission:'passenger',lesson:'airline',fuel:0,fuelStart:fuel,passengers:brief.passengers,
    service:{id:crypto.randomUUID(),rent,targetFuel:fuel,referencePayload:brief.capacity+brief.passengers*95,
      boarded:0,delivered:0,door:false,pushed:false,pushing:0,progress:0,
      mode:null,seatBelts:true,cabinLights:true,comfort:100,weather,time,brief}});
}
function updatePassengerService(f,dt){
  const service=f.service;
  if(!service||f.finished) return;
  if(service.pumping&&groundServiceAllowed(f)){
    f.fuel=Math.min(service.targetFuel,f.fuel+110*dt);
    if(f.fuel>=service.targetFuel) service.pumping=false;
  }
  if(service.mode&&service.door&&f.bridge&&groundServiceAllowed(f)){
    service.progress+=dt*6;
    const count=Math.floor(service.progress);
    if(count){
      service.progress-=count;
      if(service.mode==='board') service.boarded=Math.min(f.passengers,service.boarded+count);
      else{
        const exiting=Math.min(service.boarded,count);
        service.boarded-=exiting;
        service.delivered+=exiting;
      }
    }
  }
  if(service.pushing>0){
    const distance=Math.min(service.pushing,2*dt);
    f.x-=Math.sin(f.heading)*distance;
    f.z+=Math.cos(f.heading)*distance;
    service.pushing-=distance;
    if(service.pushing===0){service.pushed=true;f.parkingBrake=true;}
  }
  if(!f.ground){
    const motion=Math.max(0,Math.abs(f.bank)-.30)+Math.max(0,Math.abs(f.pitchRate)-.10);
    if(motion>0){
      service.comfort=Math.max(0,service.comfort-motion*dt*.9);
      service.roughPhase=f.phase==='approach'?'進場':'飛行中';
    }
  }
  if(f.touchdown&&!service.landingScored){
    service.landingScored=true;
    service.landingPenalty=Math.round(Math.max(0,-f.touchdown.verticalSpeed-1.3)*9);
    service.comfort=Math.max(0,service.comfort-service.landingPenalty);
  }
}
function settlePassenger(f,result){
  const career=readCareer();
  const service=f.service;
  const id=service?.id;
  if(id&&career.receipts[id]) return career.receipts[id];
  const success=result==='任務完成';
  const base=success?Math.round(f.passengers*180*(service?.diverted?.55:1)):0;
  const punctual=success&&service&&!service.diverted&&f.elapsed<=service.brief.schedule*60?Math.round(base*.12):0;
  const fuel=Math.round(Math.max(0,f.fuelStart-f.fuel)*.8);
  const handling=service?1200:0;
  const rent=service?.rent??0;
  const maintenance=service?(success?(service.landingPenalty||0)*110:3500):0;
  const net=base+punctual-fuel-handling-maintenance-rent;
  const receipt={base,punctual,fuel,handling,maintenance,rent,net,comfort:Math.round(service?.comfort??100)};
  career.money+=net;
  if(id){
    career.receipts[id]=receipt;
    if(career.active?.service.id===id) career.active=null;
  }
  try{localStorage.setItem(careerKey,JSON.stringify(career));return receipt;}catch{return null;}
}
function recordFlight(f,result){
  if(f.mission==='passenger'&&!f.rewardPaid&&(f.service||result==='任務完成')){
    f.receipt=settlePassenger(f,result);
    if(f.receipt){f.reward=f.receipt.net;f.rewardPaid=true;}
  }
  const row={aircraft:f.aircraft.name,departure:f.departure.code,destination:f.destination.code,
    reward:f.reward||0,passengers:f.passengers||0,seconds:Math.round(f.elapsed),date:new Date().toISOString(),result};
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
function makeCruiseTrial(departure,destination,aircraft,tailwind){
  const heading=Math.atan2(destination.x-departure.x,departure.z-destination.z);
  const altitude=35000*.3048;
  const along=distance=>({x:departure.x+distance*Math.sin(heading),z:departure.z-distance*Math.cos(heading)});
  const route=[{...along(350000),name:'巡航驗證終點'}];
  const flight=makeRegionalFlight(departure,destination,aircraft,'air',0,route);
  const air=atmosphere(altitude);
  const tas=.80*air.sound;
  const wind=tailwind/knotsPerMps;
  const speed=tas+wind;
  const pitch=(aircraft.mass*9.80665/(.5*air.density*tas*tas*aircraft.wingArea)-.27)/5.05-.036;
  return Object.assign(flight,along(15000),{
    heading,y:altitude,pitch,trim:pitch-.015,
    vx:Math.sin(heading)*speed,vz:-Math.cos(heading)*speed,
    windVector:{x:Math.sin(heading)*wind,z:-Math.cos(heading)*wind},
    speed:tas,power:.72,fuel:45000,fuelStart:45000,cruiseTrial:true,
    hold:{heading,altitude,mach:aircraft.cruiseMach}
  });
}
function startEngine(f,index){
  if(f.engines[index]){
    f.engines[index]=false;
    return true;
  }
  if(f.service&&!f.airborne&&(!f.service.pushed||f.service.boarded!==f.passengers||f.fuel<=0)) return false;
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
          const done=!f.engines.some(Boolean)&&(f.mission==='passenger'?(f.service?f.service.delivered===f.passengers&&!f.service.door&&!f.bridge:f.bridge):f.loadedAtDeparture&&!f.pallets.some(Boolean)&&!f.noseDoor&&!f.sideDoor);
          if(!done) return;
        }
        f.finished=true;
        f.recorded=save(f,f.mission?'任務完成':'已落地並停妥');
      }
    }
    return;
  }
  if(f.airborne){
    f.phase=!f.cruiseTrial&&f.waypoint>=f.route.length-1?'approach':'cruise';
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
if(typeof module!=='undefined') Object.assign(globalThis,{makeRegionalFlight,startEngine,updateRegionalFlight,activeTarget,readFlightLog,makeCruiseTrial,makePassengerFlight,updatePassengerService,savePassenger,readCareer,recordFlight,passengerBrief});


