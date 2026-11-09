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
        if(child!==data.gear||asset.integratedGear) legacy.add(child);
      }
      model.add(legacy);
      const object=gltf.scene;
      if(asset.integratedGear){
        const bounds=new THREE.Box3().setFromObject(object);
        const size=bounds.getSize(new THREE.Vector3());
        const scale=asset.length/size.z;
        object.scale.setScalar(scale);
        object.rotation.y=asset.yaw;
        object.position.y=-bounds.min.y*scale-profile.gearHeight;
      }else{
        object.position.y=-asset.centerHeight;
        addAirframeDetails(object);
      }
      model.add(object);
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
    },undefined,()=>{data.downloadFailed=true;});
  }
  if(data.downloaded){
    // The traffic models have no moving flaps or boarding door geometry.
    const useExternal=asset.integratedGear||(!livery&&!flight?.flaps&&!(flight?.ground&&flight.service));
    data.downloaded.visible=useExternal;
    data.downloadLegacy.visible=!useExternal;
    for(const part of data.downloadGear) part.visible=flight?Boolean(flight.gear):true;
  }
}
