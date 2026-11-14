const downloadedAirframes={
  sf15:{file:'f15.glb',length:19.46,yaw:Math.PI,integratedGear:true},
  sa380:{file:'ac_a380-c4bd029f.glb',centerHeight:6.1},
  a223:{file:'ac_a220-22f0e703.glb',centerHeight:3.5},
  b773:{file:'ac_b77w-4e801325.glb',centerHeight:5.5}
};

function addAirframeDetails(object){
  object.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(object);
  const length=bounds.max.z-bounds.min.z;
  const ray=new THREE.Raycaster();
  const down=new THREE.Vector3(0,-1,0);
  const trim=new THREE.MeshStandardMaterial({color:0xb7c5cc,roughness:.34,metalness:.48});
  const beaconMaterial=new THREE.MeshStandardMaterial({color:0xa31d23,emissive:0x62030a,roughness:.25});
  const details=new THREE.Group();
  for(const [fraction,height,width] of [[.27,.26,.08],[.46,.18,.18],[.65,.24,.07]]){
    ray.set(new THREE.Vector3(0,bounds.max.y+1,bounds.min.z+length*fraction),down);
    const hit=ray.intersectObject(object,true)[0];
    if(!hit) continue;
    const beacon=fraction===.46;
    const geometry=beacon?new THREE.SphereGeometry(.11,20,12):new THREE.BoxGeometry(width,height,.35);
    const part=new THREE.Mesh(geometry,beacon?beaconMaterial:trim);
    part.position.copy(object.worldToLocal(hit.point.clone()));
    part.position.y+=beacon?.035:height*.45;
    if(beacon) part.scale.y=.48;
    else part.rotation.x=.26;
    part.castShadow=true;
    details.add(part);
  }
  object.add(details);
}

function updateDownloadedAircraft(model,profile,flight,livery,anisotropy){
  const asset=downloadedAirframes[profile.id];
  if(!asset) return;
  const data=model.userData;
  if(!data.downloadStarted){
    data.downloadStarted=true;
    new THREE.GLTFLoader().load('models/'+asset.file,gltf=>{
      const legacy=new THREE.Group();
      for(const child of [...model.children]){
        legacy.add(child);
      }
      model.add(legacy);
      const object=gltf.scene;
      model.add(object);
      if(asset.integratedGear){
        object.updateMatrixWorld(true);
        const bounds=new THREE.Box3().setFromObject(object);
        const size=bounds.getSize(new THREE.Vector3());
        const scale=asset.length/Math.max(.1,size.z);
        object.scale.setScalar(scale);
        object.rotation.y=asset.yaw;
        object.updateMatrixWorld(true);
        const sb=new THREE.Box3().setFromObject(object);
        object.position.y+=-profile.gearHeight-sb.min.y;
      }else{
        object.updateMatrixWorld(true);
        const b=new THREE.Box3().setFromObject(object);
        const clearance=0.52;
        if(Number.isFinite(b.min.y)) object.position.y+=-profile.gearHeight+clearance-b.min.y;
        object.updateMatrixWorld(true);
        addAirframeDetails(object);
      }
      object.visible=false;
      data.downloadLegacy=legacy;
      data.downloaded=object;
      data.downloadGear=[];
      object.traverse(part=>{
        if(part.isMesh){
          part.castShadow=part.receiveShadow=true;
          for(const material of Array.isArray(part.material)?part.material:[part.material]){
            for(const key of ['map','normalMap','roughnessMap','metalnessMap']){
              if(material[key]) material[key].anisotropy=anisotropy;
            }
          }
        }
        if(/Landing_Gear|Tires/.test(part.name)) data.downloadGear.push(part);
      });
      if(!asset.integratedGear&&THREE.Raycaster){
        // Attach clean gear struts & tires strictly between -profile.gearHeight and GLB underside
        object.updateMatrixWorld(true);
        const wb=new THREE.Box3().setFromObject(object);
        const len=Math.max(1,wb.max.z-wb.min.z), cz=(wb.min.z+wb.max.z)*.5;
        const hs=(wb.max.x-wb.min.x)*.5, radius=profile.geometry?.[1]??2.0;
        const ray=new THREE.Raycaster(), up=new THREE.Vector3(0,1,0);
        const metal=new THREE.MeshStandardMaterial({color:0x8a959d,roughness:.35,metalness:.68});
        const tireMat=new THREE.MeshStandardMaterial({color:0x1b2026,roughness:.82});
        const tireR=Math.min(.52,Math.max(.34,radius*.22));
        const attachStrut=(gx,gz,pair)=>{
          ray.set(new THREE.Vector3(gx,-profile.gearHeight-1,gz),up);
          const hit=ray.intersectObject(object,true)[0];
          if(!hit) return;
          const localTop=object.worldToLocal(hit.point.clone());
          const localBot=object.worldToLocal(new THREE.Vector3(gx,-profile.gearHeight+tireR,gz));
          const gap=localTop.y-localBot.y;
          if(gap<0.15) return;
          const strutG=new THREE.Group();
          const sGeo=new THREE.CylinderGeometry(tireR*.20,tireR*.17,gap+0.12,10);
          const sMesh=new THREE.Mesh(sGeo,metal);
          sMesh.position.set(localTop.x,(localTop.y+localBot.y)*.5+.04,localTop.z);
          strutG.add(sMesh);
          const tireGeo=new THREE.CylinderGeometry(tireR,tireR,tireR*.52,18);
          tireGeo.rotateZ(Math.PI/2);
          for(const ox of (pair?[-tireR*.52,tireR*.52]:[-tireR*.32,tireR*.32])){
            const tMesh=new THREE.Mesh(tireGeo,tireMat);
            tMesh.position.set(localBot.x+ox,localBot.y,localBot.z);
            strutG.add(tMesh);
          }
          object.add(strutG);
          data.downloadGear.push(strutG);
        };
        attachStrut(0,cz-len*.36,false);
        const mainX=Math.min(hs*.26,radius*1.45);
        attachStrut(-mainX,cz+len*.05,true);
        attachStrut(mainX,cz+len*.05,true);
      }
    },undefined,()=>{data.downloadFailed=true;});
  }
  if(data.downloaded){
    // Keep any re-applied skin decals inside legacy so external GLB has zero overlapping decal slabs.
    if(data.decalGroup&&data.decalGroup.parent===model&&data.downloadLegacy){
      data.downloadLegacy.add(data.decalGroup);
    }
    // The traffic models have no moving flaps or boarding door geometry.
    const useExternal=asset.integratedGear||(!livery&&!flight?.flaps&&!(flight?.ground&&flight.service));
    data.downloaded.visible=useExternal;
    data.downloadLegacy.visible=!useExternal;
    for(const part of data.downloadGear) part.visible=flight?Boolean(flight.gear):true;
  }
}
