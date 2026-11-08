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
  if(!twin){
    const registration=document.createElement('canvas');registration.width=1024;registration.height=128;
    const text=registration.getContext('2d');text.clearRect(0,0,1024,128);
    text.fillStyle='#134c68';text.font='bold 70px sans-serif';text.textAlign='center';
    text.fillText('SKYBOUND  ·  HORIZON',512,90);
    const livery=new THREE.CanvasTexture(registration);livery.colorSpace=THREE.SRGBColorSpace;
    for(const side of [-1,1]){
      const decal=new THREE.Mesh(new THREE.PlaneGeometry(24,3),new THREE.MeshBasicMaterial({map:livery,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
      decal.rotation.y=side*Math.PI/2;
      decal.position.set(side*(radius+.035),.55,-half*.27);model.add(decal);
      for(let i=0;i<16;i++)box(model,metal,.045,.045,.07,side*radius*.98,-.50,-half*.55+i*2.8);
    }
    for(const side of [-1,1]){
      const strut=box(data.gear,metal,.15,2.1,.15,side*4.8,-2.7,1.8);
      strut.rotation.z=side*.30;
      for(let i=0;i<3;i++)box(model,trim,.30,.09,.8,side*(8+i*7),-1.1,8+i*2);
    }
  }
  const cabin=data.cabin;
  for(const oldPanel of cabin.children){
    if(oldPanel.type==='Group'&&Math.abs(oldPanel.position.z-(-half*.56-.63))<.1) oldPanel.visible=false;
  }
  const cockpitZ=-half*.56, cockpitY=radius*.17;
  box(cabin,trim,3.65,.12,1.60,0,cockpitY-.52,cockpitZ-.75);
  box(cabin,trim,.52,.45,2.1,0,cockpitY-.52,cockpitZ+.17);
  for(const side of [-1,1]){
    box(cabin,trim,.12,1.4,1.8,side*1.8,cockpitY+.62,cockpitZ-.55);
    box(cabin,metal,.035,1.25,.07,side*.62,cockpitY+.92,cockpitZ-1.48);
    const seat=box(cabin,trim,.65,.8,.17,side*.83,cockpitY-.1,cockpitZ+1.1);
    seat.rotation.x=-.13;
    box(cabin,trim,.68,.15,.75,side*.83,cockpitY-.50,cockpitZ+.8);
  }
  if(twin){
    const yokeMat=new THREE.MeshStandardMaterial({color:0x2a3038,roughness:.66});
    box(cabin,trim,3.62,.10,.48,0,cockpitY+.71,cockpitZ-1.28);
    for(const side of [-1,1]){
      const x=side*.77;
      const column=box(cabin,yokeMat,.08,.62,.09,x,cockpitY-.36,cockpitZ-.39);
      column.rotation.x=-.18;
      const yoke=new THREE.Mesh(new THREE.TorusGeometry(.178,.031,9,32,Math.PI*1.24),yokeMat);
      yoke.position.set(x,cockpitY-.09,cockpitZ-.42);
      yoke.rotation.z=Math.PI*.88;
      cabin.add(yoke);
      box(cabin,trim,.16,.10,.055,x,cockpitY-.10,cockpitZ-.40);
    }
    for(let row=0;row<3;row++){
      for(let column=0;column<5;column++){
        box(cabin,metal,.075,.025,.07,(column-2)*.104,cockpitY-.22,cockpitZ+.37+row*.10);
      }
    }
  }
  const panelCanvas=document.createElement('canvas');panelCanvas.width=1536;panelCanvas.height=512;
  const ctx=panelCanvas.getContext('2d');
  const screenTexture=new THREE.CanvasTexture(panelCanvas);screenTexture.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(3.35,1.02),new THREE.MeshBasicMaterial({map:screenTexture}));
  screen.position.set(0,cockpitY+.21,cockpitZ-1.33);cabin.add(screen);
  const switches=[];
  const actions=twin?['電瓶','引擎 1','引擎 2','燈光','起落架','襟翼']:
    ['電瓶','引擎 1','引擎 2','引擎 3','引擎 4','燈光','起落架','襟翼'];
  for(let i=0;i<actions.length;i++){
    const button=box(cabin,metal,.12,.08,.12,-.57+i*.16,cockpitY-.10,cockpitZ-.35);
    button.userData.action=actions[i];
    switches.push(button);
  }
  box(cabin,trim,2.4,.10,.65,0,cockpitY+1.38,cockpitZ-.57);
  for(let i=0;i<(twin?2:4);i++)box(cabin,metal,.045,.18,.12,-.16+i*.105,cockpitY-.18,cockpitZ+.20);
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
  return {update,switches};
}


