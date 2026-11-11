'use strict';
const flightLogKey='skybound.flightLog.v2';
function readFlightLog(){
  try {
    const rows=JSON.parse(localStorage.getItem(flightLogKey)||'[]');
    return Array.isArray(rows)?rows.filter(row=>row&&typeof row==='object'):[];
  }catch{return [];}
}
const careerKey='skybound.career.v1';
function readCareer(){
  try{
    const saved=JSON.parse(localStorage.getItem(careerKey)||'null');
    if(saved&&typeof saved==='object'&&Number.isFinite(saved.money)&&saved.receipts&&
      typeof saved.receipts==='object') return saved;
    return {money:Math.max(0,Number(localStorage.getItem('skybound.money'))||0),active:null,receipts:{}};
  }catch{return {money:0,active:null,receipts:{}};}
}
function readMoney(){return readCareer().money;}
const hangarPrices={sa380:420000,b773:290000,b38m:155000,b763er:215000};
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
const minimumDispatchCondition=60;
function hangarCondition(career,id){
  return career.condition?.[id]??100;
}
function maintenanceQuote(career,aircraft){
  const id=aircraft.id;
  const condition=hangarCondition(career,id);
  const cost=(100-condition)*Math.round((hangarPrices[id]||0)/1000);
  return {condition,cost,owned:Boolean(career.owned?.[id]),busy:passengerCheckpoints(career).some(f=>f.aircraft.id===id)};
}
function serviceHangar(aircraft){
  const career=readCareer();
  const quote=maintenanceQuote(career,aircraft);
  if(!quote.owned||quote.busy||!quote.cost||career.money<quote.cost) return false;
  career.money-=quote.cost;
  (career.condition??={})[aircraft.id]=100;
  try{localStorage.setItem(careerKey,JSON.stringify(career));return true;}catch{return false;}
}
function passengerCheckpoints(career=readCareer()){
  const saves={...career.passengerSaves};
  if(career.active?.service?.id) saves[career.active.service.id]=career.active;
  return Object.values(saves).filter(f=>!f.finished&&!career.receipts[f.service.id]);
}
function savePassenger(f){
  const career=readCareer();
  if(f.finished||career.receipts[f.service.id]) return;
  career.passengerSaves=Object.fromEntries(passengerCheckpoints(career).map(saved=>[saved.service.id,saved]));
  career.passengerSaves[f.service.id]=f;
  career.active=f;
  try{localStorage.setItem(careerKey,JSON.stringify(career));}catch{}
}
const missionSaveKey='skybound.missionCheckpoint.v1';
function missionCheckpoints(){
  try{
    const stored=JSON.parse(localStorage.getItem(missionSaveKey)||'null');
    const saves=stored?.flight?[stored]:Array.isArray(stored)?stored:[];
    const receipts=readCareer().receipts;
    return saves.filter(saved=>saved?.flight?.checkpointId&&!saved.flight.finished&&saved.options&&Array.isArray(saved.frames)&&
      !(saved.flight.contract&&receipts[saved.flight.contract.id]));
  }catch{return [];}
}
function readMissionCheckpoint(id){
  const saves=missionCheckpoints();
  return (id?saves.find(saved=>saved.flight.checkpointId===id):saves[0])??null;
}
function writeMissionCheckpoint(f,options,frames=[],replaces){
  if(f.finished||!f.checkpointId||f.contract&&readCareer().receipts[f.contract.id]) return false;
  const saves=missionCheckpoints().filter(saved=>![f.checkpointId,replaces].includes(saved.flight.checkpointId));
  try{
    localStorage.setItem(missionSaveKey,JSON.stringify([{flight:f,options,frames},...saves]));
    return true;
  }catch{return false;}
}
function clearMissionCheckpoint(id){
  try{
    const saves=missionCheckpoints();
    const remaining=saves.filter(saved=>saved.flight.checkpointId!==id);
    if(remaining.length) localStorage.setItem(missionSaveKey,JSON.stringify(remaining));
    else localStorage.removeItem(missionSaveKey);
    return true;
  }catch{return false;}
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
  const career=readCareer();
  const owned=Boolean(career.owned?.[aircraft.id]);
  if(owned&&hangarCondition(career,aircraft.id)<minimumDispatchCondition){
    throw new Error('自有客機機況低於 '+minimumDispatchCondition+'%，請先在機庫維修。');
  }
  const brief=passengerBrief(aircraft,departure,destination);
  if(!Number.isFinite(fuel)||fuel<brief.estimated+brief.reserve||fuel>brief.capacity){
    throw new Error('請選擇足夠的航程及備用燃油，並符合本航班的加油上限。');
  }
  const f=makeRegionalFlight(departure,destination,aircraft,'cold',wind,brief.route);
  const rent=hangarPrices[aircraft.id]&&!owned?4500:0;
  return Object.assign(f,{mission:'passenger',lesson:'airline',fuel:0,fuelStart:fuel,passengers:brief.passengers,
    service:{id:crypto.randomUUID(),rent,owned,targetFuel:fuel,referencePayload:brief.capacity+brief.passengers*95,
      boarded:0,delivered:0,door:false,pushed:false,pushing:0,progress:0,
      mode:null,seatBelts:true,cabinLights:true,comfort:100,weather,time,brief}});
}
function runwayTowReady(f){
  if(!f.regional||!f.ground||f.airborne||f.finished||f.tow||f.power>.08||
      Math.hypot(f.vx,f.vz)>1.2||f.bridge||f.service?.door||f.service?.pumping||
      f.service?.pushing||f.noseDoor||f.sideDoor) return false;
  if(f.service&&(f.service.boarded!==f.passengers||f.fuel<f.service.targetFuel)) return false;
  if(f.mission==='cargo'&&(!f.pallets.some(Boolean)||cargoBalance(f).problems.length)) return false;
  const frame=runwayCoordinates(f.x,f.z,f.departure);
  return Math.abs(frame.along)<=f.departure.length/2+450&&Math.abs(frame.cross)<=750;
}
function requestRunwayTow(f){
  if(!runwayTowReady(f)) return false;
  const airport=f.departure;
  const frame=runwayCoordinates(f.x,f.z,airport);
  const threshold=-airport.length/2+135;
  const pavedAlong=limit(frame.along,-airport.length/2+100,airport.length/2-100);
  const points=airport.shortField?[
    airportPoint(airport,airport.parkingAlong,0),
    airportPoint(airport,threshold-40,0)
  ]:[
    airportPoint(airport,pavedAlong,airport.apron),
    airportPoint(airport,threshold,airport.apron),
    airportPoint(airport,threshold,0),
    airportPoint(airport,threshold+48,0)
  ];
  f.tow={index:0,points};
  f.parkingBrake=true;
  f.phase='taxi';
  f.hold=null;
  return true;
}
function arrivalTowReady(f){
  return Boolean((f.service||f.mission==='cargo')&&f.arrivalTaxi&&f.ground&&f.landed&&!f.ended&&!f.finished&&!f.tow&&!f.awaitingService&&
    Math.hypot(f.vx,f.vz)<1.2);
}
function requestGateTow(f){
  if(!arrivalTowReady(f)) return false;
  const airport=f.destination;
  const {along,cross}=runwayCoordinates(f.x,f.z,airport);
  const exit=limit(Math.max(440,along+100),-airport.length/2+100,airport.length/2-90);
  const onRunway=Math.abs(cross)<airport.width/2+10;
  f.tow={index:0,arrival:true,points:[
    ...(onRunway?[airportPoint(airport,exit,0)]:[]),
    airportPoint(airport,onRunway?exit:limit(along,-airport.length/2+100,airport.length/2-90),airport.apron),
    parkingPoint(airport)
  ]};
  f.parkingBrake=true;
  f.power=0;
  stopNavigation(f);
  return true;
}
function finishRunwayTow(f){
  if(!f.tow) return false;
  const arrival=Boolean(f.tow.arrival),airport=arrival?f.destination:f.departure;
  const target=f.tow.points[f.tow.points.length-1];
  f.x=target.x;f.z=target.z;
  f.y=airport.elevation+f.aircraft.gearHeight;
  f.heading=arrival?wrapAngle(airport.heading+Math.PI):airport.heading;
  f.vx=f.vy=f.vz=f.vs=f.speed=0;
  f.pitch=f.bank=f.pitchRate=f.bankRate=f.yawRate=0;
  f.tow=null;
  f.parkingBrake=true;
  if(arrival){
    f.phase='arrival';
    f.taxiIndex=f.arrivalTaxi.length-1;
    f.awaitingService=true;
    return true;
  }
  f.taxiIndex=f.taxi.length;
  f.start='runway';f.phase='takeoff';
  if(f.service){f.service.pushed=true;f.service.pushing=0;}
  return true;
}
function stepRunwayTow(f,dt){
  const tow=f.tow,airport=tow.arrival?f.destination:f.departure;
  f.parkingBrake=true;
  const target=tow.points[tow.index];
  const dx=target.x-f.x,dz=target.z-f.z;
  const distance=Math.hypot(dx,dz);
  const speed=Math.min(12,Math.max(2,distance*.75));
  f.elapsed+=dt;
  if(distance>.025){
    const heading=Math.atan2(dx,-dz);
    const turn=wrapAngle(heading-f.heading);
    f.heading=wrapAngle(f.heading+limit(turn,-.95*dt,.95*dt));
    const step=Math.abs(turn)<.10?Math.min(distance,speed*dt):0;
    f.vx=dx/distance*step/dt;f.vz=dz/distance*step/dt;
    f.x+=f.vx*dt;f.z+=f.vz*dt;
  }else{
    f.x=target.x;f.z=target.z;f.vx=f.vz=0;
    tow.index++;
    if(tow.index===tow.points.length){finishRunwayTow(f);return;}
  }
  f.y=airport.elevation+f.aircraft.gearHeight;
  f.pitch=f.bank=f.pitchRate=f.bankRate=f.yawRate=f.vy=f.vs=0;
  f.speed=Math.hypot(f.vx,f.vz);
}
const passengerBridgeSeconds=4;
function setPassengerDoor(f,open){
  if(!groundServiceAllowed(f)||!f.bridge||f.finished) return;
  const service=f.service;
  service.door=open;
  service.bridgeElapsed=0;
  service.progress=0;
  service.bridgeDelay=open?passengerBridgeSeconds:0;
  service.mode=open?(f.awaitingService?'exit':'board'):null;
}
function updatePassengerService(f,dt){
  const service=f.service;
  if(!service||f.finished) return;
  if(service.pumping&&groundServiceAllowed(f)){
    f.fuel=Math.min(service.targetFuel,f.fuel+110*dt);
    if(f.fuel>=service.targetFuel) service.pumping=false;
  }
  if(service.mode&&service.door&&f.bridge&&groundServiceAllowed(f)){
    const previous=service.bridgeElapsed||0;
    service.bridgeElapsed=previous+dt;
    const delay=Math.min(service.bridgeDelay??passengerBridgeSeconds,passengerBridgeSeconds);
    service.progress+=6*(Math.max(0,service.bridgeElapsed-delay)-Math.max(0,previous-delay));
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
  const owned=service?.owned??Boolean(service&&!rent&&career.owned?.[f.aircraft.id]);
  const maintenance=service&&!owned?(success?(service.landingPenalty||0)*110:3500):0;
  const net=base+punctual-fuel-handling-maintenance-rent;
  const receipt={base,punctual,fuel,handling,maintenance,rent,net,comfort:Math.round(service?.comfort??100)};
  if(owned&&(f.airborne||f.touchdown||success)){
    const airborneWear=2+Math.min(8,Math.floor(f.elapsed/3600));
    const impactWear=f.ended&&!success&&f.touchdown?12:Math.ceil((service.landingPenalty||0)/4);
    const oldCondition=hangarCondition(career,f.aircraft.id);
    const condition=Math.max(0,oldCondition-airborneWear-impactWear);
    (career.condition??={})[f.aircraft.id]=condition;
    Object.assign(receipt,{condition,wear:oldCondition-condition});
  }
  career.money+=net;
  if(id){
    career.receipts[id]=receipt;
    if(career.passengerSaves) delete career.passengerSaves[id];
    if(career.active?.service.id===id) career.active=passengerCheckpoints(career).at(-1)??null;
  }
  try{localStorage.setItem(careerKey,JSON.stringify(career));return receipt;}catch{return null;}
}
const regionalContracts={
  sightseeing:{label:'臺北觀光 · 松山返場',from:'RCSS',to:'RCSS',base:4200},
  ferry:{label:'飛機調度 · 松山至花蓮',from:'RCSS',to:'RCYU',base:5700}
};
function regionalContractPlan(kind){
  const contract=regionalContracts[kind];
  const departure=taiwanAirports.find(a=>a.code===contract.from);
  const destination=taiwanAirports.find(a=>a.code===contract.to);
  const route=kind==='sightseeing'?[
    {name:'臺北東側爬升',...airportPoint(departure,8500,0)},
    {name:'北海岸轉向',...geoPoint(25.23,121.62)},
    {name:'淡水河口觀景',...geoPoint(25.185,121.408)},
    ...regionalRoute(departure,destination).slice(-2)
  ]:regionalRoute(departure,destination);
  return {departure,destination,route};
}
function attachContract(f,kind,base){
  f.contract={id:crypto.randomUUID(),kind,base};
  return f;
}
function makeRegionalContract(kind,wind){
  const {departure,destination,route}=regionalContractPlan(kind);
  const sightseeing=kind==='sightseeing';
  const aircraft=fleet.find(a=>a.id==='a223');
  const f=makeRegionalFlight(departure,destination,aircraft,'cold',wind,route);
  const fuel=sightseeing?3000:4500;
  Object.assign(f,{lesson:kind,fuel,fuelStart:fuel,passengers:sightseeing?2:0});
  return attachContract(f,kind,regionalContracts[kind].base);
}
function settleContract(f){
  const career=readCareer();
  const {id,kind,base,cargoAtTakeoff}=f.contract;
  if(career.receipts[id]) return career.receipts[id];
  const gross=kind==='cargo'?base+Math.round((cargoAtTakeoff||0)*.28):base;
  const fuel=Number.isFinite(f.fuelStart)?Math.round(Math.max(0,f.fuelStart-f.fuel)*.8):0;
  const receipt={base:gross,fuel,net:Math.max(0,gross-fuel)};
  career.money+=receipt.net;
  career.receipts[id]=receipt;
  try{localStorage.setItem(careerKey,JSON.stringify(career));return receipt;}catch{return null;}
}
function recordFlight(f,result){
  if(f.contract&&result==='任務完成'&&!f.rewardPaid){
    f.receipt=settleContract(f);
    if(f.receipt){f.reward=f.receipt.net;f.rewardPaid=true;}
  }
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
  const threshold=-departure.length/2+95;
  const first=airportPoint(departure,departure.parkingAlong??threshold+40,departure.shortField?0:departure.apron);
  const holding=airportPoint(departure,departure.shortField?threshold:threshold+40,0);
  const flight={
    ...position,heading,pitch:0,bank:0,pitchRate:0,bankRate:0,yawRate:0,
    y:air?950:departure.elevation+aircraft.gearHeight,
    vx:Math.sin(heading)*speed,vy:0,vz:-Math.cos(heading)*speed,
    trim:0,power:air?.58:0,flaps:0,ground:!air,landed:false,ended:false,
    stall:false,speed,vs:0,wind,elapsed:0,airborne:air,touchdown:null,
    aircraft,departure,destination,start,regional:true,
    battery:!cold,engines:Array(aircraft.geometry[4]).fill(!cold),
    lights:false,parkingBrake:cold,gear:!air||!aircraft.retract,reverse:false,spoilers:false,
    route:waypoints,waypoint:0,pallets:[0,0,0],noseDoor:false,boost:aircraft.role==='fighter',bridge:false,awaitingService:false,
    taxi:[{name:departure.shortField?'從機坪滑入跑道':'滑行至跑道端',...first},
      {name:departure.shortField?'沿跑道滑至起飛端':'轉入跑道',...holding}],
    taxiIndex:0,arrivalTaxi:null,phase:cold?'cold':air?'cruise':'takeoff',recorded:false,finished:false
  };
  return aircraft.helicopter?configureHelicopterFlight(flight):flight;
}
function makeCruiseTrial(departure,destination,aircraft,tailwind,fast=false,indicated=false){
  const heading=Math.atan2(destination.x-departure.x,departure.z-destination.z);
  const altitude=indicated?2500:35000*.3048;
  const along=distance=>({x:departure.x+distance*Math.sin(heading)-(indicated?38000:0),z:departure.z-distance*Math.cos(heading)});
  const route=[{...along(350000),name:'巡航驗證終點'}];
  const flight=makeRegionalFlight(departure,destination,aircraft,'air',0,route);
  flight.fastCruise=fast;
  flight.iasTrial=indicated;
  flight.y=altitude;
  const air=atmosphere(altitude);
  const tas=(flight.fastCruise?cruiseMachTarget(flight)*(indicated?.86:1):.80)*air.sound;
  const wind=tailwind/knotsPerMps;
  const speed=tas+wind;
  const pitch=(aircraft.mass*9.80665/(.5*air.density*tas*tas*aircraft.wingArea)-.27)/5.05-.036;
  return Object.assign(flight,along(15000),{
    heading,y:altitude,pitch,trim:pitch-.015,
    vx:Math.sin(heading)*speed,vz:-Math.cos(heading)*speed,
    windVector:{x:Math.sin(heading)*wind,z:-Math.cos(heading)*wind},
    speed:tas,power:.72,fuel:45000,fuelStart:45000,cruiseTrial:true,
    hold:{heading,altitude,mach:cruiseMachTarget(flight)}
  });
}
function makeClimbLesson(airport,aircraft,tailwind){
  const route=[{...airportPoint(airport,300000,0),name:'05L 延伸航向 · 巡航練習'}];
  const f=makeRegionalFlight(airport,airport,aircraft,'runway',0,route);
  const wind=tailwind/knotsPerMps;
  return Object.assign(f,{lesson:'climbLesson',climbLesson:{stable:0},
    fuel:45000,fuelStart:45000,
    windVector:{x:Math.sin(f.heading)*wind,z:-Math.cos(f.heading)*wind}
  });
}
function climbReady(f){
  return !f.ground&&f.battery&&!f.flaps&&!f.gear&&!f.spoilers&&f.engines.every(Boolean)&&f.fuel!==0&&
    f.y>f.departure.elevation+150&&flightSpeeds(f).ias*knotsPerMps>f.aircraft.rotation+15;
}
function updateClimbLesson(f,save){
  const lesson=f.climbLesson;
  if(f.ended||f.landed||f.fuel<=0){
    f.finished=true;
    lesson.failed=true;
    f.recorded=save(f,f.fuel<=0?'巡航練習失敗 · 燃油耗盡':'巡航練習失敗 · 中途接地');
    return;
  }
  if(!f.airborne) return;
  const speeds=flightSpeeds(f);
  const stable=Math.abs(f.y-35000*.3048)<60&&Math.abs(f.vy)<2&&
    Math.abs(speeds.mach-cruiseMachTarget(f))<.015&&!f.gear&&!f.flaps&&!f.spoilers;
  lesson.stable=stable?lesson.stable+simTick:0;
  if(lesson.stable<60) return;
  f.finished=true;
  f.recorded=save(f,'巡航練習完成 · Mach '+speeds.mach.toFixed(3)+' · GS '+
    displayKmh(speeds.gs)+' km/h · 耗油 '+Math.round(f.fuelStart-f.fuel)+' kg');
}
function startEngine(f,index){
  if(f.engines[index]){
    f.engines[index]=false;
    return true;
  }
  if(f.service&&!f.airborne&&(!f.service.pushed||f.service.boarded!==f.passengers||f.fuel<=0)) return false;
  if(!f.battery || f.noseDoor || f.sideDoor || (f.mission==='cargo'&&f.phase==='cold'&&!f.pallets.some(Boolean)) || (f.aircraft.cargoLimit&&cargoBalance(f).problems.length)) return false;
  f.engines[index]=true;
  return true;
}
function updateRegionalFlight(f,save=recordFlight){
  if(f.aircraft.helicopter){updateHelicopterFlight(f,save);return;}
  if(f.finished||f.tow) return;
  if(f.climbLesson){updateClimbLesson(f,save);return;}
  if(f.ended){
    f.finished=true;
    f.recorded=save(f,'落地失敗');
    return;
  }
  if(f.landed){
    if(f.approach&&f.lesson==='free'&&Math.hypot(f.vx,f.vz)<1&&f.parkingBrake){
      f.finished=true;
      f.recorded=save(f,'降落練習完成');
      return;
    }
    if(!f.arrivalTaxi){
      const end=f.destination.parkingAlong??(f.touchdown.along<40?440:Math.min(f.destination.length/2-90,950));
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
        const completedRoute=f.waypoint===f.route.length-1;
        const contractReady=completedRoute&&(!f.range||f.range.hit)&&(f.contract?.kind!=='cargo'||f.contract.cargoAtTakeoff>0);
        const result=f.contract?(contractReady?'任務完成':'航段或貨運條件未完成'):f.mission?'任務完成':'已落地並停妥';
        if(f.contract) f.contract.result=result;
        f.recorded=save(f,result);
      }
    }
    return;
  }
  if(f.airborne){
    if(f.contract?.kind==='cargo'&&f.contract.cargoAtTakeoff===undefined){
      f.contract.cargoAtTakeoff=cargoBalance(f).mass;
    }
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
function stopNavigation(f){
  if(f.hold?.speedBrake) f.spoilers=false;
  f.hold=null;
}
function navigationControls(f,target){
  const hold=f.hold, runway=f.destination;
  if(f.landed){
    hold.stage='rollout';
    if(Math.hypot(f.vx,f.vz)<.8){f.parkingBrake=true;stopNavigation(f);}
    return {roll:0,pitch:-.25,throttle:-.8,brake:true,
      rudder:limit(wrapAngle(runway.heading-f.heading)*2,-.4,.4)};
  }
  const frame=runwayCoordinates(f.x,f.z,runway);
  const distance=-frame.along-runway.length/2;
  const approachLeg=f.waypoint>=f.route.length-2;
  const finalDistance=hold.finalDistance??limit((hold.altitude-runway.elevation)/.046,12500,65000);
  const intercept=airportPoint(runway,-runway.length/2-finalDistance,0);
  const remaining=Math.hypot(f.x-intercept.x,f.z-intercept.z);
  const speeds=flightSpeeds(f);
  const ias=speeds.ias*knotsPerMps;
  hold.cruiseIAS??=limit(ias,f.aircraft.approach+65,320);
  const capture=distance>150&&distance<finalDistance+2500&&Math.abs(frame.cross)<850&&
    Math.abs(wrapAngle(runway.heading-f.heading))<.70;
  const descentRange=Math.max(38000,(hold.altitude-runway.elevation)/.0524-finalDistance+28000)
    +(f.fastCruise?Math.max(0,speeds.gs-250)*650:0);
  if(approachLeg&&capture) hold.stage='final';
  else if(hold.stage!=='final'&&hold.stage!=='descent'){
    hold.stage=approachLeg&&remaining<descentRange?'descent':'route';
  }
  const final=hold.stage==='final';
  const approach=final||hold.stage==='descent';
  if(approach) hold.finalDistance=finalDistance;
  if(final&&distance<200&&(Math.abs(frame.cross)>runway.width*.42||
      f.y-runway.elevation-f.aircraft.gearHeight>42||ias>f.aircraft.approach+30)){
    stopNavigation(f);
    f.navMessage='進場未穩定 · 自動導航已退出，請加油門重飛';
    return {roll:0,pitch:.35,throttle:.7};
  }
  if(approachLeg){
    if(remaining<4600) hold.interceptPassed=true;
    target=final?airportPoint(runway,frame.along+1800,0):
      hold.interceptPassed?airportPoint(runway,-runway.length/2-5200,0):intercept;
  }
  const dx=target.x-f.x,dz=target.z-f.z;
  const wind=flightWind(f);
  const crosswind=wind.x*Math.cos(runway.heading)+wind.z*Math.sin(runway.heading);
  const crab=Math.atan2(crosswind,Math.max(30,speeds.tas));
  const desired=final?runway.heading-crab-limit(frame.cross/420,-.32,.32):Math.atan2(dx,-dz);
  const track=Math.atan2(f.vx,-f.vz);
  const heading=desired+limit(wrapAngle(desired-track)*.55,-.22,.22);
  const tas=Math.max(24,speeds.tas);
  const q=.5*1.225*Math.exp(-Math.max(0,f.y)/8500)*tas**2;
  let altitude=hold.altitude, feedForward=0;
  let targetIAS=hold.cruiseIAS;
  let terrainClearance=0;
  if(!final){
    const bearing=Math.atan2(dx,-dz);
    const directionX=Math.sin(bearing),directionZ=-Math.cos(bearing);
    const horizon=Math.min(15000,Math.hypot(dx,dz));
    for(const fraction of [.12,.35,.62,1]){
      const lookAhead=horizon*fraction;
      terrainClearance=Math.max(terrainClearance,regionalHeight(f.x+directionX*lookAhead,f.z+directionZ*lookAhead)+300);
    }
    altitude=Math.max(altitude,terrainClearance);
  }
  if(approach){
    const alongDistance=final?Math.max(0,distance+(f.aircraft.jet?350:125)):hold.interceptPassed?
      Math.max(5200,distance):finalDistance+remaining;
    const glide=runway.elevation+f.aircraft.gearHeight+alongDistance*.0524;
    altitude=final?glide:Math.max(Math.min(hold.altitude,glide),terrainClearance);
    if(final||glide<altitude+1&&altitude<hold.altitude) feedForward=-Math.min(final?6:12,speeds.gs*.0524);
    targetIAS=final?f.aircraft.approach+5:Math.min(hold.cruiseIAS,f.aircraft.approach+19+remaining/500);
    if(final){
      f.gear=true;
      if(ias<f.aircraft.approach+31) f.flaps=2;
      else if(ias<f.aircraft.approach+49) f.flaps=1;
    }
  }
  const height=f.y-runway.elevation-f.aircraft.gearHeight;
  if(hold.speedBrake&&(!approach||height<140||ias<targetIAS+12)){
    f.spoilers=false;
    hold.speedBrake=false;
  }else if(approach&&f.aircraft.jet&&!f.spoilers&&height>220&&ias>targetIAS+26){
    f.spoilers=true;
    hold.speedBrake=true;
  }
  const flare=final&&distance<0&&height<(f.aircraft.jet?12:3.6);
  const desiredVS=flare?-.75:limit(feedForward+(altitude-f.y)*(final?.29:.095),final?-8:-13,6);
  const lift=flightMass(f)*(9.80665+limit((desiredVS-f.vy)*1.2,-4,4))/(q*f.aircraft.wingArea*Math.max(.72,Math.cos(f.bank)));
  const fastQ=.5*atmosphere(f.y,f.temperatureOffset).density*tas**2;
  const attitude=f.fastCruise&&fastQ>14000?fastLevelPitch(f,fastQ,tas,desiredVS):
    Math.atan2(f.vy,tas)+(lift-.27-f.aircraft.flapLift[f.flaps])/5.05-.036;
  // Route navigation commands full power. Speed control takes over for landing.
  const approachPower=flare?0:limit(f.aircraft.jet?.23+f.flaps*.065+(targetIAS-ias)*.016:
    .40+f.flaps*.105+(targetIAS-ias)*.025,.12,1);
  const throttle=approach?limit((approachPower-f.power)*2.6,-.8,.8):1;
  return {roll:limit(wrapAngle(heading-f.heading)*(final?3:2.4)-f.bank*.45,final?-.31:-.65,final?.31:.65),
    pitch:limit((attitude-.015-f.trim-f.flaps*.008)/.24,-.80,.82),
    throttle,airBrake:f.fastCruise&&approach&&ias>targetIAS+55};
}
function rangeShot(f){
  const range=f.range;
  if(!range||f.finished||f.ground||range.hit||!range.rounds) return false;
  range.rounds--;
  const dx=range.x-f.x,dz=range.z-f.z;
  const distance=Math.hypot(dx,dz);
  const yaw=Math.abs(wrapAngle(Math.atan2(dx,-dz)-f.heading));
  const pitch=Math.abs(Math.atan2(range.y-f.y,distance)-f.pitch);
  range.hit=distance>250&&distance<2600&&yaw<.105&&pitch<.12;
  range.message=range.hit?'命中訓練靶 · 返回機場':range.rounds?'未命中 · 調整機鼻後再射擊':'彈藥用盡 · 可重飛';
  return range.hit;
}
function activeTarget(f){
  if(f.tow) return {...f.tow.points[f.tow.index],name:f.tow.arrival?'拖車牽引至停機位':'拖車牽引至跑道'};
  if(f.phase==='arrival') return f.arrivalTaxi[f.taxiIndex];
  if(f.phase==='taxi'||f.phase==='cold') return f.taxi[f.taxiIndex];
  return f.route[f.waypoint];
}
if(typeof module!=='undefined') Object.assign(globalThis,{makeRegionalFlight,startEngine,updateRegionalFlight,activeTarget,readFlightLog,makeCruiseTrial,makeClimbLesson,climbReady,navigationControls,rangeShot,makeRegionalContract,attachContract,makePassengerFlight,updatePassengerService,savePassenger,readCareer,recordFlight,passengerBrief});


