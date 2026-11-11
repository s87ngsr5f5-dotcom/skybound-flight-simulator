'use strict';
// Original fighter finish and readable 3D flight deck; no copied cockpit textures.
function refineFighter(model,profile){
  const data=model.userData,cabin=data.cabin,half=profile.geometry[0],radius=profile.geometry[1];
  const f16=profile.id==='sf16'||profile.f16Family;
  const skinCanvas=document.createElement('canvas');skinCanvas.width=1024;skinCanvas.height=1024;
  const ink=skinCanvas.getContext('2d');ink.fillStyle='#bbc0c0';ink.fillRect(0,0,1024,1024);
  for(let i=0;i<4200;i++){
    const x=(i*137.39)%1024,y=(i*71.77)%1024;
    ink.fillStyle=i%2?'#737a7c0a':'#ffffff09';ink.fillRect(x,y,5,12);
  }
  ink.lineWidth=1.3;ink.strokeStyle='#58636888';
  for(let row=0;row<9;row++){
    const y=row*119+18;ink.beginPath();ink.moveTo(0,y);ink.lineTo(1024,y);ink.stroke();
    for(let col=0;col<6;col++){
      const x=col*172+(row%2)*54;ink.strokeRect(x,y+8,132,86);
      for(let n=0;n<12;n++){ink.fillStyle='#45545899';ink.fillRect(x+n*11,y+5,1.6,1.6);}
    }
  }
  const skin=new THREE.CanvasTexture(skinCanvas);skin.colorSpace=THREE.SRGBColorSpace;skin.anisotropy=4;
  const treated=new Set();
  model.traverse(o=>{
    if(!o.isMesh||!o.material?.isMeshStandardMaterial)return;
    const m=o.material;
    if(o.geometry.type==='LatheGeometry'&&m.roughness>.4&&!treated.has(m)){
      o.geometry.computeBoundingBox();
      m.map=skin;m.color.set(o.geometry.boundingBox.max.z<-half*.70?'#777f83':'#a3aaad');m.roughness=.55;m.metalness=.28;m.envMapIntensity=.9;m.needsUpdate=true;treated.add(m);
    }
    if(m.isMeshPhysicalMaterial){m.color.set('#536b75');m.roughness=.13;m.metalness=.27;m.clearcoat=1;m.transparent=true;m.opacity=.62;m.depthWrite=false;}
  });
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.67,...extra});
  const graphite=mat('#192228'),edge=mat('#353f42'),bezel=mat('#2b3437'),metal=mat('#929d9e',{metalness:.7,roughness:.3});
  const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=128;
  const grain=grainCanvas.getContext('2d');grain.fillStyle='#a4a8a8';grain.fillRect(0,0,128,128);
  for(let i=0;i<2300;i++){grain.fillStyle=i%2?'#737a7b':'#c0c5c1';grain.fillRect(i*71%128,i*37%128,1,1);}
  const grainMap=new THREE.CanvasTexture(grainCanvas);grainMap.wrapS=grainMap.wrapT=THREE.RepeatWrapping;grainMap.repeat.set(7,4);
  for(const m of [graphite,edge,bezel]){m.map=grainMap;m.bumpMap=grainMap;m.bumpScale=.008;m.roughness=.87;}
  const key=mat('#aeafa1'),seat=mat('#3c4940'),paint=mat('#89969b',{metalness:.25,roughness:.5});
  function part(parent,g,m,x,y,z){const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  const box=(p,m,w,h,d,x,y,z)=>part(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  if(f16){
    // Distinct metallic nozzle feathers, sensor blisters and subdued original tail markings.
    for(let i=0;i<24;i++){
      const angle=i*Math.PI/12;
      const petal=box(model,i%3?metal:edge,.115,.035,.52,Math.cos(angle)*.56,Math.sin(angle)*.56,half-.17);
      petal.rotation.z=angle+Math.PI/2;
    }
    const ring=part(model,new THREE.TorusGeometry(.52,.027,8,48),metal,0,0,half+.07);
    for(const side of [-1,1]){
      const port=part(model,new THREE.SphereGeometry(1,14,10),paint,side*radius*.67,-.09,-half*.49);
      port.scale.set(.075,.10,.27);
      const pylon=box(model,edge,.10,.09,.58,side*profile.geometry[2]*.96,profile.geometry[3]-.03,half*.14);
    }
    const stencil=document.createElement('canvas');stencil.width=256;stencil.height=384;
    const s=stencil.getContext('2d');s.fillStyle='#424f55';s.font='bold 78px sans-serif';s.fillText('SB',25,115);s.font='52px monospace';s.fillText('16V',24,184);
    s.font='20px sans-serif';s.fillText('SKYBOUND',20,229);
    const map=new THREE.CanvasTexture(stencil);map.colorSpace=THREE.SRGBColorSpace;
    for(const sign of [-1,1]){
      const label=part(model,new THREE.PlaneGeometry(.66,.98),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:THREE.DoubleSide}),sign>0?.015:-.185,radius*.61+half*.22,half*.72);
      label.rotation.y=sign*Math.PI/2;
    }
    const pilot=new THREE.Group();pilot.position.set(0,radius*.49,-half*.37);model.add(pilot);
    box(pilot,seat,.34,.40,.22,0,-.03,0);
    const helmet=part(pilot,new THREE.SphereGeometry(.17,18,12),seat,0,.29,0);helmet.scale.y=1.1;
    const visor=part(pilot,new THREE.SphereGeometry(.175,16,10,Math.PI*.55,Math.PI*.9,Math.PI*.2,Math.PI*.55),graphite,0,.29,-.015);
  }
  for(const child of [...cabin.children]){child.traverse(o=>o.geometry?.dispose());cabin.remove(child);}
  const eye={x:0,y:radius*.78+.16,z:-half*(profile.sideIntakes?.40:.37)};
  data.cockpitEye={...eye,z:eye.z+.38};
  // Instrument panel below the pilot's eye line; separate side consoles and glare shield.
  const panelZ=eye.z-.92,panelY=eye.y-.55;
  const fascia=new THREE.Shape();fascia.moveTo(-.73,-.30);fascia.lineTo(-.77,.10);fascia.lineTo(-.63,.30);fascia.lineTo(.63,.30);fascia.lineTo(.77,.10);fascia.lineTo(.73,-.30);fascia.closePath();
  part(cabin,new THREE.ExtrudeGeometry(fascia,{depth:.15,bevelEnabled:true,bevelThickness:.018,bevelSize:.02,bevelSegments:3}),graphite,0,panelY,panelZ-.08);
  const hood=part(cabin,new THREE.BoxGeometry(1.50,.065,.50),edge,0,panelY+.34,panelZ-.10);
  box(cabin,graphite,.38,.43,.80,-.55,panelY-.35,eye.z-.04);
  box(cabin,graphite,.33,.43,.80,.56,panelY-.35,eye.z-.04);
  for(const side of [-1,1]){
    const sill=box(cabin,edge,.075,.10,2.4,side*.75,eye.y-.35,eye.z+.05);sill.rotation.x=-.035;
    for(let i=0;i<8;i++)box(cabin,key,.035,.045,.025,side*.40,eye.y-.71,eye.z-.50+i*.085);
  }
  box(cabin,seat,.46,.1,.49,0,eye.y-1,eye.z+.28);box(cabin,seat,.48,.76,.1,0,eye.y-.62,eye.z+.55);
  box(cabin,metal,.035,.25,.035,.54,eye.y-.64,eye.z-.12);box(cabin,graphite,.085,.12,.08,.54,eye.y-.48,eye.z-.12);
  box(cabin,metal,.05,.06,.28,-.56,eye.y-.58,eye.z-.14);
  const screens=[];
  for(const side of [-1,1]){
    const x=side*.47;box(cabin,bezel,.42,.40,.065,x,panelY+.03,panelZ+.13);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    part(cabin,new THREE.PlaneGeometry(.31,.29),new THREE.MeshBasicMaterial({map:texture}),x,panelY+.045,panelZ+.17);
    for(let i=0;i<4;i++)for(const s of [-1,1])box(cabin,key,.028,.022,.024,x+s*.19,panelY-.09+i*.09,panelZ+.19);
    screens.push({ink:canvas.getContext('2d'),texture});
  }
  // Centre keypad, knobs and lower annunciators are actual geometry.
  box(cabin,bezel,.39,.50,.11,0,panelY+.12,panelZ+.15);
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){
    const button=box(cabin,key,.075,.060,.022,(col-1)*.10,panelY+.24-row*.078,panelZ+.218);
  }
  const keyCanvas=document.createElement('canvas');keyCanvas.width=300;keyCanvas.height=312;
  const ki=keyCanvas.getContext('2d');ki.fillStyle='#182124';ki.font='bold 34px monospace';ki.textAlign='center';
  for(let row=0;row<4;row++)for(let col=0;col<3;col++)ki.fillText(['1','2','3','4','5','6','7','8','9','C','0','E'][row*3+col],50+col*100,54+row*78);
  const keyMap=new THREE.CanvasTexture(keyCanvas);keyMap.colorSpace=THREE.SRGBColorSpace;
  part(cabin,new THREE.PlaneGeometry(.30,.312),new THREE.MeshBasicMaterial({map:keyMap,transparent:true,depthWrite:false}),0,panelY+.122,panelZ+.232);
  for(const side of [-1,1]){
    const knob=part(cabin,new THREE.CylinderGeometry(.035,.035,.047,14),metal,side*.12,panelY-.115,panelZ+.23);knob.rotation.x=Math.PI/2;
  }
  const hudCanvas=document.createElement('canvas');hudCanvas.width=512;hudCanvas.height=512;
  const hudInk=hudCanvas.getContext('2d'),hudTexture=new THREE.CanvasTexture(hudCanvas);hudTexture.colorSpace=THREE.SRGBColorSpace;
  const paneMat=new THREE.MeshPhysicalMaterial({color:0xb4d0c0,transparent:true,opacity:.085,roughness:.12,metalness:.1,side:THREE.DoubleSide,depthWrite:false});
  const pane=part(cabin,new THREE.PlaneGeometry(.58,.62),paneMat,0,eye.y+.045,eye.z-1.34);pane.rotation.x=-.08;
  const symbols=part(cabin,new THREE.PlaneGeometry(.54,.58),new THREE.MeshBasicMaterial({map:hudTexture,transparent:true,depthWrite:false,toneMapped:false}),0,eye.y+.045,eye.z-1.327);symbols.rotation.x=-.08;
  for(const side of [-1,1]){
    const support=box(cabin,edge,.042,.60,.065,side*.30,eye.y-.005,eye.z-1.33);support.rotation.z=-side*.10;
  }
  let nextDraw=0;
  data.updateFighterDeck=(f,now)=>{
    if(now<nextDraw)return;nextDraw=now+100;
    const on=f?.battery??true;
    const speeds=f?flightSpeeds(f):{ias:0,mach:0};
    for(let i=0;i<screens.length;i++){
      const {ink:c,texture}=screens[i];c.fillStyle='#050b0c';c.fillRect(0,0,384,384);
      if(on){
        c.strokeStyle='#7ceaa7';c.fillStyle='#8af4b5';c.lineWidth=2;c.font='24px monospace';
        c.fillText(i?'NAV / FUEL':'FLIGHT',20,34);
        if(i){
          c.beginPath();c.arc(192,184,112,0,Math.PI*2);c.moveTo(192,72);c.lineTo(192,300);c.moveTo(80,184);c.lineTo(304,184);c.stroke();
          c.fillText('HDG '+String(Math.round(((f?.heading??0)*180/Math.PI+360)%360)).padStart(3,'0'),20,330);
          c.fillText('FUEL '+Math.round(f?.fuel??2700),20,365);
        }else{
          c.fillText('IAS '+Math.round(speeds.ias*3.6),20,88);c.fillText('ALT '+Math.round(f?.y??0),20,127);
          c.fillText('PWR '+Math.round((f?.power??0)*100)+'%',20,166);
          c.fillText('M '+speeds.mach.toFixed(2),20,205);
          c.fillText('ENG '+(f?.engines?.[0]?'RUN':'OFF'),20,270);
          c.fillText('GEAR '+(f?.gear?'DOWN':'UP'),20,325);
        }
      }
      texture.needsUpdate=true;
    }
    hudInk.clearRect(0,0,512,512);
    if(on){
      const c=hudInk;c.fillStyle=c.strokeStyle='#74ffa0';c.font='bold 30px monospace';c.lineWidth=4;
      c.fillText(String(Math.round(speeds.ias*3.6)),23,238);c.fillText(String(Math.round(f?.y??0)),382,238);
      c.fillText(String(Math.round(((f?.heading??0)*180/Math.PI+360)%360)).padStart(3,'0'),226,43);
      c.save();c.translate(256,254+(f?.pitch??0)*180);c.rotate(-(f?.bank??0));
      for(let angle=-20;angle<=20;angle+=10){const y=-angle*5;c.beginPath();c.moveTo(-110,y);c.lineTo(-35,y);c.moveTo(35,y);c.lineTo(110,y);c.stroke();if(angle)c.fillText(String(angle),115,y+8);}
      c.restore();c.beginPath();c.arc(256,266,12,0,Math.PI*2);c.moveTo(210,266);c.lineTo(244,266);c.moveTo(268,266);c.lineTo(302,266);c.stroke();
      c.fillText('SKYBOUND',194,474);
    }
    hudTexture.needsUpdate=true;
  };
}
