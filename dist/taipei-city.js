'use strict';
// Offline OSM footprints, locally generated facades and original landmark models.
// City streaming is independent of the optional desktop forest/road layers.
function createTaipeiCity(scene,ground,airports){
  const root=new THREE.Group();root.name='Taipei 3D city';scene.add(root);
  const loaded=new Map(),pending=new Set(),failed=new Map();
  const masks=new Map();
  function mask(group,x0,z0,x1,z1){
    const rect=[x0,z0,x1,z1];
    for(let x=Math.floor(x0/100);x<=Math.floor(x1/100);x++)for(let z=Math.floor(z0/100);z<=Math.floor(z1/100);z++){
      const key=x+':'+z;if(!masks.has(key))masks.set(key,new Set());
      masks.get(key).add(rect);group.userData.masks.push([key,rect]);
    }
  }
  function blocked(x,z,radius){
    for(let cx=Math.floor((x-radius)/100);cx<=Math.floor((x+radius)/100);cx++)for(let cz=Math.floor((z-radius)/100);cz<=Math.floor((z+radius)/100);cz++){
      const cell=masks.get(cx+':'+cz);if(cell)for(const r of cell)if(x+radius>r[0]&&x-radius<r[2]&&z+radius>r[1]&&z-radius<r[3])return true;
    }
    return false;
  }
  const stats={buildings:0,tiles:0,roads:0,loading:0,vehicles:0,maskRevision:0};
  let index=null,indexRequest=false,nextScan=0,clock=0,jobs=[],day=1;
  const bounds=[24.97,121.43,25.14,121.65];
  const inside=(lat,lon)=>lat>=bounds[0]&&lat<=bounds[2]&&lon>=bounds[1]&&lon<=bounds[3];
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#eee9e0';ctx.fillRect(0,0,256,128);
  for(let i=0;i<4;i++){
    ctx.fillStyle=i%2?'#455e69':'#71858c';ctx.fillRect(i*64+9,16,45,72);
    ctx.fillStyle='#b4c8cb';ctx.fillRect(i*64+11,18,20,65);
    ctx.fillStyle='#c7c3b8';ctx.fillRect(i*64+29,16,3,72);
    ctx.fillStyle='#999d98';ctx.fillRect(i*64+8,96,47,12);
  }
  const facade=new THREE.CanvasTexture(canvas);facade.colorSpace=THREE.SRGBColorSpace;
  facade.wrapS=facade.wrapT=THREE.RepeatWrapping;
  const night=document.createElement('canvas');night.width=256;night.height=128;
  const ink=night.getContext('2d');ink.fillStyle='#000';ink.fillRect(0,0,256,128);
  for(let i=0;i<4;i++){ink.fillStyle=i===1?'#d7b37c':'#080c10';ink.fillRect(i*64+11,18,40,66);}
  const lights=new THREE.CanvasTexture(night);lights.wrapS=lights.wrapT=THREE.RepeatWrapping;
  const wall=new THREE.MeshStandardMaterial({color:0xffffff,map:facade,vertexColors:true,roughness:.83,
    emissiveMap:lights,emissive:0xffd6a2,emissiveIntensity:0});
  const roof=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.88});
  const asphalt=new THREE.MeshStandardMaterial({color:0x55595b,roughness:.95,side:THREE.DoubleSide});
  const stripe=new THREE.MeshStandardMaterial({color:0xddd8b5,roughness:.9,side:THREE.DoubleSide});
  const water=new THREE.MeshStandardMaterial({color:0x486f76,roughness:.3,metalness:.2,side:THREE.DoubleSide});
  for(const mat of [asphalt,stripe,water]){mat.polygonOffset=true;mat.polygonOffsetFactor=-3;mat.polygonOffsetUnits=-3;}
  const palette=['#9b7f6d','#b7ab8e','#8b9f9c','#8896a3','#ad9585','#c8c2b2','#96a08a','#929599'].map(c=>new THREE.Color(c));
  const roofPalette=['#85675a','#888a81','#496b67','#526675','#96745f','#92958c','#727d66','#626b73'].map(c=>new THREE.Color(c));
  const officeCanvas=document.createElement('canvas');officeCanvas.width=officeCanvas.height=256;
  const oi=officeCanvas.getContext('2d');
  const officeNight=document.createElement('canvas');officeNight.width=officeNight.height=256;
  const ni=officeNight.getContext('2d');ni.fillStyle='#000';ni.fillRect(0,0,256,256);
  const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=256;
  const ri=roughCanvas.getContext('2d');ri.fillStyle='#bababa';ri.fillRect(0,0,256,256);
  oi.fillStyle='#8c9a9f';oi.fillRect(0,0,256,256);
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const x=col*64+3,y=row*64+4;
    const reflection=oi.createLinearGradient(x,y,x+58,y+55);
    reflection.addColorStop(0,['#546f81','#668494','#4d6c7b','#718692'][(row+col)%4]);
    reflection.addColorStop(.56,'#263e50');reflection.addColorStop(1,'#7b929e');
    oi.fillStyle=reflection;oi.fillRect(x,y,58,55);
    oi.fillStyle='#aeb5b4';oi.fillRect(x+28,y,1.2,55);
    ri.fillStyle='#737373';ri.fillRect(x,y,58,55);
    if((row*5+col*7)%9<3){ni.fillStyle=(row+col)%3?'#c7b28a':'#b9d0d5';ni.fillRect(x+3,y+5,52,45);}
  }
  function repeatTexture(canvas,color=false){const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(color)t.colorSpace=THREE.SRGBColorSpace;return t;}
  const officeGlass=new THREE.MeshPhysicalMaterial({map:repeatTexture(officeCanvas,true),roughnessMap:repeatTexture(roughCanvas),
    color:0x3e6074,metalness:.72,roughness:.68,clearcoat:.25,clearcoatRoughness:.22,envMapIntensity:.8,
    emissiveMap:repeatTexture(officeNight),emissive:0xffe6bb,emissiveIntensity:0,side:THREE.DoubleSide});
  const reflectedCity=document.createElement('canvas');reflectedCity.width=1024;reflectedCity.height=512;
  const reflected=reflectedCity.getContext('2d'),sky=reflected.createLinearGradient(0,0,0,512);
  sky.addColorStop(0,'#517fa6');sky.addColorStop(.44,'#adc4d1');sky.addColorStop(.58,'#c5c5b6');sky.addColorStop(1,'#515c60');
  reflected.fillStyle=sky;reflected.fillRect(0,0,1024,512);
  for(let i=0;i<54;i++){
    const x=i*19,h=25+(i*47%113);reflected.fillStyle=['#697c88','#81939e','#5d707e'][i%3];
    reflected.fillRect(x,288-h,15,h+120);
    reflected.fillStyle='#bac9cc';for(let y=296-h;y<365;y+=10)reflected.fillRect(x+3,y,9,2);
  }
  const reflectedMap=new THREE.CanvasTexture(reflectedCity);reflectedMap.colorSpace=THREE.SRGBColorSpace;
  reflectedMap.mapping=THREE.EquirectangularReflectionMapping;officeGlass.envMap=reflectedMap;
  const landmarks=new THREE.Group();landmarks.name='Taipei landmarks';root.add(landmarks);
  const landmarkSites=[
    {name:'臺北101',lat:25.03396,lon:121.56450,radius:53,height:508,type:'101'},
    {name:'新光摩天大樓',lat:25.04625,lon:121.51520,radius:44,height:245,type:'tower'},
    {name:'臺北大巨蛋',lat:25.04242,lon:121.55940,radius:151,height:74.5,type:'dome'},
    {name:'臺北小巨蛋',lat:25.05190,lon:121.55074,radius:115,height:42,type:'arena'},
    {name:'圓山大飯店',lat:25.07846,lon:121.52648,radius:83,height:87,type:'hotel'}
    ,{name:'臺北車站',lat:25.0478,lon:121.5170,radius:115,height:49,type:'station'}
    ,{name:'中正紀念堂',lat:25.0346,lon:121.5219,radius:55,height:70,type:'memorial'}
  ];
  const glass=new THREE.MeshStandardMaterial({color:0x6eaaa3,metalness:.38,roughness:.28,map:facade,
    emissiveMap:lights,emissive:0xffd6a2,emissiveIntensity:0});
  const stone=new THREE.MeshStandardMaterial({color:0xc1c1ae,roughness:.82});
  const darkGlass=new THREE.MeshStandardMaterial({color:0x517b88,roughness:.29,metalness:.35,map:facade});
  const metal=new THREE.MeshStandardMaterial({color:0xa5aeb0,roughness:.4,metalness:.35});
  const red=new THREE.MeshStandardMaterial({color:0xa14735,roughness:.78});
  const gold=new THREE.MeshStandardMaterial({color:0xe1b866,roughness:.65});
  function add(parent,geometry,mat,x,y,z){
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function box(parent,mat,w,h,d,x,y,z){return add(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
  for(const site of landmarkSites){
    const p=geoPoint(site.lat,site.lon);Object.assign(site,p);
    const group=new THREE.Group();group.name=site.name;group.position.set(p.x,ground(p.x,p.z),p.z);
    group.userData={height:site.height,source:'Original simplified landmark geometry; see TAIPEI-3D.txt'};landmarks.add(group);
    if(site.type==='101'){
      group.rotation.y=-.12;
      box(group,stone,150,24,120,-22,12,-22);
      box(group,glass,64,68,64,0,34,0);
      for(let tier=0;tier<8;tier++){
        const y=68+tier*44;
        const segment=add(group,new THREE.CylinderGeometry(38,30,44,4,1,false,Math.PI/4),glass,0,y+22,0);
        // Repeat windows by real section height rather than stretching one window.
        const uv=segment.geometry.attributes.uv;
        for(let n=0;n<uv.count;n++)uv.setXY(n,uv.getX(n)*20,uv.getY(n)*12);
        box(group,metal,56,1.2,56,0,y+43,0);
        for(const sx of [-1,1])for(const sz of [-1,1])box(group,metal,1.3,44,1.3,sx*25,y+22,sz*25);
      }
      box(group,glass,35,28,35,0,434,0);
      box(group,metal,22,12,22,0,454,0);
      add(group,new THREE.CylinderGeometry(1,4,48,12),metal,0,484,0);
    }else if(site.type==='tower'){
      box(group,stone,67,26,68,0,13,0);
      box(group,darkGlass,52,171,49,0,111.5,0);
      box(group,metal,45,22,43,0,208,0);
      add(group,new THREE.CylinderGeometry(12,28,26,4,1,false,Math.PI/4),metal,0,232,0);
    }else if(site.type==='dome'||site.type==='arena'){
      const big=site.type==='dome',w=big?260:177,d=big?208:136,h=big?74.5:42;
      box(group,stone,w,18,d,0,9,0);
      box(group,darkGlass,w+1,13,d+1,0,21,0);
      const dome=add(group,new THREE.SphereGeometry(1,48,20,0,Math.PI*2,0,Math.PI/2),metal,0,24,0);
      dome.scale.set(w*.52,h-24,d*.52);
      for(let x=-w*.43;x<w*.44;x+=12)box(group,stone,.8,23,d+2,x,12,0);
    }else if(site.type==='station'){
      box(group,stone,190,29,130,0,14.5,0);
      box(group,darkGlass,191,12,131,0,23,0);
      for(let level=0;level<3;level++){
        const g=add(group,new THREE.CylinderGeometry(60-level*8,78-level*8,8,4,1,false,Math.PI/4),red,0,32+level*7,0);
        g.scale.set(1.85,1,1.2);
      }
    }else if(site.type==='memorial'){
      box(group,stone,88,11,88,0,5.5,0);box(group,stone,50,39,50,0,30.5,0);
      for(let level=0;level<2;level++)add(group,new THREE.CylinderGeometry(13-level*5,38-level*6,12,8,1,false,Math.PI/8),darkGlass,0,54+level*10,0);
    }else{
      box(group,stone,124,65,56,0,32.5,0);
      for(let floor=0;floor<12;floor++){
        box(group,red,129,1.3,61,0,6+floor*5,0);
        for(let col=-5;col<=5;col++)box(group,red,1.4,4.2,59,col*11,8+floor*5,0);
      }
      const top=add(group,new THREE.CylinderGeometry(42,77,18,4,1,false,Math.PI/4),red,0,76,0);
      top.scale.z=.57;box(group,gold,111,2,5,0,86,0);
    }
    // One draw per material instead of hundreds of hotel columns/tower details.
    group.updateMatrixWorld(true);
    const batches=new Map();
    for(const child of [...group.children]){
      const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      if(!batches.has(child.material))batches.set(child.material,[]);
      batches.get(child.material).push(geometry);group.remove(child);child.geometry.dispose();
    }
    for(const [mat,parts] of batches){
      const geometry=new THREE.BufferGeometry();
      for(const [attribute,width] of [['position',3],['normal',3],['uv',2]]){
        const array=new Float32Array(parts.reduce((sum,g)=>sum+g.attributes.position.count*width,0));
        let offset=0;
        for(const part of parts){if(part.attributes[attribute])array.set(part.attributes[attribute].array,offset);offset+=part.attributes.position.count*width;}
        geometry.setAttribute(attribute,new THREE.BufferAttribute(array,width));
      }
      group.add(new THREE.Mesh(geometry,mat));parts.forEach(g=>g.dispose());
    }
  }
  const skipBuilding=(x,z)=>landmarkSites.some(s=>Math.abs(x-s.x)<s.radius&&Math.abs(z-s.z)<s.radius)||airports.some(a=>{
    if(Math.hypot(x-a.x,z-a.z)>a.length/2+500)return false;
    const p=runwayCoordinates(x,z,a);
    if(typeof airportSurroundingsContains==='function'&&airportSurroundingsContains(a,p))return true;
    return Math.abs(p.along)<a.length/2+80&&Math.abs(p.cross)<110;
  });
  function buffers(){return {p:[],n:[],uv:[],c:[]};}
  function tri(out,a,b,c,color,normal,uvs){
    for(let i=0;i<3;i++){
      const v=[a,b,c][i];out.p.push(...v);out.n.push(...normal);
      out.uv.push(...(uvs?.[i]??[v[0]/4,v[2]/4]));
      out.c.push(color.r,color.g,color.b);
    }
  }
  const white=new THREE.Color(0xffffff);
  function mesh(group,data,mat,name){
    if(!data.p.length)return;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(data.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(data.c,3));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;group.add(m);
  }
  function polygon(out,points,y,color){
    const contour=points.map(p=>new THREE.Vector2(p[0],p[1]));
    for(const ids of THREE.ShapeUtils.triangulateShape(contour,[])){
      const [a,b,c]=ids.map(i=>[points[i][0],y,points[i][1]]);
      if((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])>0)tri(out,a,b,c,color,[0,1,0]);
      else tri(out,a,c,b,color,[0,1,0]);
    }
  }
  function* build(key,data){
    const group=new THREE.Group();group.name='Taipei tile '+key;
    group.userData.masks=[];
    const walls=buffers(),glazed=buffers(),roofs=buffers(),roads=buffers(),lines=buffers(),waters=buffers();
    let built=0;
    for(const [x,z,h,tone,kind,coords] of data.b){
      if(skipBuilding(x,z))continue;
      const points=[];for(let i=0;i<coords.length;i+=2)points.push([x+coords[i],z+coords[i+1]]);
      mask(group,Math.min(...points.map(p=>p[0]))-2,Math.min(...points.map(p=>p[1]))-2,Math.max(...points.map(p=>p[0]))+2,Math.max(...points.map(p=>p[1]))+2);
      const center=ground(x,z),base=Math.min(center,...points.map(p=>ground(...p)))-.25;
      const top=center+h,color=palette[tone].clone().multiplyScalar(h>75?.76:1);
      const isGlazed=h>50||kind===1&&h>25;
      const facadeTarget=isGlazed?glazed:walls;
      polygon(roofs,points,top,roofPalette[tone]);
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
        if(length<.01)continue;
        const normal=[dz/length,0,-dx/length];
        // Double-sided walls handle either winding from OSM, with physically scaled windows.
        const u=length/12.8,v=(top-base)/(isGlazed?12.8:3.2);
        tri(facadeTarget,[a[0],base,a[1]],[b[0],base,b[1]],[b[0],top,b[1]],color,normal,[[0,0],[u,0],[u,v]]);
        tri(facadeTarget,[a[0],base,a[1]],[b[0],top,b[1]],[a[0],top,a[1]],color,normal,[[0,0],[u,v],[0,v]]);
      }
      built++;if(built%24===0)yield;
    }
    for(const coords of data.w){
      const points=[];for(let i=0;i<coords.length;i+=2)points.push([coords[i],coords[i+1]]);
      const y=Math.max(.1,Math.min(...points.map(p=>ground(...p))))+.16;
      polygon(waters,points,y,white);yield;
    }
    for(let r=0;r<data.r.length;r++){
      const [width,bridge,coords]=data.r[r];
      for(let i=2;i<coords.length;i+=2){
        const ax=coords[i-2],az=coords[i-1],bx=coords[i],bz=coords[i+1],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
        if(length<.1)continue;
        mask(group,Math.min(ax,bx)-width/2,Math.min(az,bz)-width/2,Math.max(ax,bx)+width/2,Math.max(az,bz)+width/2);
        const sections=Math.max(1,Math.ceil(length/35));
        const nx=-dz/length,nz=dx/length;
        for(let part=0;part<sections;part++){
          const t=part/sections,u=(part+1)/sections;
          const x=ax+dx*t,z=az+dz*t,x2=ax+dx*u,z2=az+dz*u;
          // Keep runway and taxiway surfaces owned by the airport layer.
          if(airports.some(a=>Math.hypot(x-a.x,z-a.z)<a.length/2+100&&Math.abs(runwayCoordinates(x,z,a).cross)<250))continue;
          function strip(target,half,lift){
            const p=[[x+nx*half,z+nz*half],[x-nx*half,z-nz*half],[x2-nx*half,z2-nz*half],[x2+nx*half,z2+nz*half]];
            const v=p.map(([px,pz])=>[px,ground(px,pz)+.18+lift+(bridge?8:0),pz]);
            tri(target,v[0],v[1],v[2],white,[0,1,0]);tri(target,v[0],v[2],v[3],white,[0,1,0]);
          }
          strip(roads,width/2,0);
          if(width>=13)strip(lines,.1,.025);
        }
      }
      if(r%12===0)yield;
    }
    // Winding may differ between OSM ways; use both sides for facades only.
    wall.side=THREE.DoubleSide;
    mesh(group,walls,wall,'OSM footprint facades');mesh(group,glazed,officeGlass,'Taipei glass curtain walls');mesh(group,roofs,roof,'Taipei rooftops');
    mesh(group,roads,asphalt,'Taipei streets and bridges');mesh(group,lines,stripe,'Road markings');mesh(group,waters,water,'Taipei water');
    Object.assign(group.userData,{buildings:built,roads:data.r.length,routes:data.r.filter(r=>r[0]>=11&&r[2].length>=6)});root.add(group);loaded.set(key,group);
    stats.buildings+=built;stats.roads+=data.r.length;stats.tiles=loaded.size;
    stats.maskRevision++;
  }
  function dispose(key){
    const group=loaded.get(key);if(!group)return;
    stats.buildings-=group.userData.buildings;stats.roads-=group.userData.roads;
    for(const [key,rect] of group.userData.masks){const cell=masks.get(key);cell.delete(rect);if(!cell.size)masks.delete(key);}
    group.traverse(o=>o.geometry?.dispose());root.remove(group);loaded.delete(key);stats.tiles=loaded.size;
    stats.maskRevision++;
  }
  function request(tile){
    const key=tile[0];pending.add(key);stats.loading=pending.size;
    fetch('taipei-city/'+key+'.json?v=27').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
      .then(data=>jobs.push({key,iterator:build(key,data)}))
      .catch(()=>{failed.set(key,clock+15);pending.delete(key);stats.loading=pending.size;});
  }
  const vehicleMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.46,metalness:.12});
  const vehicles=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),vehicleMat,64);
  vehicles.name='Taipei moving traffic';
  const cabins=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),darkGlass,64);
  const headlamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffe5ad}),128);
  const tailLamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xef4736}),128);
  const tyre=new THREE.CylinderGeometry(.33,.33,.22,8);tyre.rotateZ(Math.PI/2);
  const tyres=new THREE.InstancedMesh(tyre,new THREE.MeshStandardMaterial({color:0x252b2e,roughness:.95}),256);
  root.add(vehicles,cabins,headlamps,tailLamps,tyres);
  const matrix=new THREE.Object3D(),cars=Array.from({length:64},(_,i)=>({route:null,t:i*.618%1}));
  for(let i=0;i<64;i++)vehicles.setColorAt(i,new THREE.Color(['#dedfdc','#c3b14a','#4a6573','#a8b2b2','#faf6e7','#ae4e43'][i%6]));
  let trafficTime=0;
  function traffic(dt,x,z,paused,mobile){
    trafficTime+=dt;if(trafficTime<.05)return;
    dt=trafficTime;trafficTime=0;
    const available=[...loaded.values()].filter(g=>g.visible).flatMap(g=>g.userData.routes);
    const count=Math.min(mobile?40:64,available.length);vehicles.count=cabins.count=count;
    stats.vehicles=count;
    headlamps.count=tailLamps.count=count*2;tyres.count=count*4;
    headlamps.visible=tailLamps.visible=day<.4;
    function instance(mesh,i,px,py,pz,w,h,d,angle){matrix.position.set(px,py,pz);matrix.scale.set(w,h,d);matrix.rotation.set(0,angle,0);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);}
    for(let i=0;i<count;i++){
      const car=cars[i],r=available[(i*17)%available.length];
      // Route remains selected while its tile is loaded: no per-frame jumps.
      if(!car.route||!available.includes(car.route))car.route=r;
      const [width,bridge,p]=car.route,points=[];let length=0;
      for(let n=2;n<p.length;n+=2){const segment=Math.hypot(p[n]-p[n-2],p[n+1]-p[n-1]);points.push(segment);length+=segment;}
      if(!paused)car.t=(car.t+(width>15?17:10)*dt/Math.max(1,length))%1;
      let distance=car.t*length,j=0;while(j<points.length-1&&distance>points[j])distance-=points[j++];
      const f=distance/Math.max(.01,points[j]),n=j*2,dx=p[n+2]-p[n],dz=p[n+3]-p[n+1],norm=Math.max(.01,points[j]);
      const px=p[n]+dx*f-dz/norm*width*.23,pz=p[n+1]+dz*f+dx/norm*width*.23;
      const y=ground(px,pz)+(bridge?8:0)+.5,angle=Math.atan2(dx,dz),bus=i%9===0,long=bus?10:4.5;
      instance(vehicles,i,px,y+(bus?1:.5),pz,bus?2.35:1.8,bus?2:1,long,angle);
      instance(cabins,i,px,y+(bus?2:1.12),pz,bus?2.15:1.58,bus?.65:.52,long*.64,angle);
      for(let side=0;side<2;side++){
        const offset=(side?1:-1)*.67,ox=dz/norm*offset,oz=-dx/norm*offset;
        instance(headlamps,i*2+side,px+dx/norm*long*.51+ox,y+.42,pz+dz/norm*long*.51+oz,.35,.18,.1,angle);
        instance(tailLamps,i*2+side,px-dx/norm*long*.51+ox,y+.42,pz-dz/norm*long*.51+oz,.3,.2,.1,angle);
      }
      for(let wheel=0;wheel<4;wheel++){
        const ox=(wheel%2?1:-1)*(bus?1.18:.91),oz=(wheel<2?-1:1)*long*.32;
        instance(tyres,i*4+wheel,px+dz/norm*ox+dx/norm*oz,y-.05,pz-dx/norm*ox+dz/norm*oz,1,1,1,angle);
      }
    }
    for(const mesh of [vehicles,cabins,tyres,headlamps,tailLamps]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  }
  function update(dt,x,z,quality,activeDay,wet,paused){
    clock+=Math.min(dt,.1);day=activeDay;
    const at=latLon(x,z),near=at.lat>24.90&&at.lat<25.22&&at.lon>121.35&&at.lon<121.74;
    root.visible=near;if(!near)return;
    const mobile=touchControls.mode.value==='mobile',range=mobile?4800:quality==='ultra'?11000:quality==='high'?9000:6500;
    wall.emissiveIntensity=(1-day)*.36;glass.emissiveIntensity=(1-day)*.55;officeGlass.emissiveIntensity=(1-day)*.72;
    officeGlass.envMapIntensity=.13+day*.95;
    asphalt.roughness=wet?.32:.95;asphalt.metalness=wet?.15:0;
    traffic(dt,x,z,paused,mobile);
    if(!index&&!indexRequest&&clock>=nextScan){
      indexRequest=true;fetch('taipei-city/index.json?v=27').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{index=data;root.userData.coverage=data;})
        .catch(()=>{indexRequest=false;nextScan=clock+10;});
    }
    if(index&&clock>=nextScan){
      nextScan=clock+.5;
      const distances=index.tiles.map(t=>[t,Math.hypot(t[1]-x,t[2]-z)]).sort((a,b)=>a[1]-b[1]);
      for(const [tile,distance] of distances){
        const mesh=loaded.get(tile[0]);if(mesh)mesh.visible=distance<range+1150;
        if(distance<range+800&&!mesh&&!pending.has(tile[0])&&(failed.get(tile[0])??0)<clock&&pending.size<2)request(tile);
        if(mesh&&distance>range+4200)dispose(tile[0]);
      }
    }
    const end=performance.now()+(mobile?1.8:2.8);
    while(jobs.length&&performance.now()<end){
      const job=jobs[0];
      try{
        if(job.iterator.next().done){jobs.shift();pending.delete(job.key);stats.loading=pending.size;nextScan=0;}
      }catch(error){jobs.shift();pending.delete(job.key);failed.set(job.key,clock+15);console.warn('Optional Taipei tile:',error);}
    }
  }
  return {root,stats,inside,update,landmarks,landmarkSites,blocked};
}
