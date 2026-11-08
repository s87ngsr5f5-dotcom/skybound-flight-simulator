'use strict';
function buildRegionalScenery(scene,ground,airports,roadData,cityData,taipeiBounds){
  const tileSize=1600, tiles=new Map();
  const tileKey=(x,z)=>x+':'+z;
  function tileAt(x,z){
    const id=tileKey(Math.floor(x/tileSize),Math.floor(z/tileSize));
    if(!tiles.has(id)) tiles.set(id,{roads:[],buildings:[]});
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
  for(const [width,bridge,coords] of roadData){
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
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],x=(a.x+b.x)/2,z=(a.z+b.z)/2;
      const {lat,lon}=latLon(x,z);
      const insideTaipei=lat>=taipeiBounds[0]&&lat<=25.11&&lon>=taipeiBounds[1]&&lon<=taipeiBounds[3];
      if(insideTaipei) continue;
      const lift=distance=>bridge?Math.min(1,distance/48,(lengths.at(-1)-distance)/48)*4.8:0;
      tileAt(x,z).roads.push({a,b,width,normalA:normals[i-1],normalB:normals[i],
        riseA:lift(lengths[i-1]),riseB:lift(lengths[i])});
    }
  }
  for(const [lat,lon,width,depth,height,tone] of cityData){
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
  const wall=new THREE.MeshStandardMaterial({color:0xffffff,map:facadeTexture,roughness:.88});
  const roof=new THREE.MeshStandardMaterial({color:0xb6b4a9,roughness:.95});
  const buildings=new THREE.InstancedMesh(new THREE.BoxGeometry(),[wall,wall,roof,roof,wall,wall],28000);
  buildings.name='Regional city volumes';
  buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buildings.count=0;
  scene.add(buildings);
  const boxMatrix=new THREE.Object3D(),color=new THREE.Color();
  const palette=[0xa6a3a1,0xc9c2ad,0x9fa9af,0xada299,0x9dada7,0xc7c8c2,0xa3a7b0];
  let last='';
  function meshGeometry(mesh,positions){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry=geometry;
  }
  function update(x,z,quality){
    const col=Math.floor(x/tileSize),row=Math.floor(z/tileSize),key=tileKey(col,row)+':'+quality;
    if(last===key) return;
    last=key;
    const reach=quality==='low'?4:quality==='high'?8:6;
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
        for(const b of tile.buildings){
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
