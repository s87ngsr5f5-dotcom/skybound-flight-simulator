const downloadedAirframes={
  sf15:{file:'f15.glb',length:19.46,yaw:Math.PI,integratedGear:true},
  sa380:{file:'ac_a380-c4bd029f.glb',centerHeight:6.1},
  a223:{file:'ac_a220-22f0e703.glb',centerHeight:3.5},
  b773:{file:'ac_b77w-4e801325.glb',centerHeight:5.5}
};

function updateDownloadedAircraft(model,profile,flight,livery){
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
      }
      model.add(object);
      object.visible=false;
      data.downloadLegacy=legacy;
      data.downloaded=object;
      data.downloadGear=[];
      object.traverse(part=>{
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
