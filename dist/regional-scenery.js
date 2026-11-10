'use strict';
function* buildRegionalScenery(scene,ground,airports,roadData,cityData,taipeiBounds){
  const tileSize=1600, tiles=new Map();
  const tileKey=(x,z)=>x+':'+z;
  function tileAt(x,z){
    const id=tileKey(Math.floor(x/tileSize),Math.floor(z/tileSize));
    if(!tiles.has(id)) tiles.set(id,{roads:[],buildings:[],traffic:new Set()});
    return tiles.get(id);
  }
  function inAirport(x,z,margin){
    return airports.some(a=>{
      const length=a.length/2+margin;
      if(Math.abs(x-a.x)>length||Math.abs(z-a.z)>length) return false;
      const p=runwayCoordinates(x,z,a);
      return Math.abs(p.along)<length&&Math.abs(p.cross)<Math.abs(a.apron)+margin;
    });
  }
  function insideTaipei(x,z){
    const {lat,lon}=latLon(x,z);
    return lat>=taipeiBounds[0]&&lat<=25.11&&lon>=taipeiBounds[1]&&lon<=taipeiBounds[3];
  }
  for(const [width,bridge,coords] of roadData){
    yield;
    const points=[],lengths=[0],normals=[];
    for(let i=0;i<coords.length;i+=2){
      const point=geoPoint(coords[i],coords[i+1]), prev=points.at(-1);
      const length=prev?Math.hypot(point.x-prev.x,point.z-prev.z):0;
      if(prev&&length<.6) continue;
      if(prev) lengths.push(lengths.at(-1)+length);
      points.push(point);
    }
    for(let i=0;i<points.length;i++){
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const length=Math.hypot(b.x-a.x,b.z-a.z)||1;
      normals.push({x:-(b.z-a.z)/length,z:(b.x-a.x)/length});
    }
    const route={points,lengths,width,bridge,id:coords[0]*10000+coords[1]};
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],x=(a.x+b.x)/2,z=(a.z+b.z)/2;
      if(insideTaipei(x,z)) continue;
      const lift=distance=>bridge?Math.min(1,distance/48,(lengths.at(-1)-distance)/48)*4.8:0;
      const tile=tileAt(x,z);
      if(lengths.at(-1)>115) tile.traffic.add(route);
      tile.roads.push({a,b,width,normalA:normals[i-1],normalB:normals[i],
        riseA:lift(lengths[i-1]),riseB:lift(lengths[i])});
    }
  }
  for(let i=0;i<cityData.length;i++){
    if(i%64===0) yield;
    const [lat,lon,width,depth,height,tone]=cityData[i];
    const {x,z}=geoPoint(lat,lon);
    if(inAirport(x,z,195+Math.max(width,depth)/2)) continue;
    tileAt(x,z).buildings.push({x,z,width,depth,height,tone});
  }
  const asphalt=new THREE.MeshStandardMaterial({color:0x42464a,roughness:.90,side:THREE.DoubleSide});
  const stripe=new THREE.MeshBasicMaterial({color:0xe4dfc7,side:THREE.DoubleSide});
  const road=new THREE.Mesh(new THREE.BufferGeometry(),asphalt);
  const lines=new THREE.Mesh(new THREE.BufferGeometry(),stripe);
  scene.add(road,lines);
  const facade=document.createElement('canvas');facade.width=facade.height=96;
  const ctx=facade.getContext('2d');
  ctx.fillStyle='#f4f0e9';ctx.fillRect(0,0,96,96);
  ctx.fillStyle='#86939b';
  for(let row=0;row<6;row++) for(let col=0;col<5;col++) ctx.fillRect(4+col*18,4+row*15,9,7);
  const facadeTexture=new THREE.CanvasTexture(facade);
  facadeTexture.colorSpace=THREE.SRGBColorSpace;
  const litWindows=document.createElement('canvas');litWindows.width=litWindows.height=96;
  const ink=litWindows.getContext('2d');
  ink.fillStyle='#000';ink.fillRect(0,0,96,96);
  for(let row=0;row<6;row++) for(let col=0;col<5;col++){
    if((row*3+col*7)%7<2) continue;
    ink.fillStyle=(row+col)%3===0?'#e3bd83':'#7b8a96';
    ink.fillRect(4+col*18,4+row*15,9,7);
  }
  const windowLights=new THREE.CanvasTexture(litWindows);
  windowLights.colorSpace=THREE.SRGBColorSpace;
  const wall=new THREE.MeshStandardMaterial({color:0xffffff,map:facadeTexture,roughness:.88,emissive:0xffe0ac,emissiveMap:windowLights,emissiveIntensity:0});
  const roof=new THREE.MeshStandardMaterial({color:0xb6b4a9,roughness:.95});
  const buildings=new THREE.InstancedMesh(new THREE.BoxGeometry(),[wall,wall,roof,roof,wall,wall],65000);
  buildings.name='Regional city volumes';
  buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buildings.count=0;
  scene.add(buildings);
  const boxMatrix=new THREE.Object3D(),color=new THREE.Color();
  const palette=[0xa6a3a1,0xc9c2ad,0x9fa9af,0xada299,0x9dada7,0xc7c8c2,0xa3a7b0];
  const carBody=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:0xffffff}),180);
  const carCabin=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:0x31434c}),180);
  carBody.name='Regional highway vehicles';
  for(const mesh of [carBody,carCabin]){
    mesh.count=0;
    mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
  }
  const carColors=[0xd9dedf,0x354c62,0x9b3935,0xa3a59c,0xeee0b6];
  let clock=0, trafficElapsed=0, last='';
  function updateTraffic(x,z,dt,quality){
    clock+=dt;
    trafficElapsed+=dt;
    if(trafficElapsed<.05) return;
    trafficElapsed=0;
    const col=Math.floor(x/tileSize),row=Math.floor(z/tileSize),routes=new Set();
    for(let j=row-2;j<=row+2;j++) for(let i=col-2;i<=col+2;i++){
      const tile=tiles.get(tileKey(i,j));
      if(tile) for(const route of tile.traffic) routes.add(route);
    }
    let count=0;
    const limit=quality==='low'?70:180;
    for(const {points,lengths,width,bridge,id} of routes){
      if(count>=limit) break;
      const length=lengths.at(-1);
      const cars=Math.min(8,Math.max(1,Math.floor(length/135)));
      for(let k=0;k<cars&&count<limit;k++){
        const speed=width===8?15:25;
        const along=(clock*speed+length*(id%1+k/cars))%length;
        let lo=0,hi=lengths.length-1;
        while(hi-lo>1){
          const mid=(lo+hi)>>1;
          if(lengths[mid]<=along) lo=mid;else hi=mid;
        }
        const a=points[lo],b=points[hi],span=lengths[hi]-lengths[lo];
        const t=(along-lengths[lo])/span, dx=(b.x-a.x)/span,dz=(b.z-a.z)/span;
        const px=a.x+(b.x-a.x)*t+dz*width*.22,pz=a.z+(b.z-a.z)*t-dx*width*.22;
        if((px-x)**2+(pz-z)**2>3900**2||insideTaipei(px,pz)) continue;
        const y=ground(px,pz)+.72+(bridge?Math.min(1,along/48,(length-along)/48)*4.8:0);
        const scale=Math.min(1,along/8,(length-along)/8);
        boxMatrix.rotation.y=Math.atan2(dx,dz);
        boxMatrix.position.set(px,y+.58*scale,pz);
        boxMatrix.scale.set(1.78*scale,.89*scale,4.35*scale);
        boxMatrix.updateMatrix();carBody.setMatrixAt(count,boxMatrix.matrix);
        carBody.setColorAt(count,color.setHex(carColors[(Math.floor(id)+k)%carColors.length]));
        boxMatrix.position.y=y+1.13*scale;
        boxMatrix.scale.set(1.49*scale,.58*scale,2.18*scale);
        boxMatrix.updateMatrix();carCabin.setMatrixAt(count++,boxMatrix.matrix);
      }
    }
    boxMatrix.rotation.y=0;
    carBody.count=carCabin.count=count;
    carBody.instanceMatrix.needsUpdate=carCabin.instanceMatrix.needsUpdate=true;
    if(carBody.instanceColor) carBody.instanceColor.needsUpdate=true;
  }
  function meshGeometry(mesh,positions){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry=geometry;
  }
  function update(x,z,quality,dt,daylight=1,traffic=true){
    wall.emissiveIntensity=(1-daylight)*.85;
    carBody.visible=carCabin.visible=traffic;
    if(traffic) updateTraffic(x,z,dt,quality);
    const col=Math.floor(x/tileSize),row=Math.floor(z/tileSize),key=tileKey(col,row)+':'+quality;
    if(last===key) return;
    last=key;
    const reach=quality==='ultra'?11:quality==='low'?4:quality==='high'?8:6;
    const positions=[],marks=[];
    buildings.count=0;
    for(let j=row-reach;j<=row+reach;j++){
      for(let i=col-reach;i<=col+reach;i++){
        const tile=tiles.get(tileKey(i,j));
        if(!tile) continue;
        for(const {a,b,width,normalA,normalB,riseA,riseB} of tile.roads){
          const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
          const count=Math.max(1,Math.ceil(len/25));
          for(let k=0;k<count;k++){
            const u=k/count,v=(k+1)/count;
            const ax=a.x+dx*u,az=a.z+dz*u,bx=a.x+dx*v,bz=a.z+dz*v;
            const ay=ground(ax,az)+.72+riseA+(riseB-riseA)*u;
            const by=ground(bx,bz)+.72+riseA+(riseB-riseA)*v;
            const quad=(target,offset,half,lift,end=1)=>{
              function point(t,edge){
                const v0=u+(v-u)*t;
                const nx=normalA.x+(normalB.x-normalA.x)*v0;
                const nz=normalA.z+(normalB.z-normalA.z)*v0;
                return [ax+(bx-ax)*t+nx*edge,ay+(by-ay)*t+lift,az+(bz-az)*t+nz*edge];
              }
              const p=point(0,offset-half),q=point(0,offset+half);
              const r=point(end,offset-half),s=point(end,offset+half);
              target.push(...p,...q,...r,...q,...s,...r);
            };
            quad(positions,0,width/2,0);
            if(Math.abs(i-col)<=3&&Math.abs(j-row)<=3){
              quad(marks,width/2-.56,.12,.04);
              quad(marks,-width/2+.56,.12,.04);
              if(width>8&&len/count>4) quad(marks,0,.13,.05,.42);
            }
          }
        }
        if(Math.abs(i-col)>reach-1||Math.abs(j-row)>reach-1) continue;
        const distance=Math.max(Math.abs(i-col),Math.abs(j-row));
        const stride=distance<=(quality==='ultra'?5:2)?1:quality==='high'||quality==='ultra'?2:3;
        for(let index=0;index<tile.buildings.length;index+=stride){
          const b=tile.buildings[index];
          if(buildings.count>=buildings.instanceMatrix.count) break;
          const y=ground(b.x,b.z);
          if(y<.6) continue;
          boxMatrix.position.set(b.x,y+b.height/2-.65,b.z);
          boxMatrix.scale.set(b.width,b.height+1.3,b.depth);
          boxMatrix.updateMatrix();
          buildings.setMatrixAt(buildings.count,boxMatrix.matrix);
          buildings.setColorAt(buildings.count++,color.setHex(palette[b.tone]));
        }
      }
    }
    meshGeometry(road,positions);
    meshGeometry(lines,marks);
    buildings.instanceMatrix.needsUpdate=true;
    if(buildings.instanceColor) buildings.instanceColor.needsUpdate=true;
    buildings.computeBoundingSphere();
  }
  return {update};
}
