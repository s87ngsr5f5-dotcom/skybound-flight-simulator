'use strict';
function createTreeCover(source){
  const runs=atob(source.runs);
  const density=new Uint8Array(source.columns*source.rows);
  let index=0;
  for(let i=0;i<runs.length;i++){
    const run=runs.charCodeAt(i), end=index+(run&15)+1;
    density.fill(run>>>4,index,end);
    index=end;
  }
  return (x,z)=>{
    const {lat,lon}=latLon(x,z);
    const col=Math.floor((lon-source.west)/source.step);
    const row=Math.floor((source.north-lat)/source.step);
    if(col<0||row<0||col>=source.columns||row>=source.rows) return null;
    return density[row*source.columns+col]/15;
  };
}
function buildVegetation(scene,ground,airports,map,cover,highways){
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
  function pathMask(path,radius,clearCanopy=false){
    const points=path.map(([lat,lon])=>geoPoint(lat,lon));
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z;
      const lengthSquared=dx*dx+dz*dz;
      if(!lengthSquared) continue;
      const padding=radius+(clearCanopy?40:0);
      index(Math.min(a.x,b.x)-padding,Math.min(a.z,b.z)-padding,
        Math.max(a.x,b.x)+padding,Math.max(a.z,b.z)+padding,(x,z,crown)=>{
          const clearance=radius+(clearCanopy?crown:0);
          const t=Math.min(1,Math.max(0,((x-a.x)*dx+(z-a.z)*dz)/lengthSquared));
          return (x-a.x-t*dx)**2+(z-a.z-t*dz)**2<clearance**2;
        });
    }
  }
  for(const road of map.roads){
    if(!road.tunnel) pathMask(road.p,road.kind==='motorway'?12:9,true);
  }
  for(const [width,,coords] of highways){
    const path=[];
    for(let i=0;i<coords.length;i+=2) path.push([coords[i],coords[i+1]]);
    pathMask(path,width/2+2,true);
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
  const limit=23000;
  const bark=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,envMapIntensity:.12});
  const leaves=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,envMapIntensity:.15});
  // A small shared texture breaks up the solid color of the nearest crowns.
  const tile=document.createElement('canvas');
  tile.width=tile.height=128;
  const ink=tile.getContext('2d');
  ink.fillStyle='#b5b5b5';
  ink.fillRect(0,0,128,128);
  for(let i=0;i<2100;i++){
    const x=hash(i,0,20)*128,z=hash(i,0,21)*128;
    const shade=100+Math.round(hash(i,0,22)*145);
    ink.fillStyle='rgb('+shade+' '+shade+' '+shade+')';
    ink.beginPath();
    ink.ellipse(x,z,1.2+hash(i,0,23)*2.6,.6+hash(i,0,24)*1.2,hash(i,0,25)*Math.PI,0,Math.PI*2);
    ink.fill();
  }
  const leafTexture=new THREE.CanvasTexture(tile);
  leafTexture.colorSpace=THREE.SRGBColorSpace;
  leafTexture.wrapS=leafTexture.wrapT=THREE.RepeatWrapping;
  leafTexture.repeat.set(3,2);
  const detailedLeaves=leaves.clone();
  detailedLeaves.map=leafTexture;
  function batch(name,geometry,material){
    const mesh=new THREE.InstancedMesh(geometry,material,limit);
    mesh.name=name;
    mesh.count=0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return mesh;
  }
  const trunks=batch('Vegetation trunks',new THREE.CylinderGeometry(.68,1,1,7),bark);
  const crowns=batch('Vegetation crowns',new THREE.IcosahedronGeometry(1,1),detailedLeaves);
  const branches=batch('Vegetation crown lobes',new THREE.IcosahedronGeometry(1,0),detailedLeaves);
  const distant=batch('Vegetation distant crowns',new THREE.IcosahedronGeometry(1,0),leaves);
  const matrix=new THREE.Object3D(), color=new THREE.Color();
  const up=new THREE.Vector3(0,1,0), normal=new THREE.Vector3(), yawRotation=new THREE.Quaternion();
  let last='';
  function hash(x,z,salt){
    let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(salt,1442695041);
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967296;
  }
  function place(mesh,x,y,z,sx,sy,sz,yaw,slopeX=0,slopeZ=0){
    if(mesh.count>=limit) return;
    matrix.position.set(x,y,z);
    matrix.scale.set(sx,sy,sz);
    normal.set(-slopeX,1,-slopeZ).normalize();
    matrix.quaternion.setFromUnitVectors(up,normal).multiply(yawRotation.setFromAxisAngle(up,yaw));
    matrix.updateMatrix();
    mesh.setMatrixAt(mesh.count,matrix.matrix);
    mesh.setColorAt(mesh.count++,color);
  }
  function blocked(x,z,radius){
    for(const a of airports){
      const reach=a.length/2+460+radius;
      if(Math.abs(x-a.x)>reach||Math.abs(z-a.z)>reach) continue;
      const frame=runwayCoordinates(x,z,a);
      if(Math.abs(frame.along)<reach&&Math.abs(frame.cross)<Math.max(325,Math.abs(a.apron)+135)+radius) return true;
    }
    const cell=masks.get(key(Math.floor(x/maskSize),Math.floor(z/maskSize)));
    return cell?.some(test=>test(x,z,radius));
  }
  function update(x,z,quality){
    const spacing=96;
    const col=Math.floor(x/spacing),row=Math.floor(z/spacing),id=key(col,row)+':'+quality;
    if(last===id) return;
    last=id;
    for(const mesh of [trunks,crowns,branches,distant]) mesh.count=0;
    const [near,mid,far]=quality==='ultra'?[680,2200,7300]:quality==='low'?[215,930,2900]:quality==='high'?[450,1500,5300]:[320,1200,4200];
    const centerX=(col+.5)*spacing,centerZ=(row+.5)*spacing;
    for(const [grid,inner,outer,detail] of [[10,0,near,2],[23,near,mid,1],[54,mid,far,0]]){
      for(let iz=Math.floor((centerZ-outer)/grid);iz*grid<centerZ+outer;iz++){
        for(let ix=Math.floor((centerX-outer)/grid);ix*grid<centerX+outer;ix++){
          const tx=(ix+.12+.76*hash(ix,iz,1))*grid,tz=(iz+.12+.76*hash(ix,iz,2))*grid;
          const distance=(tx-centerX)**2+(tz-centerZ)**2;
          if(distance<inner**2||distance>outer**2) continue;
          const elevation=ground(tx,tz);
          if(elevation<1.5||elevation>3500) continue;
          const measured=cover(tx,tz);
          const fallback=elevation<40?.04:elevation<120?.24:.78;
          const density=measured??fallback;
          if(hash(ix,iz,3)>density) continue;
          const size=hash(ix,iz,4), tall=hash(ix,iz,5)>.84;
          const height=8+size*10;
          const width=detail===2?height*(tall?.30:.47):grid*(.40+density*.23);
          if(blocked(tx,tz,width*(detail===2?1.25:1)+1)) continue;
          const angle=hash(ix,iz,6)*Math.PI*2;
          const grove=hash(Math.floor(tx/65),Math.floor(tz/65),8);
          color.setHSL(.225+grove*.08,.36+grove*.14,.25+size*.09+grove*.06,THREE.SRGBColorSpace);
          if(detail===2){
            place(crowns,tx,elevation+height*.69,tz,width,height*(tall?.42:.34),width*.88,angle);
            color.multiplyScalar(.83);
            const dx=Math.cos(angle)*width*.53,dz=Math.sin(angle)*width*.53;
            place(branches,tx+dx,elevation+height*.59,tz+dz,width*.69,height*.24,width*.69,angle);
            place(branches,tx-dx,elevation+height*.79,tz-dz,width*.64,height*.23,width*.64,angle);
            color.setHSL(.08,.34,.27+size*.09,THREE.SRGBColorSpace);
            place(trunks,tx,elevation+height*.23-.35,tz,.19+size*.23,height*.48,.19+size*.23,angle);
          }else{
            // A wider crown stands in for a group of trees beyond the near view.
            const probe=grid*.30;
            const slopeX=(ground(tx+probe,tz)-elevation)/probe;
            const slopeZ=(ground(tx,tz+probe)-elevation)/probe;
            place(distant,tx,elevation+height*.39,tz,width,height*.49,width*.92,angle,slopeX,slopeZ);
          }
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
