'use strict';
// Original light helicopter. Stabilised rotorcraft model, not fixed-wing lift.
const helicopterProfile={...trainer,id:'sh6',name:'SKYBOUND H6 · 巡遊直升機',type:'單發渦軸直升機 · 總距／懸停',
  helicopter:true,mass:1900,missionFuel:280,geometry:[5.8,.90,5.25,.15,1,0],gearHeight:1.40,
  rotation:0,approach:45,retract:false,jet:false,flapLift:[0,0,0],flapDrag:[0,0,0],glass:true};
fleet.push(helicopterProfile);
function configureHelicopterFlight(f){
  f.fastCruise=false;f.flaps=0;f.gear=true;f.hold=null;
  f.rotorRPM=f.start==='cold'?0:1;
  f.fuel??=f.aircraft.missionFuel;f.fuelStart??=f.fuel;
  if(f.start==='air'){
    f.power=.55;f.vx=f.vy=f.vz=0;f.speed=0;
    f.y=f.departure.elevation+150;
  }
  return f;
}
function toggleHelicopterHover(f){
  if(f.hover){f.hover=null;return;}
  if(f.battery&&f.engines.some(Boolean)&&!f.ground&&!f.ended)
    f.hover={x:f.x,z:f.z,y:f.y,heading:f.heading};
}
function stepHelicopter(f,input,dt=simTick){
  if(f.ended||f.finished)return;
  const g=9.80665,wind=flightWind(f),density=atmosphere(f.y).density/1.225;
  const mass=Math.max(1400,f.aircraft.mass+(f.fuel??280)-280);
  f.elapsed+=dt;
  f.power=limit(f.power+(input.throttle||0)*dt*.55,0,1);
  const running=f.engines.some(Boolean)&&f.fuel!==0;
  f.rotorRPM??=f.start==='cold'?0:1;
  f.rotorRPM+=((running?1:0)-f.rotorRPM)*(1-Math.exp(-dt/(running?2.8:7)));
  if(Number.isFinite(f.fuel)){
    f.fuelFlow=running?.016+.040*f.power:0;
    f.fuel=Math.max(0,f.fuel-f.fuelFlow*dt);
    if(f.fuel===0){f.fuelFlow=0;f.engines.fill(false);f.hover=null;}
  }
  let pitch=input.pitch||0,roll=input.roll||0,rudder=input.rudder||0;
  const sine=Math.sin(f.heading),cosine=Math.cos(f.heading);
  const vx=f.vx-wind.x,vz=f.vz-wind.z;
  const forward=f.vx*sine-f.vz*cosine,right=f.vx*cosine+f.vz*sine;
  if(f.hover){
    if(Math.abs(pitch)+Math.abs(roll)+Math.abs(rudder)+Math.abs(input.throttle||0)>.15)f.hover=null;
    else{
      const ax=limit((f.hover.x-f.x)*.35-f.vx*.9,-3,3),az=limit((f.hover.z-f.z)*.35-f.vz*.9,-3,3);
      pitch=limit((ax*sine-az*cosine)/g/.28,-.8,.8);
      roll=limit((ax*cosine+az*sine)/g/.32,-.8,.8);
      rudder=limit(wrapAngle(f.hover.heading-f.heading)*2,-.7,.7);
      const desiredVS=limit((f.hover.y-f.y)*.8,-3,3);
      f.power=limit(.55/Math.pow(density,.65)/Math.max(.6,Math.cos(f.bank)*Math.cos(f.pitch))+(desiredVS-f.vy)*.055,.12,.92);
    }
  }
  if(input.brake&&!f.ground){pitch=limit(-forward*.10,-1,1);roll=limit(-right*.10,-1,1);}
  const pTarget=-pitch*.28,bTarget=roll*.32;
  f.commandPitch=pTarget;f.commandBank=bTarget;
  f.pitchRate+=((pTarget-f.pitch)*14-f.pitchRate*6)*dt;
  f.bankRate+=((bTarget-f.bank)*14-f.bankRate*6)*dt;
  f.pitch=limit(f.pitch+f.pitchRate*dt,-.5,.5);f.bank=limit(f.bank+f.bankRate*dt,-.55,.55);
  f.yawRate+=(rudder*.75-f.yawRate)*(1-Math.exp(-dt*4));
  if(!f.ground)f.heading=wrapAngle(f.heading+f.yawRate*dt);
  const lift=g*(f.power/.55)*f.rotorRPM*f.rotorRPM*Math.pow(density,.65)*1900/mass;
  f.engineThrust=lift*mass;f.stall=false;f.airBrake=Boolean(input.brake&&!f.ground);
  const floor=(f.regional?regionalHeight(f.x,f.z):groundHeight(f.x,f.z))+f.aircraft.gearHeight;
  if(f.ground){
    f.vx=f.vy=f.vz=0;f.y=floor;
    if(!f.parkingBrake&&lift*Math.cos(f.pitch)*Math.cos(f.bank)>g*1.025&&f.rotorRPM>.88){
      f.ground=false;f.airborne=true;f.landed=false;f.touchdown=null;
    }
  }
  if(!f.ground){
    const forwardAcceleration=-Math.sin(f.pitch)*lift,rightAcceleration=Math.sin(f.bank)*lift;
    f.vx+=(sine*forwardAcceleration+cosine*rightAcceleration-vx*(.045+.0008*Math.abs(vx)))*dt;
    f.vz+=(-cosine*forwardAcceleration+sine*rightAcceleration-vz*(.045+.0008*Math.abs(vz)))*dt;
    f.vy+=(lift*Math.cos(f.pitch)*Math.cos(f.bank)-g-f.vy*.55)*dt;
    f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;
    const landingFloor=(f.regional?regionalHeight(f.x,f.z):groundHeight(f.x,f.z))+f.aircraft.gearHeight;
    if(f.y<=landingFloor){
      const horizontal=Math.hypot(f.vx,f.vz);
      const frame=f.destination?runwayCoordinates(f.x,f.z,f.destination):{along:0,cross:0};
      f.touchdown={...frame,verticalSpeed:f.vy,speed:horizontal};
      f.landed=f.vy>-3&&horizontal<8&&Math.abs(f.bank)<.23&&Math.abs(f.pitch)<.23;
      f.ended=!f.landed;f.ground=true;f.hover=null;f.y=landingFloor;
      f.vx=f.vy=f.vz=0;f.pitch=f.bank=f.pitchRate=f.bankRate=0;
    }
  }
  f.speed=Math.hypot(f.vx-wind.x,f.vy,f.vz-wind.z);f.vs=f.vy;f.lateralAcceleration=0;
}
function updateHelicopterFlight(f,save){
  if(f.finished)return;
  f.phase=f.ground?(f.landed?'landed':!f.battery?'cold':'takeoff'):f.hover?'hover':'cruise';
  if(f.ended){f.finished=true;f.recorded=save(f,'直升機重落地');}
  else if(f.landed&&f.parkingBrake&&!f.engines.some(Boolean)){
    f.finished=true;f.recorded=save(f,'直升機降落完成');
  }
}
function buildHelicopter(profile,scene){
  const root=new THREE.Group();root.name='H6 helicopter';
  const cabin=new THREE.Group(),gear=new THREE.Group(),rotor=new THREE.Group(),tailRotor=new THREE.Group();
  const paint=new THREE.MeshStandardMaterial({color:0xe5e9e8,roughness:.36,metalness:.15});
  const blue=new THREE.MeshStandardMaterial({color:0x216b83,roughness:.38,metalness:.2});
  const dark=new THREE.MeshStandardMaterial({color:0x242e35,roughness:.76});
  const metal=new THREE.MeshStandardMaterial({color:0x747f82,roughness:.32,metalness:.65});
  const glass=new THREE.MeshPhysicalMaterial({color:0x91b8c1,roughness:.13,metalness:.25,clearcoat:1,transparent:true,opacity:.38,depthWrite:false});
  function mesh(parent,geometry,mat,x,y,z){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);parent.add(m);return m;}
  const box=(p,m,w,h,d,x,y,z)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const body=mesh(root,new THREE.SphereGeometry(1,44,26),paint,0,0,-.65);body.scale.set(.9,.89,2.2);
  const bodyIndex=body.geometry.index.array,bodyPosition=body.geometry.attributes.position,skin=[];
  for(let i=0;i<bodyIndex.length;i+=3){
    const ids=[bodyIndex[i],bodyIndex[i+1],bodyIndex[i+2]];
    const y=ids.reduce((n,k)=>n+bodyPosition.getY(k)/3,0),z=ids.reduce((n,k)=>n+bodyPosition.getZ(k)/3,0);
    if(!(y>0&&z<-.13))skin.push(...ids);
  }
  body.geometry.setIndex(skin);
  const windscreen=mesh(root,new THREE.SphereGeometry(1,36,22,0,Math.PI*2,0,Math.PI),glass,0,.28,-1.4);windscreen.scale.set(.88,.77,1.39);
  // Solid nose fairing, window frames and door sills distinguish glazing from the hull.
  const chin=mesh(root,new THREE.SphereGeometry(1,32,16),blue,0,-.34,-1.4);chin.scale.set(.92,.46,1.25);
  for(const side of [-1,1]){
    box(root,dark,.055,.82,1.65,side*.84,.30,-.68);
    box(root,blue,.12,.07,2.75,side*.90,-.25,-.35);
    box(root,metal,.07,.06,.31,side*.93,.18,.15);
    const skid=mesh(gear,new THREE.CylinderGeometry(.055,.055,4.6,12),metal,side*.97,-1.27,-.3);skid.rotation.x=Math.PI/2;
    for(const z of [-1.35,.70]){const strut=box(gear,metal,.065,.65,.065,side*.76,-.94,z);strut.rotation.z=side*.45;}
  }
  const boom=mesh(root,new THREE.CylinderGeometry(.16,.43,5.1,22),blue,0,.30,3.05);boom.rotation.x=Math.PI/2;
  const finShape=new THREE.Shape();finShape.moveTo(0,0);finShape.lineTo(.9,0);finShape.lineTo(.65,1.7);finShape.lineTo(.12,1.5);finShape.closePath();
  const fin=mesh(root,new THREE.ExtrudeGeometry(finShape,{depth:.07,bevelEnabled:false}),paint,-.035,.28,4.8);fin.rotation.y=Math.PI/2;
  box(root,blue,2.3,.07,.55,0,.45,3.8);
  const pod=mesh(root,new THREE.SphereGeometry(1,24,16),blue,0,.98,.40);pod.scale.set(.55,.45,1.30);
  const exhaust=mesh(root,new THREE.CylinderGeometry(.17,.20,.7,18,1,true),metal,.32,1.05,1.28);exhaust.rotation.x=Math.PI/2;
  mesh(root,new THREE.CylinderGeometry(.08,.11,.65,12),metal,0,1.44,.05);
  rotor.position.set(0,1.79,.05);root.add(rotor);
  mesh(rotor,new THREE.SphereGeometry(.17,16,10),metal,0,0,0);
  for(let blade=0;blade<4;blade++){
    const arm=new THREE.Group();arm.rotation.y=blade*Math.PI/2;rotor.add(arm);
    box(arm,dark,.22,.045,4.80,0,.02,-2.75);box(arm,paint,.23,.05,.31,0,.02,-5.02);
    box(arm,metal,.08,.09,.6,0,-.03,-.30);
  }
  tailRotor.position.set(.20,.72,5.45);root.add(tailRotor);
  for(let i=0;i<4;i++){const b=box(tailRotor,dark,.055,.17,1.5,0,0,0);b.rotation.x=i*Math.PI/2;}
  const navLights=[];
  for(const side of [-1,1])navLights.push(mesh(root,new THREE.SphereGeometry(.06,9,6),new THREE.MeshBasicMaterial({color:side<0?0xff5347:0x57e9ac}),side*.91,.28,.9));
  const panelCanvas=document.createElement('canvas');panelCanvas.width=768;panelCanvas.height=320;
  const ink=panelCanvas.getContext('2d'),panelTexture=new THREE.CanvasTexture(panelCanvas);panelTexture.colorSpace=THREE.SRGBColorSpace;
  const display=mesh(cabin,new THREE.PlaneGeometry(1.28,.53),new THREE.MeshBasicMaterial({map:panelTexture}),0,.09,-2.08);
  display.rotation.x=-.1;
  box(cabin,dark,1.51,.62,.25,0,.05,-2.21);box(cabin,dark,1.6,.08,.35,0,.43,-2.23);
  for(const side of [-1,1]){
    box(cabin,dark,.46,.12,.57,side*.43,-.46,-1.01);box(cabin,dark,.46,.70,.10,side*.43,-.13,-.68);
    box(cabin,dark,.035,.55,.04,side*.43,-.40,-1.45);
    box(cabin,metal,.035,.04,.26,side*.43,-.13,-1.48);
    box(cabin,dark,.04,1.4,.05,side*.80,.45,-1.33);
  }
  box(cabin,dark,.045,.98,.05,0,.88,-2.30);
  cabin.visible=false;root.add(gear);scene.add(root,cabin);
  let nextInstrument=0;
  function update(f,dt,now,cockpit,paused){
    if(!paused){rotor.rotation.y+=dt*39*(f?.rotorRPM??.35);tailRotor.rotation.x+=dt*150*(f?.rotorRPM??.35);}
    cabin.position.copy(root.position);cabin.quaternion.copy(root.quaternion);cabin.visible=cockpit;
    if(now<nextInstrument)return;nextInstrument=now+100;
    ink.fillStyle='#17232a';ink.fillRect(0,0,768,320);ink.font='bold 25px sans-serif';ink.fillStyle='#b7d9c8';
    ink.fillText('SKYBOUND H6',25,34);
    const rows=[['空速',Math.round((f?.speed??0)*3.6)+' km/h'],['高度',Math.round(f?.y??0)+' m'],['升降',((f?.vy??0)).toFixed(1)+' m/s'],
      ['旋翼 NR',Math.round((f?.rotorRPM??0)*100)+'%'],['總距',Math.round((f?.power??0)*100)+'%'],['燃油',Math.round(f?.fuel??280)+' kg']];
    rows.forEach(([title,value],i)=>{const x=25+i%3*250,y=90+Math.floor(i/3)*100;ink.fillStyle='#97aeb2';ink.fillText(title,x,y);ink.fillStyle='#7affbe';ink.font='bold 33px monospace';ink.fillText(value,x,y+38);ink.font='bold 25px sans-serif';});
    panelTexture.needsUpdate=true;
  }
  root.userData={gear,blades:[],surfaces:[],navLights,cabin,rotor,tailRotor,updateHelicopter:update};
  const airport=allAirports.find(a=>a.code==='RCSS'),pad=airportPoint(airport,385,airport.apron+46);
  const padCanvas=document.createElement('canvas');padCanvas.width=padCanvas.height=256;
  const p=padCanvas.getContext('2d');p.fillStyle='#666e70';p.fillRect(0,0,256,256);
  p.strokeStyle='#ece4a6';p.lineWidth=7;p.beginPath();p.arc(128,128,105,0,Math.PI*2);p.stroke();
  p.fillStyle='#f3edc4';p.font='bold 126px sans-serif';p.textAlign='center';p.fillText('H',128,173);
  const t=new THREE.CanvasTexture(padCanvas);t.colorSpace=THREE.SRGBColorSpace;
  const padMesh=new THREE.Mesh(new THREE.PlaneGeometry(28,28),new THREE.MeshStandardMaterial({map:t,roughness:.88}));
  padMesh.rotation.x=-Math.PI/2;padMesh.position.set(pad.x,airport.elevation+.13,pad.z);padMesh.name='H1 training helipad';scene.add(padMesh);
  return root;
}
if(typeof module!=='undefined')Object.assign(globalThis,{helicopterProfile,configureHelicopterFlight,stepHelicopter,toggleHelicopterHover,updateHelicopterFlight});
