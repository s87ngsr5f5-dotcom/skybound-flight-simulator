'use strict';
const byId = id => document.getElementById(id);
const airports=allAirports;
const rad = Math.PI / 180;
const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
let seed = 682;
function random(){
  seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
  return seed / 4294967296;
}
let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias:true});
} catch(error) {
  byId('startupMessage').textContent = '3D 引擎無法啟動。請用支援 WebGL 的瀏覽器開啟。';
  byId('retryStartup').hidden=false;
  byId('fly').disabled = byId('approach').disabled = true;
}
if(renderer) initialize();
function initialize(){
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9ccbea');
  scene.fog = new THREE.FogExp2('#a4c9dd',0.000026);
  const camera = new THREE.PerspectiveCamera(64,1,.6,155000);
  renderer.domElement.className = 'world';
  document.body.prepend(renderer.domElement);
  const ambient=new THREE.HemisphereLight(0xe1efff,0x777054,2.15);
  scene.add(ambient);
  const sunlight = new THREE.DirectionalLight(0xffead0,2.1);
  sunlight.position.set(-500,800,-360);
  scene.add(sunlight);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.97;
  const sky=document.createElement('canvas');sky.width=512;sky.height=256;
  const skyInk=sky.getContext('2d'),skyFade=skyInk.createLinearGradient(0,0,0,256);
  skyFade.addColorStop(0,'#6d9ec4');skyFade.addColorStop(.48,'#d5e2df');skyFade.addColorStop(.55,'#8a8e79');skyFade.addColorStop(1,'#4b5e51');
  skyInk.fillStyle=skyFade;skyInk.fillRect(0,0,512,256);
  const environment=new THREE.CanvasTexture(sky);environment.mapping=THREE.EquirectangularReflectionMapping;
  scene.environment=environment;

  function material(color){return new THREE.MeshStandardMaterial({color,roughness:.86});}
  function box(parent,mat,w,h,d,x,y,z){
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);
    parent.add(mesh);
    return mesh;
  }
  function terrainHeight(x,z){
    const natural=regionalHeight(x,z);
    for(const airport of airports){
      const half=airport.length/2;
      if(Math.abs(x-airport.x)>half+950||Math.abs(z-airport.z)>half+950) continue;
      const {along,cross}=runwayCoordinates(x,z,airport);
      // Clear a terrain-grid cell around paved surfaces so coarse triangles
      // cannot bury a flat runway threshold or the edge of the apron.
      const apronLimit=Math.sign(airport.apron)*cross>0?Math.abs(airport.apron)+135:airport.width/2+9;
      const edge=Math.max(Math.abs(along)-half-355,Math.abs(cross)-apronLimit-355);
      const blend=1-clamp(edge/185,0,1);
      if(blend>0) return natural+(airport.elevation-natural)*blend;
    }
    return natural;
  }
  const treeCover=createTreeCover(worldCoverTrees);
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = 1024;
  const paint = atlas.getContext('2d');
  paint.fillStyle = '#7b856b';
  paint.fillRect(0,0,1024,1024);
  for(let scale=128;scale>=2;scale/=2){
    for(let y=0;y<1024;y+=scale)for(let x=0;x<1024;x+=scale){
      const shade=80+Math.floor(random()*80);
      paint.fillStyle='rgba('+shade+','+(shade+10)+','+(shade-12)+','+(scale>16?.08:.035)+')';
      paint.fillRect(x,y,scale,scale);
    }
  }
  const landTexture = new THREE.CanvasTexture(atlas);
  landTexture.colorSpace = THREE.SRGBColorSpace;
  landTexture.wrapS = landTexture.wrapT = THREE.RepeatWrapping;
  landTexture.repeat.set(18,45);
  landTexture.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const terrainMaterial=new THREE.MeshStandardMaterial({map:landTexture,roughness:1,vertexColors:true});
  const terrainChunks=new Map();
  const span=11520;
  let previousChunk='',terrainQueue=[];
  function updateTerrain(x,z){
    const cx=Math.floor(x/span),cz=Math.floor(z/span),id=cx+':'+cz;
    if(id!==previousChunk){
      previousChunk=id;
      const visible=new Set();
      terrainQueue=[];
      for(let row=cz-3;row<=cz+3;row++){
        for(let col=cx-3;col<=cx+3;col++){
          const key=col+':'+row;
          visible.add(key);
          if(!terrainChunks.has(key)) terrainQueue.push({col,row,key,distance:(cx-col)**2+(cz-row)**2});
        }
      }
      terrainQueue.sort((a,b)=>a.distance-b.distance);
      for(const [key,patch] of terrainChunks){
        if(visible.has(key)) continue;
        scene.remove(patch);
        patch.geometry.dispose();
        terrainChunks.delete(key);
      }
    }
    // Build the nearest patches first without generating a whole region in one frame.
    const deadline=performance.now()+3;
    for(let count=0;terrainQueue.length&&(count===0||count<3&&performance.now()<deadline);count++){
      const {col,row,key}=terrainQueue.shift();
        const mesh=new THREE.PlaneGeometry(span,span,48,48);
        mesh.rotateX(-Math.PI/2);
        const px=(col+.5)*span,pz=(row+.5)*span;
        const pos=mesh.attributes.position;
        const rgb=[];
        for(let i=0;i<pos.count;i++){
          const height=terrainHeight(px+pos.getX(i),pz+pos.getZ(i));
          pos.setY(i,height-.14);
          const forest=height>=1.5&&height<=3500?(treeCover(px+pos.getX(i),pz+pos.getZ(i))||0):0;
          if(height<.7) rgb.push(.17,.42,.83);
          else if(forest>.08) rgb.push(.76-.44*forest,.90-.45*forest,.76-.47*forest);
          else if(height>1000) rgb.push(.71,.77,.72);
          else{
            const worldX=px+pos.getX(i),worldZ=pz+pos.getZ(i);
            const urban=height<160&&worldX>-9000&&worldX<11000&&worldZ>-4500&&worldZ<9500;
            if(urban)rgb.push(.68,.72,.72);else rgb.push(.78,.92,.77);
          }
        }
        mesh.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
        mesh.computeVertexNormals();
        const patch=new THREE.Mesh(mesh,terrainMaterial);
        patch.position.set(px,0,pz);
        terrainChunks.set(key,patch);
        scene.add(patch);
    }
  }
  landTexture.repeat.set(9,9);
  const asphalt = material('#41464b'), concrete = material('#898d8c'), white = material('#f6f6e8');
  function pavementTexture(concreteSurface){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=concreteSurface?'#93968f':'#51565a';ctx.fillRect(0,0,512,512);
    for(let i=0;i<17000;i++){
      const v=concreteSurface?130+Math.floor(random()*40):65+Math.floor(random()*29);
      ctx.fillStyle='rgba('+v+','+v+','+v+',.36)';ctx.fillRect(random()*512,random()*512,1+random()*2,1);
    }
    ctx.strokeStyle=concreteSurface?'#5d635d55':'#343b3e66';ctx.lineWidth=1;
    for(let x=0;x<=512;x+=128){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}
    for(let y=0;y<=512;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
    ctx.fillStyle='#20282c16';for(let i=0;i<16;i++)ctx.fillRect(170+random()*160,random()*512,2,25+random()*70);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(concreteSurface?3:2,concreteSurface?3:30);
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
  }
  asphalt.map=pavementTexture(false);concrete.map=pavementTexture(true);
  asphalt.color.set('#d3d7d7');concrete.color.set('#d4d6d1');
  const glass = material('#53758b'), roof = material('#a4afac');
  const airportGroups=[],jetwayWalls=new Map();
  const jetwayPaint=material('#b4c0c7'), jetwayDark=material('#36464d');
  const jetwayGlass=new THREE.MeshStandardMaterial({color:0x527f99,roughness:.25,transparent:true,opacity:.37,depthWrite:false});
  function makeJetway(){
    const root=new THREE.Group(), tunnel=new THREE.Group();
    root.add(tunnel);
    box(tunnel,jetwayPaint,3.3,.22,1,0,-.13,0);
    box(tunnel,jetwayPaint,3.45,.21,1,0,2.48,0);
    for(const side of [-1,1]){
      box(tunnel,jetwayPaint,.11,.73,1,side*1.61,.36,0);
      box(tunnel,jetwayGlass,.12,1.42,1,side*1.62,1.45,0);
      box(tunnel,jetwayPaint,.14,.21,1,side*1.62,2.24,0);
      for(let i=-3;i<=3;i++) box(tunnel,jetwayPaint,.15,1.62,.011,side*1.63,1.48,i/7);
    }
    const cabin=new THREE.Group();root.add(cabin);
    box(cabin,jetwayPaint,3.50,.23,2.25,0,-.12,0);
    box(cabin,jetwayPaint,3.50,.22,2.25,0,2.45,0);
    for(const side of [-1,1]){
      box(cabin,jetwayGlass,.13,1.65,2.25,side*1.69,1.36,0);
      box(cabin,jetwayPaint,.15,.56,2.25,side*1.69,.28,0);
      box(cabin,jetwayDark,.34,2.38,.15,side*1.36,1.18,1.15);
    }
    const support=new THREE.Group();root.add(support);
    box(support,jetwayPaint,.61,1,.63,-.84,-.5,0);
    box(support,jetwayPaint,.61,1,.63,.84,-.5,0);
    box(support,jetwayDark,2.39,.16,1,0,-.91,0);
    return {root,tunnel,cabin,support};
  }
  function placeJetway(model,terminal,door,ground){
    const length=terminal.distanceTo(door);
    model.root.position.copy(terminal);
    model.root.lookAt(door);
    model.tunnel.scale.z=Math.max(.5,length-1.6);
    model.tunnel.position.z=(length-1.6)/2;
    model.cabin.position.z=length-1.2;
    model.support.position.z=length*.72;
    model.support.scale.y=Math.max(.5,(terminal.y+door.y)/2-ground);
  }
  function labelTexture(label,foreground,background){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
    const ink=canvas.getContext('2d');
    if(background){ink.fillStyle=background;ink.fillRect(0,0,256,128);}
    ink.font='900 '+(label.length<4?102:70)+'px Arial, sans-serif';
    ink.textAlign='center';ink.textBaseline='middle';ink.fillStyle=foreground;
    ink.fillText(label,128,68,244);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
  }
  function airportSign(group,label,x,z,w,h,color='#651b1b'){
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({
      map:labelTexture(label,'#ffffff',color),side:THREE.DoubleSide
    }));
    sign.position.set(x,h/2+.36,z);
    sign.rotation.y=Math.PI/2;
    group.add(sign);
    box(group,roof,.44,.36,w,x,.18,z);
  }

  const lampMaterial=new THREE.MeshBasicMaterial({color:0xd7eaff});
  for(const airport of airports){
    const half=airport.length/2, width=airport.width, apron=airport.apron, sideOfApron=Math.sign(apron);
    const large=['RCTP','RJAA','RCKH'].includes(airport.code);
    const gates=large?7:['RCSS','RCMQ'].includes(airport.code)?5:3;
    const gatePitch=large?73:51, apronLength=gates*gatePitch+80;
    const terminalX=apron+sideOfApron*(large?112:88);
    const terminalWidth=large?59:40;
    const gateWall=terminalX-sideOfApron*terminalWidth/2;
    jetwayWalls.set(airport.code,gateWall);
    const group = new THREE.Group();
    group.position.set(airport.x,airport.elevation,airport.z);
    group.rotation.y = -airport.heading;
    scene.add(group);
    airportGroups.push({group,airport});
    box(group,concrete,width+15,.08,airport.length+28,0,-.008,0);
    box(group,asphalt,width,.12,airport.length,0,0,0);
    box(group,concrete,24,.10,airport.length-180,apron,0,0);
    box(group,concrete,large?150:113,.11,apronLength,apron+sideOfApron*30,0,-65);
    const lane=material('#dbad49');
    box(group,lane,.26,.03,airport.length-190,apron,.07,0);
    for(const z of [half-135,-440,-950]){
      box(group,concrete,Math.abs(apron),.10,18,apron/2,0,z);
      box(group,lane,Math.abs(apron)-width/2,.025,.42,apron/2+sideOfApron*width/4,.07,z);
      const hold=sideOfApron*(width/2+32);
      for(let i=0;i<4;i++){
        if(i<2) box(group,lane,.34,.025,14,hold+i*.78*sideOfApron,.081,z);
        else for(let m=-6;m<=6;m+=2) box(group,lane,.34,.025,1.12,hold+i*.78*sideOfApron,.081,z+m);
      }
      airportSign(group,airport.designator+'-'+airport.reciprocal,hold+sideOfApron*6,z-12,8,1.40);
    }
    for(const side of [-1,1]){
      box(group,white,1.05,.035,airport.length-38,side*(width/2-2),.08,0);
      for(const end of [-1,1]){
        box(group,white,Math.min(8,width*.13),.035,48,side*width*.22,.086,end*(half-315));
        for(const distance of [200,430,520]){
          box(group,white,1.9,.035,21,side*width*.25,.086,end*(half-distance));
          if(distance===200) box(group,white,1.9,.035,21,side*width*.33,.086,end*(half-distance));
        }
      }
      for(let i=0;i<(width<50?6:8);i++){
        for(const end of [-1,1]) box(group,white,1.55,.03,30,side*(2.6+i*width/21),.085,end*(half-40));
      }
      for(let z=-half+38;z<half;z+=60) box(group,lampMaterial,.31,.13,.31,side*(width/2+.45),.09,z);
    }
    for(let z=-half+160;z<half-155;z+=65) box(group,white,1.18,.035,34,0,.08,z);
    for(const [direction,text] of [[1,airport.designator],[-1,airport.reciprocal]]){
      const marking=new THREE.Mesh(new THREE.PlaneGeometry(width*.67,24),new THREE.MeshBasicMaterial({
        map:labelTexture(text,'#ffffff'),transparent:true,depthWrite:false
      }));
      marking.rotation.x=-Math.PI/2;
      if(direction<0) marking.rotateZ(Math.PI);
      marking.position.set(0,.11,direction*(half-106));
      group.add(marking);
      const edge=new THREE.MeshBasicMaterial({color:direction===1?0x6dffc0:0xf66c62});
      for(let x=-width/2;x<=width/2;x+=4) box(group,edge,.29,.15,.35,x,.105,direction*(half-10));
    }
    const buildingLength=gates*gatePitch+25;
    const height=large?15:10;
    box(group,roof,terminalWidth,height,buildingLength,terminalX,height/2,-65);
    box(group,glass,terminalWidth+.12,height*.44,buildingLength-3,terminalX,height*.55,-65);
    box(group,roof,terminalWidth+5,.86,buildingLength+4,terminalX,height+.35,-65);
    for(let gate=0;gate<gates;gate++){
      const z=-65+(gate-Math.floor(gates/2))*gatePitch;
      box(group,roof,9,.34,gatePitch*.76,gateWall-sideOfApron*4,height*.69,z);
      for(let offset=-18;offset<=18;offset+=6) box(group,roof,.27,height*.52,.29,gateWall-sideOfApron*.18,height*.53,z+offset);
      box(group,lane,large?29:21,.029,.33,apron+sideOfApron*26,.091,z);
      box(group,lane,.35,.029,5,apron+sideOfApron*17,.091,z);
      airportSign(group,'G'+String(gate+1).padStart(2,'0'),gateWall-sideOfApron*2,z+9,3.8,1.12,'#15354b');
      if(gate!==Math.floor(gates/2)){
        const fixed=makeJetway();
        placeJetway(fixed,new THREE.Vector3(gateWall,4.5,z-7),new THREE.Vector3(gateWall-sideOfApron*23,3.7,z+3),0);
        group.add(fixed.root);
      }
    }
    const towerZ=-65-buildingLength/2-56;
    const towerHeight=large?38:28;
    box(group,roof,8,towerHeight,8,terminalX+sideOfApron*15,towerHeight/2,towerZ);
    box(group,glass,14,6,14,terminalX+sideOfApron*15,towerHeight+3,towerZ);
    box(group,roof,15.5,.92,15.5,terminalX+sideOfApron*15,towerHeight+6.2,towerZ);
    const terminalLabel=new THREE.Mesh(new THREE.PlaneGeometry(22,6),new THREE.MeshBasicMaterial({
      map:labelTexture(airport.code,'#ffffff','#15354b'),side:THREE.DoubleSide
    }));
    terminalLabel.rotation.y=-sideOfApron*Math.PI/2;
    terminalLabel.position.set(gateWall-sideOfApron*.15,height*.78,-65);
    group.add(terminalLabel);
    const byMaterial=new Map();
    for(const child of group.children){
      if(child.geometry?.type!=='BoxGeometry') continue;
      const batch=byMaterial.get(child.material)||[];
      batch.push(child);byMaterial.set(child.material,batch);
    }
    const transform=new THREE.Object3D();
    for(const [mat,batch] of byMaterial){
      const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(),mat,batch.length);
      batch.forEach((mesh,i)=>{
        const {width,height,depth}=mesh.geometry.parameters;
        transform.position.copy(mesh.position);
        transform.scale.set(width,height,depth);
        transform.updateMatrix();
        instances.setMatrixAt(i,transform.matrix);
        group.remove(mesh);
        mesh.geometry.dispose();
      });
      group.add(instances);
    }

  }
  const buildingGeo = new THREE.BoxGeometry();
  const blocks = new THREE.InstancedMesh(buildingGeo,material('#ffffff'),2100);
  const dummy = new THREE.Object3D();
  for(let i=0;i<blocks.count;i++){
    const a=airports[0], side=i%2===0 ? -1 : 1;
    const x=a.x+side*(450+random()*5200), z=a.z+(random()-.5)*9500;
    const width=12+random()*47, height=5+random()*26;
    const {along,cross}=localRunway(x,z);
    const nearRunway=Math.abs(along)<1660 && Math.abs(cross)<375;
    dummy.position.set(x,nearRunway ? -80 : terrainHeight(x,z)+height/2,z);
    if(terrainHeight(x,z)<.5) dummy.position.y=-80;
    dummy.scale.set(width,height,width*(.5+random()));
    dummy.updateMatrix();
    blocks.setMatrixAt(i,dummy.matrix);
    blocks.setColorAt(i,new THREE.Color().setHSL(.11+random()*.52,.09,.36+random()*.39));
  }
  function renderedGround(x,z){
    const step=240,cx=Math.floor(x/step)*step,cz=Math.floor(z/step)*step;
    const u=(x-cx)/step,v=(z-cz)/step;
    const a=terrainHeight(cx,cz),b=terrainHeight(cx+step,cz),c=terrainHeight(cx,cz+step),d=terrainHeight(cx+step,cz+step);
    return (u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u))-.14;
  }
  const taipeiVisuals=buildTaipeiVisuals(scene,renderedGround);
  const regionalScenery=buildRegionalScenery(scene,renderedGround,airports,taiwanHighways,airportCityVolumes,taipeiData.bounds);
  const vegetation=buildVegetation(scene,renderedGround,airports,taipeiData,treeCover,taiwanHighways);

  const atmosphericSky=createAtmosphericSky(scene);

  const fuselage = material('#e9eef2'), trim = material('#185378'), windowMat=material('#192b39');
  function makeAircraft(profile,index){
    const [length,radius,span,wingHeight,count,sweep]=profile.geometry;
    const group=new THREE.Group(), gear=new THREE.Group(), blades=[], surfaces=[], navLights=[];
    const accent=material(['#185378','#9f5433','#16817b','#6a4b9b','#88404b','#354d66'][index]);
    const body=new THREE.Mesh(new THREE.SphereGeometry(1,26,16),fuselage);
    body.scale.set(radius,radius*.96,length);
    group.add(body,gear);
    const glass=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),windowMat);
    glass.position.set(0,radius*.63,-length*.37);
    glass.scale.set(radius*.92,radius*.59,length*.23);
    group.add(glass);
    for(let i=0;i<(profile.jet?6:2);i++){
      for(const side of [-1,1]) box(group,windowMat,.07,radius*.34,length*.10,side*radius*.93,radius*.20,-length*.13+i*length*.13);
    }
    function wing(side,width,rootZ,tipZ,chord,tipChord,y){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute([0,y,rootZ,side*width,y+.20,tipZ,side*width,y+.20,tipZ+tipChord,0,y,rootZ+chord],3));
      geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();
      const mat=fuselage.clone();mat.side=THREE.DoubleSide;
      group.add(new THREE.Mesh(geo,mat));
    }
    for(const side of [-1,1]){
      wing(side,span,-length*.44,-length*.4+sweep,length*.57,length*.14,wingHeight);
      wing(side,span*.34,length*.62,length*.69,length*.27,length*.14,profile.jet?radius*1.6:radius*.23);
      const hinge=new THREE.Group();
      hinge.position.set(side*span*.55,wingHeight,length*.13+sweep*.55);
      box(hinge,accent,span*.42,.07,length*.15,0,0,length*.072);
      group.add(hinge);surfaces.push(hinge);
      box(gear,windowMat,.34,.59,.57,side*span*.23,-profile.gearHeight+.27,length*.12);
      navLights.push(box(group,new THREE.MeshBasicMaterial({color:side<0?0xdc3934:0x35dba0}),.17,.13,.19,side*span,.18+wingHeight,sweep-length*.30));
    }
    const tail=new THREE.Shape();
    tail.moveTo(0,0);tail.lineTo(length*.43,0);tail.lineTo(length*.32,radius*2.2);tail.lineTo(length*.18,radius*2.2);tail.closePath();
    const fin=new THREE.Mesh(new THREE.ExtrudeGeometry(tail,{depth:.14,bevelEnabled:false}),accent);
    fin.rotation.y=-Math.PI/2;fin.position.set(0,radius*.34,length*.56);group.add(fin);
    box(gear,windowMat,.28,.48,.50,0,-profile.gearHeight+.25,-length*.55);
    for(let i=0;i<count;i++){
      const x=count===1?0:(i===0?-1:1)*span*(profile.jet?.23:.36);
      const z=profile.jet?length*.53:count===1?-length*.98:-length*.33;
      if(count===2){
        const engine=new THREE.Mesh(new THREE.CylinderGeometry(radius*.48,radius*.60,length*.40,14),accent);
        engine.rotation.x=Math.PI/2;engine.position.set(x,profile.jet?.28:wingHeight,z+length*.12);group.add(engine);
      }
      if(!profile.jet){
        const blade=box(group,windowMat,span*.43,.095,.11,x,count===1?0:wingHeight,z);
        blades.push(blade);
      }
    }
    group.userData={gear,blades,surfaces,navLights};
    scene.add(group);
    return group;
  }
  const models=fleet.map((m,i)=>m.role?buildBenchmarkAirframe(m,scene):makeAircraft(m,i));
  const airlinerDetails={
    sa380:refineAirliner(models[fleet.findIndex(m=>m.id==='sa380')]),
    b773:refineAirliner(models[fleet.findIndex(m=>m.id==='b773')],{twin:true})
  };
  const raycaster=new THREE.Raycaster();
  addEventListener('click',event=>{
    if(event.target.closest('button,input,select,textarea,details,a'))return;
    if(!flight||!airlinerDetails[flight.aircraft.id]||cameraMode!==1||flight.cabinView||replay)return;
    const mouse=new THREE.Vector2(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2);
    raycaster.setFromCamera(mouse,camera);
    const hit=raycaster.intersectObjects(airlinerDetails[flight.aircraft.id].switches)[0];
    if(!hit)return;
    const label=hit.object.userData.action;
    for(const button of byId('switches').children)if(button.textContent===label){button.click();break;}
  });
  const landmark = material('#698c91');
  const towerX=(121.5645-runway10.lon)*111319.49*Math.cos(runway10.lat*rad);
  const towerZ=(runway10.lat-25.03396)*110772;
  const towerBase=terrainHeight(towerX,towerZ);
  for(let section=0;section<8;section++){
    box(scene,landmark,59-section*3,54,59-section*3,towerX,towerBase+27+section*54,towerZ);
  }
  box(scene,landmark,8,76,8,towerX,towerBase+470,towerZ);

  let inspectionMode=false;
  let flight=null, cameraMode=0, last=performance.now(), accumulator=0, paused=false;
  let nextNavDraw=0;
  let savedControls={};
  try{savedControls=JSON.parse(localStorage.getItem('skybound.controls.v2')||'{}')||{};}catch{}
  let settings=upgradeControls(savedControls);
  const persistControls=()=>{
    try{localStorage.setItem('skybound.controls.v2',JSON.stringify(settings));}catch{}
  };
  function showControlDirections(){
    byId('gainValue').textContent=Math.round(settings.sensitivity*100)+'%';
    const pitch=settings.invert?'↑ 壓低 · ↓ 拉升':'↑ 拉升 · ↓ 壓低';
    const roll='← 左轉 · → 右轉';
    byId('controlDirections').textContent=pitch+' · '+roll;
    byId('quickControls').querySelector('summary').textContent='操控設定 · '+Math.round(settings.sensitivity*100)+'%';
  }
  persistControls();showControlDirections();
  for(const [name,value] of Object.entries(settings)){
    const input=byId(name);
    if(!input) continue;
    if(typeof value==='boolean') input.checked=value;else input.value=value;
    input.onchange=()=>{
      settings[name]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
      persistControls();showControlDirections();input.blur();
    };
  }
  byId('sensitivity').oninput=()=>{
    settings.sensitivity=Number(byId('sensitivity').value);
    persistControls();showControlDirections();
  };
  byId('resetControls').onclick=()=>{
    settings={...settings,...defaultControls};
    for(const [name,value] of Object.entries(defaultControls)){
      const field=byId(name);
      if(!field) continue;
      if(typeof value==='boolean') field.checked=value;else field.value=value;
    }
    if(flight) flight.manualControls={pitch:0,roll:0,rudder:0};
    persistControls();showControlDirections();
    byId('resetControls').blur();
  };
  const legacyRoute=[worldRunway(2400,0),worldRunway(2700,2100),worldRunway(-3600,2100),worldRunway(-4000,0),worldRunway(-900,0)];
  const keys=new Set(), pointer={x:0,y:0,active:false};
  const cockpitView={preset:0,yaw:0,pitch:0,zoom:0,drag:null};
  const cockpitEye=new THREE.Vector3(), cockpitAim=new THREE.Vector3();
  const cockpitOrientation=new THREE.Quaternion(), lookRotation=new THREE.Quaternion();
  const cockpitAngles=new THREE.Euler(0,0,0,'YXZ');
  const cockpitActive=()=>Boolean(flight&&cameraMode===1&&!flight.cabinView);
  const twoSeats=profile=>['passenger','cargo'].includes(profile?.role);
  function resetLook(){
    Object.assign(cockpitView,{yaw:0,pitch:0,zoom:0,drag:null});
  }
  function cycleCockpitView(){
    if(!cockpitActive()) return;
    cockpitView.preset=(cockpitView.preset+1)%(twoSeats(flight.aircraft)?3:2);
    resetLook();
    changeView();
  }
  const controls=new Set(['KeyW','KeyS','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyC','KeyF','KeyR','KeyQ','KeyE','KeyX','KeyZ','KeyP','KeyB','KeyI','KeyL','KeyG','KeyV','KeyN','Home','KeyJ','KeyM']);
  const radar=byId('radar').getContext('2d');
  const planMap=byId('planMap').getContext('2d');
  const hangarPreview=byId('hangarPreview').getContext('2d');
  const switches=byId('switches');
  const special=byId('special');
  let voyageFrames=[], replay=null;
  const replaySeek=byId('replaySeek');
  const replayControls=byId('replayControls');
  function updateReplayButton(){byId('playVoyage').hidden=!loadVoyage();}
  byId('replaySeek').oninput=()=>{
    if(!replay) return;
    replay.time=Number(replaySeek.value);
    trail.length=0;
  };
  byId('replayToggle').onclick=()=>{
    if(!replay) return;
    if(replay.time>=replay.duration) replay.time=0;
    replay.paused=!replay.paused;
    showTouchPause(replay.paused);
    byId('replayToggle').textContent=replay.paused?'播放回放':'暫停回放';
  };
  byId('replayRate').onclick=()=>{
    if(!replay) return;
    replay.rate=replay.rate===60?12:replay.rate===12?1:60;
    byId('replayRate').textContent='倍率 '+replay.rate+'×';
  };
  byId('playVoyage').onclick=()=>{
    const data=loadVoyage();
    if(!data) return;
    byId('aircraft').value='sf748';
    byId('lesson').value='naritaCargo';
    byId('time').value=data.time||'21:00';
    flight=makeCargoVoyage(airports.find(a=>a.code==='RCTP'),selectedAircraft(),data.node||'load',data.wind||0);
    replay={...data,time:0,duration:data.frames.at(-1)[0],rate:60,paused:false};
    beginFlight();
    replaySeek.max=replay.duration;replaySeek.value=0;
    byId('replayToggle').textContent='暫停回放';
    byId('replayRate').textContent='倍率 60×';
    replayControls.hidden=false;
    for(const control of [...switches.children,...special.querySelectorAll('input')]) control.disabled=true;
  };
  const flightAudio=makeFlightAudio();
  let audioEnabled=false, previousTouchdown=null;
  byId('sound').onclick=()=>{
    audioEnabled=!audioEnabled;
    if(audioEnabled) flightAudio.start();
    byId('sound').setAttribute('aria-pressed',String(audioEnabled));
    byId('sound').textContent=audioEnabled?'關閉音效':'音效';
    byId('sound').blur();
  };
  const statLabels=['IAS kt','高度 FT','升降 FT/M','航向','功率','襟翼／配平','地速 GS kt','真空速 TAS kt','Mach'];
  byId('stats').insertAdjacentHTML('afterbegin',statLabels.map(label=>'<div class="stat"><small>'+label+'</small><b></b></div>').join(''));
  const statValues=Array.from(byId('stats').querySelectorAll('b'));
  const labelAirport=r=>r.code+' '+r.name+' · '+r.designator;
  for(const r of airports){
    byId('departure').add(new Option(labelAirport(r),r.code));
    byId('destination').add(new Option(labelAirport(r),r.code));
  }
  byId('destination').value='RCYU';
  for(const m of fleet) byId('aircraft').add(new Option(m.name,m.id));
  const selectedAircraft=()=>fleet.find(m=>m.id===byId('aircraft').value);
  const selectedAirport=name=>airports.find(r=>r.code===byId(name).value);
  function parsePlan(){
    const departure=selectedAirport('departure'), destination=selectedAirport('destination');
    const auto=regionalRoute(departure,destination);
    const lines=byId('waypoints').value.trim().split(/\r?\n/).filter(Boolean);
    const route=lines.length?lines.map((line,i)=>{
      const match=line.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
      if(!match) throw new Error('航點 '+(i+1)+' 請輸入「緯度,經度」。');
      const lat=Number(match[1]), lon=Number(match[2]);
      const point=geoPoint(lat,lon);
      if(lat<21.9||lat>25.4||lon<119.1||lon>122.10||point.z>326000) throw new Error('航點 '+(i+1)+' 超出離線區域。');
      return {name:'自訂航點 '+(i+1),...point};
    }).concat(auto.slice(-2)):auto;
    return {departure,destination,route};
  }
  function mapPath(context,points,project,color){
    context.strokeStyle=color;
    context.lineWidth=2;
    context.beginPath();
    points.forEach((point,i)=>i===0?context.moveTo(...project(point)):context.lineTo(...project(point)));
    context.stroke();
  }
  const airlineRoute=()=>{
    const to=byId('airlineRoute').value;
    const from=['RCQC','RCBS'].includes(to)?'RCSS':'RCTP';
    return [from,to].map(code=>airports.find(a=>a.code===code));
  };
  const compatibleAirline=(plane,from,to)=>plane.role==='passenger'&&
    (plane.regionalGates||[from,to].every(airport=>airport.length>=3000&&airport.width>=55));
  let lastBriefPlane;
  let hangarLiveries={};
  function updateHangar(){
    const career=readCareer(),aircraft=selectedAircraft();
    hangarLiveries=career.liveries??{};
    const available=Boolean(aircraft.role),owned=career.owned?.[aircraft.id];
    byId('hangarShop').hidden=!available;
    byId('buyLivery').disabled=Boolean(hangarLiveries[aircraft.id]);
    byId('buyPlane').disabled=!hangarPrices[aircraft.id]||Boolean(owned);
    byId('shopInfo').textContent='海灣青塗裝 '+(hangarLiveries[aircraft.id]?'已購買':liveryPrice.toLocaleString()+' 金幣')+
      (hangarPrices[aircraft.id]?' · '+(owned?'已擁有':'買機 '+hangarPrices[aircraft.id].toLocaleString()+' 金幣 · 未購買時每個載客航班租金 4,500'):'');
    const quote=maintenanceQuote(career,aircraft);
    const maintenance=byId('servicePlane');
    maintenance.hidden=byId('maintenanceInfo').hidden=!quote.owned;
    maintenance.disabled=quote.busy||!quote.cost||career.money<quote.cost;
    maintenance.textContent='維修至 100% · '+quote.cost.toLocaleString()+' 金幣';
    byId('maintenanceInfo').textContent='機況 '+quote.condition+'%'+(quote.busy?' · 航班進行中':
      quote.condition<minimumDispatchCondition?' · 需維修後才能接定期航班':' · 可執飛定期航班');
  }
  for(const [id,item] of [['buyLivery','livery'],['buyPlane','plane']]){
    byId(id).onclick=()=>{
      const ok=purchaseHangar(selectedAircraft(),item);
      byId('shopMessage').textContent=ok?'已購買':'餘額不足或無法儲存';
      updateAirlinePlan();
    };
  }
  byId('servicePlane').onclick=()=>{
    const ok=serviceHangar(selectedAircraft());
    byId('shopMessage').textContent=ok?'維修完成，機況已恢復至 100%':'目前無法維修';
    updateAirlinePlan();
  };
  function updateAirlinePlan(){
    updateHangar();
    const active=byId('lesson').value==='airline';
    byId('airlinePlan').hidden=!active;
    const career=readCareer();
    byId('wallet').textContent='遊戲金幣 '+career.money.toLocaleString()+' · 存在目前瀏覽器';
    const passengers=passengerCheckpoints(career);
    const missions=missionCheckpoints();
    function fillSaved(select,flights,id){
      const previous=select.value;
      select.replaceChildren(...flights.map(f=>new Option(
        f.aircraft.name+' · '+f.departure.code+' → '+f.destination.code+' · '+Math.floor(f.elapsed/60)+' 分',id(f))));
      if([...select.options].some(option=>option.value===previous)) select.value=previous;
      select.hidden=flights.length===0;
    }
    fillSaved(byId('savedAirline'),passengers,f=>f.service.id);
    fillSaved(byId('savedMission'),missions.map(checkpoint=>checkpoint.flight),f=>f.checkpointId);
    byId('resumeAirline').hidden=!passengers.length;
    byId('resumeMission').hidden=byId('discardMission').hidden=!missions.length;
    if(!active) return;
    const aircraft=selectedAircraft();
    const field=byId('airlineFuel');
    const [from,to]=airlineRoute();
    if(!compatibleAirline(aircraft,from,to)){
      byId('passengerBrief').textContent='請選擇適合此跑道和機位的客機。離島航線建議 A220-300。';
      byId('fuelPreview').textContent='';
      field.disabled=true;
      return;
    }
    const quote=maintenanceQuote(career,aircraft);
    if(quote.owned&&quote.condition<minimumDispatchCondition){
      byId('passengerBrief').textContent='自有客機機況 '+quote.condition+'%，請先在機庫工坊維修。';
      byId('fuelPreview').textContent='';
      field.disabled=true;
      return;
    }
    const brief=passengerBrief(aircraft,from,to);
    field.disabled=false;
    field.min=brief.estimated+brief.reserve;field.max=brief.capacity;
    const briefKey=aircraft.id+to.code;
    if(lastBriefPlane!==briefKey||!field.value) field.value=Math.min(Number(field.min),Number(field.max));
    lastBriefPlane=briefKey;
    const fuel=Number(field.value);
    const weight=aircraft.mass+fuel-brief.capacity;
    byId('passengerBrief').textContent=from.name+' → '+to.name+' · '+brief.distance.toFixed(0)+' NM · 班表 '+brief.schedule+
      ' 分鐘 · '+byId('weather').selectedOptions[0].text+' · '+brief.passengers+' 人／'+brief.passengers+' 座 · 行李 '+
      (brief.passengers*15).toLocaleString()+' kg · 基本報酬 '+brief.base.toLocaleString()+' 金幣';
    byId('fuelPreview').textContent='預估航程耗油 '+brief.estimated+' kg · 備降及備用 '+brief.reserve+
      ' kg · 估計起飛重量 '+weight.toLocaleString()+' kg · 估計可用 '+Math.round(60*fuel/brief.hourlyFuel)+
      ' 分鐘 · 估計用油費 '+Math.round(brief.estimated*.8).toLocaleString()+' 金幣';
  }
  byId('airlineFuel').oninput=updateAirlinePlan;
  byId('airlineRoute').onchange=drawPlan;
  byId('weather').addEventListener('change',updateAirlinePlan);
  byId('quickAirline').onclick=()=>{
    byId('aircraft').value='a320neo';
    byId('lesson').value='airline';
    byId('airlineRoute').value='RCKH';
    drawPlan();
    byId('fly').focus();
  };
  byId('resumeAirline').onclick=()=>{
    const saved=passengerCheckpoints().find(f=>f.service.id===byId('savedAirline').value);
    if(!saved) return;
    const aircraft=fleet.find(a=>a.id===saved.aircraft.id);
    if(!aircraft){byId('message').textContent='此存檔的機型目前無法載入。';return;}
    saved.aircraft=aircraft;
    byId('aircraft').value=aircraft.id;byId('lesson').value='airline';
    byId('weather').value=saved.service.weather;byId('time').value=saved.service.time;
    flight=saved;
    beginFlight();
  };
  byId('resumeMission').onclick=()=>{
    const checkpoint=readMissionCheckpoint(byId('savedMission').value);
    if(!checkpoint) return;
    const {flight:saved,options,frames}=checkpoint;
    const aircraft=fleet.find(a=>a.id===saved.aircraft.id);
    if(!aircraft){byId('message').textContent='此存檔的機型目前無法載入。';return;}
    saved.aircraft=aircraft;
    byId('aircraft').value=aircraft.id;
    byId('lesson').value=options.lesson;
    byId('weather').value=options.weather;
    byId('time').value=options.time;
    if(saved.voyage){
      byId('voyageNode').value=saved.node;
      byId('voyageRate').value=options.rate;
      byId('voyageGuided').checked=options.guided;
    }
    byId('cruiseWind').value=options.cruiseWind;
    replay=null;
    replayControls.hidden=true;
    voyageFrames=saved.voyage?frames:[];
    flight=saved;
    beginFlight();
    cameraMode=options.camera===1?1:0;
    const savedView=options.cockpitView;
    if(savedView){
      cockpitView.preset=clamp(Math.trunc(savedView.preset)||0,0,twoSeats(aircraft)?2:1);
      cockpitView.yaw=clamp(Number(savedView.yaw)||0,-100*rad,100*rad);
      cockpitView.pitch=clamp(Number(savedView.pitch)||0,-58*rad,48*rad);
      cockpitView.zoom=clamp(Number(savedView.zoom)||0,-14,22);
    }
    changeView();
    paused=true;
    nextCheckpoint=performance.now()+15000;
  };
  byId('discardMission').onclick=()=>{
    const checkpoint=readMissionCheckpoint(byId('savedMission').value);
    if(!checkpoint||!confirm('刪除尚未完成的任務進度與其未完成的回放？')) return;
    if(clearMissionCheckpoint(checkpoint.flight.checkpointId)) drawPlan();
  };
  function drawPlan(){
    updateAirlinePlan();
    const isTactical=byId('lesson').value==='tactical';
    byId('tacticalSetup').hidden=!isTactical;
    if(isTactical) byId('aircraft').value='sf16';
    const isVoyage=byId('lesson').value==='naritaCargo';
    const isClimb=byId('lesson').value==='climbLesson';
    const isCruise=isClimb||byId('lesson').value==='cruiseTrial';
    byId('cruiseWeather').hidden=!isCruise;
    byId('voyageOptions').hidden=!isVoyage;
    const model=selectedAircraft();
    byId('aircraftInfo').textContent=model.type+' · 起飛 '+model.rotation+' KTS · 進場 '+model.approach+' KTS'+(model.sideCargo?' · 側門貨運 · 高雄至桃園':model.role?' · '+benchmarkMissions[model.role].label:'');
    try{
      const rangeLesson=byId('lesson').value==='range';
      const contract=regionalContracts[byId('lesson').value];
      let {departure,destination,route}=contract?regionalContractPlan(byId('lesson').value):parsePlan();
      const mission=byId('lesson').value==='benchmark'?benchmarkMissions[model.role]:null;
      if(isTactical){
        departure=destination=airports.find(a=>a.code==='RCMQ');
        route=tacticalRoute(departure,tacticalSelection);
      }
      if(byId('lesson').value==='airline'){
        [departure,destination]=airlineRoute();
        route=passengerBrief(model,departure,destination).route;
      }
      if(isCruise){
        departure=airports.find(a=>a.code==='RCTP');
        destination=airports.find(a=>a.code==='RCKH');
        const profile=fleet.find(a=>a.id==='b773');
        const wind=Number(byId('cruiseWind').value);
        route=isClimb?makeClimbLesson(departure,profile,wind).route:makeCruiseTrial(departure,destination,profile,wind).route;
        if(isClimb) destination=departure;
      }
      if(rangeLesson){
        departure=destination=airports.find(a=>a.code==='RCMQ');
        route=trainingRoute(departure);
      }
      if(isVoyage){
        departure=airports.find(a=>a.code==='RCTP');
        destination=naritaAirport;
        route=cargoVoyageRoute;
      }
      if(mission){
        departure=airports.find(a=>a.code===mission.from);
        destination=airports.find(a=>a.code===mission.to);
        route=benchmarkRoute(model.role,departure,destination);
      }
      const points=isClimb?[departure,...route]:[departure,...route,destination];
      planMap.fillStyle='#12364d';planMap.fillRect(0,0,430,440);
      for(let y=0;y<440;y+=4){
        for(let x=0;x<430;x+=4){
          const h=regionalHeight((x-290)*900,(y-43)*900);
          if(h<.8) continue;
          planMap.fillStyle=h>1900?'#afb7a1':h>550?'#5d805f':'#426d56';
          planMap.fillRect(x,y,4,4);
        }
      }
      if(isVoyage||destination.code==='RJAA'){
        planMap.fillStyle='#12364d';planMap.fillRect(0,0,430,440);
      }
      const project=isVoyage||destination.code==='RJAA'?
        (p=>[48+(p.x-departure.x)/6200,389+(p.z-departure.z)/3550]):
        (p=>[290+p.x/900,43+p.z/900]);
      mapPath(planMap,points,project,'#6ceaff');
      planMap.font='12px sans-serif';planMap.fillStyle='#f4f9fd';
      for(const r of isVoyage||destination.code==='RJAA'?[departure,destination]:airports){
        const [x,y]=project(r);
        planMap.fillRect(x-2,y-2,4,4);
        planMap.fillText(r.code,x+7,y+3);
      }
      byId('routePreview').textContent=isClimb?'777-300ER · 桃園 05L 起飛 · 35,000 ft 巡航練習':departure.name+' → '+destination.name+' · '+route.map(p=>p.name).join(' → ');
      byId('message').textContent=rangeLesson?'SF-16 由臺中跑道起飛。按 M 射擊虛構地面靶，命中並依航點返場停妥才結算。':contract?'使用 SB-172，從冷艙出發，依序通過航點並停妥。基本報酬 '+contract.base+' 金幣，結算扣除耗油。':isClimb?'從跑道靜止開始，手動起飛。巡航高度與速度維持 60 秒後儲存成績。':isVoyage?'桃園及成田周邊高程可離線使用。夜航任務固定夜間開始。':'區域高程可離線使用。模擬航線供遊戲練習。';
      if(isTactical) byId('message').textContent='虛構訓練空域 · '+tacticalScenarios[tacticalSelection].brief+' · M 發射';
    }catch(error){byId('message').textContent=error.message;}
  }
  for(const name of ['aircraft','departure','destination','waypoints','lesson','cruiseWind']) byId(name).addEventListener('change',drawPlan);
  function showLog(){
    const rows=readFlightLog();
    byId('log').replaceChildren();
    for(const row of rows.slice(0,12)){
      const item=document.createElement('p');
      const time=new Date(row.date).toLocaleString('zh-TW');
      item.textContent=time+' · '+row.aircraft+' · '+row.departure+' → '+row.destination+' · '+Math.round(row.seconds/60)+' 分鐘 · '+row.result+(row.reward?' · '+row.reward+' 金幣':'');
      byId('log').append(item);
    }
    if(!rows.length) byId('log').textContent='尚無飛行紀錄';
    const progress=document.createElement('p');
    try{
      const names={cold:'冷艙',taxi:'滑行',circuit:'起落航線',crosswind:'側風進場',route:'跨機場導航'};
      progress.textContent='已完成課程 · '+(Object.keys(names).filter(k=>localStorage.getItem('skybound.lesson.'+k)).map(k=>names[k]).join('、')||'尚無');
      byId('log').append(progress);
    }catch{}
  }
  function changeView(){
    const cockpit=cockpitActive();
    byId('cockpit').hidden=byId('struts').hidden=!cockpit||Boolean(flight?.aircraft.role);
    byId('systems').hidden=!flight?.regional;
    byId('reticle').hidden=!cockpit||Boolean(flight?.aircraft.role);
    byId('benchmarkHUD').hidden=!cockpit||!flight?.aircraft.role;
    document.body.classList.toggle('cockpit-active',cockpit);
    document.body.classList.toggle('cockpit-panel-view',
      cockpit&&cockpitView.preset===(twoSeats(flight.aircraft)?2:1));
    document.body.dataset.panel=flight?.aircraft?.glass?'glass':'analog';
    byId('view').textContent=cockpit?'追蹤視角 C':'駕駛艙 C';
    byId('cockpitViews').hidden=!cockpit;
    if(cockpit){
      const views=twoSeats(flight.aircraft)?['左座','右座','儀表近看']:['正前方','儀表近看'];
      byId('cockpitPreset').textContent=views[cockpitView.preset]+' · N';
    }
  }
  function setEnvironment(){
    const [hours,minutes]=byId('time').value.split(':').map(Number);
    const hour=(hours||0)+(minutes||0)/60;
    const angle=(hour-6)/12*Math.PI;
    const elevation=Math.sin(angle);
    const day=clamp((elevation+.13)/.53,0,1);
    const weather=byId('weather').value;
    const wet=weather==='wet';
    const strength=weather==='fog'?.42:wet?.62:1;
    const warmth=clamp(1-Math.min(Math.abs(hour-6),Math.abs(hour-18))/1.45,0,1);
    sunlight.intensity=.05+day*2.3*strength;
    sunlight.color.set('#fff0d9').lerp(new THREE.Color('#ffad71'),warmth);
    ambient.intensity=.16+day*1.14*(weather==='fog'?.83:1);
    sunlight.position.set(Math.cos(angle)*760,elevation*820,-280);
    atmosphericSky.setWeather(hour,day,weather,sunlight.position);
    scene.background.set('#132740').lerp(new THREE.Color(weather==='fog'?'#c5ced1':wet?'#aabac5':'#b2ccdc'),day);
    scene.fog.color.copy(scene.background);
    scene.fog.density=weather==='fog'?.00064:wet?.000065:.000034;
    lampMaterial.color.set(day>.07?0xc5d7e2:0xeffaff);
    asphalt.roughness=wet?.24:.90;asphalt.metalness=wet?.27:.02;
    concrete.roughness=wet?.31:.92;concrete.metalness=wet?.19:.02;
    return day;
  }
  let activeDay=1,previewNight=false;
  let nextCheckpoint=0;
  function saveCurrentMission(f,replaces){
    if(!f||replay) return;
    if(f.service){savePassenger(f);return;}
    if(!f.checkpointId||f.finished) return;
    const options={lesson:byId('lesson').value,weather:byId('weather').value,time:byId('time').value,
      rate:byId('voyageRate').value,guided:byId('voyageGuided').checked,cruiseWind:byId('cruiseWind').value,camera:cameraMode,
      cockpitView:{preset:cockpitView.preset,yaw:cockpitView.yaw,pitch:cockpitView.pitch,zoom:cockpitView.zoom}};
    f.checkpointFailed=!writeMissionCheckpoint(f,options,f.voyage?voyageFrames:[],replaces);
    nextCheckpoint=performance.now()+15000;
  }
  addEventListener('pagehide',()=>saveCurrentMission(flight));
  function callRunwayTow(f){
    if(!paused&&!replay&&requestRunwayTow(f)){f.towMessage='';return;}
    if(!f.tow) f.towMessage='請在出發機場停住、收油，並關門收空橋；載客航班須完成登機及加油。';
  }
  function addPassengerSystems(f,entries){
    const service=f.service;
    const atGate=()=>!f.finished&&groundServiceAllowed(f)&&!service.pushing&&(!service.pushed||f.awaitingService);
    const fuel=()=>{if(atGate()&&!f.awaitingService) service.pumping=f.fuel<service.targetFuel&&!service.pumping;};
    const bridge=()=>{if(atGate()&&!service.door) f.bridge=!f.bridge;};
    const door=()=>{if(atGate()) setPassengerDoor(f,!service.door);};
    const aisle=()=>{f.cabinView=f.cabinView==='aisle'?false:'aisle';changeView();};
    byId('gateStep').onclick=()=>{
      if(!f.parkingBrake&&f.ground&&Math.hypot(f.vx,f.vz)<.8){f.parkingBrake=true;return;}
      if(f.ground&&f.parkingBrake&&Math.hypot(f.vx,f.vz)<.8&&f.engines.some(Boolean)){
        f.engines.forEach((running,index)=>{if(running) startEngine(f,index);});
        return;
      }
      const complete=f.awaitingService?service.delivered===f.passengers:service.boarded===f.passengers;
      if(!f.awaitingService&&complete&&!f.bridge&&f.fuel>=service.targetFuel){callRunwayTow(f);return;}
      if(f.bridge&&(service.door||!complete)) door();
      else bridge();
    };
    byId('gateFuel').onclick=fuel;
    byId('gateView').onclick=aisle;
    entries.push(
      ['客艙廣播',()=>false,()=>{
        const message=f.awaitingService?'已抵達，請依序下機。':f.ground?'歡迎登機，請就座並繫好安全帶。':'請繫好安全帶。';
        service.announcement=message;
        if(!audioEnabled||!window.speechSynthesis) return;
        const voice=speechSynthesis.getVoices().find(v=>v.localService&&v.lang.toLowerCase().startsWith('zh'));
        if(voice){
          const audio=new SpeechSynthesisUtterance(message);
          audio.voice=voice;speechSynthesis.speak(audio);
        }
      }],
      ['加油',()=>Boolean(service.pumping),fuel],
      ['連接空橋',()=>f.bridge,bridge],
      ['客艙門',()=>service.door,door],
      ['客艙走道',()=>f.cabinView==='aisle',aisle],
      ['乘客窗景',()=>f.cabinView==='window',()=>{f.cabinView=f.cabinView==='window'?false:'window';changeView();}],
      ['客艙照明',()=>service.cabinLights,()=>{service.cabinLights=!service.cabinLights;}],
      ['安全帶燈',()=>service.seatBelts,()=>{service.seatBelts=!service.seatBelts;}]
    );
    const output=document.createElement('p');
    output.id='passengerStatus';
    special.append(output);
    const alternate=document.createElement('button');
    alternate.textContent='備降臺中';
    alternate.onclick=()=>{
      if(f.ground||f.landed||f.finished||service.diverted) return;
      const airport=airports.find(a=>a.code==='RCMQ');
      if(!reachableAlternate(f,airport)) return;
      f.destination=airport;
      f.route=regionalRoute(f.departure,airport);
      f.waypoint=0;service.diverted=true;
      savePassenger(f);
    };
    alternate.id='passengerAlternate';
    const goAround=document.createElement('button');
    goAround.textContent='重新進場';
    goAround.id='passengerGoAround';
    goAround.onclick=()=>{
      if(f.ground||f.finished||f.phase!=='approach') return;
      const runway=f.destination;
      const frame=runwayCoordinates(f.x,f.z,runway);
      const departureLeg=airportPoint(runway,Math.max(3500,frame.along+2500),0);
      f.route=[{...departureLeg,name:'重飛爬升'},...regionalRoute(f.departure,runway)];
      f.waypoint=0;f.hold=null;
    };
    const cancel=document.createElement('button');
    cancel.textContent='結束本次任務';
    cancel.onclick=()=>{
      if(f.finished) return;
      f.finished=true;f.ended=true;
      f.recorded=recordFlight(f,'任務取消');
    };
    special.append(alternate,goAround,cancel);
  }
  function reachableAlternate(f,airport){
    const distance=Math.hypot(airport.x-f.x,airport.z-f.z);
    const hourly=((f.aircraft.fuelIdle??.30)+.61*(f.aircraft.fuelPower??3.3))*3600;
    return f.fuel>hourly*(distance/1852/195+.25);
  }
  function drawPassengerStatus(f){
    const service=f.service;
    drawGateGuide(f);
    const output=byId('passengerStatus');
    byId('passengerAlternate').disabled=f.ground||f.finished||service.diverted||!reachableAlternate(f,airports.find(a=>a.code==='RCMQ'));
    byId('passengerGoAround').disabled=f.ground||f.finished||f.phase!=='approach';
    if(f.receipt){
      const r=f.receipt;
      output.textContent='基本 '+r.base+' · 準點獎金 '+r.punctual+' · 燃油費 '+r.fuel+
        ' · 地勤 '+r.handling+' · 維修 '+r.maintenance+' · 租賃 '+(r.rent||0)+' · 淨額 '+r.net+' 金幣 · 滿意度 '+r.comfort+
        '%'+(r.condition!==undefined?' · 機況 '+r.condition+'%（磨耗 '+r.wear+'）':'')+(service.roughPhase?' · 不平穩階段 '+service.roughPhase:'')+(service.landingPenalty?' · 接地扣分 '+service.landingPenalty:'');
      return;
    }
    output.textContent='登機 '+service.boarded+'/'+f.passengers+' · 空位 '+(f.passengers-service.boarded)+
      ' · 已下機 '+service.delivered+' · 行李 '+service.boarded*15+' kg · 燃油 '+Math.round(f.fuel)+'/'+service.targetFuel+
      ' kg · '+(f.fuelFlow||0).toFixed(2)+' kg/s · 重量 '+Math.round(flightMass(f)).toLocaleString()+
      ' kg · '+(service.seatBelts?'請繫安全帶':'安全帶燈已關閉')+
      (f.airborne&&f.fuel<service.brief.reserve?' · 低油量，請檢查備降':'')+
      (service.door&&service.mode&&(service.bridgeElapsed||0)<(service.bridgeDelay||0)?' · 旅客正在通過空橋':'')+
      (service.announcement?' · 廣播：'+service.announcement:'');
  }
  function drawGateGuide(f){
    const service=f.service;
    const guide=byId('gateGuide');
    guide.hidden=f.finished||!f.ground||service.pushing>0||Boolean(f.tow)||service.pushed&&!f.awaitingService;
    if(guide.hidden) return;
    const arriving=f.awaitingService;
    const complete=arriving?service.delivered===f.passengers:service.boarded===f.passengers;
    const available=groundServiceAllowed(f);
    const count=arriving?service.delivered:service.boarded;
    const activity=arriving?'下機':'登機';
    let prompt, next;
    if(!f.parkingBrake){prompt='停妥後拉上停機煞車。';next='停機煞車';}
    else if(f.engines.some(Boolean)){prompt='請關閉引擎，才能使用空橋。';next='關閉引擎';}
    else if(!available){prompt='請在機位停妥後開始地勤作業。';}
    else if(!f.bridge&&!complete){prompt='接上空橋，準備'+activity+'。';next='接上空橋';}
    else if(!service.door&&!complete){prompt='開門後，旅客會自動'+activity+'。';next='開艙門';}
    else if(!complete){prompt='旅客正在'+activity+'，請保持艙門開啟。';}
    else if(service.door){prompt=activity+'完成，可以關門。';next='關艙門';}
    else if(f.bridge){prompt='艙門已關閉，可以收回空橋。';next='收回空橋';}
    else if(arriving) prompt='地勤作業完成。';
    else if(f.fuel<service.targetFuel) prompt='登機完成，請完成加油。';
    else {prompt='登機與加油完成，可以呼叫拖車。';next='拖車牽引至跑道';}
    const message=activity+' '+count+'/'+f.passengers+' 人 · '+prompt;
    const caption=byId('gateCaption');
    if(caption.textContent!==message) caption.textContent=message;
    const step=byId('gateStep'), fuel=byId('gateFuel');
    step.hidden=!next;
    if(next&&step.textContent!==next) step.textContent=next;
    step.disabled=Math.hypot(f.vx,f.vz)>=.8;
    fuel.hidden=arriving;
    fuel.disabled=!available||f.fuel>=service.targetFuel;
    const fuelLabel=service.pumping?'停止加油':f.fuel>=service.targetFuel?'加油完成':'開始加油';
    if(fuel.textContent!==fuelLabel) fuel.textContent=fuelLabel;
  }
  function jetwayEndpoints(f,model){
    const airport=f.awaitingService?f.destination:f.departure;
    const {radius,half}=model.userData;
    const door=new THREE.Vector3(-radius*.94-.12,-.72,-half*.58);
    door.applyQuaternion(model.quaternion).add(model.position);
    const gate=airportPoint(airport,65,jetwayWalls.get(airport.code));
    return {terminal:new THREE.Vector3(gate.x,airport.elevation+4.5,gate.z),door,airport};
  }
  function showSystems(f){
    switches.replaceChildren();special.replaceChildren();
    const entries=[
      ['電瓶',()=>f.battery,()=>f.battery=!f.battery],
      ...f.engines.map((_,i)=>['引擎 '+(i+1),()=>f.engines[i],()=>startEngine(f,i)]),
      ['停機煞車',()=>f.parkingBrake,()=>f.parkingBrake=!f.parkingBrake],
      ['燈光',()=>f.lights,()=>{if(f.battery) f.lights=!f.lights;}],
      ['襟翼',()=>f.flaps>0,()=>f.flaps=(f.flaps+1)%3]
    ];
    if(f.aircraft.retract) entries.push(['起落架',()=>f.gear,()=>{if(!f.ground&&f.battery) f.gear=!f.gear;}]);
    if(f.aircraft.reverse){
      if(!f.aircraft.jet) entries.push(['螺旋槳低轉速',()=>f.propLow,()=>f.propLow=!f.propLow]);
      entries.push(['反推',()=>f.reverse,()=>{if(f.ground) f.reverse=!f.reverse;}]);
    }
    if(f.aircraft.jet){
      entries.push(['擾流板',()=>f.spoilers,()=>f.spoilers=!f.spoilers]);
      if(f.aircraft.cruiseMach) entries.push(['爬升／巡航 35,000 ft',()=>Boolean(f.hold?.climb),()=>{
        if(f.hold?.climb){f.hold=null;return;}
        if(climbReady(f)){
          f.hold={heading:f.heading,altitude:35000*.3048,mach:f.aircraft.cruiseMach,climb:true};
        }
      }]);
      entries.push(['航向／高度保持',()=>Boolean(f.hold),()=>{f.hold=f.hold?null:!f.ground&&f.battery?{heading:f.heading,altitude:f.y,mach:f.y>7000&&!f.flaps&&!f.gear?f.aircraft.cruiseMach:null}:null;}]);
    }
    entries.push(['自動導航 J',()=>Boolean(f.hold?.nav),()=>toggleNavigation(f)]);
    if(f.range) entries.push(['射擊訓練靶 M',()=>f.range.hit,()=>{if(!paused&&!replay) rangeShot(f);}]);
    if(f.aircraft.role==='fighter') entries.push(['加力待命',()=>f.boost,()=>{if(f.engines[0]) f.boost=!f.boost;}]);
    entries.push(['拖車牽引至跑道',()=>Boolean(f.tow),()=>callRunwayTow(f)]);
    if(f.service) addPassengerSystems(f,entries);
    if(f.aircraft.role==='passenger'&&!f.service) entries.push(['連接空橋',()=>f.bridge,()=>{
      if(f.awaitingService&&groundServiceAllowed(f)) f.bridge=!f.bridge;
    }]);
    if(f.aircraft.role==='cargo'){
      if(!f.aircraft.sideCargo) entries.push(['機鼻貨門',()=>f.noseDoor,()=>{if(groundServiceAllowed(f)) f.noseDoor=!f.noseDoor;}]);
      if(f.voyage||f.aircraft.sideCargo) entries.push(['側貨門',()=>f.sideDoor,()=>{if(groundServiceAllowed(f)) f.sideDoor=!f.sideDoor;}]);
      entries.push(['主貨艙檢視',()=>f.cabinView,()=>{if(f.ground) f.cabinView=!f.cabinView;}]);
      const sheet=document.createElement('details');
      const summary=document.createElement('summary');
      summary.textContent='貨物與重心';
      sheet.append(summary);
      for(const [index,slot] of palletStations.entries()){
        const row=document.createElement('label'),mass=document.createElement('input');
        mass.type='number';mass.min=0;mass.max=f.aircraft.cargoSlotLimit??38000;mass.step=1000;mass.value=f.pallets[index];
        mass.style.width='85px';
        row.append(slot.name+' · '+slot.size+' · kg ',mass);
        mass.onchange=()=>{
          if(setPallet(f,index,Number(mass.value))&&f.phase==='cold'&&f.pallets.some(Boolean)) f.loadedAtDeparture=true;
          mass.value=f.pallets[index];
          if(f.voyage) captureVoyage(f,voyageFrames,true);
        };
        sheet.append(row);
      }
      const output=document.createElement('p');output.id='cargoBalance';
      sheet.append(output);special.append(sheet);
    }
    for(const [label,get,toggle] of entries){
      const b=document.createElement('button');
      b.textContent=label;
      b.update=()=>{
        b.setAttribute('aria-pressed',String(Boolean(get())));
        if(label==='爬升／巡航 35,000 ft'){
          b.disabled=!get()&&!climbReady(f);
          b.title='離地至少 500 呎，收起落架、襟翼與擾流板，並加速至抬輪速度以上 15 節';
        }
      };
      b.onclick=()=>{
        const before=get();
        toggle();b.update();b.blur();
        if(f.voyage&&before!==get()) captureVoyage(f,voyageFrames,true);
        if(audioEnabled&&before!==get()) flightAudio.effect(label.startsWith('引擎')?110:62,.04);
      };
      b.update();switches.append(b);
    }
    const items=['電瓶開啟',f.engines.length===2?'兩具引擎啟動':'啟動引擎',f.aircraft.reverse?'確認扭矩及螺旋槳轉速':'確認油門及儀表',
      '滑行前鬆開停機煞車','起飛前襟翼確認','進場 '+f.aircraft.approach+' KTS'+(f.aircraft.retract?'，放下起落架':''),'停妥後拉停機煞車'];
    byId('checklist').replaceChildren(...items.map(label=>{
      const row=document.createElement('label'),box=document.createElement('input');
      box.type='checkbox';row.append(box,' '+label);return row;
    }));
  }
  function beginFlight(){
    byId('gateGuide').hidden=true;
    tacticalView.start(flight);
    touchControls.reset();
    showTouchPause(false);
    cockpitView.preset=0;
    resetLook();
    if(flight.regional) showSystems(flight);
    activeDay=setEnvironment();paused=false;accumulator=0;nextNavDraw=0;keys.clear();trail.length=0;previousTouchdown=null;
    byId('plan').hidden=byId('edition').hidden=true;
    byId('hud').hidden=byId('menu').hidden=false;
    changeView();
  }
  function start(approach,restart=false){
    try{
      const lesson=byId('lesson').value;
      const selection=regionalContracts[lesson]?regionalContractPlan(lesson):parsePlan();
      const weather=byId('weather').value;
      const savesMission=Boolean(regionalContracts[lesson]||lesson==='climbLesson'||lesson==='naritaCargo'||
        (lesson==='benchmark'&&['fighter','cargo'].includes(selectedAircraft().role)||lesson==='range'));
      const replacedId=restart?flight?.checkpointId:undefined;
      const wind=lesson==='crosswind'?5.144:['fog','wet'].includes(weather)?0:Number(weather);
      replay=null;replayControls.hidden=true;
      if(lesson==='tactical'){
        if(approach) throw new Error('請按「開始飛行」載入戰術任務。');
        byId('aircraft').value='sf16';
        flight=makeTacticalFlight(airports.find(a=>a.code==='RCMQ'),selectedAircraft(),tacticalSelection,wind,
          byId('tacticalGuided').value==='guided',byId('tacticalDifficulty').value==='advanced');
      }else if(lesson==='range'){
        if(approach) throw new Error('靶場訓練由臺中跑道開始。');
        const airport=airports.find(a=>a.code==='RCMQ');
        const fighter=fleet.find(a=>a.id==='sf16');
        byId('aircraft').value=fighter.id;
        flight=makeRegionalFlight(airport,airport,fighter,'runway',wind,trainingRoute(airport));
        flight.mission='fighter';
        flight.lesson='range';
        const target=airportPoint(airport,13200,0);
        flight.range={...target,y:terrainHeight(target.x,target.z)+5,rounds:8,hit:false,message:''};
        attachContract(flight,'fighter',8200);
      }else if(regionalContracts[lesson]){
        if(approach) throw new Error('請從機位開始任務。');
        flight=makeRegionalContract(lesson,wind);
        byId('aircraft').value=flight.aircraft.id;
      }else if(lesson==='airline'){
        if(approach) throw new Error('載客任務請從機位開始。');
        const profile=selectedAircraft();
        const [from,to]=airlineRoute();
        if(!compatibleAirline(profile,from,to)) throw new Error('此機型不適用所選機位或跑道。');
        flight=makePassengerFlight(from,to,profile,wind,Number(byId('airlineFuel').value),weather,byId('time').value);
        savePassenger(flight);
      }else if(lesson==='climbLesson'){
        if(approach) throw new Error('請按開始飛行，從桃園跑道開始練習。');
        const profile=fleet.find(a=>a.id==='b773');
        byId('aircraft').value=profile.id;
        flight=makeClimbLesson(airports.find(a=>a.code==='RCTP'),profile,Number(byId('cruiseWind').value));
      }else if(lesson==='cruiseTrial'){
        if(approach) throw new Error('請按開始飛行進入巡航驗證。');
        const profile=fleet.find(a=>a.id==='b773');
        byId('aircraft').value=profile.id;
        flight=makeCruiseTrial(airports.find(a=>a.code==='RCTP'),airports.find(a=>a.code==='RCKH'),profile,Number(byId('cruiseWind').value));
      }else if(lesson==='naritaCargo'){
        if(approach) byId('voyageNode').value='approach';
        const profile=fleet.find(m=>m.id==='sf748');
        byId('aircraft').value=profile.id;
        flight=makeCargoVoyage(airports.find(a=>a.code==='RCTP'),profile,byId('voyageNode').value,wind);
        flight.approach=approach;
        if(flight.node==='load'){
          flight.fuelStart=flight.fuel;
          attachContract(flight,'cargo',40000);
        }
        flight.voyageTime=byId('time').value;
        if(Number(flight.voyageTime.slice(0,2))>=6&&Number(flight.voyageTime.slice(0,2))<19) flight.voyageTime='21:00';
        byId('time').value=flight.voyageTime;
        voyageFrames=[];captureVoyage(flight,voyageFrames,true);
      }else if(lesson==='circuit'||lesson==='crosswind'){
        flight=createTrainer(approach||lesson==='crosswind',wind);
        flight.aircraft=fleet[0];
        flight.approach=approach||lesson==='crosswind';
        flight.waypoint=flight.approach?4:0;
        flight.lesson=lesson;
      }else{
        const chosen=selectedAircraft();
        const mission=lesson==='benchmark'?benchmarkMissions[chosen.role]:null;
        if(lesson==='benchmark'&&!mission) throw new Error('請在機庫選擇有基準任務的機型。');
        if(mission&&approach) throw new Error('基準任務請使用「開始飛行」從冷艙開始。');
        const departure=mission?airports.find(a=>a.code===mission.from):lesson==='route'?airports[0]:selection.departure;
        const destination=mission?airports.find(a=>a.code===mission.to):lesson==='route'?airports[1]:selection.destination;
        if(['passenger','cargo'].includes(chosen.role)&&!chosen.regionalGates&&[departure,destination].some(r=>r.width<55||r.length<3000)){
          throw new Error('此廣體機請選桃園、臺中或高雄的寬體起降場。');
        }
        if(departure===destination&&!mission) throw new Error('請選不同的起降機場，或使用松山起落航線訓練。');
        const mode=mission||['cold','taxi'].includes(lesson)?'cold':byId('startType').value;
        const route=mission?(chosen.role==='fighter'?trainingRoute(departure):
          [...selection.route.slice(0,-2),...regionalRoute(departure,destination).slice(-2)]):
          lesson==='route'?regionalRoute(departure,destination):selection.route;
        flight=makeRegionalFlight(departure,destination,selectedAircraft(),mode,wind,route);
        flight.approach=approach;flight.lesson=lesson;flight.mission=mission?chosen.role:null;
        if(['cargo','fighter'].includes(flight.mission)){
          attachContract(flight,flight.mission,flight.mission==='cargo'?9500:6500);
          if(flight.mission==='cargo') Object.assign(flight,{fuel:18000,fuelStart:18000});
        }
        if(flight.mission==='passenger'){
          const fuel=chosen.missionFuel??56000;
          Object.assign(flight,{passengers:chosen.passengers??320,fuel,fuelStart:fuel});
        }
        if(approach){
          const p=airportPoint(destination,-3700,0);
          const speed=flight.aircraft.approach/1.94384;
          Object.assign(flight,{...p,heading:destination.heading,y:destination.elevation+123,
            vx:Math.sin(destination.heading)*speed,vz:-Math.cos(destination.heading)*speed,vy:-1.5,
            speed,ground:false,airborne:true,flaps:2,gear:true,power:.23,parkingBrake:false,
            battery:true,phase:'approach',waypoint:route.length-1});
          flight.engines.fill(true);
        }
      }
      if(!Number.isFinite(flight.fuel)){
        const aircraft=flight.aircraft;
        flight.fuel=aircraft.missionFuel??(aircraft.role==='fighter'?2700:aircraft.jet?18000:Math.round(aircraft.mass*.10));
        flight.fuelStart=flight.fuel;
      }
      beginFlight();
      if(savesMission){
        flight.checkpointId=crypto.randomUUID();
        saveCurrentMission(flight,replacedId);
      }
    }catch(error){byId('message').textContent=error.message;}
  }
  function menu(){
    tacticalView.clear();
    touchControls.reset();
    saveCurrentMission(flight);
    replay=null;replayControls.hidden=true;updateReplayButton();
    flight=null;pointer.active=false;keys.clear();
    byId('hud').hidden=byId('menu').hidden=true;
    byId('plan').hidden=byId('edition').hidden=false;
    showLog();drawPlan();changeView();
  }
  function toggleNavigation(f){
    if(f.hold?.nav){f.hold=null;return;}
    if(f.regional&&!f.ground&&f.battery&&!f.finished&&f.phase==='cruise'&&!f.climbLesson&&!f.cruiseTrial){
      f.hold={nav:true,altitude:f.y};
    }
  }
  function showTouchPause(isPaused){
    const button=touchControls.panel.querySelector('[data-action="KeyP"]');
    button.textContent=isPaused?'繼續':'暫停';
    button.setAttribute('aria-pressed',String(isPaused));
  }
  function action(code){
    if(replay&&!['KeyC','KeyP','KeyN','Home'].includes(code)) return;
    if(replay&&code==='KeyP'){byId('replayToggle').click();return;}
    if(code==='KeyJ') toggleNavigation(flight);
    if(code==='KeyM'&&!paused){
      if(flight.tactical) tacticalView.command('fire');
      else rangeShot(flight);
    }
    if(code==='KeyV') flight.bankCommand=0;
    if(code==='KeyN') cycleCockpitView();
    if(code==='Home'&&cockpitActive()){
      cockpitView.preset=0;
      resetLook();
      changeView();
    }
    if(code==='KeyC'){if(flight.cabinView) flight.cabinView=false;else cameraMode=1-cameraMode;changeView();}
    if(code==='KeyP'){paused=!paused;touchControls.reset();showTouchPause(paused);}
    if(code==='KeyF') flight.flaps=(flight.flaps+1)%3;
    if(code==='KeyR'&&!flight.service) start(flight.approach,true);
    if(!flight.regional) return;
    if(code==='KeyB'&&!flight.tow) flight.parkingBrake=!flight.parkingBrake;
    if(code==='KeyI') startEngine(flight,0);
    if(code==='KeyL'&&flight.battery) flight.lights=!flight.lights;
    if(code==='KeyG'&&flight.aircraft.retract&&!flight.ground&&flight.battery) flight.gear=!flight.gear;
  }
  function throttleKeys(){return settings.throttleKeys.split(',').map(s=>s.trim());}
  const bindingLabels={ArrowUp:'抬頭',ArrowDown:'低頭',ArrowLeft:'左坡度',ArrowRight:'右坡度',KeyQ:'左舵',KeyE:'右舵',KeyX:'抬頭配平',KeyZ:'低頭配平',Space:'煞車',KeyC:'切換視角',KeyF:'襟翼',KeyG:'起落架',KeyP:'暫停',KeyR:'重飛',KeyB:'停機煞車',KeyI:'引擎 1',KeyL:'燈光',KeyV:'回正坡度'};
  const bindings=byId('bindings');
  function drawBindings(){
    bindings.replaceChildren();
    for(const [code,label] of Object.entries(bindingLabels)){
      const b=document.createElement('button');
      b.textContent=label+' · '+(settings.bindings?.[code]||code);
      b.onclick=()=>{b.textContent=label+' · 按下新按鍵';};
      b.onkeydown=event=>{
        if(event.code==='Tab'||event.code==='Escape') return;
        event.preventDefault();
        const assigned=settings.bindings||{};
        const clash=Object.keys(bindingLabels).some(other=>other!==code&&(assigned[other]||other)===event.code)||throttleKeys().includes(event.code);
        if(clash){b.textContent=label+' · 按鍵已使用';return;}
        settings.bindings={...assigned,[code]:event.code};
        try{localStorage.setItem('skybound.controls.v2',JSON.stringify(settings));}catch{}
        drawBindings();
      };
      bindings.append(b);
    }
  }
  function boundCode(physical){
    return Object.keys(bindingLabels).find(code=>(settings.bindings?.[code]||code)===physical)||
      (Object.hasOwn(bindingLabels,physical)?null:physical);
  }
  drawBindings();
  addEventListener('keydown',event=>{
    if(event.target.closest('input,select,textarea,#quickControls[open]')) return;
    const code=boundCode(event.code);
    if(!flight||(!controls.has(code)&&!throttleKeys().includes(event.code))) return;
    if(event.target instanceof HTMLButtonElement&&code==='Space') return;
    event.preventDefault();if(code) keys.add(code);if(throttleKeys().includes(event.code)) keys.add(event.code);
    if(!event.repeat) action(code);
  });
  addEventListener('keyup',event=>{keys.delete(event.code);keys.delete(boundCode(event.code));});
  addEventListener('blur',()=>{keys.clear();pointer.active=false;cockpitView.drag=null;});
  const overControls=target=>target.closest('button,details,input,select,textarea,a,.systems,.right,header,#touchFlight,#tacticalGuide,#tacticalReport');
  addEventListener('contextmenu',event=>{
    if(cockpitActive()&&!overControls(event.target)) event.preventDefault();
  });
  addEventListener('wheel',event=>{
    if(!cockpitActive()||overControls(event.target)) return;
    event.preventDefault();
    cockpitView.zoom=clamp(cockpitView.zoom+Math.sign(event.deltaY)*4,-14,22);
  },{passive:false});
  addEventListener('pointerdown',event=>{
    if(!flight||overControls(event.target)) return;
    if(event.button===2&&cockpitActive()){
      event.preventDefault();
      pointer.active=false;
      cockpitView.drag={id:event.pointerId,x:event.clientX,y:event.clientY};
      return;
    }
    if(event.button!==0||!settings.mouse||cockpitView.drag) return;
    pointer.active=true;pointer.x=0;pointer.y=0;pointer.left=event.clientX;pointer.top=event.clientY;
  });
  addEventListener('pointermove',event=>{
    const drag=cockpitView.drag;
    if(drag?.id===event.pointerId){
      cockpitView.yaw=clamp(cockpitView.yaw-(event.clientX-drag.x)*.004,-100*rad,100*rad);
      cockpitView.pitch=clamp(cockpitView.pitch-(event.clientY-drag.y)*.004,-58*rad,48*rad);
      drag.x=event.clientX;
      drag.y=event.clientY;
      return;
    }
    if(!pointer.active) return;
    pointer.x=clamp((event.clientX-pointer.left)/130,-1,1);
    pointer.y=clamp((pointer.top-event.clientY)/130,-1,1);
  });
  addEventListener('pointercancel',()=>{pointer.active=false;cockpitView.drag=null;});
  addEventListener('pointerup',event=>{
    if(event.pointerId===cockpitView.drag?.id&&event.button===2) cockpitView.drag=null;
    if(event.button===0) pointer.active=false;
    if(event.target instanceof HTMLInputElement&&event.target.type==='range'&&event.target.closest('#quickControls')) event.target.blur();
  });
  byId('viewScene').onclick=()=>{
    inspectionMode=true;byId('plan').hidden=true;byId('exitInspection').hidden=false;
  };
  byId('exitInspection').onclick=()=>{
    inspectionMode=false;byId('plan').hidden=false;byId('exitInspection').hidden=true;
  };
  byId('view').onclick=()=>{if(flight) action('KeyC');};
  byId('cockpitPreset').onclick=cycleCockpitView;
  byId('resetLook').onclick=()=>action('Home');
  byId('fly').onclick=()=>{byId('fly').blur();start(false);};
  byId('approach').onclick=()=>{byId('approach').blur();start(true);};
  byId('menu').onclick=menu;
  touchControls.panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');
    if(flight&&button) action(button.dataset.action);
  });
  const qualitySelect=byId('quality');
  try{qualitySelect.value=localStorage.getItem('skybound-quality')||'balanced';}catch{}
  if(!qualitySelect.value)qualitySelect.value='balanced';
  qualitySelect.onchange=()=>{try{localStorage.setItem('skybound-quality',qualitySelect.value);}catch{}resize();};
  function resize(){
    const scale={low:.6,balanced:.85,high:1.25}[qualitySelect.value]||.85;
    renderer.setPixelRatio(Math.min(devicePixelRatio,scale,touchControls.mode.value==='mobile'?.85:Infinity));
    renderer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  }
  addEventListener('resize',resize);resize();
  touchControls.mode.addEventListener('change',resize);
  const forward=heading=>new THREE.Vector3(Math.sin(heading),0,-Math.cos(heading));
  const axis=(positive,negative)=>Number(keys.has(positive))-Number(keys.has(negative));
  const padAxis=value=>gamepadAxis(value,settings.deadzone);
  let previousButtons=[];
  function inputs(f){
    const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);
    const buttons=pad?.buttons||[];
    for(const [i,code] of [[2,'KeyF'],[3,'KeyC'],[8,'KeyB'],[9,'KeyP']]){
      if(buttons[i]?.pressed&&!previousButtons[i]) action(code);
    }
    previousButtons=Array.from(buttons,button=>button.pressed);
    const [up,down]=throttleKeys();
    const touch=touchControls.input;
    const rawRoll=axis('ArrowRight','ArrowLeft')+padAxis(pad?.axes[0])+(pointer.active?pointer.x:0)+touch.roll;
    const rawPitch=axis('ArrowUp','ArrowDown')-padAxis(pad?.axes[1])+(pointer.active?pointer.y:0)+touch.pitch;
    const manual=manualAxes({pitch:rawPitch,roll:rawRoll,
      rudder:axis('KeyE','KeyQ')+padAxis(pad?.axes[2])},settings);
    let {roll,pitch}=manual;
    let throttle=clamp((axis(up,down)+Number(Boolean(buttons[5]?.pressed))-Number(Boolean(buttons[4]?.pressed)))*.48+touch.throttle,-.48,.48);
    if(f.hold?.nav&&(f.phase!=='cruise'||!f.battery||f.ground)) f.hold=null;
    if(f.hold?.climb&&(f.ground||!f.battery||f.flaps||f.gear||f.spoilers||!f.engines.every(Boolean)||f.fuel===0)){
      f.hold=null;
    }
    if(f.ground||!settings.keepBank||f.hold) f.bankCommand=0;
    else if(Math.abs(roll)>.04) f.bankCommand=roll;
    else roll=f.bankCommand||0;
    if(f.hold){
      const manualThrottle=throttle;
      if(Math.abs(roll)+Math.abs(pitch)+Math.abs(manual.rudder)+(!f.hold.climb?Math.abs(throttle):0)>.15) f.hold=null;
      else {
        if(f.hold.nav) ({roll,pitch}=navigationControls(f,activeTarget(f)));
        else{
          roll=clamp(wrapAngle(f.hold.heading-f.heading)*2,-.45,.45);
          const desiredVS=clamp((f.hold.altitude-f.y)*.14,-5,5);
          pitch=clamp(.36+(desiredVS-f.vy)*.11,-.7,.85);
          if(f.hold.mach) ({pitch,throttle}=f.hold.climb?climbCruiseControls(f):cruiseControls(f));
          if(f.hold.climb&&manualThrottle) throttle=manualThrottle;
        }
      }
    }
    return {response:settings.sensitivity,maneuver:f.hold?1:(f.ground?1:1.20-.38*clamp((f.speed-100)/200,0,1)),pitch:clamp(pitch,-1,1),roll:clamp(roll,-1,1),
      rudder:clamp(manual.rudder+(f.ground?roll:0),-1,1),
      throttle,
      trim:axis('KeyX','KeyZ')*.22,brake:touch.brake||keys.has('Space')||Boolean(buttons[0]?.pressed)};
  }
  const trail=[];
  let trailFrame=0;
  function drawNav(f,target){
    radar.fillStyle='#112c41';radar.fillRect(0,0,155,100);
    if(f.regional&&!f.battery){byId('speedDetails').textContent='';byId('nav').textContent='航電未供電';byId('coords').textContent='';return;}
    const distance=Math.hypot(target.x-f.x,target.z-f.z);
    const speeds=flightSpeeds(f);
    const closing=distance>0?((target.x-f.x)*f.vx+(target.z-f.z)*f.vz)/distance:0;
    byId('speedDetails').textContent='TAS '+Math.round(speeds.tas*knotsPerMps)+' kt · GS '+Math.round(speeds.gs*knotsPerMps)+
      ' kt · Mach '+speeds.mach.toFixed(2)+(closing>5&&!f.ground?' · 航點 ETA '+(distance/closing/60).toFixed(1)+' 分':'');
    const scale=f.ground?.13:Math.min(.018,58/Math.max(1000,distance));
    const project=p=>[77+(p.x-f.x)*scale,50+(p.z-f.z)*scale];
    radar.setLineDash([3,2]);mapPath(radar,[f,target],project,'#65ceff');radar.setLineDash([]);
    if(trail.length>1) mapPath(radar,trail,project,'#dba04e');
    radar.save();radar.translate(77,50);radar.rotate(f.heading);
    radar.fillStyle='#ffcf5e';radar.beginPath();radar.moveTo(0,-7);radar.lineTo(5,6);radar.lineTo(-5,6);radar.closePath();radar.fill();radar.restore();
    const bearing=(Math.atan2(target.x-f.x,f.z-target.z)/rad+360)%360;
    byId('nav').textContent=(target.name||'RCSS 10')+' · '+Math.round(bearing)+'° / '+(f.ground?Math.round(distance)+' m':(distance/1852).toFixed(1)+' NM');
    const geo=latLon(f.x,f.z);
    byId('coords').textContent=geo.lat.toFixed(4)+'°N · '+geo.lon.toFixed(4)+'°E';
  }
  function status(f,knots,target){
    if(replay) return '貨運回放 · '+Math.floor(replay.time/60)+' 分鐘 · '+f.phase;
    if(paused) return touchControls.mode.value==='mobile'?'已暫停 · 點「繼續」':'已暫停 · P 繼續';
    if(f.tow) return '拖車牽引中 · 對正跑道後自動停住';
    if(f.ground&&f.towMessage) return f.towMessage;
    if(f.ground&&f.start==='runway'&&f.parkingBrake&&f.taxiIndex>=f.taxi.length) return '已對正跑道 · 啟動引擎後按 B 鬆開煞車';
    if(f.checkpointFailed&&!f.finished) return '任務存檔未更新 · 請檢查瀏覽器儲存空間或其他分頁';
    if(f.contract&&f.finished){
      const receipt=f.receipt;
      const payout=receipt?' · 收入 '+receipt.base+' − 燃油 '+receipt.fuel+' = '+receipt.net+' 金幣':'';
      return (f.ended?'落地失敗':f.contract.result)+payout+' · '+(f.recorded?'已儲存':'未能儲存')+
        (f.replaySaved?' · 回放已儲存':'')+' · R 重試';
    }
    if(f.voyage){
      if(f.finished) return (f.landed?'成田貨運任務完成':'落地失敗')+' · '+(f.replaySaved?'回放已儲存':'回放未儲存')+' · R 重試';
      if(f.noseDoor||f.sideDoor) return '貨門警告 · 關門前禁止滑行及啟動引擎';
      if(!byId('voyageGuided').checked&&!paused) return '貨運任務 · '+Math.round(f.fuel)+' kg 燃油';
    }
    if(f.climbLesson){
      if(f.finished){
        if(f.climbLesson.failed) return '巡航練習失敗 · R 重飛';
        const {gs,mach}=flightSpeeds(f);
        return '巡航練習完成 · Mach '+mach.toFixed(3)+' · GS '+Math.round(gs*knotsPerMps)+' kt · '+
          (f.recorded?'已儲存紀錄':'未能儲存')+' · R 重飛';
      }
      if(f.ground) return knots<f.aircraft.rotation?'桃園 05L · 增加油門，達到 '+f.aircraft.rotation+' IAS kt 再抬頭':'抬頭離地 · 正爬升後收起落架';
      if(f.stall) return '失速 · 放低機鼻';
      if(f.hold?.climb||f.climbLesson.stable>0) return '自動油門 · 目標 35,000 ft · Mach 0.84 · 穩定 '+Math.floor(f.climbLesson.stable)+'/60 秒 · 剩油 '+Math.round(f.fuel)+' kg';
      if(f.gear||f.flaps||f.spoilers) return '保持正爬升 · 收起落架、襟翼及擾流板';
      return climbReady(f)?'接通「爬升／巡航 35,000 ft」':'保持正爬升 · 離地約 500 呎且至少 164 IAS kt 後接通爬升';
    }
    if(f.finished&&f.service) return '載客航班已結算 · 請查看地勤面板';
    if(f.finished) return (f.ended?'落地失敗':f.mission?'任務完成'+(f.rewardPaid?' · 獎金 $'+f.reward.toLocaleString():''):'已落地並停妥')+' · '+(f.recorded?'已儲存紀錄':'未能儲存')+' · R 重飛';
    if(f.ended) return '落地失敗 · R 重飛';
    if(f.aircraft.maxMach&&flightSpeeds(f).mach>f.aircraft.maxMach) return '超速 · 請降低油門';
    if(f.range&&!f.range.hit&&!f.ground){
      const d=Math.hypot(f.range.x-f.x,f.range.z-f.z);
      return (f.range.message||'對準橘色地面靶，距離 250–2600 m 按 M')+' · '+Math.round(d)+' m · '+f.range.rounds+' 發';
    }
    if(f.cruiseTrial) return '777 巡航驗證 · 1× · '+Math.floor(f.elapsed/60)+' 分 '+Math.floor(f.elapsed%60)+' 秒 · 剩油 '+Math.round(f.fuel)+' kg';
    if(!f.regional){
      if(f.landed) return '已接地 · 收油並煞車 · R 重飛';
      if(f.ground) return knots>=51?'按 ↑ 拉升':'按住 W 加速至約 51 KTS';
      return f.stall?'失速 · 放低機鼻':'松山起落航線 · 依地圖飛行';
    }
    if(f.service){
      const service=f.service;
      if(f.awaitingService) return service.delivered===f.passengers?'下機完成 · 關艙門並收回空橋':'關閉引擎 · 接空橋、開艙門讓旅客下機';
      if(!service.pushed) return service.pushing?'地勤推離中':service.boarded===f.passengers&&f.fuel>=service.targetFuel?
        '關艙門、收空橋，再按「拖車牽引至跑道」':'停妥後接空橋並開艙門，同時加油';
    }
    if(f.awaitingService) return f.mission==='cargo'?'關閉引擎 · 開貨門卸貨，卸完關門':'關閉引擎 · 連接空橋';
    if(f.phase==='cold'){
      if(f.mission==='cargo'&&!f.pallets.some(Boolean)) return '開貨門，裝載貨盤後關門';
      return '開電瓶，再啟動引擎';
    }
    if(f.phase==='taxi'||f.phase==='arrival'){
      if(f.parkingBrake) return '停機煞車已拉上 · B 鬆開';
      return target.name+' · 停妥按 B';
    }
    if(f.ground) return knots>=f.aircraft.rotation?'按 ↑ 拉升':'對正跑道 · 加速至 '+f.aircraft.rotation+' KTS';
    if(f.stall) return '失速 · 放低機鼻';
    return f.phase==='approach'?'最後進場 · 目標 '+f.aircraft.approach+' KTS':target.name+' · 依導航轉向';
  }
  function completeLesson(f){
    const done=f.lesson==='cold'?f.engines?.every(Boolean):
      f.lesson==='taxi'?f.phase==='takeoff':
      f.lesson==='circuit'||f.lesson==='crosswind'?f.landed&&Math.hypot(f.vx,f.vz)<1:
      f.lesson==='route'?f.finished&&f.landed:false;
    if(!done||f.lessonSaved) return;
    f.lessonSaved=true;
    try{localStorage.setItem('skybound.lesson.'+f.lesson,'完成');}catch{}
  }
  const rangeMarker=new THREE.Mesh(new THREE.OctahedronGeometry(26),new THREE.MeshBasicMaterial({color:0xff7928}));
  rangeMarker.visible=false;
  scene.add(rangeMarker);
  const activeJetway=makeJetway(),bridgeMesh=activeJetway.root;
  scene.add(bridgeMesh);
  bridgeMesh.visible=false;
  // Two local ground decals avoid a second full scenery render for shadows.
  function groundShadow(paint){
    const image=document.createElement('canvas');
    image.width=image.height=128;
    const ink=image.getContext('2d');
    ink.fillStyle='#16202c';
    ink.filter='blur(3px)';
    paint(ink);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({
      map:new THREE.CanvasTexture(image),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2
    }));
    mesh.visible=false;
    scene.add(mesh);
    return mesh;
  }
  const aircraftShadow=groundShadow(ink=>{
    ink.beginPath();ink.ellipse(64,64,7,56,0,0,Math.PI*2);ink.fill();
    ink.beginPath();
    for(const [x,y] of [[64,48],[120,79],[119,86],[64,70],[9,86],[8,79]]) ink.lineTo(x,y);
    ink.fill();
    ink.fillRect(43,101,42,7);
  });
  const jetwayShadow=groundShadow(ink=>ink.fillRect(28,6,72,116));
  function placeGroundShadow(mesh,x,z,y,heading,width,length,height){
    const light=sunlight.position;
    const projection=height/Math.max(230,light.y);
    mesh.position.set(x-light.x*projection,y+.16,z-light.z*projection);
    mesh.rotation.set(-Math.PI/2,0,-heading);
    mesh.scale.set(width,length,1);
    mesh.material.opacity=(.25+.28*clamp(sunlight.intensity/2.3,0,1))*activeDay;
    mesh.visible=mesh.material.opacity>.02;
  }
  const bridgeQueue=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0xc99c78});
  const queuePeople=Array.from({length:9},(_,i)=>{
    const person=new THREE.Group();
    box(person,skin,.18,.22,.17,0,.78,0);
    box(person,material([0x547694,0x9b6557,0x69795c][i%3]),.32,.44,.20,0,.45,0);
    box(person,material(0x263540),.12,.42,.14,-.083,.04,0);
    box(person,material(0x263540),.12,.42,.14,.083,.04,0);
    bridgeQueue.add(person);
    return person;
  });
  scene.add(bridgeQueue);
  function serviceVehicle(color,truck){
    const vehicle=new THREE.Group(),paint=material(color),wheel=material('#252932');
    const length=truck?6.2:3.6;
    box(vehicle,paint,truck?2.3:2.6,.58,length,0,.58,0);
    box(vehicle,paint,2.05,truck?1.68:.95,1.6,0,truck?1.55:1.23,-length*.31);
    box(vehicle,material('#405d76'),1.72,.35,.08,0,truck?2:1.56,-length*.44);
    for(const side of [-1,1]) for(const end of [-1,1]){
      const tire=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.24,12),wheel);
      tire.rotation.z=Math.PI/2;
      tire.position.set(side*1.11,.34,end*length*.30);
      vehicle.add(tire);
    }
    if(truck){
      const tank=new THREE.Mesh(new THREE.CylinderGeometry(.84,.84,3.7,16),material('#ccd8df'));
      tank.rotation.x=Math.PI/2;tank.position.set(0,1.35,.96);vehicle.add(tank);
    }
    vehicle.visible=false;scene.add(vehicle);
    return vehicle;
  }
  const tug=serviceVehicle('#e6b94b',false);
  const tanker=serviceVehicle('#f1eeea',true);
  const cargoLoader=new THREE.Group();
  const loaderPaint=material('#ebad35'), loaderMetal=material('#667480');
  box(cargoLoader,loaderPaint,4.2,.65,6,0,0,0);
  box(cargoLoader,loaderMetal,3.5,.38,6.5,0,4.3,0);
  for(const side of [-1,1]){
    box(cargoLoader,loaderPaint,.24,4,.24,side*1.60,2,1.8);
    box(cargoLoader,loaderPaint,.24,4,.24,side*1.60,2,-1.8);
  }
  const serviceLamp=new THREE.PointLight(0xffecce,0,95,1.2);
  scene.add(cargoLoader,serviceLamp);
  const taxiLamp=new THREE.SpotLight(0xffebc9,0,240,.40,.62,1.35);
  scene.add(taxiLamp,taxiLamp.target);
  function render(now){
    requestAnimationFrame(render);
    const frameSeconds=Math.min(1,(now-last)/1000);
    const dt=Math.min(.25,frameSeconds);last=now;
    const profile=flight?.aircraft||selectedAircraft();
    const model=models[fleet.indexOf(profile)];
    model.userData.setLivery?.(hangarLiveries[profile.id]||!flight&&byId('liveryPreview').checked);
    for(const other of models){
      other.visible=other===model&&(!flight||cameraMode===0)&&!flight?.cabinView;
      if(other.userData.cabin) other.userData.cabin.visible=false;
    }
    rangeMarker.visible=Boolean(flight?.range&&!flight.range.hit);
    if(rangeMarker.visible) rangeMarker.position.set(flight.range.x,flight.range.y+12,flight.range.z);
    bridgeMesh.visible=false;
    aircraftShadow.visible=jetwayShadow.visible=false;
    bridgeQueue.visible=tug.visible=tanker.visible=false;
    cargoLoader.visible=false;
    serviceLamp.intensity=0;
    if(flight){
      const f=flight,input=replay?{roll:0}:inputs(f);
      if(replay){
        if(!replay.paused) replay.time=Math.min(replay.duration,replay.time+dt*replay.rate);
        applyVoyageFrame(f,replay.frames,replay.time);
        replaySeek.value=replay.time;
        if(replay.time>=replay.duration){
          replay.paused=true;showTouchPause(true);byId('replayToggle').textContent='重新播放';
        }
        special.querySelectorAll('input').forEach((field,i)=>field.value=f.pallets[i]);
      }else{
        const fast=f.voyage&&f.phase==='cruise'&&f.y>650&&f.waypoint<4?Number(byId('voyageRate').value):1;
        if(!paused&&!f.finished&&!document.hidden) accumulator+=frameSeconds*fast;
        // Catch up gradually after a long frame so fast-forward cannot stall rendering.
        const simDeadline=performance.now()+5;
        for(let ticks=0;!paused&&!document.hidden&&accumulator+1e-10>=simTick&&
            (ticks<12||performance.now()<simDeadline);ticks++){
          if(f.tow) stepRunwayTow(f,simTick);
          else stepTrainer(f,smoothControls(f,input,simTick));
          if(f.service) updatePassengerService(f,simTick);
          if(f.tactical) stepTactical(f,simTick);
          else if(f.regional) updateRegionalFlight(f);
          if(f.voyage) captureVoyage(f,voyageFrames,f.finished);
          accumulator-=simTick;
          if(f.finished){
            if(f.voyage) f.replaySaved=storeVoyage(voyageFrames,f);
            if(f.checkpointId) clearMissionCheckpoint(f.checkpointId);
            accumulator=0;break;
          }
        }
        accumulator=Math.min(accumulator,fast);
      }
      if(f.checkpointId&&!replay&&!f.finished&&!paused&&now>=nextCheckpoint) saveCurrentMission(f);
      if(f.service){
        if(Math.floor(f.elapsed/5)!==f.service.checkpoint){
          f.service.checkpoint=Math.floor(f.elapsed/5);
          savePassenger(f);
        }
        drawPassengerStatus(f);
      }
      completeLesson(f);
      if(f.touchdown&&previousTouchdown!==f.touchdown){
        if(audioEnabled) flightAudio.effect(48,.11);
        previousTouchdown=f.touchdown;
      }
      const dir=forward(f.heading),pos=new THREE.Vector3(f.x,f.y,f.z);
      updateTerrain(f.x,f.z);
      taxiLamp.intensity=f.voyage&&f.ground&&f.battery&&f.lights?470:0;
      taxiLamp.position.copy(pos).addScaledVector(dir,14);
      taxiLamp.target.position.copy(pos).addScaledVector(dir,62);
      taxiLamp.target.position.y=f.y-5;
      model.position.copy(pos);model.rotation.set(f.pitch,-f.heading,-f.bank,'YXZ');
      const airport=f.landed?f.destination:f.departure;
      if(f.ground&&airport&&Math.hypot(f.x-airport.x,f.z-airport.z)<airport.length*.5+450){
        placeGroundShadow(aircraftShadow,f.x,f.z,airport.elevation,f.heading,
          profile.geometry[2]*2.22,profile.geometry[0]*2.24,profile.gearHeight*.8);
      }
      if(f.ground){
        if(f.tow||f.service?.pushing){
          tug.position.copy(pos).addScaledVector(dir,profile.geometry[0]+2.5);
          tug.position.y=terrainHeight(tug.position.x,tug.position.z);
          tug.rotation.y=-f.heading;tug.visible=true;
        }
        if(f.service?.pumping){
          const side=new THREE.Vector3(Math.cos(f.heading),0,Math.sin(f.heading));
          tanker.position.copy(pos).addScaledVector(side,profile.geometry[1]+4);
          tanker.position.y=terrainHeight(tanker.position.x,tanker.position.z);
          tanker.rotation.y=-f.heading;tanker.visible=true;
        }
      }
      const gear=model.userData.gear;
      const gearTarget=f.gear===false?0:1;
      if(!paused) gear.scale.y+=(gearTarget-gear.scale.y)*Math.min(1,dt*4);
      gear.visible=gear.scale.y>.06;
      model.userData.blades.forEach((blade,i)=>{if(!paused&&(f.engines?.[i]??true)) blade.rotation.z+=dt*(9+f.power*135)*(f.propLow?.72:1);});
      model.userData.navLights.forEach(lamp=>lamp.visible=Boolean(f.battery&&f.lights));
      if(profile.role){
        const data=model.userData;
        data.flaps.forEach(part=>part.rotation.x=-f.flaps*.21);
        data.wheels.forEach(wheel=>wheel.rotateY(paused?0:Math.hypot(f.vx,f.vz)*dt/.57));
        if(f.voyage){
          data.gear.position.y=f.ground?Math.max(0,.13-Math.hypot(f.vx,f.vz)*.001):0;
        }
        if(f.voyage||profile.sideCargo){
          if(f.ground&&(f.noseDoor||f.sideDoor)&&!f.cabinView){
            const offset=new THREE.Vector3(f.sideDoor?-data.radius-5:0,-profile.gearHeight+.5,f.sideDoor?data.sideDoor.position.z:-data.half-4);
            cargoLoader.position.copy(pos).add(offset.applyQuaternion(model.quaternion));
            cargoLoader.rotation.y=model.rotation.y+(f.sideDoor?Math.PI/2:0);
            cargoLoader.visible=true;
            serviceLamp.position.copy(cargoLoader.position).add(new THREE.Vector3(0,13,0));
            serviceLamp.intensity=f.lights?750:170;
          }
        }
        if(data.sideDoor) data.sideDoor.rotation.z+=(Number(f.sideDoor)*-1.33-data.sideDoor.rotation.z)*Math.min(1,dt*2.8);
        data.noseDoor.rotation.x+=(Number(f.noseDoor)*1.37-data.noseDoor.rotation.x)*Math.min(1,dt*2.8);
        data.cabin.position.copy(pos);data.cabin.quaternion.copy(model.quaternion);
        data.cabin.visible=cameraMode===1||Boolean(f.cabinView);
        data.palletMeshes.forEach((pallet,index)=>{
          const loaded=f.pallets[index]>0;
          const desired=loaded?0:-data.half-4;
          pallet.visible=loaded||(f.noseDoor||f.sideDoor)&&pallet.position.z>desired+.2;
          if(!Number.isFinite(pallet.userData.target)) pallet.position.z=loaded?desired+palletStations[index].arm:desired;
          pallet.position.z+=( (loaded?palletStations[index].arm:desired)-pallet.position.z)*Math.min(1,dt*.95);
          pallet.userData.target=desired;
          pallet.scale.y=loaded?.45+f.pallets[index]/42000:.45;
        });
        data.passengerCabin?.update(f,dt);
        if(f.bridge){
          const {terminal,door,airport}=jetwayEndpoints(f,model);
          placeJetway(activeJetway,terminal,door,airport.elevation);
          bridgeMesh.visible=true;
          placeGroundShadow(jetwayShadow,(terminal.x+door.x)/2,(terminal.z+door.z)/2,
            airport.elevation,Math.atan2(door.x-terminal.x,terminal.z-door.z),4.2,
            Math.hypot(door.x-terminal.x,door.z-terminal.z)*1.1,3.8);
          if(f.service?.door){
            const exit=f.service.mode==='exit';
            const waiting=exit?f.service.boarded:f.passengers-f.service.boarded;
            bridgeQueue.position.copy(bridgeMesh.position);
            bridgeQueue.quaternion.copy(bridgeMesh.quaternion);
            bridgeQueue.visible=waiting>0;
            const distance=bridgeMesh.position.distanceTo(door);
            queuePeople.forEach((person,index)=>{
              const seconds=Math.min(f.service.bridgeDelay??passengerBridgeSeconds,passengerBridgeSeconds)||passengerBridgeSeconds;
              const travel=(f.service.bridgeElapsed||0)/seconds-index/queuePeople.length;
              person.visible=index<waiting&&travel>=0;
              const moving=(travel%1)*Math.max(0,distance-.5);
              person.position.set(index%2?.34:-.34,Math.sin(moving*8)*.035,exit?distance-.25-moving:moving+.25);
              person.rotation.y=exit?Math.PI:0;
            });
          }
        }
      }
      model.userData.surfaces.forEach((part,i)=>part.rotation.x=-f.flaps*.16+input.roll*(i===0?-.22:.22));
      if(cameraMode===0){
        camera.position.copy(pos).addScaledVector(dir,-profile.geometry[0]*(profile.id==='b773'?2.7:5));
        camera.position.y+=profile.gearHeight*4;camera.up.set(0,1,0);
        camera.lookAt(pos.clone().addScaledVector(dir,12));
      }else{
        const airliner=twoSeats(profile);
        const panel=cockpitView.preset===(airliner?2:1);
        const half=profile.geometry[0],radius=profile.geometry[1];
        const seat=airliner?(cockpitView.preset===1?.70:-.70):0;
        const height=profile.role?(airliner?radius*.17+.64:.68):radius*.85;
        const setback=airliner?(profile.id==='b773'?.86:.64):0;
        cockpitEye.set(panel&&airliner?-.28:seat,height-(panel?.08:0),
          -half*(profile.role?.56:.30)+setback+(panel?.26:0));
        camera.position.copy(cockpitEye.applyQuaternion(model.quaternion).add(pos));
        cockpitAngles.set(cockpitView.pitch-(panel?(airliner?.24:.31):0),cockpitView.yaw,0);
        lookRotation.setFromEuler(cockpitAngles);
        cockpitOrientation.copy(model.quaternion).multiply(lookRotation);
        cockpitAim.set(0,1,0).applyQuaternion(cockpitOrientation);
        camera.up.copy(cockpitAim);
        cockpitAim.set(0,0,-1).applyQuaternion(cockpitOrientation).add(camera.position);
        camera.lookAt(cockpitAim);
      }
      if((f.voyage||profile.sideCargo)&&cameraMode===0&&cargoLoader.visible){
        const door=new THREE.Vector3(f.sideDoor?-model.userData.radius:0,2,
          f.sideDoor?model.userData.sideDoor.position.z:-model.userData.half*.78);
        const eye=door.clone().add(new THREE.Vector3(-24,9,f.sideDoor?7:-20));
        camera.position.copy(eye.applyQuaternion(model.quaternion).add(pos));
        camera.lookAt(door.applyQuaternion(model.quaternion).add(pos));
      }
      if(f.service&&f.cabinView){
        const window=f.cabinView==='window';
        const eye=new THREE.Vector3(window?profile.geometry[1]-.4:profile.centerSeats?.89:0,.68,2);
        const look=window?new THREE.Vector3(30,-1,0):new THREE.Vector3(0,.2,-profile.geometry[0]*.55);
        camera.position.copy(eye.applyQuaternion(model.quaternion).add(pos));
        camera.up.set(0,1,0);
        camera.lookAt(look.applyQuaternion(model.quaternion).add(pos));
      }else if(profile.role&&f.cabinView&&f.ground){
        const eye=new THREE.Vector3(.23,.92,18).applyQuaternion(model.quaternion).add(pos);
        camera.position.copy(eye);camera.up.set(0,1,0);
        camera.lookAt(pos.clone().addScaledVector(dir,11).add(new THREE.Vector3(0,.44,0)));
      }
      const fuelLabel=Number.isFinite(f.fuel)?Math.round(f.fuel).toLocaleString()+' kg':'—';
      const occupants=f.service?f.service.boarded:f.passengers??0;
      const loadStatus=byId('flightLoad');
      const loadText='燃油 '+fuelLabel+' · 旅客 '+occupants+(f.service?'/'+f.passengers:'')+' 人';
      if(loadStatus.textContent!==loadText) loadStatus.textContent=loadText;
      const speeds=flightSpeeds(f);
      const knots=Math.round(speeds.ias*knotsPerMps), live=!f.regional||f.battery;
      const values=[knots,Math.round(f.y*3.28084),Math.round(f.vs*196.85),String(Math.round(((f.heading/rad)%360+360)%360)%360).padStart(3,'0')+'°',Math.round(f.power*100)+'%',f.flaps+' / '+Math.round(f.trim/rad)+'°',Math.round(speeds.gs*knotsPerMps),Math.round(speeds.tas*knotsPerMps),speeds.mach.toFixed(2)];
      values.forEach((value,i)=>statValues[i].textContent=live?value:'—');
      const straightAhead=cockpitView.preset!==(twoSeats(profile)?2:1)&&
        Math.abs(cockpitView.yaw)<.18&&Math.abs(cockpitView.pitch)<.16;
      byId('benchmarkHUD').hidden=Boolean(f.tactical)||!profile.role||!cockpitActive()||!live||!straightAhead;
      if(!byId('benchmarkHUD').hidden){
        byId('hudHeading').textContent='HDG '+values[3];
        byId('hudCross').style.transform='rotate('+(-f.bank/rad)+'deg) translateY('+clamp(f.pitch/rad*2,-40,40)+'px)';
        byId('hudNumbers').textContent=knots+' IAS kt　 '+values[1]+' FT　 VAPP '+profile.approach;
      }
      if(f.regional){
        for(const b of switches.children) b.update();
        byId('instrumentType').textContent=live?
          f.aircraft.type+' · '+f.engines.map((running,i)=>'ENG '+(i+1)+' '+(running?Math.round(f.power*100)+'%':'OFF')).join(' / ')+(f.aircraft.reverse?' · 扭矩 '+(f.engines[0]?Math.round(f.power*100):0)+'%':'')+(f.hold?.climb?(f.hold.levelOff?' · 自動油門／巡航保持':' · 自動油門／爬升至 35,000 ft'):(f.hold?.nav?' · 自動導航接通':f.hold?' · 保持接通':'')):'航電未供電';
        if(profile.role&&live){
          const guide=approachGuidance(f);
          byId('instrumentType').textContent+=' · VAPP '+profile.approach+(f.boost&&f.power>.89?' · 加力':'');
          if(guide.valid) byId('instrumentType').textContent+=' · 下滑偏差 '+Math.round(guide.height)+' m · 航向道 '+Math.round(guide.cross)+' m';
        }
        if(profile.role==='cargo'){
          const balance=cargoBalance(f);
          byId('cargoBalance').textContent='貨重 '+balance.mass.toLocaleString()+' kg · CG '+balance.shift.toFixed(2)+' m'+(f.voyage?' · 燃油 '+Math.round(f.fuel).toLocaleString()+' kg':'')+
            (balance.problems.length?' · 超限：'+balance.problems.join('、'):'');
        }
        byId('cockpit').style.filter=activeDay<.15&&!f.lights?'brightness(.40)':'none';
      }
      if(f.contract&&Number.isFinite(f.fuel)){
        byId('instrumentType').textContent+=' · 燃油 '+Math.round(f.fuel)+' kg'+(f.passengers?' · '+f.passengers+' 名旅客':'');
      }
      if(f.mission==='passenger') byId('instrumentType').textContent='旅客 '+f.passengers+' 人 · 燃油 '+Math.round(f.fuel).toLocaleString()+' kg · 餘額 $'+readMoney().toLocaleString();
      if(!f.regional&&!f.ground&&f.waypoint<4&&Math.hypot(legacyRoute[f.waypoint].x-f.x,legacyRoute[f.waypoint].z-f.z)<420) f.waypoint++;
      const target=f.regional?activeTarget(f):legacyRoute[f.waypoint];
      if(!paused&&++trailFrame%60===0){trail.push({x:f.x,z:f.z});if(trail.length>140) trail.shift();}
      const statusBox=byId('status');
      statusBox.hidden=Boolean(f.tactical&&!paused)||!byId('gateGuide').hidden&&!paused&&!f.towMessage;
      statusBox.textContent=status(f,knots,target);
      if(now>=nextNavDraw){drawNav(f,target);nextNavDraw=now+100;}
    }else{
      taxiLamp.intensity=0;
      const airport=selectedAirport('departure');
      model.userData.passengerCabin?.update(null,dt);
      const p=profile.role?airportPoint(airport,230,0):parkingPoint(airport);
      updateTerrain(airport.x,airport.z);
      model.userData.gear.scale.y=1;model.userData.gear.visible=true;
      model.position.set(p.x,airport.elevation+profile.gearHeight,p.z);
      model.rotation.set(0,now*.00045,0);
      camera.up.set(0,1,0);
      camera.position.set(p.x-21,airport.elevation+8,p.z+16);
      camera.lookAt(p.x,airport.elevation+profile.gearHeight,p.z);
      const inspection=byId('inspect').value;
      if(profile.role){
        const data=model.userData;
        const h=data.half;
        const station={nose:[0,3,-2.9],side:[2.8,3,0],tail:[0,3,2.9],belly:[.3,-9,2.6]}[inspection];
        if(inspection==='orbit'){
          camera.position.set(p.x-h*1.62,model.position.y+h*.64,p.z+h*1.42);
          camera.lookAt(model.position);
        }else{
          model.rotation.set(0,0,0);
          if(inspection==='belly'){
            model.position.y+=16;
            camera.lookAt(model.position);
          }
          if(station) camera.position.set(p.x+station[0]*h,model.position.y+station[1]*(inspection==='belly'?1:h*.10),p.z+station[2]*h);
          if(station) camera.lookAt(model.position);
          if(['panel','night','cabin'].includes(inspection)){
            model.visible=false;data.cabin.visible=true;
            data.cabin.position.copy(model.position);data.cabin.quaternion.identity();
            const interior=inspection==='cabin'&&profile.role!=='fighter';
            camera.position.copy(model.position).add(new THREE.Vector3(.20,interior?.88:profile.role==='fighter'?.68:data.radius*.17+.62,interior?h*.39:-h*.56));
            camera.lookAt(p.x,model.position.y+(interior?.45:.20),interior?p.z-h*.44:p.z-h*.72);
            if(profile.id==='b773'&&!interior){
              camera.position.set(p.x-.72,model.position.y+data.radius*.17+.60,p.z-h*.56+1.20);
              camera.lookAt(p.x-.38,model.position.y+data.radius*.17+.14,p.z-h*.56-1.31);
            }
          }
        }
      }
      const night=profile.role&&inspection==='night';
      if(night){ambient.intensity=.25;sunlight.intensity=.08;}
      else if(previewNight) activeDay=setEnvironment();
      previewNight=Boolean(night);
    }
    const px=flight?.x??0,pz=flight?.z??0;
    for(const {group,airport} of airportGroups) group.visible=Math.hypot(px-airport.x,pz-airport.z)<24000||!flight&&selectedAirport('departure')===airport;
    if(!flight&&byId('inspect').value.startsWith('tour-')){
      models.forEach(model=>{model.visible=false;if(model.userData.cabin)model.userData.cabin.visible=false;});
      const tour=byId('inspect').value;
      const airport=selectedAirport('departure');
      if(tour==='tour-terminal'||tour==='tour-runway'){
        const apron=airport.apron, half=airport.length/2;
        const terminal=tour==='tour-terminal';
        const eye=terminal?airportPoint(airport,-122,apron*.62):airportPoint(airport,-half+14,0);
        const target=terminal?airportPoint(airport,65,jetwayWalls.get(airport.code)):airportPoint(airport,-half+300,0);
        camera.position.set(eye.x,airport.elevation+(terminal?27:21),eye.z);
        camera.up.set(0,1,0);
        camera.lookAt(target.x,airport.elevation+(terminal?5:0),target.z);
      }else{
        const tours={
          'tour-apron':[25.0652,121.5507,28,25.0646,121.5527,10],
          'tour-river':[25.0787,121.5531,280,25.0742,121.5475,12],
          'tour-city':[25.0558,121.5447,370,25.0662,121.5585,18],
          'tour-woods':[25.1122,121.5770,34,25.1132,121.5777,12]
        };
        const t=tours[tour],eye=geoPoint(t[0],t[1]),target=geoPoint(t[3],t[4]);
        camera.position.set(eye.x,terrainHeight(eye.x,eye.z)+t[2],eye.z);
        camera.up.set(0,1,0);
        camera.lookAt(target.x,terrainHeight(target.x,target.z)+t[5],target.z);
      }
    }
    const viewerX=flight?.x??selectedAirport('departure').x;
    const viewerZ=flight?.z??selectedAirport('departure').z;
    vegetation.update(camera.position.x,camera.position.z,qualitySelect.value);
    regionalScenery.update(camera.position.x,camera.position.z,qualitySelect.value,dt);
    taipeiVisuals.update(dt,viewerX,viewerZ,activeDay,byId('weather').value==='wet',paused||Boolean(replay),qualitySelect.value);
    airlinerDetails[profile.id]?.update(flight,now,flight?activeDay:byId('inspect').value==='night'?0:1);
    flightAudio.update(flight,cameraMode===1,audioEnabled&&!paused);
    const panelView=cockpitActive()&&cockpitView.preset===(twoSeats(profile)?2:1);
    const viewFov=cockpitActive()?clamp((panelView?53:69)+cockpitView.zoom,34,86):
      !flight&&['panel','night'].includes(byId('inspect').value)?82:64;
    if(camera.fov!==viewFov){camera.fov=viewFov;camera.updateProjectionMatrix();}
    atmosphericSky.update(camera,dt,qualitySelect.value);
    tacticalView.render(flight,dt,now,qualitySelect.value==='low'||touchControls.mode.value==='mobile');
    renderer.render(scene,camera);
    if(!flight&&!inspectionMode&&now%200<35){
      const canvas=renderer.domElement;
      const width=Math.min(canvas.width,canvas.height*1.76);
      const height=width/1.76;
      hangarPreview.drawImage(canvas,(canvas.width-width)/2,(canvas.height-height)/2,width,height,0,0,352,200);
    }
  }
  let tacticalSelection='radar';
  for(const [id,mission] of Object.entries(tacticalScenarios)){
    const card=document.createElement('button');
    const name=document.createElement('strong'), details=document.createElement('small'), brief=document.createElement('small');
    name.textContent=mission.name;
    details.textContent='SF-16 · '+mission.difficulty+' · '+mission.minutes+' 分 · '+mission.base+' 金幣';
    brief.textContent=(id==='intercept'?'跑道起飛':'空中開始')+' · '+mission.brief;
    card.type='button';
    card.setAttribute('aria-pressed',String(id===tacticalSelection));
    card.append(name,details,brief);
    card.onclick=()=>{
      tacticalSelection=id;
      for(const option of byId('tacticalCards').children) option.setAttribute('aria-pressed',String(option===card));
      drawPlan();
    };
    byId('tacticalCards').append(card);
  }
  const tacticalView=createTacticalView(scene,camera,{
    paused:()=>paused,
    retry:()=>start(false,true),
    menu,
    sound:frequency=>{if(audioEnabled) flightAudio.effect(frequency,.18);},
    replayPlane:([x,y,z,heading,pitch,bank],inside)=>{
      const model=models[fleet.indexOf(flight.aircraft)];
      model.visible=!inside;
      model.position.set(x,y,z);
      model.rotation.set(pitch,-heading,-bank,'YXZ');
    }
  });
  drawPlan();showLog();updateReplayButton();activeDay=setEnvironment();
  byId('time').addEventListener('change',()=>{activeDay=setEnvironment();});
  byId('weather').addEventListener('change',()=>{activeDay=setEnvironment();});
  requestAnimationFrame(render);
  byId('startupNotice').style.display='none';
  byId('startupNotice').hidden=true;
}









