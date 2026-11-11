'use strict';
const airportEnvironmentBounds=new Map();
function airportSurroundingsContains(airport,frame){
  const b=airportEnvironmentBounds.get(airport.code);
  return b&&frame.cross>b[0]&&frame.cross<b[1]&&Math.abs(-frame.along-b[2])<b[3];
}
// Original environment details fitted to the existing playable airport layout.
// Access roads/parking are scenery approximations, not an aeronautical survey.
function createAirportSurroundings(parent,airport,layout){
  const root=new THREE.Group();root.name=airport.code+' airport surroundings';parent.add(root);
  const {terminalX,terminalWidth,height,buildingLength,apronZ,gateWall}=layout;
  const side=Math.sign(airport.apron),back=terminalX+side*terminalWidth/2;
  const roadX=back+side*23,parkingX=back+side*74;
  const dense=airport.code==='RCSS',length=buildingLength+(dense?95:55);
  airportEnvironmentBounds.set(airport.code,[Math.min(gateWall,parkingX-parkPadding()),Math.max(gateWall,parkingX+parkPadding()),apronZ,length/2+5]);
  function parkPadding(){return dense?44:30;}
  const stats={parkingSpaces:0,parkedVehicles:0,fencePanels:0,trees:0,lights:0};
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.83,...extra});
  const road=mat('#434b50'),paving=mat('#a3a497'),curb=mat('#d2d0bf'),paint=mat('#e5dfc2');
  const frame=mat('#737f82',{metalness:.3,roughness:.53}),white=mat('#e3e2d7'),rubber=mat('#252a2c');
  const glazing=mat('#3e6173',{metalness:.28,roughness:.32});
  const brick=mat('#9b725a'),red=mat('#aa4c3d'),grass=mat('#52674b');
  const leaves=mat('#41613e',{vertexColors:true}),trunk=mat('#77614b');
  const lamp=mat('#f2dcab',{emissive:0xffe3a4,emissiveIntensity:.05});
  const batches=new Map(),transform=new THREE.Object3D();
  function add(geometry,material,x,y,z,sx=1,sy=1,sz=1,angle=0){
    transform.position.set(x,y,z);transform.rotation.set(0,angle,0);transform.scale.set(sx,sy,sz);transform.updateMatrix();
    const flat=geometry.index?geometry.toNonIndexed():geometry;
    if(flat!==geometry)geometry.dispose();flat.applyMatrix4(transform.matrix);
    if(!batches.has(material))batches.set(material,[]);batches.get(material).push(flat);
  }
  function box(material,w,h,d,x,y,z){add(new THREE.BoxGeometry(w,h,d),material,x,y,z);}
  function pole(x,z,h=7){
    add(new THREE.CylinderGeometry(.08,.13,h,7),frame,x,h/2,z);
    box(frame,2.4,.09,.12,x+1, h-.12,z);box(lamp,.75,.15,.36,x+2,h-.18,z);stats.lights++;
  }
  // Landside access: parallel drop-off road, sidewalks and bus/taxi bays.
  box(road,15,.12,length,roadX,.06,apronZ);
  for(const s of [-1,1]){
    box(paving,3.5,.18,length,roadX+s*9.2,.09,apronZ);
    box(curb,.24,.24,length,roadX+s*7.6,.12,apronZ);
  }
  for(let z=-length/2+8;z<length/2-3;z+=11)box(paint,.12,.018,4.5,roadX,.13,apronZ+z);
  for(const z of [-buildingLength*.34,buildingLength*.34]){
    for(let i=-6;i<=6;i+=2)box(paint,13.8,.025,.7,roadX,.14,apronZ+z+i);
  }
  box(paving,8,.15,buildingLength-15,back+side*4.5,.075,apronZ);
  box(white,7,.27,buildingLength-24,back+side*4.5,4.6,apronZ);
  for(let z=-buildingLength/2+15;z<buildingLength/2-5;z+=18){
    add(new THREE.CylinderGeometry(.12,.12,4.5,8),frame,back+side*6.8,2.25,apronZ+z);
    box(glazing,.16,3.8,4,back+side*.2,2,apronZ+z);
  }
  // Roof seams, HVAC cabinets and ducts make the existing terminal readable close up.
  for(let z=-buildingLength/2+7;z<buildingLength/2;z+=12)box(frame,terminalWidth+2,.035,.09,terminalX,height+.80,apronZ+z);
  for(let z=-buildingLength/2+24;z<buildingLength/2-12;z+=40){
    box(frame,3.8,1.45,5.6,terminalX,height+1.45,apronZ+z);
    box(white,4,.1,5.8,terminalX,height+2.2,apronZ+z);
    box(frame,1.1,.55,12,terminalX+side*3,height+1,apronZ+z+4);
  }
  // Marked parking stays on the landside, clear of all gate/tug/taxi paths.
  const parkLength=Math.min(length-28,dense?240:140),parkWidth=dense?64:37;
  box(road,parkWidth,.13,parkLength,parkingX,.065,apronZ);
  for(const s of [-1,1])box(curb,.22,.19,parkLength,parkingX+s*parkWidth/2,.10,apronZ);
  const tones=['#b4c2c5','#d6d2c6','#42566a','#ae5746','#d4ad45','#77887a'];
  const carPaint=tones.map(c=>mat(c,{roughness:.49,metalness:.15}));
  function vehicle(x,z,tone,type='car'){
    const bus=type==='bus',truck=type==='truck',l=bus?10:truck?6.6:4.4,w=bus?2.4:truck?2.3:1.78;
    box(carPaint[tone%6],w,bus?2.3:truck?2:1.05,l,x,bus?1.6:truck?1.5:.88,z);
    box(glazing,w*.87,bus?.7:truck?.7:.57,l*(truck?.24:.63),x,bus?2.5:truck?2.3:1.62,z-(truck?l*.32:0));
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const g=new THREE.CylinderGeometry(bus?.43:.31,bus?.43:.31,.23,9);g.rotateZ(Math.PI/2);
      add(g,rubber,x+sx*w*.49,bus?.48:.37,z+sz*l*.33);
    }
    box(lamp,w*.8,.13,.08,x,.98,z-l*.51);box(red,w*.76,.15,.08,x,.98,z+l*.51);
    stats.parkedVehicles++;
  }
  let n=0;
  for(const row of dense?[-22,-8,8,22]:[-10,10])for(let z=-parkLength/2+9;z<parkLength/2-6;z+=3){
    const x=parkingX+row,cz=apronZ+z;
    box(paint,5.3,.025,.08,x,.15,cz-1.45);
    box(paint,.1,.025,2.85,x+2.65,.15,cz);stats.parkingSpaces++;
    if(n++%4===0)continue;
    // Cars face across the parking aisle, perpendicular to the access road.
    const start=new Map([...batches].map(([m,p])=>[m,p.length]));
    vehicle(x,cz,n);
    const turn=new THREE.Matrix4().makeTranslation(-x,0,-cz);
    const restore=new THREE.Matrix4().makeTranslation(x,0,cz).multiply(new THREE.Matrix4().makeRotationY(Math.PI/2)).multiply(turn);
    for(const [m,parts] of batches)for(let i=start.get(m)??0;i<parts.length;i++)parts[i].applyMatrix4(restore);
  }
  vehicle(roadX-side*3,apronZ+buildingLength*.29,4,'bus');
  vehicle(roadX+side*3,apronZ-buildingLength*.28,4);
  // Airside equipment is parked off the centreline and away from the active central gate.
  for(const end of [-1,1]){
    const x=gateWall-side*12,z=apronZ+end*(buildingLength/2-17);
    box(white,2.2,1.3,3.5,x,.9,z);box(glazing,1.8,.48,1.1,x,1.55,z-1.2);
    for(let i=0;i<3;i++){
      box(frame,1.5,.7,2.8,x+side*(5+i*2.1),.55,z);box(rubber,1.6,.22,2,x+side*(5+i*2.1),.23,z);
    }
    box(brick,8,4,10,terminalX+side*8,2,z+end*18);box(frame,9,.3,11,terminalX+side*8,4.1,z+end*18);
  }
  // Chain-link panel texture is an original drawing; alpha-tested holes remain see-through.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.strokeStyle='#c2c7c4';ctx.lineWidth=1.5;
  for(let i=-64;i<128;i+=16){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+64,64);ctx.moveTo(i,0);ctx.lineTo(i-64,64);ctx.stroke();}
  const fenceTexture=new THREE.CanvasTexture(canvas);fenceTexture.colorSpace=THREE.SRGBColorSpace;
  fenceTexture.wrapS=fenceTexture.wrapT=THREE.RepeatWrapping;fenceTexture.repeat.set(3,1);
  const meshFence=mat('#979f9c',{map:fenceTexture,alphaTest:.35,side:THREE.DoubleSide});
  function fence(x,z,length){
    for(let start=-length/2;start<length/2;start+=6){
      add(new THREE.CylinderGeometry(.045,.045,2.4,6),frame,x,1.2,z+start);
      const panel=new THREE.PlaneGeometry(6,2.1);panel.rotateY(Math.PI/2);
      add(panel,meshFence,x,1.25,z+start+3);stats.fencePanels++;
    }
  }
  if(dense)fence(-side*148,0,airport.length-160);
  for(const end of [-1,1])fence(airport.apron+side*65,apronZ+end*(buildingLength/2+80),95);
  // Human-scale landscaping, with no crowns over access lanes or parking bays.
  const canopy=naturalTreeCrown(1);
  const leafy=[leaves,mat('#556849',{vertexColors:true}),mat('#3f6955',{vertexColors:true})];
  let treeNumber=0;
  for(let z=-parkLength/2+8;z<parkLength/2;z+=16){
    const x=parkingX+side*(parkWidth/2+6),cz=apronZ+z;
    box(grass,6,.15,11,x,.08,cz);box(curb,6.3,.10,11.3,x,.035,cz);
    const variation=(treeNumber*7%11)/10,h=5.2+variation*1.8,m=leafy[treeNumber++%3];
    add(new THREE.CylinderGeometry(.13,.19,h*.65,7),trunk,x,h*.325,cz);
    add(canopy.clone(),m,x,h,cz,2.25+variation*.45,2.35+variation*.6,2.2,z*.17);
    for(const s of [-1,1]){
      const branch=new THREE.CylinderGeometry(.055,.10,2.2,6);branch.rotateZ(s*.55);
      add(branch,trunk,x+s*.5,h*.63,cz+.25);
      add(canopy.clone(),m,x+s*1.4,h-s*.28,cz+s*.55,1.7,1.6+variation*.3,1.65,z*.37);
    }
    stats.trees++;
    pole(roadX+side*10.6,cz);
  }
  canopy.dispose();
  if(dense){
    // Bus shelter and pedestrian railings in front of the terminal.
    box(white,4,.2,12,roadX-side*11.7,3,apronZ+38);
    box(glazing,.12,2.7,11.5,roadX-side*13.5,1.55,apronZ+38);
    for(const z of [33,43])box(frame,3.6,.1,.12,roadX-side*11.7,.65,apronZ+z);
    for(let z=-length/2;z<length/2;z+=34)pole(gateWall-side*9,apronZ+z,9);
  }
  // Merge static geometry by material; hundreds of details cost only a few draws.
  for(const [material,parts] of batches){
    const geometry=new THREE.BufferGeometry();
    for(const [name,width] of [['position',3],['normal',3],['uv',2],['color',3]]){
      const array=new Float32Array(parts.reduce((n,g)=>n+g.attributes.position.count*width,0));let offset=0;
      if(name==='color')array.fill(1);
      for(const g of parts){if(g.attributes[name])array.set(g.attributes[name].array,offset);offset+=g.attributes.position.count*width;}
      geometry.setAttribute(name,new THREE.BufferAttribute(array,width));
    }
    geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;root.add(mesh);
    parts.forEach(g=>g.dispose());
  }
  root.userData={...stats,roadX,parkingX,parkWidth,parkLength,source:'Original scenery fitted to existing layout'};
  function update(x,z,day,quality){
    root.visible=Math.hypot(x-airport.x,z-airport.z)<(quality==='ultra'?9500:quality==='high'?6500:3800);
    lamp.emissiveIntensity=day<.25?1.8:.05;
    road.roughness=byId('weather').value==='wet'?.38:.91;
  }
  return {root,update,stats};
}
