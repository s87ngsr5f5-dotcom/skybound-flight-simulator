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
    return lat>=24.97&&lat<=25.14&&lon>=121.43&&lon<=121.65;
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
    if(insideTaipei(x,z))continue;
    if(inAirport(x,z,195+Math.max(width,depth)/2)) continue;
    tileAt(x,z).buildings.push({x,z,width,depth,height,tone});
  }
  const asphalt=new THREE.MeshStandardMaterial({color:0x42464a,roughness:.90,side:THREE.DoubleSide});
  const stripe=new THREE.MeshBasicMaterial({color:0xe4dfc7,side:THREE.DoubleSide});
  const road=new THREE.Mesh(new THREE.BufferGeometry(),asphalt);
  const lines=new THREE.Mesh(new THREE.BufferGeometry(),stripe);
  scene.add(road,lines);
  const facade=document.createElement('canvas');facade.width=facade.height=256;
  const ctx=facade.getContext('2d');
  ctx.fillStyle='#ece7dd';ctx.fillRect(0,0,256,256);
  ctx.fillStyle='#ded8cc';
  for(let y=0;y<256;y+=8) ctx.fillRect(0,y,256,1);
  for(let y=0;y<256;y+=8){
    const shift=(y%16===0)?0:12;
    for(let x=shift;x<256;x+=24) ctx.fillRect(x,y,1,8);
  }
  for(let row=0;row<8;row++){
    const y=8+row*31;
    ctx.fillStyle='#bcb7ab';ctx.fillRect(0,y+24,256,3);
    for(let col=0;col<6;col++){
      const x=6+col*41;
      ctx.fillStyle='#2c3236';ctx.fillRect(x,y,30,22);
      ctx.fillStyle=(row*3+col*5)%4===0?'#688290':'#4f6775';
      ctx.fillRect(x+2,y+2,12,18);ctx.fillRect(x+16,y+2,12,18);
      ctx.fillStyle='#22262a';ctx.fillRect(x+14,y+2,2,18);
      ctx.fillStyle='#65737d';
      ctx.fillRect(x+1,y+13,28,1);ctx.fillRect(x+1,y+18,28,1);
      for(let g=4;g<28;g+=5) ctx.fillRect(x+g,y+13,1,7);
      if((row*7+col*11)%3!==0){
        ctx.fillStyle='#eef1f4';ctx.fillRect(x+17,y+15,11,8);
        ctx.fillStyle='#363c40';ctx.fillRect(x+23,y+17,4,4);
        ctx.fillStyle='#1e2225';ctx.fillRect(x+17,y+23,11,1);
      }
    }
  }
  const facadeTexture=new THREE.CanvasTexture(facade);
  facadeTexture.colorSpace=THREE.SRGBColorSpace;
  const litWindows=document.createElement('canvas');litWindows.width=litWindows.height=256;
  const ink=litWindows.getContext('2d');
  ink.fillStyle='#000';ink.fillRect(0,0,256,256);
  for(let row=0;row<8;row++){
    const y=8+row*31;
    for(let col=0;col<6;col++){
      if((row*3+col*7)%5<2) continue;
      const x=6+col*41;
      ink.fillStyle=(row+col)%3===0?'#ffda8b':(row+col)%2===0?'#f5e6ba':'#8ba2b5';
      ink.fillRect(x+2,y+2,12,18);
      ink.fillRect(x+16,y+2,12,18);
    }
  }
  const windowLights=new THREE.CanvasTexture(litWindows);
  windowLights.colorSpace=THREE.SRGBColorSpace;
  const roofCanvas=document.createElement('canvas');roofCanvas.width=roofCanvas.height=256;
  const rctx=roofCanvas.getContext('2d');
  rctx.fillStyle='#3f7556';rctx.fillRect(0,0,256,256);
  rctx.fillStyle='#356548';
  for(let i=0;i<12;i++) rctx.fillRect((i*47)%220,(i*67)%220,35,35);
  rctx.fillStyle='#5a5750';
  rctx.fillRect(0,0,256,12);rctx.fillRect(0,244,256,12);
  rctx.fillRect(0,0,12,256);rctx.fillRect(244,0,12,256);
  rctx.fillStyle='rgba(0,0,0,0.32)';
  rctx.fillRect(12,12,232,6);rctx.fillRect(12,12,6,232);
  rctx.fillStyle='#c8c4bc';rctx.fillRect(160,28,72,56);
  rctx.fillStyle='#9e9990';rctx.fillRect(158,26,76,4);rctx.fillRect(158,26,4,60);
  rctx.fillStyle='#3a3f44';rctx.fillRect(174,68,16,16);
  rctx.fillStyle='rgba(0,0,0,0.35)';rctx.fillRect(156,84,78,10);
  function drawWaterTank(cx,cy,r){
    rctx.fillStyle='rgba(0,0,0,0.38)';
    rctx.beginPath();rctx.ellipse(cx+r*0.2,cy+r*0.25,r*1.05,r*0.9,0,0,Math.PI*2);rctx.fill();
    const grad=rctx.createRadialGradient(cx-r*0.35,cy-r*0.35,r*0.1,cx,cy,r);
    grad.addColorStop(0,'#ffffff');
    grad.addColorStop(0.3,'#e2e6eb');
    grad.addColorStop(0.7,'#9aa3ad');
    grad.addColorStop(1,'#626b75');
    rctx.fillStyle=grad;
    rctx.beginPath();rctx.arc(cx,cy,r,0,Math.PI*2);rctx.fill();
    rctx.strokeStyle='#505860';rctx.lineWidth=1.5;
    rctx.beginPath();rctx.arc(cx,cy,r*0.65,0,Math.PI*2);rctx.stroke();
    rctx.beginPath();rctx.arc(cx,cy,r*0.35,0,Math.PI*2);rctx.stroke();
    rctx.fillStyle='#cbd2d8';
    rctx.beginPath();rctx.arc(cx,cy,r*0.18,0,Math.PI*2);rctx.fill();
  }
  drawWaterTank(60,70,26);
  drawWaterTank(115,65,22);
  drawWaterTank(75,130,20);
  const roofTexture=new THREE.CanvasTexture(roofCanvas);
  roofTexture.colorSpace=THREE.SRGBColorSpace;
  const wall=new THREE.MeshStandardMaterial({color:0xffffff,map:facadeTexture,roughness:.88,emissive:0xffe0ac,emissiveMap:windowLights,emissiveIntensity:0});
  const roof=new THREE.MeshStandardMaterial({color:0xffffff,map:roofTexture,roughness:.82});
  const buildings=new THREE.InstancedMesh(new THREE.BoxGeometry(),[wall,wall,roof,roof,wall,wall],65000);
  buildings.name='Regional city volumes';
  buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buildings.count=0;
  scene.add(buildings);

  // Kaohsiung 85 Sky Tower (高雄 85 大樓 · 347.5m / 378m)
  const p85=geoPoint(22.61106,120.30350), g85=ground(p85.x,p85.z);
  const tower85=new THREE.Group();tower85.name='高雄85大樓';tower85.position.set(p85.x,g85,p85.z);
  const k85Glass=new THREE.MeshStandardMaterial({color:0x2b6468,roughness:.16,metalness:.72,emissive:0xffdfa8,emissiveIntensity:0});
  const k85Stone=new THREE.MeshStandardMaterial({color:0xb2b6b8,roughness:.72});
  const k85Metal=new THREE.MeshStandardMaterial({color:0x717980,roughness:.38,metalness:.55});
  const k85Beacon=new THREE.MeshBasicMaterial({color:0xff2222});
  function kbox(parent,mat,w,h,d,x,y,z){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z);parent.add(m);return m;
  }
  function kcyl(parent,mat,rt,rb,h,seg,x,y,z){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);
    m.position.set(x,y,z);parent.add(m);return m;
  }
  kbox(tower85,k85Stone,98,34,64,0,17,0);
  for(const side of [-1,1]){
    kbox(tower85,k85Glass,32,122,54,side*27,34+61,0);
    for(const cz of [-26,26]) kbox(tower85,k85Stone,3.5,122,3.5,side*27,34+61,cz);
    for(const cx of [-15,15]) kbox(tower85,k85Stone,3.5,122,3.5,side*27+cx,34+61,0);
  }
  kbox(tower85,k85Stone,86,14,56,0,156+7,0);
  kbox(tower85,k85Glass,48,142,48,0,163+71,0);
  kbox(tower85,k85Glass,52,136,44,0,234,0);
  kbox(tower85,k85Glass,44,136,52,0,234,0);
  kbox(tower85,k85Stone,40,16,40,0,305+8,0);
  kbox(tower85,k85Glass,32,14,32,0,321+7,0);
  kcyl(tower85,k85Stone,6,28,15,4,0,335+7.5,0).rotation.y=Math.PI/4;
  kcyl(tower85,k85Metal,.9,2.8,32,8,0,348+16,0);
  kbox(tower85,k85Beacon,2.2,2.2,2.2,0,381,0);
  for(const side of [-1,1]){
    kbox(tower85,k85Beacon,1.6,1.6,1.6,side*27,156,26);
    kbox(tower85,k85Beacon,1.6,1.6,1.6,side*27,156,-26);
  }
  scene.add(tower85);

  // Chang-Gu 50 Tower (長谷世貿聯合國大樓 · 222m)
  const p50=geoPoint(22.64302,120.31483), g50=ground(p50.x,p50.z);
  const tower50=new THREE.Group();tower50.name='長谷世貿50層大樓';tower50.position.set(p50.x,g50,p50.z);
  const cgGlass=new THREE.MeshStandardMaterial({color:0x39655e,roughness:.20,metalness:.68});
  const cgGranite=new THREE.MeshStandardMaterial({color:0xb44c3c,roughness:.75});
  kcyl(tower50,cgGranite,24,26,42,8,0,21,0);
  kcyl(tower50,cgGlass,20,24,140,8,0,42+70,0);
  kcyl(tower50,cgGranite,14,20,32,8,0,182+16,0);
  kcyl(tower50,cgGlass,6,14,14,8,0,214+7,0);
  kcyl(tower50,k85Metal,.6,1.8,16,8,0,228+8,0);
  kbox(tower50,k85Beacon,1.8,1.8,1.8,0,238,0);
  scene.add(tower50);
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
    k85Glass.emissiveIntensity=(1-daylight)*.85;
    k85Beacon.color.setHex((Math.floor(Date.now()/550)%2===0)?0xff1111:0x440000);
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
