'use strict';

function createTaiwanOverview(){
  const center=geoPoint(24.1,120.10);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x205774);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,1,750000);
  camera.position.set(center.x,550000,center.z);
  camera.up.set(0,0,-1);
  camera.lookAt(center.x,0,center.z);

  // Both horizontal axes are in the simulation's projected metres.
  const [left,top,width,height]=taiwanSatelliteData.overview,step=1920;
  const geometry=new THREE.PlaneGeometry(width,height,Math.ceil(width/step),Math.ceil(height/step));
  geometry.rotateX(-Math.PI/2);
  geometry.translate(left+width/2,0,top+height/2);
  const points=geometry.attributes.position;
  const colors=new Float32Array(points.count*3);
  const color=new THREE.Color(),sea=new THREE.Color(0x205774),coast=new THREE.Color(0x4d7658);
  const forest=new THREE.Color(0x325b47),ridge=new THREE.Color(0xbbb7a1);
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),z=points.getZ(i),h=regionalHeight(x,z);
    points.setY(i,h);
    if(h<1.5) color.copy(sea);
    else{
      color.copy(coast).lerp(forest,Math.min(1,h/850));
      if(h>1400) color.lerp(ridge,Math.min(1,(h-1400)/2350));
      const shade=(h-regionalHeight(x-step,z-step))/step;
      color.multiplyScalar(Math.max(.72,Math.min(1.24,.96+shade*1.35)));
    }
    color.toArray(colors,i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const material=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});
  const overviewImage={value:null},imageReady={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.overviewImage=overviewImage;
    shader.uniforms.imageReady=imageReady;
    shader.vertexShader='varying vec2 overviewUV;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\n overviewUV=uv;');
    shader.fragmentShader='varying vec2 overviewUV;\nuniform sampler2D overviewImage;\nuniform float imageReady;\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        if(imageReady>0.5){
          vec4 image=texture2D(overviewImage,overviewUV);
          diffuseColor.rgb=mix(diffuseColor.rgb,image.rgb,image.a);
        }
      `);
  };
  loadTaiwanAtlas().then(texture=>{
    overviewImage.value=texture;
    imageReady.value=1;
    document.getElementById('satelliteCredit').hidden=false;
  }).catch(()=>{});
  const overviewTerrain=new THREE.Mesh(geometry,material);
  scene.add(overviewTerrain);
  const distantTerrain=overviewTerrain.clone();
  distantTerrain.position.y=-40;

  // 3D Label Sprite Helper for Airports, VORs, and Multiplayer Callsigns
  function createTagSprite(text, borderColor='#6ee7ff', textColor='#ffffff', bgColor='rgba(9, 23, 36, 0.86)'){
    if(typeof document==='undefined') return null;
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=56;
    const ctx=canvas.getContext('2d');
    if(!ctx) return null;
    ctx.font='bold 24px system-ui, -apple-system, sans-serif';
    const textW=Math.min(220, ctx.measureText(text).width);
    const boxW=Math.max(78, textW+26);
    const x0=(256-boxW)/2;
    ctx.fillStyle=bgColor;
    ctx.strokeStyle=borderColor;
    ctx.lineWidth=3;
    if(ctx.roundRect){
      ctx.beginPath();ctx.roundRect(x0,8,boxW,40,10);ctx.fill();ctx.stroke();
    }else{
      ctx.fillRect(x0,8,boxW,40);ctx.strokeRect(x0,8,boxW,40);
    }
    ctx.fillStyle=textColor;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(text,128,29);
    const tex=new THREE.CanvasTexture(canvas);
    tex.minFilter=THREE.LinearFilter;
    const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,toneMapped:false});
    const sprite=new THREE.Sprite(mat);
    sprite.userData={text,boxW};
    return sprite;
  }

  // 3D Airport & Waypoint Markers
  const airportGroup=new THREE.Group();
  scene.add(airportGroup);
  // Diamond shape for airports
  const diamondShape=new THREE.Shape();
  diamondShape.moveTo(0,1.2);
  diamondShape.lineTo(1.2,0);
  diamondShape.lineTo(0,-1.2);
  diamondShape.lineTo(-1.2,0);
  diamondShape.closePath();
  const diamondGeo=new THREE.ShapeGeometry(diamondShape);
  diamondGeo.rotateX(-Math.PI/2);
  const airportMat=new THREE.MeshBasicMaterial({color:0x6ee7ff,toneMapped:false});
  const destAirportMat=new THREE.MeshBasicMaterial({color:0xffcf5e,toneMapped:false});

  const airportMeshes=new Map();
  const airportLabels=new Map();
  if(typeof allAirports!=='undefined'&&Array.isArray(allAirports)){
    for(const ap of allAirports){
      const mesh=new THREE.Mesh(diamondGeo,airportMat);
      mesh.position.set(ap.x,8500,ap.z);
      mesh.userData={code:ap.code,name:ap.name,x:ap.x,z:ap.z};
      airportGroup.add(mesh);
      airportMeshes.set(ap.code,mesh);

      const label=createTagSprite(`${ap.code} ${ap.shortName||ap.name||''}`.trim(),'rgba(110, 231, 255, 0.7)','#eaf9ff');
      if(label){
        label.position.set(ap.x,9600,ap.z+3200);
        airportGroup.add(label);
        airportLabels.set(ap.code,label);
      }
    }
  }

  // VOR / Airways Beacons on Overview
  const vorMeshes=[];
  const vorLabels=[];
  if(typeof airwaysNav!=='undefined'&&typeof airwaysNav.getVORStations==='function'){
    airwaysNav.ensureVORCoordinates?.(geoPoint);
    const vors=airwaysNav.getVORStations()||[];
    const vorGeo=new THREE.RingGeometry(0.6,1.1,6);
    vorGeo.rotateX(-Math.PI/2);
    const vorMat=new THREE.MeshBasicMaterial({color:0x00e5a3,toneMapped:false,side:THREE.DoubleSide});
    for(const v of vors){
      if(!Number.isFinite(v.x)||!Number.isFinite(v.z)) continue;
      const vm=new THREE.Mesh(vorGeo,vorMat);
      vm.position.set(v.x,8400,v.z);
      scene.add(vm);
      vorMeshes.push(vm);
      const vl=createTagSprite(`VOR ${v.id}`,'rgba(0, 229, 163, 0.65)','#7affbe','rgba(6, 26, 28, 0.82)');
      if(vl){
        vl.position.set(v.x,9400,v.z-2800);
        scene.add(vl);
        vorLabels.push(vl);
      }
    }
  }

  // Route Polyline
  const routePoints=[new THREE.Vector3(),new THREE.Vector3()];
  const routeGeo=new THREE.BufferGeometry().setFromPoints(routePoints);
  const routeMat=new THREE.LineBasicMaterial({color:0x80dcff,transparent:true,opacity:0.85,toneMapped:false});
  const routeLine=new THREE.Line(routeGeo,routeMat);
  scene.add(routeLine);

  // Multi-aircraft Marker (Heading Needle + Pulse Ring)
  const markerGroup=new THREE.Group();
  const arrowShape=new THREE.Shape();
  arrowShape.moveTo(0,-1.5);
  arrowShape.lineTo(1.0,1.0);
  arrowShape.lineTo(0,0.5);
  arrowShape.lineTo(-1.0,1.0);
  arrowShape.closePath();
  const arrowGeo=new THREE.ShapeGeometry(arrowShape);
  arrowGeo.rotateX(-Math.PI/2);
  const arrowMat=new THREE.MeshBasicMaterial({color:0xffcf5e,toneMapped:false});
  const arrowMesh=new THREE.Mesh(arrowGeo,arrowMat);
  markerGroup.add(arrowMesh);

  const ringGeo=new THREE.RingGeometry(1.6,2.0,24);
  ringGeo.rotateX(-Math.PI/2);
  const ringMat=new THREE.MeshBasicMaterial({color:0xffa834,transparent:true,opacity:0.7,toneMapped:false});
  const ringMesh=new THREE.Mesh(ringGeo,ringMat);
  markerGroup.add(ringMesh);
  scene.add(markerGroup);

  // Multiplayer Peer Markers & Labels
  const peerMarkers=new Map();
  const peerLabels=new Map();
  const peerArrowMat=new THREE.MeshBasicMaterial({color:0x00e5ff,toneMapped:false});

  let currentScaleFactor=1;
  let spriteScaleBase=1;
  function updateSpriteScales(){
    for(const lbl of airportLabels.values()){
      lbl.scale.set(spriteScaleBase*32, spriteScaleBase*7, 1);
    }
    for(const vl of vorLabels){
      vl.scale.set(spriteScaleBase*24, spriteScaleBase*5.2, 1);
    }
    for(const vm of vorMeshes){
      vm.scale.setScalar(currentScaleFactor*0.85);
    }
    for(const pl of peerLabels.values()){
      pl.scale.set(spriteScaleBase*34, spriteScaleBase*7.5, 1);
    }
  }

  function resize(w,h){
    const aspect=w/h,halfHeight=Math.max(265000,218000/aspect);
    camera.left=-halfHeight*aspect;
    camera.right=halfHeight*aspect;
    camera.top=halfHeight;
    camera.bottom=-halfHeight;
    camera.updateProjectionMatrix();
    currentScaleFactor=7*2*halfHeight/h;
    spriteScaleBase=(2*halfHeight)/h*2.6;
    markerGroup.scale.setScalar(currentScaleFactor*1.3);
    for(const mesh of airportMeshes.values()){
      mesh.scale.setScalar(currentScaleFactor*1.1);
    }
    for(const pMesh of peerMarkers.values()){
      pMesh.scale.setScalar(currentScaleFactor*1.1);
    }
    updateSpriteScales();
    return 50000*w/(camera.right-camera.left);
  }
  function draw(renderer,f){
    markerGroup.position.set(f.x,9000,f.z);
    markerGroup.rotation.y=-f.heading;

    // Pulse animation on aircraft beacon ring
    const t=(typeof performance!=='undefined'?performance.now():Date.now())*0.004;
    const pulse=1.0+0.35*Math.sin(t);
    ringMesh.scale.setScalar(pulse);
    ringMat.opacity=0.45+0.35*(0.5+0.5*Math.cos(t));

    // Highlight Destination Airport
    if(f.destination&&airportMeshes.has(f.destination.code)){
      for(const [code,mesh] of airportMeshes){
        const isDest=code===f.destination.code;
        mesh.material=isDest?destAirportMat:airportMat;
        mesh.scale.setScalar(isDest?currentScaleFactor*1.8:currentScaleFactor*1.1);
        const lbl=airportLabels.get(code);
        if(lbl){
          lbl.scale.set(spriteScaleBase*(isDest?40:30), spriteScaleBase*(isDest?8.8:6.6), 1);
        }
      }
    }

    // Dynamic Route Line
    if(f.route&&f.route.length>0){
      const pts=[new THREE.Vector3(f.x,8800,f.z)];
      const startIndex=Math.max(0,f.waypoint||0);
      for(let i=startIndex;i<f.route.length;i++){
        pts.push(new THREE.Vector3(f.route[i].x,8800,f.route[i].z));
      }
      if(f.destination) pts.push(new THREE.Vector3(f.destination.x,8800,f.destination.z));
      routeLine.geometry.dispose();
      routeLine.geometry=new THREE.BufferGeometry().setFromPoints(pts);
      routeLine.visible=true;
    }else if(f.destination){
      const pts=[new THREE.Vector3(f.x,8800,f.z),new THREE.Vector3(f.destination.x,8800,f.destination.z)];
      routeLine.geometry.dispose();
      routeLine.geometry=new THREE.BufferGeometry().setFromPoints(pts);
      routeLine.visible=true;
    }else{
      routeLine.visible=false;
    }

    // Multiplayer Peers with Callsign Labels
    if(typeof multiplayer!=='undefined'&&multiplayer.isConnected()){
      const activePeers=multiplayer.getPeers();
      const currentIds=new Set();
      for(const peer of activePeers){
        if(!peer.state) continue;
        currentIds.add(peer.id);
        let pm=peerMarkers.get(peer.id);
        if(!pm){
          pm=new THREE.Mesh(arrowGeo,peerArrowMat);
          pm.scale.setScalar(currentScaleFactor*1.2);
          scene.add(pm);
          peerMarkers.set(peer.id,pm);

          const pl=createTagSprite(`✈ ${peer.callsign||'PEER'}`,'#00e5ff','#7affbe','rgba(6, 20, 32, 0.90)');
          if(pl){
            pl.scale.set(spriteScaleBase*34, spriteScaleBase*7.5, 1);
            scene.add(pl);
            peerLabels.set(peer.id,pl);
          }
        }
        pm.position.set(peer.state.x,8900,peer.state.z);
        pm.rotation.y=-(peer.state.heading||0);
        pm.visible=true;
        const pl=peerLabels.get(peer.id);
        if(pl){
          pl.position.set(peer.state.x,9700,peer.state.z-3200);
          pl.visible=true;
        }
      }
      for(const [id,pm] of peerMarkers){
        if(!currentIds.has(id)){
          pm.visible=false;
          scene.remove(pm);
          peerMarkers.delete(id);
        }
      }
      for(const [id,pl] of peerLabels){
        if(!currentIds.has(id)){
          pl.visible=false;
          scene.remove(pl);
          peerLabels.delete(id);
        }
      }
    }else{
      for(const pm of peerMarkers.values()){
        pm.visible=false;
        scene.remove(pm);
      }
      peerMarkers.clear();
      for(const pl of peerLabels.values()){
        pl.visible=false;
        scene.remove(pl);
      }
      peerLabels.clear();
    }

    renderer.render(scene,camera);
  }
  return {distantTerrain,resize,draw,airportLabels,peerLabels};
}
