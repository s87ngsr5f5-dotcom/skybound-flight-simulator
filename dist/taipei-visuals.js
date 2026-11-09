'use strict';
function buildTaipeiVisuals(scene,terrain){
  const root=new THREE.Group();scene.add(root);
  const batches=new Map();
  const tiles=[];
  const groundCache=new Map();
  function ground(x,z){
    const key=Math.round(x*2)+":"+Math.round(z*2);
    if(groundCache.has(key))return groundCache.get(key);
    const y=terrain(x,z);groundCache.set(key,y);return y;
  }
  const makeMat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.88,...extra});
  const roadMat=makeMat('#3b4145'),lineMat=makeMat('#e4dfc6'),waterMat=makeMat('#426f78',{roughness:.24,metalness:.42});
  const bankMat=makeMat('#97998a'),roofMat=makeMat('#747b7d');
  for(const mat of [roadMat,lineMat,waterMat,bankMat]) mat.side=THREE.DoubleSide;
  roadMat.polygonOffset=lineMat.polygonOffset=waterMat.polygonOffset=bankMat.polygonOffset=true;
  roadMat.polygonOffsetFactor=-3;roadMat.polygonOffsetUnits=-3;
  lineMat.polygonOffsetFactor=-5;lineMat.polygonOffsetUnits=-5;
  bankMat.polygonOffsetFactor=-1;bankMat.polygonOffsetUnits=-1;
  waterMat.polygonOffsetFactor=-2;waterMat.polygonOffsetUnits=-2;
  function batch(geometry,material,matrix){
    if(matrix) geometry.applyMatrix4(matrix);
    const flat=geometry.index?geometry.toNonIndexed():geometry;
    flat.computeBoundingBox();
    const center=flat.boundingBox.getCenter(new THREE.Vector3());
    const key=Math.floor(center.x/1200)+':'+Math.floor(center.z/1200)+':'+material.uuid;
    const entry=batches.get(key)||{material,geometries:[]};
    entry.geometries.push(flat);batches.set(key,entry);
    if(flat!==geometry)geometry.dispose();
  }
  const transform=new THREE.Object3D();
  function block(mat,w,h,d,x,y,z,angle=0){
    transform.position.set(x,y,z);transform.rotation.set(0,angle,0);transform.scale.set(1,1,1);transform.updateMatrix();
    batch(new THREE.BoxGeometry(w,h,d),mat,transform.matrix);
  }
  function ribbon(points,width,mat,lift,bridge=false){
    // Continuous miter joins; sample the same triangulated surface as the renderer.
    const samples=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);
      const count=Math.max(1,Math.ceil(length/24));
      for(let j=0;j<count;j++)samples.push({x:a.x+(b.x-a.x)*j/count,z:a.z+(b.z-a.z)*j/count});
    }
    if(points.length)samples.push(points[points.length-1]);
    const rows=[],across=Math.max(1,Math.ceil(width/24));
    for(let i=0;i<samples.length;i++){
      const p=samples[i],a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)];
      const length=Math.max(.01,Math.hypot(b.x-a.x,b.z-a.z));
      const nx=-(b.z-a.z)/length,nz=(b.x-a.x)/length;
      const row=[];
      for(let k=0;k<=across;k++){
        const x=p.x+nx*width*(k/across-.5),z=p.z+nz*width*(k/across-.5);
        row.push([x,ground(x,z)+lift+(bridge?9:0),z]);
      }
      rows.push(row);
    }
    for(let start=1;start<rows.length;start+=24){
      const vertices=[];
      for(let i=start;i<Math.min(rows.length,start+24);i++)for(let k=0;k<across;k++){
        vertices.push(...rows[i-1][k],...rows[i][k],...rows[i-1][k+1],...rows[i-1][k+1],...rows[i][k],...rows[i][k+1]);
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.computeVertexNormals();batch(geometry,mat);
    }
  }
  const waterPaths=[];
  for(const river of taipeiData.rivers){
    const points=river.p.map(([lat,lon])=>geoPoint(lat,lon));
    waterPaths.push(points);
    const width=river.name.includes('基隆')?120:river.name.includes('淡水')?180:river.name.includes('新店')?130:river.name.includes('大漢')?160:18;
    ribbon(points,width+12,bankMat,.65);
    ribbon(points,width,waterMat,.85);
  }
  const routes=[];
  for(const road of taipeiData.roads){
    if(road.tunnel) continue;
    const points=road.p.map(([lat,lon])=>geoPoint(lat,lon));
    const width=road.kind==='motorway'?20:road.kind==='trunk'?16:road.kind==='primary'?13:9;
    ribbon(points,width+1.6,bankMat,.72,road.bridge);
    ribbon(points,width,roadMat,.82,road.bridge);
    ribbon(points,.20,lineMat,.88,road.bridge);
    if(road.bridge&&points.length>1){
      for(let i=0;i<points.length;i+=3) block(bankMat,1.7,9,1.7,points[i].x,terrain(points[i].x,points[i].z)+4.5,points[i].z);
    }
    let length=0;
    const distances=[0];
    for(let i=1;i<points.length;i++){length+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);distances.push(length);}
    if(length>350) routes.push({points,distances,length,bridge:road.bridge,speed:road.kind==='motorway'?22:12});
  }
  const facade=document.createElement('canvas');facade.width=128;facade.height=128;
  const ink=facade.getContext('2d');
  ink.fillStyle='#b5b7b5';ink.fillRect(0,0,128,128);
  ink.fillStyle='#657682';ink.fillRect(15,18,96,75);
  ink.fillStyle='#b6c4c8';ink.fillRect(20,23,41,64);
  ink.fillStyle='#60696b';ink.fillRect(8,101,113,9);
  ink.fillStyle='#dad9cf';ink.fillRect(61,17,6,77);
  const map=new THREE.CanvasTexture(facade);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
  const night=document.createElement('canvas');night.width=night.height=128;
  const n=night.getContext('2d');n.fillStyle='#000';n.fillRect(0,0,128,128);n.fillStyle='#e1b879';n.fillRect(23,25,37,59);
  const emissiveMap=new THREE.CanvasTexture(night);emissiveMap.wrapS=emissiveMap.wrapT=THREE.RepeatWrapping;
  const facades=['#c8c4b7','#9ba9aa','#b1b0ac','#8c9eab'].map(color=>makeMat(color,{map,emissiveMap,emissive:0xffdf9b,emissiveIntensity:0}));
  for(let index=0;index<taipeiData.buildings.length;index++){
    const building=taipeiData.buildings[index],points=building.p.map(([lat,lon])=>geoPoint(lat,lon));
    const center=points.reduce((a,p)=>({x:a.x+p.x/points.length,z:a.z+p.z/points.length}),{x:0,z:0});
    const frame=localRunway(center.x,center.z);
    if(Math.abs(frame.along)<1450&&Math.abs(frame.cross)<290)continue;
    const base=ground(center.x,center.z);
    if(base<1)continue;
    const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    block(bankMat,maxX-minX+2,.08,maxZ-minZ+2,(minX+maxX)/2,base+.04,(minZ+maxZ)/2);
    const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x-center.x,-p.z+center.z)));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:building.h,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);geometry.translate(center.x,base,center.z);
    const pos=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
    for(let i=0;i<pos.count;i++) uv.setXY(i,(Math.abs(normal.getX(i))>.6?pos.getZ(i):pos.getX(i))/3.2,pos.getY(i)/3.2);
    const flat=geometry.toNonIndexed();
    const wall=[],top=[];
    for(let i=0;i<flat.attributes.position.count;i+=3){
      const target=Math.abs(flat.attributes.normal.getY(i))>.8?top:wall;
      for(let j=0;j<3;j++)target.push(i+j);
    }
    for(const [indices,mat] of [[wall,facades[index%4]],[top,roofMat]]){
      const part=new THREE.BufferGeometry();
      for(const name of ['position','normal','uv']){
        const source=flat.attributes[name],values=[];
        for(const i of indices)for(let k=0;k<source.itemSize;k++)values.push(source.array[i*source.itemSize+k]);
        part.setAttribute(name,new THREE.Float32BufferAttribute(values,source.itemSize));
      }
      batch(part,mat);
    }
    flat.dispose();geometry.dispose();
    if(index%4===0) block(roofMat,2.1,1.3,2.1,center.x,base+building.h+.65,center.z);
    if(index%9===0) block(bankMat,4,1.7,2.8,center.x+1.5,base+building.h+.85,center.z+2);
  }
  const tsa=geoPoint(25.06455,121.5527),glass=makeMat('#6f929f',{metalness:.35,roughness:.28});
  block(roofMat,210,13,70,tsa.x,terrain(tsa.x,tsa.z)+6.5,tsa.z);
  block(glass,211,8,71,tsa.x,terrain(tsa.x,tsa.z)+7,tsa.z);
  for(let i=-10;i<=10;i++)block(bankMat,.3,9,71,tsa.x+i*10,terrain(tsa.x,tsa.z)+7,tsa.z);
  block(bankMat,219,1.5,77,tsa.x,terrain(tsa.x,tsa.z)+13.7,tsa.z);
  for(let i=-3;i<4;i++)block(roofMat,7,1.3,9,tsa.x+i*25,terrain(tsa.x,tsa.z)+15,tsa.z);
  const apron=makeMat('#8c9393',{roughness:.82,metalness:.08});
  for(let x=-1450;x<1400;x+=65){
    const p=worldRunway(x,175);
    block(lineMat,.12,.02,220,p.x,4.20,p.z,-runway10.heading);
  }
  function flush(){
    for(const {material:mat,geometries} of batches.values()){
      const attrs={position:[],normal:[],uv:[]};
      for(const geo of geometries){
        for(const name of ['position','normal']) geo.attributes[name].array.forEach(v=>attrs[name].push(v));
        if(geo.attributes.uv) attrs.uv.push(...geo.attributes.uv.array);
        else attrs.uv.push(...Array(geo.attributes.position.count*2).fill(0));
      }
      const merged=new THREE.BufferGeometry();
      for(const name of Object.keys(attrs))merged.setAttribute(name,new THREE.Float32BufferAttribute(attrs[name],name==='uv'?2:3));
      merged.computeBoundingSphere();
      const tile=new THREE.Mesh(merged,mat);tile.userData.center=merged.boundingSphere.center.clone();
      tile.userData.radius=merged.boundingSphere.radius;tiles.push(tile);root.add(tile);
      for(const geometry of geometries)geometry.dispose();
    }
    batches.clear();
  }
  flush();
  const vehicleCount=Math.min(160,routes.length*2);
  const vehiclePaint=makeMat('#ffffff',{roughness:.42,metalness:.15});
  const cars=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),vehiclePaint,vehicleCount);
  const windows=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),glass,vehicleCount);
  const lamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffe9b6}),vehicleCount);
  const tyreMat=makeMat('#1b2023');
  const wheels=new THREE.InstancedMesh(new THREE.CylinderGeometry(.33,.33,.22,10),tyreMat,vehicleCount*4);
  root.add(cars,windows,lamps,wheels);
  const moving=Array.from({length:vehicleCount},(_,i)=>({route:routes[i%routes.length],distance:(i*.618%1)*routes[i%routes.length].length,type:i%11===0?'bus':i%7===0?'truck':'car'}));
  const palette=['#d9dfdf','#313c4a','#a4a9ad','#b24035','#e6b63e','#eee8dd'];
  for(let i=0;i<vehicleCount;i++)cars.setColorAt(i,new THREE.Color(palette[i%palette.length]));
  groundCache.clear();
  let seconds=0,trafficElapsed=0;
  function update(dt,x,z,day,wet,paused,quality="balanced"){
    root.visible=Math.hypot(x,z)<26000;
    if(!root.visible)return;
    const range=quality==='ultra'?25500:quality==='low'?6500:quality==='high'?19000:12000;
    for(const tile of tiles)tile.visible=Math.hypot(x-tile.userData.center.x,z-tile.userData.center.z)<range+tile.userData.radius;
    facades.forEach(mat=>mat.emissiveIntensity=day<.2?.8:.03);
    roadMat.roughness=wet?.25:.92;roadMat.metalness=wet?.26:.04;
    waterMat.color.set(day<.2?'#19333c':'#426f78');
    if(!paused)seconds+=dt;
    trafficElapsed+=dt;
    if(trafficElapsed<1/20)return;
    dt=trafficElapsed;trafficElapsed=0;
    for(let i=0;i<moving.length;i++){
      const car=moving[i],route=car.route;
      if(!paused)car.distance=(car.distance+route.speed*dt)%route.length;
      let j=1;while(j<route.distances.length-1&&route.distances[j]<car.distance)j++;
      const a=route.points[j-1],b=route.points[j],length=route.distances[j]-route.distances[j-1];
      const t=(car.distance-route.distances[j-1])/Math.max(.1,length),dx=b.x-a.x,dz=b.z-a.z;
      const heading=Math.atan2(-dx,-dz),norm=Math.max(.1,Math.hypot(dx,dz));
      const px=a.x+(b.x-a.x)*t-dz/norm*2,pz=a.z+(b.z-a.z)*t+dx/norm*2;
      const y=terrain(px,pz)+1.05+(route.bridge?9:0),long=car.type==='bus'?11:car.type==='truck'?8:4.5;
      transform.rotation.set(0,heading,0);transform.position.set(px,y+.70,pz);transform.scale.set(car.type==='car'?1.8:2.4,car.type==='car'?1.25:2.6,long);transform.updateMatrix();cars.setMatrixAt(i,transform.matrix);
      const wx=dz/norm*.89,wz=-dx/norm*.89,ax=dx/norm*long*.31,az=dz/norm*long*.31;
      for(let k=0;k<4;k++){
        const side=k%2===0?-1:1,end=k<2?-1:1;
        transform.position.set(px+side*wx+end*ax,y+.13,pz+side*wz+end*az);
        transform.rotation.set(0,heading,Math.PI/2);
        transform.scale.set(1,1,1);transform.updateMatrix();wheels.setMatrixAt(i*4+k,transform.matrix);
      }
      transform.rotation.set(0,heading,0);
      transform.position.set(px,y+(car.type==='car'?1.08:1.35),pz);
      transform.position.y+=car.type==='car'?.38:.65;transform.scale.set(1.62,.46,long*.65);transform.updateMatrix();windows.setMatrixAt(i,transform.matrix);
      transform.position.set(px-dx/norm*long*.46,y+.44,pz-dz/norm*long*.46);transform.scale.set(1.45,.18,.14);transform.updateMatrix();lamps.setMatrixAt(i,transform.matrix);
    }
    cars.instanceMatrix.needsUpdate=windows.instanceMatrix.needsUpdate=lamps.instanceMatrix.needsUpdate=wheels.instanceMatrix.needsUpdate=true;
    lamps.visible=day<.2;
  }
  return {update,root,coverage:taipeiData.bounds,counts:{roads:taipeiData.roads.length,buildings:taipeiData.buildings.length,vehicles:vehicleCount}};
}




