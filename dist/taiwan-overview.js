'use strict';

function createTaiwanOverview(){
  const center=geoPoint(24.1,120.10);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x163e57);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,100,2600000);
  const viewState={
    mode:'3d', // '3d' oblique relief view | 'top' north-up flat ortho
    zoom:1,
    panX:0,
    panZ:0,
    tiltDeg:36,
    viewW:1280,
    viewH:720,
    baseHalfHeight:265000
  };
  function updateCameraTransform(){
    const fx=center.x+viewState.panX;
    const fz=center.z+viewState.panZ;
    if(viewState.mode==='top'){
      camera.position.set(fx,560000,fz);
      camera.up.set(0,0,-1);
      camera.lookAt(fx,0,fz);
    }else{
      const dist=660000;
      const tilt=viewState.tiltDeg*Math.PI/180;
      camera.position.set(fx,dist*Math.cos(tilt),fz+dist*Math.sin(tilt));
      camera.up.set(0,1,0);
      camera.lookAt(fx,1800,fz);
    }
    camera.updateMatrixWorld();
  }
  updateCameraTransform();

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
  const airportPillars=new Map();
  const airportLabels=new Map();
  const majorHubs=new Set(['RCTP','RCSS','RCMQ','RCKH','RCYU','RCFN','RCBS','RCQC','RCGI','RCLY']);
  const pillarGeo=new THREE.CylinderGeometry(360,520,9000,6);
  const airportPillarMat=new THREE.MeshBasicMaterial({color:0x5ce1ff,transparent:true,opacity:0.42,toneMapped:false});
  const destPillarMat=new THREE.MeshBasicMaterial({color:0xffcf5e,transparent:true,opacity:0.78,toneMapped:false});
  if(typeof allAirports!=='undefined'&&Array.isArray(allAirports)){
    for(const ap of allAirports){
      const mesh=new THREE.Mesh(diamondGeo,airportMat);
      mesh.position.set(ap.x,8800,ap.z);
      mesh.userData={code:ap.code,name:ap.name,x:ap.x,z:ap.z};
      airportGroup.add(mesh);
      airportMeshes.set(ap.code,mesh);

      const groundY=typeof regionalHeight==='function'?Math.max(0,regionalHeight(ap.x,ap.z)):0;
      const pillar=new THREE.Mesh(pillarGeo,airportPillarMat);
      pillar.position.set(ap.x,groundY+4400,ap.z);
      airportGroup.add(pillar);
      airportPillars.set(ap.code,pillar);

      const label=createTagSprite(`${ap.code} ${ap.shortName||ap.name||''}`.trim(),'rgba(110, 231, 255, 0.78)','#eaf9ff');
      if(label){
        label.position.set(ap.x,9600,ap.z);
        label.userData={anchorX:ap.x,anchorY:9600,anchorZ:ap.z,kind:'airport',code:ap.code,baseW:84,baseH:19};
        airportGroup.add(label);
        airportLabels.set(ap.code,label);
      }
    }
  }

  // VOR / Airways Beacons & 3D Airway Corridors on Overview
  const vorMeshes=[];
  const vorLabels=[];
  const vorById=new Map();
  if(typeof airwaysNav!=='undefined'&&typeof airwaysNav.getVORStations==='function'){
    airwaysNav.ensureVORCoordinates?.(geoPoint);
    const vors=airwaysNav.getVORStations()||[];
    const vorGeo=new THREE.RingGeometry(0.6,1.1,6);
    vorGeo.rotateX(-Math.PI/2);
    const vorMat=new THREE.MeshBasicMaterial({color:0x00e5a3,toneMapped:false,side:THREE.DoubleSide});
    for(const v of vors){
      if(!Number.isFinite(v.x)||!Number.isFinite(v.z)) continue;
      vorById.set(v.id,v);
      const vm=new THREE.Mesh(vorGeo,vorMat);
      vm.position.set(v.x,8400,v.z);
      scene.add(vm);
      vorMeshes.push(vm);
      const vl=createTagSprite(`VOR ${v.id}`,'rgba(0, 229, 163, 0.7)','#7affbe','rgba(6, 26, 28, 0.86)');
      if(vl){
        vl.position.set(v.x,9200,v.z);
        vl.userData={anchorX:v.x,anchorY:9200,anchorZ:v.z,kind:'vor',code:v.id,baseW:68,baseH:15};
        scene.add(vl);
        vorLabels.push(vl);
      }
    }
    if(Array.isArray(airwaysNav.civilAirways)){
      const airwayColors={W4:0x38bdf8,B591:0xa78bfa,A1:0x34d399,G581:0xfbbf24};
      for(const aw of airwaysNav.civilAirways){
        if(!Array.isArray(aw.waypoints)||aw.waypoints.length<2) continue;
        const pts=[];
        for(const wid of aw.waypoints){
          const st=vorById.get(wid);
          if(st) pts.push(new THREE.Vector3(st.x,10600,st.z));
        }
        if(pts.length>=2){
          const awGeo=new THREE.BufferGeometry().setFromPoints(pts);
          const awMat=new THREE.LineBasicMaterial({
            color:airwayColors[aw.id]||0x6ee7ff,
            transparent:true,
            opacity:0.42,
            toneMapped:false
          });
          scene.add(new THREE.Line(awGeo,awMat));
        }
      }
    }
  }

  // Route Polyline (Elevated 3D Flight Path)
  const routePoints=[new THREE.Vector3(),new THREE.Vector3()];
  const routeGeo=new THREE.BufferGeometry().setFromPoints(routePoints);
  const routeMat=new THREE.LineBasicMaterial({color:0x80dcff,transparent:true,opacity:0.9,toneMapped:false});
  const routeLine=new THREE.Line(routeGeo,routeMat);
  scene.add(routeLine);

  // Ownship Vertical Altitude Stem (visualizes altitude in 3D oblique view)
  const ownStemGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
  const ownStemMat=new THREE.LineBasicMaterial({color:0xffcf5e,transparent:true,opacity:0.78,toneMapped:false});
  const ownStemLine=new THREE.Line(ownStemGeo,ownStemMat);
  scene.add(ownStemLine);

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

  // Multiplayer Peer Markers, Altitude Stems & Labels
  const peerMarkers=new Map();
  const peerStems=new Map();
  const peerLabels=new Map();
  const peerArrowMat=new THREE.MeshBasicMaterial({color:0x00e5ff,toneMapped:false});
  const peerStemMat=new THREE.LineBasicMaterial({color:0x00e5ff,transparent:true,opacity:0.65,toneMapped:false});

  let currentScaleFactor=1;
  let spriteScaleBase=1;
  function updateSpriteScales(){
    for(const [code,lbl] of airportLabels){
      const bw=lbl.userData?.baseW||84;
      const bh=lbl.userData?.baseH||19;
      lbl.scale.set(spriteScaleBase*bw, spriteScaleBase*bh, 1);
    }
    for(const vl of vorLabels){
      vl.scale.set(spriteScaleBase*68, spriteScaleBase*15, 1);
    }
    for(const vm of vorMeshes){
      vm.scale.setScalar(currentScaleFactor*0.72);
    }
    for(const pl of peerLabels.values()){
      pl.scale.set(spriteScaleBase*94, spriteScaleBase*20, 1);
    }
  }

  function applyFrustum(){
    const aspect=viewState.viewW/Math.max(1,viewState.viewH);
    const halfH=viewState.baseHalfHeight/viewState.zoom;
    camera.left=-halfH*aspect;
    camera.right=halfH*aspect;
    camera.top=halfH;
    camera.bottom=-halfH;
    camera.updateProjectionMatrix();
    const worldPerPx=(2*halfH)/Math.max(1,viewState.viewH);
    currentScaleFactor=6.5*worldPerPx;
    spriteScaleBase=worldPerPx;
    markerGroup.scale.setScalar(currentScaleFactor*1.25);
    for(const mesh of airportMeshes.values()) mesh.scale.setScalar(currentScaleFactor*1.0);
    for(const pMesh of peerMarkers.values()) pMesh.scale.setScalar(currentScaleFactor*1.15);
    updateSpriteScales();
    return 50000*viewState.viewW/Math.max(1,(camera.right-camera.left));
  }

  function resize(w,h){
    viewState.viewW=Math.max(1,w);
    viewState.viewH=Math.max(1,h);
    const aspect=viewState.viewW/viewState.viewH;
    viewState.baseHalfHeight=Math.max(265000,218000/aspect);
    updateCameraTransform();
    return applyFrustum();
  }

  function setViewMode(mode){
    viewState.mode=mode==='top'?'top':'3d';
    updateCameraTransform();
    return viewState.mode;
  }

  function zoomBy(factor){
    viewState.zoom=Math.max(0.55,Math.min(5.2,viewState.zoom*factor));
    return {zoom:viewState.zoom,scalePx:applyFrustum()};
  }

  function panBy(dxPx,dyPx){
    const worldPerPx=spriteScaleBase||400;
    viewState.panX=Math.max(-220000,Math.min(220000,viewState.panX-dxPx*worldPerPx));
    viewState.panZ=Math.max(-260000,Math.min(260000,viewState.panZ-dyPx*worldPerPx));
    updateCameraTransform();
  }

  function resetView(){
    viewState.zoom=1;
    viewState.panX=0;
    viewState.panZ=0;
    updateCameraTransform();
    return {zoom:viewState.zoom,scalePx:applyFrustum()};
  }

  // Screen-space collision-free tag placement for crisp zero-overlap 3D maps
  const projVec=new THREE.Vector3();
  const camRight=new THREE.Vector3();
  const camUp=new THREE.Vector3();
  function declutterLabels(f){
    camera.updateMatrixWorld();
    camRight.setFromMatrixColumn(camera.matrixWorld,0).normalize();
    camUp.setFromMatrixColumn(camera.matrixWorld,1).normalize();
    const w=viewState.viewW, h=viewState.viewH;
    const candidates=[];
    const destCode=f?.destination?.code;
    const depCode=f?.departure?.code;

    for(const pl of peerLabels.values()){
      candidates.push({sprite:pl,priority:120,pw:94,ph:20});
    }
    for(const [code,lbl] of airportLabels){
      const isDest=code===destCode;
      const isDep=code===depCode;
      const isHub=majorHubs.has(code);
      const priority=isDest?110:isDep?95:isHub?70:42;
      const pw=isDest?98:84;
      const ph=isDest?21:18;
      lbl.scale.set(spriteScaleBase*pw, spriteScaleBase*ph, 1);
      candidates.push({sprite:lbl,priority,pw,ph});
    }
    for(const vl of vorLabels){
      candidates.push({sprite:vl,priority:22,pw:68,ph:15});
    }

    candidates.sort((a,b)=>b.priority-a.priority);
    const placed=[];
    const slots=[
      {cx:0.5,cy:0.0,ox:0,oy:-9},
      {cx:0.5,cy:1.0,ox:0,oy:9},
      {cx:0.0,cy:0.5,ox:10,oy:0},
      {cx:1.0,cy:0.5,ox:-10,oy:0},
      {cx:0.5,cy:0.0,ox:0,oy:-28},
      {cx:0.5,cy:1.0,ox:0,oy:28},
    ];
    const pad=5;

    for(const c of candidates){
      const s=c.sprite;
      const u=s.userData;
      if(!u||!Number.isFinite(u.anchorX)){s.visible=false;continue;}
      projVec.set(u.anchorX,u.anchorY,u.anchorZ).project(camera);
      if(projVec.z<-1||projVec.z>1||Math.abs(projVec.x)>1.08||Math.abs(projVec.y)>1.08){
        s.visible=false;
        continue;
      }
      const px=(projVec.x*0.5+0.5)*w;
      const py=(-projVec.y*0.5+0.5)*h;
      let chosen=null;
      for(const slot of slots){
        const anchorScreenX=px+slot.ox;
        const anchorScreenY=py+slot.oy;
        const x1=anchorScreenX-slot.cx*c.pw;
        const x2=x1+c.pw;
        const y2=anchorScreenY+slot.cy*c.ph;
        const y1=y2-c.ph;
        if(x1<6||x2>w-6||y1<56||y2>h-48) continue;
        let hit=false;
        for(const b of placed){
          if(x1<b.x2+pad&&x2>b.x1-pad&&y1<b.y2+pad&&y2>b.y1-pad){hit=true;break;}
        }
        if(!hit){
          chosen={slot,box:{x1,y1,x2,y2}};
          break;
        }
      }
      if(!chosen){
        s.visible=false;
        continue;
      }
      // Convert exact screen pixel offset (ox right, oy down) into world space
      const worldX=u.anchorX + camRight.x*chosen.slot.ox*spriteScaleBase - camUp.x*chosen.slot.oy*spriteScaleBase;
      const worldY=u.anchorY + camRight.y*chosen.slot.ox*spriteScaleBase - camUp.y*chosen.slot.oy*spriteScaleBase;
      const worldZ=u.anchorZ + camRight.z*chosen.slot.ox*spriteScaleBase - camUp.z*chosen.slot.oy*spriteScaleBase;
      s.position.set(worldX,worldY,worldZ);
      s.center.set(chosen.slot.cx, chosen.slot.cy);
      s.visible=true;
      placed.push(chosen.box);
    }
  }

  function draw(renderer,f){
    const acAlt=Math.max(9200, (f.y||0)+4000);
    markerGroup.position.set(f.x,acAlt,f.z);
    markerGroup.rotation.y=-f.heading;

    const gY=typeof regionalHeight==='function'?Math.max(0,regionalHeight(f.x,f.z)):0;
    const stemArr=ownStemLine.geometry.attributes.position.array;
    stemArr[0]=f.x;stemArr[1]=gY;stemArr[2]=f.z;
    stemArr[3]=f.x;stemArr[4]=acAlt;stemArr[5]=f.z;
    ownStemLine.geometry.attributes.position.needsUpdate=true;

    // Pulse animation on aircraft beacon ring
    const t=(typeof performance!=='undefined'?performance.now():Date.now())*0.004;
    const pulse=1.0+0.35*Math.sin(t);
    ringMesh.scale.setScalar(pulse);
    ringMat.opacity=0.45+0.35*(0.5+0.5*Math.cos(t));

    // Highlight Destination Airport & 3D Light Pillar
    const destCode=f.destination?.code;
    for(const [code,mesh] of airportMeshes){
      const isDest=code===destCode;
      mesh.material=isDest?destAirportMat:airportMat;
      mesh.scale.setScalar(isDest?currentScaleFactor*1.7:currentScaleFactor*1.0);
      const pillar=airportPillars.get(code);
      if(pillar) pillar.material=isDest?destPillarMat:airportPillarMat;
    }

    // Dynamic Route Line
    if(f.route&&f.route.length>0){
      const pts=[new THREE.Vector3(f.x,acAlt-150,f.z)];
      const startIndex=Math.max(0,f.waypoint||0);
      for(let i=startIndex;i<f.route.length;i++){
        pts.push(new THREE.Vector3(f.route[i].x,9500,f.route[i].z));
      }
      if(f.destination) pts.push(new THREE.Vector3(f.destination.x,9000,f.destination.z));
      routeLine.geometry.dispose();
      routeLine.geometry=new THREE.BufferGeometry().setFromPoints(pts);
      routeLine.visible=true;
    }else if(f.destination){
      const pts=[new THREE.Vector3(f.x,acAlt-150,f.z),new THREE.Vector3(f.destination.x,9000,f.destination.z)];
      routeLine.geometry.dispose();
      routeLine.geometry=new THREE.BufferGeometry().setFromPoints(pts);
      routeLine.visible=true;
    }else{
      routeLine.visible=false;
    }

    // Multiplayer Peers with Callsign Labels & Vertical Altitude Stems
    if(typeof multiplayer!=='undefined'&&multiplayer.isConnected()){
      const activePeers=multiplayer.getPeers();
      const currentIds=new Set();
      for(const peer of activePeers){
        if(!peer.state) continue;
        currentIds.add(peer.id);
        const peerAlt=Math.max(9100,(peer.state.y||0)+4000);
        let pm=peerMarkers.get(peer.id);
        if(!pm){
          pm=new THREE.Mesh(arrowGeo,peerArrowMat);
          pm.scale.setScalar(currentScaleFactor*1.15);
          scene.add(pm);
          peerMarkers.set(peer.id,pm);

          const pStemGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
          const pStem=new THREE.Line(pStemGeo,peerStemMat);
          scene.add(pStem);
          peerStems.set(peer.id,pStem);

          const pl=createTagSprite(`✈ ${peer.callsign||'PEER'}`,'#00e5ff','#7affbe','rgba(6, 20, 32, 0.92)');
          if(pl){
            pl.scale.set(spriteScaleBase*94, spriteScaleBase*20, 1);
            pl.userData={anchorX:peer.state.x,anchorY:peerAlt+400,anchorZ:peer.state.z,kind:'peer',code:peer.id,baseW:94,baseH:20};
            scene.add(pl);
            peerLabels.set(peer.id,pl);
          }
        }
        pm.position.set(peer.state.x,peerAlt,peer.state.z);
        pm.rotation.y=-(peer.state.heading||0);
        pm.visible=true;
        const pStem=peerStems.get(peer.id);
        if(pStem){
          const pgY=typeof regionalHeight==='function'?Math.max(0,regionalHeight(peer.state.x,peer.state.z)):0;
          const psa=pStem.geometry.attributes.position.array;
          psa[0]=peer.state.x;psa[1]=pgY;psa[2]=peer.state.z;
          psa[3]=peer.state.x;psa[4]=peerAlt;psa[5]=peer.state.z;
          pStem.geometry.attributes.position.needsUpdate=true;
          pStem.visible=true;
        }
        const pl=peerLabels.get(peer.id);
        if(pl){
          pl.userData.anchorX=peer.state.x;
          pl.userData.anchorY=peerAlt+400;
          pl.userData.anchorZ=peer.state.z;
          pl.visible=true;
        }
      }
      for(const [id,pm] of peerMarkers){
        if(!currentIds.has(id)){
          pm.visible=false;scene.remove(pm);peerMarkers.delete(id);
          const ps=peerStems.get(id);if(ps){scene.remove(ps);ps.geometry.dispose();peerStems.delete(id);}
        }
      }
      for(const [id,pl] of peerLabels){
        if(!currentIds.has(id)){pl.visible=false;scene.remove(pl);peerLabels.delete(id);}
      }
    }else{
      for(const pm of peerMarkers.values()){pm.visible=false;scene.remove(pm);}
      peerMarkers.clear();
      for(const ps of peerStems.values()){scene.remove(ps);ps.geometry.dispose();}
      peerStems.clear();
      for(const pl of peerLabels.values()){pl.visible=false;scene.remove(pl);}
      peerLabels.clear();
    }

    declutterLabels(f);
    renderer.render(scene,camera);
  }
  return {
    distantTerrain,resize,draw,airportLabels,peerLabels,vorLabels,
    viewState,setViewMode,zoomBy,panBy,resetView,declutterLabels
  };
}
