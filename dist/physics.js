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
const fastCruiseKmh = 2000;
const displayKmh = mps => Math.round(mps*3.6);
const knotsToKmh = knots => Math.round(knots*1.852);
function atmosphere(height,temperatureOffset=0){
  const altitude=limit(height,0,20000);
  const standardTemperature=288.15-.0065*Math.min(altitude,11000);
  const pressure=101325*Math.pow(standardTemperature/288.15,5.25588)*
    Math.exp(-Math.max(0,altitude-11000)/6341.6);
  const temperature=standardTemperature+temperatureOffset;
  return {pressure,density:pressure/(287.05*temperature),sound:Math.sqrt(1.4*287.05*temperature)};
}
function flightWind(f){
  if(f.climbLesson){
    const strength=limit((f.y-1500)/7500,0,1);
    return {x:f.windVector.x*strength,z:f.windVector.z*strength};
  }
  return f.windVector||(f.departure?airportPoint({...f.departure,x:0,z:0},0,f.wind):worldRunway(0,f.wind));
}
function flightSpeeds(f){
  const wind=flightWind(f);
  const air=atmosphere(f.y,f.temperatureOffset);
  const tas=Math.hypot(f.vx-wind.x,f.vy-(wind.y||0),f.vz-wind.z);
  const mach=tas/air.sound;
  // Ideal pitot indication for subsonic flow. Use a dynamic-pressure approximation above Mach 1.
  const impact=air.pressure*(Math.pow(1+.2*mach*mach,3.5)-1);
  const ias=mach<=1?340.294*Math.sqrt(5*(Math.pow(1+impact/101325,2/7)-1)):
    tas*Math.sqrt(air.density/1.225);
  return {tas,ias,mach,gs:Math.hypot(f.vx,f.vz)};
}
function cruiseMachTarget(f){
  if(f.fastCruise){
    const air=atmosphere(f.y,f.temperatureOffset);
    return (fastCruiseKmh+12)/(3.6*air.sound*Math.sqrt(air.density/1.225));
  }
  return f.aircraft.cruiseMach??.85;
}
function fastCruiseActive(f){
  return f.fastCruise&&!f.ground&&!f.spoilers&&(!f.hold?.climb||f.hold.levelOff)&&
    !['descent','final','rollout'].includes(f.hold?.stage);
}
// Game mode uses augmented pitch trim. Limit the effective CG
// pitching moment as dynamic pressure rises to retain pitch stability.
const fastTrimAuthority=q=>18000/Math.max(18000,q);
const pitchResponse=q=>limit(q/420,.22,1.8);
function fastLevelPitch(f,q,tas,verticalSpeed,pitchGain=1){
  const aircraft=f.aircraft;
  const weight=flightMass(f)*9.80665;
  const verticalThrust=(f.engineThrust||0)*Math.sin(f.pitch);
  const lift=(weight-verticalThrust)/Math.max(.55,Math.cos(f.bank));
  const cg=aircraft.cgOffset+(f.cargoState?.shift||0)*.18;
  const cgTrim=lift*cg*fastTrimAuthority(q)/(14500*pitchResponse(q)*pitchGain*aircraft.inertia[0]/1650);
  const path=Math.atan2(f.vy,Math.max(tas,1));
  return (lift/(Math.max(q,1)*aircraft.wingArea)-.27-aircraft.flapLift[f.flaps])/5.05-.036-cgTrim+
    path*.25+limit((verticalSpeed-f.vy)*.00055,-.045,.045);
}
function cruiseControls(f){
  const air=atmosphere(f.y,f.temperatureOffset);
  const {tas}=flightSpeeds(f);
  const aircraft=f.aircraft,hold=f.hold;
  const q=.5*air.density*Math.max(tas*tas,1);
  const weight=flightMass(f)*9.80665;
  const levelCl=weight/(q*aircraft.wingArea);
  if(f.fastCruise&&q>12500){
    const desiredVS=limit((hold.altitude-f.y)*.09,-22,22);
    const pitch=fastLevelPitch(f,q,tas,desiredVS);
    return {pitch:limit((pitch-.015-f.trim-f.flaps*.008)/.24,-.8,.8),throttle:1};
  }
  const levelPitch=(levelCl-.27)/5.05-.036;
  const desiredVS=limit((hold.altitude-f.y)*.07,-9,9);
  return {
    pitch:limit((levelPitch-.015-f.trim)/.24+(desiredVS-f.vy)*.042,-.8,.8),
    throttle:1
  };
}
function climbCruiseControls(f){
  const hold=f.hold;
  const remaining=hold.altitude-f.y;
  if(remaining<150 && !hold.levelOff) hold.levelOff=true;
  if(hold.levelOff) return cruiseControls(f);
  const air=atmosphere(f.y,f.temperatureOffset);
  const {tas,ias,mach}=flightSpeeds(f);
  const aircraft=f.aircraft;
  // Accelerate before climbing and ease into the cruise Mach target as density falls.
  const climbIAS=limit(aircraft.rotation+45+(f.y-500)*.035,aircraft.rotation+45,245)
    +40*limit((f.y-3048)/1100,0,1);
  const speedError=Math.max((ias-climbIAS/knotsPerMps)*1.45,(mach-hold.mach)*air.sound);
  const desiredVS=limit(speedError*.85+5,-3,Math.min(18,remaining*.045));
  const blend=limit((f.y-2500)/5500,0,1);
  const density=1.225*Math.exp(-Math.max(0,f.y)/8500)*(1-blend)+air.density*blend;
  const q=.5*density*Math.max(tas*tas,1);
  const liftPitch=(flightMass(f)*9.80665/(q*aircraft.wingArea)-.27)/5.05-.036;
  const path=Math.atan2(f.vy,Math.max(tas,1));
  const pitch=liftPitch+path+(desiredVS-f.vy)*.022;
  return {pitch:limit((pitch-.015-f.trim)/.24,-.7,.65),throttle:1};
}
function flightMass(f){
  const aircraft=f.aircraft||trainer;
  return aircraft.mass+(f.cargoState?.mass||0)+(f.voyage?f.fuel-56000:0)+
    (f.service?f.fuel+f.service.boarded*95-f.service.referencePayload:0)+
    (f.cruiseTrial||f.climbLesson||(!f.voyage&&f.contract?.kind==='cargo')?f.fuel-f.fuelStart:0)+
    (['sightseeing','ferry'].includes(f.contract?.kind)?f.fuel-f.fuelStart+f.passengers*82:0);
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
  if(f.aircraft?.helicopter)return stepHelicopter(f,input,dt);
  const aircraft=f.aircraft||trainer;
  const terrain=f.regional?regionalHeight:groundHeight;
  const payload=f.aircraft?.cargoLimit?(f.cargoState??=cargoBalance(f)):null;
  const mass=flightMass(f);
  f.elapsed+=dt;
  f.power=limit(f.power+input.throttle*dt*.55,0,1);
  f.trim=limit(f.trim+input.trim*dt*.08,-.12,.15);
  const wind=flightWind(f);
  const airX=f.vx-wind.x, airY=f.vy-(wind.y||0), airZ=f.vz-wind.z;
  const speed=Math.hypot(airX,airY,airZ);
  const track=Math.atan2(airX,-airZ);
  const pathAngle=Math.atan2(airY,Math.hypot(airX,airZ));
  const forwardSpeed=airX*Math.sin(f.heading)-airZ*Math.cos(f.heading);
  const alpha=limit(f.pitch-pathAngle+.036,-.65,.65);
  const beta=speed>5 ? wrapAngle(track-f.heading) : 0;
  const air=atmosphere(f.y,f.temperatureOffset);
  const fastCruise=fastCruiseActive(f);
  const gameAirborne=f.fastCruise&&!f.ground;
  const cruiseBlend=gameAirborne?1:aircraft.cruiseMach?limit((f.y-2500)/5500,0,1):0;
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
  const waveReference=gameAirborne?cruiseMachTarget(f):aircraft.cruiseMach;
  const waveDrag=waveReference ? .55*Math.pow(Math.max(0,mach-waveReference+.012),2):0;
  const drag=q*aircraft.wingArea*(cleanDrag+waveDrag+.052*cl*cl+aircraft.flapDrag[f.flaps]+.11*Math.abs(beta));
  // The lever can stay at full power while the cruise Mach envelope limits thrust.
  const cruiseProtection=waveReference&&(gameAirborne||!f.gear&&!f.flaps)?
    cruiseBlend*limit((mach-waveReference+.03)*24,0,.85):0;
  const enginePower=f.power*(1-cruiseProtection);
  const engines=f.engines||[true];
  let running=engines.filter(Boolean).length/engines.length;
  if(Number.isFinite(f.fuel)){
    const idle=aircraft.fuelIdle??(aircraft.jet?.30:.002);
    const powerFlow=aircraft.fuelPower??(aircraft.jet?3.3:.009);
    f.fuelFlow=running*(idle+enginePower*powerFlow);
    f.fuel=Math.max(0,f.fuel-dt*f.fuelFlow);
    if(f.fuel===0) f.fuelFlow=0;
    if(f.fuel===0) running=0;
  }
  const fastJet=f.boost&&aircraft.role==='fighter'&&!f.gear&&!f.flaps;
  const inletSpeed=fastJet?(aircraft.id==='sf16'?520:460):255+cruiseBlend*115;
  // Game mode budgets thrust from wing area so each airframe can sustain the
  // selected speed without changing the measured ground motion.
  const normalThrust=aircraft.thrust?
    (aircraft.thrust+(f.boost&&f.power>.89?aircraft.boostThrust||0:0))*Math.pow(rho/1.225,.75)/(1+Math.pow(speed/inletSpeed,2)):
    Math.min(2700*aircraft.power/119000,aircraft.power*.78/Math.max(18,forwardSpeed));
  f.airBrake=!f.ground&&Boolean(input.brake||input.airBrake);
  const boostBlend=fastCruise&&!f.airBrake?limit(q/10000,.05,1):0;
  const boostedThrust=.5*1.225*aircraft.wingArea*((fastCruiseKmh+12)/3.6)**2*(.064+2*aircraft.flapDrag[f.flaps]);
  const available=normalThrust+boostBlend*Math.max(0,boostedThrust-normalThrust);
  const engineThrust=enginePower*running*(f.propLow?.82:1)*available;
  const thrust=boostBlend>0?Math.min(engineThrust,drag+mass*15):engineThrust;
  if(gameAirborne) f.engineThrust=thrust;
  const left=engines.slice(0,engines.length/2).filter(Boolean).length;
  const right=engines.slice(engines.length/2).filter(Boolean).length;
  const asymmetricYaw=engines.length>1?.26*f.power*(left-right)/engines.length:0;
  const g=9.80665;
  const fighterAirborne=aircraft.role==='fighter'&&!f.ground;
  const attitudeAssist=Boolean(f.hold||f.tactical?.aimAssist||input.attitudeAssist);
  const fighterManual=fighterAirborne&&!f.hold&&!f.gear&&!f.flaps;
  const maneuver=input.maneuver??1;
  const highSpeedAuthority=gameAirborne?limit(1.65-mach*.65,.40,1):1;
  // Feed in part of the additional lift needed for a steep turn.
  const turnComp=(attitudeAssist||fighterManual||!f.ground)&&Math.cos(f.bank)>.20&&Math.abs(input.roll)<.35?
    limit(mass*g/(Math.max(q,1)*aircraft.wingArea*liftSlope)*(1/Math.max(.32,Math.cos(f.bank))-1),0,.16)*(1-Math.abs(input.pitch))*(fighterManual?1:.72):0;
  const turnLift=turnComp;
  const trimBlend=gameAirborne&&!f.hold?limit((q-9000)/12000,0,1):0;
  const normalPitch=.015+f.trim+f.flaps*.008+turnLift;
  const centerPitch=trimBlend>0?normalPitch+trimBlend*(fastLevelPitch(f,q,speed,0,fighterManual?1.4:1)+f.trim*.25-normalPitch):normalPitch;
  const bankPitchFactor=attitudeAssist?1:(Math.sign(Math.cos(f.bank))*Math.max(.68,Math.abs(Math.cos(f.bank))));
  const pitchTarget=limit(centerPitch+input.pitch*bankPitchFactor*(fighterManual?.50*highSpeedAuthority:.24*maneuver*(f.hold?1:highSpeedAuthority)),
    fighterManual?-.48:-.36,fighterManual?.54:.38);
  const bankTarget=input.roll*(fighterManual?1.25*highSpeedAuthority:.57*maneuver);
  f.commandPitch=pitchTarget;
  f.commandBank=bankTarget;
  const response=pitchResponse(q);
  const pitchDamping=(fighterManual?9200:7800)+(input.yokeDamping?2100:0);
  const cgMoment=lift*(aircraft.cgOffset+(payload?.shift||0)*.18)*(gameAirborne?fastTrimAuthority(q):1);
  const pitchMoment=(pitchTarget-f.pitch)*14500*response*(fighterManual?1.4:1)*aircraft.inertia[0]/1650-f.pitchRate*pitchDamping*aircraft.inertia[0]/1650+cgMoment;
  const bankMoment=wrapAngle(bankTarget-f.bank)*14000*response*(fighterManual?2.2:1)*aircraft.inertia[1]/2450-f.bankRate*(fighterManual?9500:5300)*aircraft.inertia[1]/2450;
  // Manual ailerons command a roll rate, not a limited bank-angle target.
  // Assisted navigation retains its bank-angle controller for stable approaches.
  if(!f.ground&&!attitudeAssist){
    const maxRollRate=aircraft.rollRate??(aircraft.role==='fighter'?2.8:aircraft.mass>20000?.48:1.05);
    const authority=limit(q/600,.08,1)*highSpeedAuthority;
    let rate=input.roll*maxRollRate*authority;
    if(input.autoLevel&&Math.abs(input.roll)<.035)rate=limit(-wrapAngle(f.bank)*1.5,-maxRollRate*.55,maxRollRate*.55);
    const responseTime=aircraft.role==='fighter'?.18:aircraft.mass>20000?.65:.30;
    const settling=Math.abs(rate)<Math.abs(f.bankRate)&&rate*f.bankRate>=0;
    f.bankRate+=(rate-f.bankRate)*(1-Math.exp(-dt/(responseTime*(settling?.45:1))));
  }else f.bankRate+=bankMoment/aircraft.inertia[1]*dt;
  // Actual lateral lift stays finite at 90 degrees; tan(bank) does not.
  const coordinatedYaw=attitudeAssist?Math.tan(limit(f.bank,-1.2,1.2))*g/Math.max(20,speed):
    limit(lift*Math.sin(f.bank)/(mass*Math.max(20,speed)),-1.3,1.3);
  const targetYaw=f.ground?input.rudder*(aircraft.role&&aircraft.role!=='fighter'?.22:.40):
    coordinatedYaw+input.rudder*(fighterManual?.37:.25)*(attitudeAssist?1:Math.cos(f.bank))+beta*.35;
  const yawMoment=(targetYaw+asymmetricYaw-f.yawRate)*8800*aircraft.inertia[2]/2850;
  f.pitchRate+=pitchMoment/aircraft.inertia[0]*dt;
  f.yawRate+=yawMoment/aircraft.inertia[2]*dt;
  f.pitch=limit(f.pitch+f.pitchRate*dt,-.62,.66);
  f.bank=wrapAngle(f.bank+f.bankRate*dt);
  if((f.pitch===-.62&&f.pitchRate<0)||(f.pitch===.66&&f.pitchRate>0)) f.pitchRate=0;
  f.heading=wrapAngle(f.heading+f.yawRate*dt*(f.ground?limit(Math.hypot(f.vx,f.vz)/6,0,1):1));
  if(f.ground){
    f.lateralAcceleration=0;
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
    const axial=thrust*Math.cos(f.pitch)-lift*Math.cos(f.bank)*Math.sin(pathAngle);
    const airBrakeDrag=f.airBrake?Math.min(q*aircraft.wingArea*.24,mass*17):0;
    const d=(drag+airBrakeDrag+(f.spoilers?q*aircraft.wingArea*.10:0))/Math.max(1,speed);
    f.vx+=(s*axial+c*side-airX*d)/mass*dt;
    const upForce=vertical+thrust*Math.sin(f.pitch)-airY*d;
    const rightForce=side-(airX*c+airZ*s)*d;
    f.lateralAcceleration=(rightForce*Math.cos(f.bank)-upForce*Math.sin(f.bank))/mass;
    f.vy+=(upForce/mass-g)*dt;
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
if(typeof module!=='undefined') module.exports={trainer,runway10,simTick,localRunway,worldRunway,groundHeight,createTrainer,stepTrainer,wrapAngle,flightSpeeds,atmosphere,cruiseControls,climbCruiseControls,flightMass,knotsPerMps};

