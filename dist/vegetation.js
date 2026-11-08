'use strict';
function buildVegetation(scene,ground,airports,map){
  // Index mapped obstructions once. A tree only checks features in its own cell.
  const masks=new Map(), maskSize=120;
  const key=(x,z)=>x+':'+z;
  function index(x0,z0,x1,z1,test){
    for(let x=Math.floor(x0/maskSize);x<=Math.floor(x1/maskSize);x++){
      for(let z=Math.floor(z0/maskSize);z<=Math.floor(z1/maskSize);z++){
        const id=key(x,z);
        if(!masks.has(id)) masks.set(id,[]);
        masks.get(id).push(test);
      }
    }
  }
  function pathMask(path,radius){
    const points=path.map(([lat,lon])=>geoPoint(lat,lon));
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z;
      const lengthSquared=dx*dx+dz*dz;
      if(!lengthSquared) continue;
      index(Math.min(a.x,b.x)-radius,Math.min(a.z,b.z)-radius,
        Math.max(a.x,b.x)+radius,Math.max(a.z,b.z)+radius,(x,z)=>{
          const t=Math.min(1,Math.max(0,((x-a.x)*dx+(z-a.z)*dz)/lengthSquared));
          return (x-a.x-t*dx)**2+(z-a.z-t*dz)**2<radius**2;
        });
    }
  }
  for(const road of map.roads){
    if(!road.tunnel) pathMask(road.p,road.kind==='motorway'?16:13);
  }
  for(const river of map.rivers){
    const width=river.name.includes('基隆')?120:river.name.includes('淡水')?180:
      river.name.includes('新店')?130:river.name.includes('大漢')?160:18;
    pathMask(river.p,width/2+8);
  }
  for(const building of map.buildings){
    const points=building.p.map(([lat,lon])=>geoPoint(lat,lon));
    const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
    const x0=Math.min(...xs)-4,x1=Math.max(...xs)+4,z0=Math.min(...zs)-4,z1=Math.max(...zs)+4;
    index(x0,z0,x1,z1,(x,z)=>x>=x0&&x<=x1&&z>=z0&&z<=z1);
  }
  const limit=10000;
  const bark=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,envMapIntensity:.12});
  const leaves=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,envMapIntensity:.15});
  function batch(name,geometry,material){
    const mesh=new THREE.InstancedMesh(geometry,material,limit);
    mesh.name=name;
    mesh.count=0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return mesh;
  }
  const trunks=batch('Vegetation trunks',new THREE.CylinderGeometry(.68,1,1,7),bark);
  const crowns=batch('Vegetation crowns',new THREE.IcosahedronGeometry(1,1),leaves);
  const branches=batch('Vegetation crown lobes',new THREE.IcosahedronGeometry(1,0),leaves);
  const distant=batch('Vegetation distant crowns',new THREE.IcosahedronGeometry(1,0),leaves);
  const matrix=new THREE.Object3D(), color=new THREE.Color();
  const grid=27;
  let last='';
  function hash(x,z,salt){
    let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(salt,1442695041);
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967296;
  }
  function place(mesh,x,y,z,sx,sy,sz,yaw){
    if(mesh.count>=limit) return;
    matrix.position.set(x,y,z);
    matrix.scale.set(sx,sy,sz);
    matrix.rotation.y=yaw;
    matrix.updateMatrix();
    mesh.setMatrixAt(mesh.count,matrix.matrix);
    mesh.setColorAt(mesh.count++,color);
  }
  function update(x,z,quality){
    const spacing=grid*9;
    const col=Math.floor(x/spacing),row=Math.floor(z/spacing),id=key(col,row)+':'+quality;
    if(last===id) return;
    last=id;
    for(const mesh of [trunks,crowns,branches,distant]) mesh.count=0;
    const near=quality==='low'?760:quality==='high'?1600:1200;
    const far=quality==='low'?2900:quality==='high'?5700:4400;
    const centerX=(col+.5)*spacing,centerZ=(row+.5)*spacing;
    for(let iz=Math.floor((centerZ-far)/grid);iz*grid<centerZ+far;iz++){
      for(let ix=Math.floor((centerX-far)/grid);ix*grid<centerX+far;ix++){
        const distance=(ix*grid-centerX)**2+(iz*grid-centerZ)**2;
        if(distance>far**2) continue;
        const close=distance<near**2;
        if(!close&&(ix%3||iz%3)) continue;
        const tx=(ix+.12+.76*hash(ix,iz,1))*grid,tz=(iz+.12+.76*hash(ix,iz,2))*grid;
        const elevation=ground(tx,tz);
        if(elevation<1.5||elevation>3200) continue;
        if(hash(ix,iz,3)>(elevation<18?.27:elevation<80?.55:.82)) continue;
        if(airports.some(a=>{
          const reach=a.length/2+460;
          if(Math.abs(tx-a.x)>reach||Math.abs(tz-a.z)>reach) return false;
          const frame=runwayCoordinates(tx,tz,a);
          return Math.abs(frame.along)<reach&&Math.abs(frame.cross)<Math.max(325,Math.abs(a.apron)+135);
        })) continue;
        const cell=masks.get(key(Math.floor(tx/maskSize),Math.floor(tz/maskSize)));
        if(cell?.some(test=>test(tx,tz))) continue;

        const size=hash(ix,iz,4),tall=hash(ix,iz,5)>.72;
        const height=5.5+size*9, width=height*(tall?.24:.37);
        const angle=hash(ix,iz,6)*Math.PI*2;
        color.setHSL(.235+hash(ix,iz,7)*.085,.40,.29+size*.12,THREE.SRGBColorSpace);
        if(close){
          place(crowns,tx,elevation+height*.68,tz,width,height*(tall?.39:.31),width*.9,angle);
          color.multiplyScalar(.83);
          const dx=Math.cos(angle)*width*.52,dz=Math.sin(angle)*width*.52;
          place(branches,tx+dx,elevation+height*.60,tz+dz,width*.68,height*.22,width*.68,angle);
          place(branches,tx-dx,elevation+height*.76,tz-dz,width*.64,height*.23,width*.64,angle);
          color.setHSL(.08,.34,.27+size*.09,THREE.SRGBColorSpace);
          place(trunks,tx,elevation+height*.22-.2,tz,.16+size*.20,height*.46,.16+size*.20,angle);
        }else{
          place(distant,tx,elevation+height*.64,tz,width,height*.35,width*.88,angle);
        }
      }
    }
    for(const mesh of [trunks,crowns,branches,distant]){
      mesh.visible=mesh.count>0;
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
      mesh.computeBoundingSphere();
    }
  }
  return {update};
}
