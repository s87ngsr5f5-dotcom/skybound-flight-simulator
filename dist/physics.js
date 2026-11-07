'use strict';
const trainer = Object.freeze({
  mass: 1040, wingArea: 16.2, power: 119000, inertia: [1650,2450,2850],
  cgOffset: .045, flapLift: [0,.17,.33], flapDrag: [0,.022,.057],
  gearHeight: 1.75, stallAngle: .28
});
const runway10 = Object.freeze({
  lat: 25+(4+10.535/60)/60, lon: 121+(33+9.085/60)/60,
  heading: 92.22*Math.PI/180, length:2605, width:60, elevation:4.11
});
const simTick = 1/120;
const knotsPerMps = 3600/1852;
function atmosphere(height,temperatureOffset=0){
  const altitude=limit(height,0,20000);
  const standardTemperature=288.15-.0065*Math.min(altitude,11000);
  const pressure=101325*Math.pow(standardTemperature/288.15,5.25588)*
    Math.exp(-Math.max(0,altitude-11000)/6341.6);
  const temperature=standardTemperature+temperatureOffset;
  return {pressure,density:pressure/(287.05*temperature),sound:Math.sqrt(1.4*287.05*temperature)};
}
function flightSpeeds(f){
  const wind=f.windVector||(f.departure?airportPoint({...f.departure,x:0,z:0},0,f.wind):worldRunway(0,f.wind));
  const air=atmosphere(f.y,f.temperatureOffset);
  const tas=Math.hypot(f.vx-wind.x,f.vy,f.vz-wind.z);
  const mach=tas/air.sound;
  // Ideal pitot indication for subsonic flow. Use a dynamic-pressure approximation above Mach 1.
  const impact=air.pressure*(Math.pow(1+.2*mach*mach,3.5)-1);
  const ias=mach<=1?340.294*Math.sqrt(5*(Math.pow(1+impact/101325,2/7)-1)):
    tas*Math.sqrt(air.density/1.225);
  return {tas,ias,mach,gs:Math.hypot(f.vx,f.vz)};
}
function cruiseControls(f){
  const air=atmosphere(f.y,f.temperatureOffset);
  const {tas,mach}=flightSpeeds(f);
  const aircraft=f.aircraft,hold=f.hold;
  const q=.5*air.density*Math.max(tas*tas,1);
  const levelCl=flightMass(f)*9.80665/(q*aircraft.wingArea);
  const levelPitch=(levelCl-.27)/5.05-.036;
  const desiredVS=limit((hold.altitude-f.y)*.07,-9,9);
  return {
    pitch:limit((levelPitch-.015-f.trim)/.24+(desiredVS-f.vy)*.042,-.8,.8),
    throttle:limit((hold.mach-mach)*15,-.7,.7)
  };
}
function flightMass(f){
  const aircraft=f.aircraft||trainer;
  return aircraft.mass+(f.cargoState?.mass||0)+(f.voyage?f.fuel-56000:0)+
    (f.service?f.fuel+f.service.boarded*95-f.service.referencePayload:0)+
    (f.cruiseTrial?f.fuel-f.fuelStart:0);
}
const limit = (n,a,b)=>Math.min(b,Math.max(a,n));
const wrapAngle = angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
function localRunway(x,z){
  const {heading}=runway10, s=Math.sin(heading), c=Math.cos(heading);
  return {along:x*s-z*c, cross:x*c+z*s};
}
function worldRunway(along,cross){
  const {heading}=runway10, s=Math.sin(heading), c=Math.cos(heading);
  return {x:along*s+cross*c,z:-along*c+cross*s};
}
function groundHeight(x,z){
  const {along,cross}=localRunway(x,z);
  const u=limit((x+18000)/120,0,299.9999), v=limit((z+18000)/120,0,299.9999);
  const ix=Math.floor(u), iz=Math.floor(v), a=u-ix,b=v-iz;
  const i=iz*301+ix;
  const raw=(elevationGrid[i]*(1-a)+elevationGrid[i+1]*a)*(1-b)
    +(elevationGrid[i+301]*(1-a)+elevationGrid[i+302]*a)*b;
  const blend=limit(Math.max((Math.abs(along)-1380)/240,(Math.abs(cross)-300)/170),0,1);
  return runway10.elevation*(1-blend)+raw*blend;
}
function createTrainer(approach,wind){
  const point=worldRunway(approach?-3340:-1210,0);
  const speed=approach?33:0;
  return {
    ...point,y:approach?116:runway10.elevation+trainer.gearHeight,
    vx:speed*Math.sin(runway10.heading),vy:approach?-1.6:0,vz:-speed*Math.cos(runway10.heading),
    heading:runway10.heading,pitch:approach?.045:0,bank:0,
    pitchRate:0,bankRate:0,yawRate:0,trim:0,power:approach?.22:0,
    flaps:approach?2:0,ground:!approach,landed:false,ended:false,
    stall:false,speed,vs:0,wind,elapsed:0,airborne:false,touchdown:null
  };
}
function stepTrainer(f, input, dt=simTick){
  if(f.ended) return;
  const aircraft=f.aircraft||trainer;
  const terrain=f.regional?regionalHeight:groundHeight;
  const payload=f.aircraft?.cargoLimit?(f.cargoState??=cargoBalance(f)):null;
  const mass=flightMass(f);
  f.elapsed+=dt;
  f.power=limit(f.power+input.throttle*dt*.55,0,1);
  f.trim=limit(f.trim+input.trim*dt*.08,-.12,.15);
  const wind=f.windVector||(f.departure?airportPoint({...f.departure,x:0,z:0},0,f.wind):worldRunway(0,f.wind));
  const airX=f.vx-wind.x, airY=f.vy, airZ=f.vz-wind.z;
  const speed=Math.hypot(airX,airY,airZ);
  const track=Math.atan2(airX,-airZ);
  const pathAngle=Math.atan2(airY,Math.hypot(airX,airZ));
  const forwardSpeed=airX*Math.sin(f.heading)-airZ*Math.cos(f.heading);
  const alpha=limit(f.pitch-pathAngle+.036,-.65,.65);
  const beta=speed>5 ? wrapAngle(track-f.heading) : 0;
  const air=atmosphere(f.y,f.temperatureOffset);
  const cruiseBlend=aircraft.cruiseMach?limit((f.y-2500)/5500,0,1):0;
  const rho=1.225*Math.exp(-Math.max(0,f.y)/8500)*(1-cruiseBlend)+air.density*cruiseBlend;
  const mach=speed/air.sound;
  const q=.5*rho*speed*speed;
  const stallAngle=aircraft.stallAngle+.02*f.flaps;
  const liftSlope=5.05;
  const cl=(.27+liftSlope*limit(alpha,-stallAngle,stallAngle)+aircraft.flapLift[f.flaps])*
    Math.max(.31,1-Math.max(0,Math.abs(alpha)-stallAngle)*2.9);
  f.stall=!f.ground && (alpha>stallAngle || forwardSpeed<12);
  const lift=q*aircraft.wingArea*cl;
  const cleanDrag=.031+((aircraft.cleanDrag??.031)-.031)*cruiseBlend;
  const waveDrag=aircraft.cruiseMach ? .55*Math.pow(Math.max(0,mach-aircraft.cruiseMach+.012),2):0;
  const drag=q*aircraft.wingArea*(cleanDrag+waveDrag+.052*cl*cl+aircraft.flapDrag[f.flaps]+.11*Math.abs(beta));
  const engines=f.engines||[true];
  let running=engines.filter(Boolean).length/engines.length;
  if(Number.isFinite(f.fuel)){
    f.fuelFlow=running*(aircraft.fuelIdle??.30)+running*f.power*(aircraft.fuelPower??3.3);
    f.fuel=Math.max(0,f.fuel-dt*f.fuelFlow);
    if(f.fuel===0) f.fuelFlow=0;
    if(f.fuel===0) running=0;
  }
  const available=aircraft.thrust?
    (aircraft.thrust+(f.boost&&f.power>.89?aircraft.boostThrust||0:0))*Math.pow(rho/1.225,.75)/(1+Math.pow(speed/(255+cruiseBlend*115),2)):
    Math.min(2700*aircraft.power/119000,aircraft.power*.78/Math.max(18,forwardSpeed));
  const thrust=f.power*running*(f.propLow?.82:1)*available;
  const left=engines.slice(0,engines.length/2).filter(Boolean).length;
  const right=engines.slice(engines.length/2).filter(Boolean).length;
  const asymmetricYaw=engines.length>1?.26*f.power*(left-right)/engines.length:0;
  const g=9.80665;
  const pitchTarget=limit(.015+f.trim+input.pitch*.24*(input.maneuver??1)+(f.flaps*.008),-.36,.38);
  const response=limit(q/420,.22,1.8);
  const pitchMoment=(pitchTarget-f.pitch)*14500*response*aircraft.inertia[0]/1650-f.pitchRate*7800*aircraft.inertia[0]/1650+lift*(aircraft.cgOffset+(payload?.shift||0)*.18);
  const bankMoment=(input.roll*.57*(input.maneuver??1)-f.bank)*14000*response*aircraft.inertia[1]/2450-f.bankRate*5300*aircraft.inertia[1]/2450;
  const targetYaw=f.ground?input.rudder*(aircraft.role&&aircraft.role!=='fighter'?.22:.40): Math.tan(f.bank)*g/Math.max(20,speed)+input.rudder*.25+beta*.35;
  const yawMoment=(targetYaw+asymmetricYaw-f.yawRate)*8800*aircraft.inertia[2]/2850;
  f.pitchRate+=pitchMoment/aircraft.inertia[0]*dt;
  f.bankRate+=bankMoment/aircraft.inertia[1]*dt;
  f.yawRate+=yawMoment/aircraft.inertia[2]*dt;
  f.pitch=limit(f.pitch+f.pitchRate*dt,-.62,.66);
  f.bank=limit(f.bank+f.bankRate*dt,-.86,.86);
  f.heading=wrapAngle(f.heading+f.yawRate*dt*(f.ground?limit(Math.hypot(f.vx,f.vz)/6,0,1):1));
  if(f.ground){
    f.bank=f.bankRate=0;
    f.pitch=Math.max(0,f.pitch);
    const rollSpeed=Math.hypot(f.vx,f.vz);
    const braking=input.brake||f.parkingBrake||f.noseDoor||f.sideDoor||f.service?.door||f.service?.pushing||Boolean(payload?.problems.length);
    const force=(f.reverse?-thrust*.40:thrust)-drag-(braking?(aircraft.brakeForce||5900)+((payload?.mass||0)*4.8):(aircraft.rollingResistance||170));
    const spoilerDrag=f.spoilers?1200:0;
    const next=limit(rollSpeed+(force-spoilerDrag)/mass*dt,0,aircraft.thrust?122:105);
    f.vx=next*Math.sin(f.heading); f.vz=-next*Math.cos(f.heading);
    if(lift+Math.sin(f.pitch)*thrust>mass*g*1.03 && f.pitch>.055 && !f.service?.door && !f.service?.pushing && forwardSpeed>(aircraft.rotation?aircraft.rotation/1.94384*.87:23) && !f.parkingBrake){
      f.ground=false;f.airborne=true;f.landed=false;
      f.vy=.5;
    }
  }else{
    const s=Math.sin(f.heading), c=Math.cos(f.heading);
    const side=lift*Math.sin(f.bank)-q*aircraft.wingArea*.19*Math.sin(beta);
    const vertical=lift*Math.cos(f.bank)*Math.cos(pathAngle);
    const axial=thrust*Math.cos(f.pitch)-lift*Math.sin(pathAngle);
    const d=(drag+(f.spoilers?q*aircraft.wingArea*.10:0))/Math.max(1,speed);
    f.vx+=(s*axial+c*side-airX*d)/mass*dt;
    f.vy+=((vertical+thrust*Math.sin(f.pitch)-airY*d)/mass-g)*dt;
    f.vz+=(-c*axial+s*side-airZ*d)/mass*dt;
  }
  f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;
  const floor=terrain(f.x,f.z)+aircraft.gearHeight;
  if(f.ground || f.y<=floor){
    if(!f.ground){
      const runway=f.destination||runway10;
      const {along,cross}=f.regional?runwayCoordinates(f.x,f.z,runway):localRunway(f.x,f.z);
      f.touchdown={along,cross,verticalSpeed:f.vy,speed};
      f.landed=Math.abs(along)<=runway.length/2 && Math.abs(cross)<=runway.width/2 && f.gear!==false &&
        f.vy>-5 && Math.abs(f.bank)<.32 && Math.abs(wrapAngle(f.heading-runway.heading))<.40;
      f.ended=!f.landed;
    }
    f.ground=true;f.y=floor;f.vy=0;
  }
  f.speed=speed;
  f.vs=f.vy;
}
if(typeof module!=='undefined') module.exports={trainer,runway10,simTick,localRunway,worldRunway,groundHeight,createTrainer,stepTrainer,wrapAngle,flightSpeeds,atmosphere,cruiseControls,flightMass,knotsPerMps};

