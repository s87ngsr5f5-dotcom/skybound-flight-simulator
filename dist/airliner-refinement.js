'use strict';
function refineAirliner(model,{twin=false}={}){
  const data=model.userData,half=data.half,radius=data.radius;
  const metal=new THREE.MeshStandardMaterial({color:0x9eafb7,roughness:.32,metalness:.68});
  const trim=new THREE.MeshStandardMaterial({color:0x29363f,roughness:.60});
  const glow=new THREE.MeshBasicMaterial({color:0xffd497});
  function box(parent,mat,w,h,d,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  const tread=document.createElement('canvas');tread.width=tread.height=128;
  const ink=tread.getContext('2d');ink.fillStyle='#555';ink.fillRect(0,0,128,128);ink.fillStyle='#111';
  for(let i=8;i<128;i+=16)ink.fillRect(i,0,5,128);
  const tyre=new THREE.CanvasTexture(tread);tyre.wrapS=tyre.wrapT=THREE.RepeatWrapping;tyre.repeat.set(5,1);
  for(const wheel of data.wheels){
    wheel.material=wheel.material.clone();wheel.material.bumpMap=tyre;wheel.material.bumpScale=.05;
  }
  if(!twin&&half>30){
    const registration=document.createElement('canvas');registration.width=1024;registration.height=128;
    const text=registration.getContext('2d');text.clearRect(0,0,1024,128);
    text.fillStyle='#134c68';text.font='bold 70px sans-serif';text.textAlign='center';
    text.fillText('SKYBOUND  ·  HORIZON',512,90);
    const livery=new THREE.CanvasTexture(registration);livery.colorSpace=THREE.SRGBColorSpace;
    for(const side of [-1,1]){
      const decal=new THREE.Mesh(new THREE.PlaneGeometry(18,1.35),new THREE.MeshBasicMaterial({map:livery,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
      decal.rotation.y=side*Math.PI/2;
      decal.position.set(side*(radius+.018),.22,-half*.18);model.add(decal);
    }
  }
  const cabin=data.cabin;
  for(const oldPanel of cabin.children){
    if(oldPanel.type==='Group'&&Math.abs(oldPanel.position.z-(-half*.56-.63))<.1) oldPanel.visible=false;
  }
  const cockpitZ=-half*.56, cockpitY=radius*.17;
  const archMat=new THREE.MeshStandardMaterial({color:0x182028,roughness:.62,metalness:.22});
  // Solid instrument console housing set slightly behind PFD/MFD display plane so glass screens stay unobstructed
  box(cabin,archMat,3.52,1.08,.44,0,cockpitY+.06,cockpitZ-1.54);
  const glareshield=box(cabin,trim,3.58,.095,.48,0,cockpitY+.49,cockpitZ-1.26);
  glareshield.rotation.x=.06;
  box(cabin,trim,3.65,.12,1.60,0,cockpitY-.52,cockpitZ-.75);
  box(cabin,trim,.56,.44,2.1,0,cockpitY-.52,cockpitZ+.17);
  // High unobstructed upper windshield brow & crisp swept A-pillars connecting corners
  box(cabin,archMat,3.44,.09,.28,0,cockpitY+1.38,cockpitZ-1.14);
  const centerMullion=box(cabin,archMat,.045,.94,.055,0,cockpitY+.93,cockpitZ-1.18);
  centerMullion.rotation.x=-.20;
  for(const side of [-1,1]){
    box(cabin,trim,.12,.52,1.8,side*1.74,cockpitY-.20,cockpitZ-.55);
    const outerPillar=box(cabin,archMat,.06,.96,.08,side*1.58,cockpitY+.93,cockpitZ-1.18);
    outerPillar.rotation.x=-.20;outerPillar.rotation.z=side*.10;
    const seat=box(cabin,trim,.65,.8,.17,side*.83,cockpitY-.1,cockpitZ+1.1);
    seat.rotation.x=-.13;
    box(cabin,trim,.68,.15,.75,side*.83,cockpitY-.50,cockpitZ+.8);
  }
  const yokeMat=new THREE.MeshStandardMaterial({color:0x2a3038,roughness:.66});
  const yokePivots=[], throttleLevers=[];
  for(const side of [-1,1]){
    const x=side*.56;
    const pivot=new THREE.Group();
    pivot.position.set(x,cockpitY-.34,cockpitZ-.56);
    const column=box(pivot,yokeMat,.07,.48,.075,0,.22,0);
    column.rotation.x=-.14;
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.16,.026,9,32,Math.PI*1.24),yokeMat);
    wheel.position.set(0,.44,-.02);
    wheel.rotation.z=Math.PI*.88;
    pivot.add(wheel);
    box(pivot,trim,.14,.085,.05,0,.43,0);
    cabin.add(pivot);
    yokePivots.push({pivot,wheel});
  }
  for(let row=0;row<3;row++){
    for(let column=0;column<5;column++){
      box(cabin,metal,.075,.025,.07,(column-2)*.104,cockpitY-.22,cockpitZ+.37+row*.10);
    }
  }
  const panelCanvas=document.createElement('canvas');panelCanvas.width=1536;panelCanvas.height=512;
  const ctx=panelCanvas.getContext('2d');
  const screenTexture=new THREE.CanvasTexture(panelCanvas);screenTexture.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(3.25,.88),new THREE.MeshBasicMaterial({map:screenTexture}));
  screen.position.set(0,cockpitY+.02,cockpitZ-1.275);screen.rotation.x=-.10;cabin.add(screen);
  const switches=[];
  const actions=twin?['電瓶','引擎 1','引擎 2','燈光','起落架','襟翼']:
    ['電瓶','引擎 1','引擎 2','引擎 3','引擎 4','燈光','起落架','襟翼'];
  for(let i=0;i<actions.length;i++){
    const button=box(cabin,metal,.12,.08,.12,-.57+i*.16,cockpitY-.10,cockpitZ-.35);
    button.userData.action=actions[i];
    switches.push(button);
  }
  box(cabin,trim,2.2,.08,.55,0,cockpitY+1.65,cockpitZ-.28);
  for(let i=0;i<(twin?2:4);i++){
    const leverPivot=new THREE.Group();
    leverPivot.position.set((i-(twin?.5:1.5))*.105,cockpitY-.28,cockpitZ+.20);
    box(leverPivot,metal,.038,.20,.045,0,.10,0);
    box(leverPivot,trim,.065,.055,.07,0,.21,-.01);
    cabin.add(leverPivot);
    throttleLevers.push(leverPivot);
  }
  let last=-1;
  function update(f,now,day){
    if(now-last<120)return;last=now;
    ctx.fillStyle='#141c22';ctx.fillRect(0,0,1536,512);
    ctx.fillStyle='#cad5d7';ctx.font='24px sans-serif';ctx.textAlign='left';
    ctx.fillText(twin?'777-300ER   FLIGHT DECK':'HORIZON   FLIGHT DECK',28,36);
    ctx.fillText(twin?'BAT   ENG 1    ENG 2    LIGHTS   GEAR   FLAPS':'BAT   ENG 1    ENG 2    ENG 3    ENG 4    LIGHTS   GEAR   FLAPS',130,491);
    const live=!f||f.battery;
    const speed=f?Math.round(flightSpeeds(f).ias*knotsPerMps):0,alt=f?Math.round(f.y*3.28084):0;
    const bank=f?.bank||0,pitch=f?.pitch||0;
    for(let i=0;i<4;i++){
      const x=25+i*377;
      ctx.fillStyle=live?'#0c242b':'#020609';ctx.fillRect(x,56,350,375);
      if(!live)continue;
      ctx.strokeStyle='#52747e';ctx.strokeRect(x,56,350,375);
      ctx.fillStyle='#9eefb8';ctx.font='22px monospace';
      ctx.fillText(['PFD','NAVIGATION','ENGINE STATUS','SYSTEMS'][i],x+16,88);
      if(i===0){
        ctx.save();ctx.beginPath();ctx.rect(x+55,110,236,205);ctx.clip();
        ctx.translate(x+173,215);ctx.rotate(-bank);ctx.translate(0,pitch*160);
        ctx.fillStyle='#407eaa';ctx.fillRect(-280,-300,560,300);ctx.fillStyle='#8d7148';ctx.fillRect(-280,0,560,300);
        ctx.strokeStyle='#f2f2dc';ctx.beginPath();ctx.moveTo(-260,0);ctx.lineTo(260,0);ctx.stroke();ctx.restore();
        ctx.fillStyle='#eef7ec';ctx.font='28px monospace';ctx.fillText(speed+' KTS',x+15,355);ctx.fillText(alt+' FT',x+15,397);
      }else if(i===1){
        ctx.strokeStyle='#66929a';for(let k=1;k<4;k++){ctx.beginPath();ctx.arc(x+174,238,k*39,0,7);ctx.stroke();}
        ctx.strokeStyle='#8cebe2';ctx.beginPath();ctx.moveTo(x+174,355);ctx.lineTo(x+174,151);ctx.lineTo(x+235,119);ctx.stroke();
        ctx.fillText('HDG '+Math.round(((f?.heading||0)*180/Math.PI+360)%360),x+28,380);
      }else if(i===2){
        for(let j=0;j<(twin?2:4);j++){
          const running=f?.engines?.[j]??false;
          ctx.fillStyle=running?'#9eefb8':'#be9378';
          ctx.fillText('ENG '+(j+1)+'  '+(running?Math.round((f?.power||0)*100)+'%':'OFF'),x+25,151+j*62);
        }
      }else{
        ctx.fillText('BAT  '+(f?.battery?'ON':'OFF'),x+18,151);
        ctx.fillText('GEAR '+(f?.gear===false?'UP':'DOWN'),x+18,213);
        ctx.fillText('FLAP '+(f?.flaps||0),x+18,275);
        if(twin&&f){
          const {mach,gs}=flightSpeeds(f);
          ctx.fillText('GS '+Math.round(gs*knotsPerMps)+' KT   M '+mach.toFixed(2),x+18,382);
        }
        ctx.fillText(day<.2?'NIGHT LIGHT':'DAYLIGHT',x+18,337);
      }
    }
    screenTexture.needsUpdate=true;
  }
  function animateControls(f,dt){
    if(!f)return;
    const roll=f.manualControls?.roll??0;
    const pitch=f.manualControls?.pitch??0;
    const pwr=Math.max(0,Math.min(1,f.power??0));
    const lerp=Math.min(1,(dt||.016)*14);
    for(const y of yokePivots){
      y.pivot.rotation.x+=(pitch*.18-.10-y.pivot.rotation.x)*lerp;
      y.wheel.rotation.z+=(Math.PI*.88-roll*.62-y.wheel.rotation.z)*lerp;
    }
    const targetThr=.22-pwr*.76;
    for(const lv of throttleLevers) lv.rotation.x+=(targetThr-lv.rotation.x)*lerp;
  }
  return {update,animateControls,switches};
}


