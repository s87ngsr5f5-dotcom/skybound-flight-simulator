'use strict';
const byId = id => document.getElementById(id);
const airports=allAirports;
const rad = Math.PI / 180;
const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
let seed = 682;
function random(){
  seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
  return seed / 4294967296;
}
let renderer;
const mobileRenderer=touchControls.mode.value==='mobile';
const rendererOptions=[
  {antialias:!mobileRenderer,powerPreference:'high-performance'},
  {antialias:!mobileRenderer},
  {antialias:false,powerPreference:'default'},
  {antialias:false,powerPreference:'low-power',precision:'mediump'}
];
const requestedInstruments=new URLSearchParams(location.search).get('mode')==='2d';
for(const options of requestedInstruments?[]:rendererOptions){
  // Three creates a new canvas for each attempt, including after context failure.
  try{renderer=new THREE.WebGLRenderer(options);break;}catch{}
}
if(!renderer){
  byId('startupMessage').textContent = '可使用 2D 座艙練習起降與導航。';
  byId('retryStartup').hidden=false;
  const start2D=byId('start2D');
  start2D.hidden=false;
  start2D.onclick=()=>{
    renderer=createInstrumentRenderer();
    if(!renderer){
      byId('startupMessage').textContent='瀏覽器無法建立 2D 畫布。請重新載入。';
      return;
    }
    start2D.hidden=true;
    document.body.classList.add('instrument-flight');
    initialize();
  };
}
if(renderer) initialize();
function initialize(){
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9ccbea');
  scene.fog = new THREE.FogExp2('#a4c9dd',0.000026);
  const camera = new THREE.PerspectiveCamera(64,1,.6,155000);
  let taiwanOverview, overviewActive=false;
  const overviewToggle=byId('taiwanOverview'),overviewScale=byId('overviewScale');
  const mapButton=byId('flightBar').querySelector('[data-panel="nav"]');
  function setOverview(active){
    overviewActive=active;
    overviewToggle.setAttribute('aria-pressed',String(active));
    overviewToggle.textContent=active?'回飛行視角':'全台俯瞰';
    overviewScale.hidden=!active;
    mapButton.textContent=active?'回飛行':'地圖';
    document.body.classList.toggle('overview-active',active);
  }
  overviewToggle.onclick=()=>{
    if(!overviewToggle.hidden&&taiwanOverview){
      setOverview(!overviewActive);
      setMobilePanel('');
    }
  };
  function updateTaiwanOverview(f){
    const visible=!renderer.instrumentOnly&&Boolean(f)&&!f.ground&&f.y>=9000&&!f.tactical&&!replay;
    const farView=!renderer.instrumentOnly&&f?.y>2200&&
      f.x>-300000&&f.x<100000&&f.z>-90000&&f.z<450000;
    if((farView||visible)&&!taiwanOverview){
      taiwanOverview=createTaiwanOverview();
      scene.add(taiwanOverview.distantTerrain);
      resizeOverview();
    }
    if(taiwanOverview) taiwanOverview.distantTerrain.visible=Boolean(farView);
    overviewToggle.hidden=!visible;
    if(!visible&&overviewActive) setOverview(false);
    if(overviewActive) byId('overviewAltitude').textContent=Math.round(f.y).toLocaleString();
    const far=farView?430000:155000;
    if(camera.far!==far){camera.far=far;camera.updateProjectionMatrix();}
  }
  function resizeOverview(){
    if(taiwanOverview) byId('scaleBar').style.width=taiwanOverview.resize(innerWidth,innerHeight)+'px';
  }
  renderer.domElement.className = 'world';
  document.body.prepend(renderer.domElement);
  const ambient=new THREE.HemisphereLight(0xe1efff,0x777054,2.15);
  scene.add(ambient);
  const sunlight = new THREE.DirectionalLight(0xffead0,2.1);
  sunlight.position.set(-500,800,-360);
  const sunDirection=sunlight.position.clone();
  scene.add(sunlight,sunlight.target);
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  sunlight.castShadow=true;
  sunlight.shadow.mapSize.set(2048,2048);
  Object.assign(sunlight.shadow.camera,{left:-460,right:460,top:460,bottom:-460,near:1,far:1800});
  sunlight.shadow.camera.updateProjectionMatrix();
  sunlight.shadow.normalBias=.08;
  sunlight.shadow.bias=-0.00015;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  const sky=document.createElement('canvas');sky.width=512;sky.height=256;
  const skyInk=sky.getContext('2d'),skyFade=skyInk.createLinearGradient(0,0,0,256);
  skyFade.addColorStop(0,'#6d9ec4');skyFade.addColorStop(.48,'#d5e2df');skyFade.addColorStop(.55,'#8a8e79');skyFade.addColorStop(1,'#4b5e51');
  skyInk.fillStyle=skyFade;skyInk.fillRect(0,0,512,256);
  const environment=new THREE.CanvasTexture(sky);environment.mapping=THREE.EquirectangularReflectionMapping;
  scene.environment=environment;

  function material(color){return new THREE.MeshStandardMaterial({color,roughness:.86});}
  function box(parent,mat,w,h,d,x,y,z){
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);
    parent.add(mesh);
    return mesh;
  }
  function terrainHeight(x,z){
    const natural=regionalHeight(x,z);
    for(const airport of airports){
      const half=airport.length/2;
      if(Math.abs(x-airport.x)>half+950||Math.abs(z-airport.z)>half+950) continue;
      const {along,cross}=runwayCoordinates(x,z,airport);
      if(airport.shortField){
        // A 120 m terrain triangle can span the runway even when its vertices are outside the strip.
        const blend=shortFieldBlend(airport,along,cross,natural>airport.elevation?180:72);
        if(blend>0) return natural+(airport.elevation-natural)*blend;
        continue;
      }
      // Clear a terrain-grid cell around paved surfaces so coarse triangles
      // cannot bury a flat runway threshold or the edge of the apron.
      const apronLimit=Math.sign(airport.apron)*cross>0?Math.abs(airport.apron)+135:airport.width/2+9;
      const edge=Math.max(Math.abs(along)-half-355,Math.abs(cross)-apronLimit-355);
      const blend=1-clamp(edge/185,0,1);
      if(blend>0) return natural+(airport.elevation-natural)*blend;
    }
    return natural;
  }
  let treeCover=()=>0;
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = 1024;
  const paint = atlas.getContext('2d');
  paint.fillStyle = '#7b856b';
  paint.fillRect(0,0,1024,1024);
  for(let scale=128;scale>=2;scale/=2){
    for(let y=0;y<1024;y+=scale)for(let x=0;x<1024;x+=scale){
      const shade=80+Math.floor(random()*80);
      paint.fillStyle='rgba('+shade+','+(shade+10)+','+(shade-12)+','+(scale>16?.08:.035)+')';
      paint.fillRect(x,y,scale,scale);
    }
  }
  const landTexture = new THREE.CanvasTexture(atlas);
  landTexture.colorSpace = THREE.SRGBColorSpace;
  landTexture.wrapS = landTexture.wrapT = THREE.RepeatWrapping;
  landTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const terrainMaterial=new THREE.MeshStandardMaterial({map:landTexture,roughness:1,vertexColors:true});
  const taipeiImage={value:landTexture}, taipeiImageReady={value:0};
  const atlasImage={value:landTexture},atlasReady={value:0};
  const atlasBounds={value:new THREE.Vector4(...taiwanSatelliteData.overview)};
  function terrainPhoto(shader,tile){
    shader.uniforms.taipeiImage=taipeiImage;
    shader.uniforms.taipeiImageReady=taipeiImageReady;
    shader.uniforms.regionalImage=tile?.image??{value:landTexture};
    shader.uniforms.regionalImageReady=tile?.ready??{value:0};
    shader.uniforms.regionalImageOrigin=tile?.origin??{value:new THREE.Vector2()};
    shader.uniforms.atlasImage=atlasImage;
    shader.uniforms.atlasReady=atlasReady;
    shader.uniforms.atlasBounds=atlasBounds;
    shader.vertexShader='varying vec2 terrainXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n terrainXZ=(modelMatrix * vec4(transformed,1.0)).xz;');
    shader.fragmentShader='varying vec2 terrainXZ;\nuniform sampler2D taipeiImage,regionalImage,atlasImage;\n'+
      'uniform float taipeiImageReady,regionalImageReady,atlasReady;\nuniform vec2 regionalImageOrigin;\nuniform vec4 atlasBounds;\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 atlasUV=(terrainXZ-atlasBounds.xy)/atlasBounds.zw;
        if(atlasReady>0.5&&all(greaterThanEqual(atlasUV,vec2(0.0)))&&all(lessThanEqual(atlasUV,vec2(1.0)))){
          vec4 atlas=texture2D(atlasImage,vec2(atlasUV.x,1.0-atlasUV.y));
          diffuseColor.rgb=mix(diffuseColor.rgb,atlas.rgb*1.12,atlas.a);
        }
        if(regionalImageReady>0.5){
          vec2 tileUV=clamp((terrainXZ-regionalImageOrigin)/11520.0,0.0,1.0);
          vec4 regional=texture2D(regionalImage,vec2(tileUV.x,1.0-tileUV.y));
          float visiblePhoto=regional.a*smoothstep(.0006,.002,max(regional.r,max(regional.g,regional.b)));
          diffuseColor.rgb=mix(diffuseColor.rgb,regional.rgb*1.12,visiblePhoto);
        }
        vec2 imageUV=(terrainXZ-vec2(-20000.0,-18000.0))/vec2(39000.0,33500.0);
        float imageEdge=min(min(imageUV.x,imageUV.y),1.0-max(imageUV.x,imageUV.y));
        if(taipeiImageReady>0.5 && imageEdge>0.0){
          vec3 photo=texture2D(taipeiImage,vec2(imageUV.x,1.0-imageUV.y)).rgb;
          diffuseColor.rgb=mix(diffuseColor.rgb,photo*1.12,smoothstep(0.0,0.035,imageEdge));
        }
        if(diffuseColor.b>diffuseColor.r*1.45&&diffuseColor.b>0.35){
          vec2 waveCoord=terrainXZ*0.0065;
          float wave=sin(waveCoord.x*2.4+waveCoord.y*1.7)*cos(waveCoord.y*2.1-waveCoord.x*1.3);
          float waveDetail=sin(waveCoord.x*6.8-waveCoord.y*5.1)*0.5+0.5;
          vec3 deepSea=vec3(0.05,0.20,0.42);
          vec3 shallowSea=vec3(0.13,0.42,0.66);
          diffuseColor.rgb=mix(deepSea,shallowSea,clamp(wave*0.22+waveDetail*0.14+0.52,0.0,1.0));
        }
      `);
  }
  terrainMaterial.onBeforeCompile=shader=>terrainPhoto(shader);
  const satelliteCredit=byId('satelliteCredit');
  if(!renderer.instrumentOnly) loadTaiwanAtlas().then(texture=>{
    atlasImage.value=texture;
    atlasReady.value=1;
    if(!flight) drawPlan();
  }).catch(()=>{});
  const taiwanSatellite=renderer.instrumentOnly?null:createTaiwanSatellite(tile=>{
    const material=terrainMaterial.clone();
    tile.image.value=landTexture;
    material.onBeforeCompile=shader=>terrainPhoto(shader,tile);
    return material;
  },renderer,()=>{satelliteCredit.hidden=false;});
  const terrainChunks=new Map();
  const span=11520;
  const terrainHeights=new Map();
  let previousChunk='',terrainQueue=[],terrainBuild=null,terrainColorRevision=0;
  const terrainStep=(col,row)=>col>=-1&&col<=0&&row>=-1&&row<=0?120:240;
  let mountainLayerRequested=false;
  let taipeiImageRequested='';
  function loadTaipeiImagery(x,z){
    if(Math.abs(x)>55000||Math.abs(z)>55000){
      taipeiImageRequested='';
      if(taipeiImageReady.value){
        taipeiImage.value.dispose();
        taipeiImage.value=landTexture;
        taipeiImageReady.value=0;
      }
      return;
    }
    const mobile=byId('quality').value==='low'||renderer.capabilities.maxTextureSize<4096;
    const file=mobile?'taipei-sentinel-mobile.webp':'taipei-sentinel.webp';
    if(taipeiImageRequested===file) return;
    taipeiImageRequested=file;
    new THREE.TextureLoader().load(file+'?v=airbrake25',texture=>{
      if(taipeiImageRequested!==file){texture.dispose();return;}
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      if(taipeiImageReady.value) taipeiImage.value.dispose();
      taipeiImage.value=texture;
      taipeiImageReady.value=1;
      satelliteCredit.hidden=false;
    });
  }
  function loadMountainTerrain(col,row){
    if(mountainLayerRequested||col< -18||col>6||row< -1||row>27) return;
    mountainLayerRequested=true;
    const script=document.createElement('script');
    script.src='central-mountains.js?v=terrain24';
    script.onload=()=>{
      terrainHeights.clear();
      terrainColorRevision++;
    };
    document.head.appendChild(script);
  }
  function terrainVertex(x,z){
    const key=x+':'+z;
    let height=terrainHeights.get(key);
    if(height===undefined){
      height=terrainHeight(x,z);
      if(terrainHeights.size>=90000) terrainHeights.clear();
      terrainHeights.set(key,height);
    }
    return height;
  }
  function stitchedHeight(x,z,step){
    // Fine tiles share the coarse edge profile, so adjacent meshes meet.
    if(step===120){
      if(x%span===0&&z%240!==0) return (terrainVertex(x,z-120)+terrainVertex(x,z+120))/2;
      if(z%span===0&&x%240!==0) return (terrainVertex(x-120,z)+terrainVertex(x+120,z))/2;
    }
    return terrainVertex(x,z);
  }
  function updateTerrain(x,z){
    if(renderer.instrumentOnly) return;
    loadTaipeiImagery(x,z);
    const cx=Math.floor(x/span),cz=Math.floor(z/span),id=cx+':'+cz+':'+terrainColorRevision;
    taiwanSatellite.update(cx,cz,byId('quality').value);
    loadMountainTerrain(cx,cz);
    if(id!==previousChunk){
      previousChunk=id;
      const visible=new Set();
      terrainQueue=[];
      for(let row=cz-3;row<=cz+3;row++){
        for(let col=cx-3;col<=cx+3;col++){
          const key=col+':'+row;
          visible.add(key);
          const mountain=Boolean(centralMountainTile(col,row));
          const near=Math.max(Math.abs(col-cx),Math.abs(row-cz))<=1;
          const island=airports.some(airport=>airport.shortField&&Math.abs(airport.x-(col+.5)*span)<span*.8&&
            Math.abs(airport.z-(row+.5)*span)<span*.8);
          const step=(mountain||island)&&near?120:terrainStep(col,row);
          const old=terrainChunks.get(key)?.userData;
          if(old?.colorRevision!==terrainColorRevision||old.step!==step){
            terrainQueue.push({col,row,key,step,mountain,distance:(x/span-col-.5)**2+(z/span-row-.5)**2});
          }
        }
      }
      terrainQueue.sort((a,b)=>a.distance-b.distance);
      if(terrainBuild){
        terrainBuild.mesh.dispose();
        terrainBuild=null;
      }
      for(const [key,patch] of terrainChunks){
        if(visible.has(key)) continue;
        scene.remove(patch);
        patch.geometry.dispose();
        terrainChunks.delete(key);
      }
    }
    // Build the nearest patches first without generating a whole region in one frame.
    const deadline=performance.now()+2.5;
    while(terrainBuild||terrainQueue.length){
      if(!terrainBuild){
        const {col,row,key,step,mountain}=terrainQueue.shift();
        const mesh=new THREE.PlaneGeometry(span,span,span/step,span/step);
        mesh.rotateX(-Math.PI/2);
        terrainBuild={key,col,row,mesh,step,mountain,px:(col+.5)*span,pz:(row+.5)*span,index:0,
          colors:new THREE.BufferAttribute(new Float32Array(mesh.attributes.position.count*3),3)};
      }
      const {key,col,row,mesh,step,mountain,px,pz,colors}=terrainBuild,pos=mesh.attributes.position;
      const end=Math.min(pos.count,terrainBuild.index+128);
      for(let i=terrainBuild.index;i<end;i++){
        const worldX=px+pos.getX(i),worldZ=pz+Math.round(pos.getZ(i));
        const height=stitchedHeight(worldX,worldZ,step);
        pos.setY(i,height-.14);
        const forest=height>=1.5&&height<=3500?(treeCover(worldX,worldZ)||0):0;
        const urban=height<160&&worldX>-9000&&worldX<11000&&worldZ>-4500&&worldZ<9500;
        if(height<.7) colors.setXYZ(i,.17,.42,.83);
        else if(mountain&&height>350){
          const slope=Math.hypot(terrainVertex(worldX+120,worldZ)-height,terrainVertex(worldX,worldZ+120)-height)/120;
          const rock=Math.max(clamp((height-2800)/1200,0,1)*.66,clamp((slope-.7)/1.1,0,.86));
          const canopy=height<3300?Math.max(forest,.52):.25;
          const r=.69-.39*canopy,g=.85-.42*canopy,b=.64-.34*canopy;
          colors.setXYZ(i,r+(.66-r)*rock,g+(.64-g)*rock,b+(.58-b)*rock);
        }else if(forest>.08) colors.setXYZ(i,.76-.44*forest,.90-.45*forest,.76-.47*forest);
        else if(height>1000) colors.setXYZ(i,.71,.77,.72);
        else if(urban) colors.setXYZ(i,.68,.72,.72);
        else colors.setXYZ(i,.78,.92,.77);
      }
      terrainBuild.index=end;
      if(end===pos.count){
        mesh.setAttribute('color',colors);
        mesh.computeVertexNormals();
        const patch=new THREE.Mesh(mesh,taiwanSatellite.material(col,row)??terrainMaterial);
        patch.receiveShadow=true;
        patch.position.set(px,0,pz);
        patch.userData.colorRevision=terrainColorRevision;
        patch.userData.step=step;
        const old=terrainChunks.get(key);
        if(old){scene.remove(old);old.geometry.dispose();}
        terrainChunks.set(key,patch);
        scene.add(patch);
        terrainBuild=null;
      }
      if(performance.now()>=deadline) break;
    }
  }
  landTexture.repeat.set(9,9);
  const asphalt = material('#41464b'), concrete = material('#898d8c'), white = material('#f6f6e8');
  function pavementTexture(concreteSurface){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=concreteSurface?'#93968f':'#51565a';ctx.fillRect(0,0,512,512);
    for(let i=0;i<17000;i++){
      const v=concreteSurface?130+Math.floor(random()*40):65+Math.floor(random()*29);
      ctx.fillStyle='rgba('+v+','+v+','+v+',.36)';ctx.fillRect(random()*512,random()*512,1+random()*2,1);
    }
    ctx.strokeStyle=concreteSurface?'#5d635d55':'#343b3e66';ctx.lineWidth=1;
    for(let x=0;x<=512;x+=128){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}
    for(let y=0;y<=512;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
    ctx.fillStyle='#20282c16';for(let i=0;i<16;i++)ctx.fillRect(170+random()*160,random()*512,2,25+random()*70);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(concreteSurface?3:2,concreteSurface?3:30);
    texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
  }
  asphalt.map=pavementTexture(false);concrete.map=pavementTexture(true);
  asphalt.color.set('#d3d7d7');concrete.color.set('#d4d6d1');
  const glass = material('#53758b'), roof = material('#a4afac');
  const airportGroups=[],airportDetails=[],jetwayWalls=new Map();
  const jetwayPaint=material('#b4c0c7'), jetwayDark=material('#36464d');
  const jetwayGlass=new THREE.MeshStandardMaterial({color:0x527f99,roughness:.25,transparent:true,opacity:.37,depthWrite:false});
  function makeJetway(){
    const root=new THREE.Group(), tunnel=new THREE.Group();
    root.add(tunnel);
    box(tunnel,jetwayPaint,3.3,.22,1,0,-.13,0);
    box(tunnel,jetwayPaint,3.45,.21,1,0,2.48,0);
    for(const side of [-1,1]){
      box(tunnel,jetwayPaint,.11,.73,1,side*1.61,.36,0);
      box(tunnel,jetwayGlass,.12,1.42,1,side*1.62,1.45,0);
      box(tunnel,jetwayPaint,.14,.21,1,side*1.62,2.24,0);
      for(let i=-3;i<=3;i++) box(tunnel,jetwayPaint,.15,1.62,.011,side*1.63,1.48,i/7);
    }
    const cabin=new THREE.Group();root.add(cabin);
    box(cabin,jetwayPaint,3.50,.23,2.25,0,-.12,0);
    box(cabin,jetwayPaint,3.50,.22,2.25,0,2.45,0);
    for(const side of [-1,1]){
      box(cabin,jetwayGlass,.13,1.65,2.25,side*1.69,1.36,0);
      box(cabin,jetwayPaint,.15,.56,2.25,side*1.69,.28,0);
      box(cabin,jetwayDark,.34,2.38,.15,side*1.36,1.18,1.15);
    }
    const support=new THREE.Group();root.add(support);
    box(support,jetwayPaint,.61,1,.63,-.84,-.5,0);
    box(support,jetwayPaint,.61,1,.63,.84,-.5,0);
    box(support,jetwayDark,2.39,.16,1,0,-.91,0);
    return {root,tunnel,cabin,support};
  }
  function placeJetway(model,terminal,door,ground){
    const length=terminal.distanceTo(door);
    model.root.position.copy(terminal);
    model.root.lookAt(door);
    model.tunnel.scale.z=Math.max(.5,length-1.6);
    model.tunnel.position.z=(length-1.6)/2;
    model.cabin.position.z=length-1.2;
    model.support.position.z=length*.72;
    model.support.scale.y=Math.max(.5,(terminal.y+door.y)/2-ground);
  }
  function labelTexture(label,foreground,background){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
    const ink=canvas.getContext('2d');
    if(background){ink.fillStyle=background;ink.fillRect(0,0,256,128);}
    ink.font='900 '+(label.length<4?102:70)+'px Arial, sans-serif';
    ink.textAlign='center';ink.textBaseline='middle';ink.fillStyle=foreground;
    ink.fillText(label,128,68,244);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
  }
  function airportSign(group,label,x,z,w,h,color='#651b1b'){
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({
      map:labelTexture(label,'#ffffff',color),side:THREE.DoubleSide
    }));
    sign.position.set(x,h/2+.36,z);
    sign.rotation.y=Math.PI/2;
    group.add(sign);
    box(group,roof,.44,.36,w,x,.18,z);
  }

  const lampMaterial=new THREE.MeshBasicMaterial({color:0xd7eaff});
  for(const airport of airports){
    const half=airport.length/2, width=airport.width, apron=airport.apron, sideOfApron=Math.sign(apron);
    const local=airport.shortField, apronZ=local?-airport.parkingAlong:-65;
    const large=['RCTP','RJAA','RCKH'].includes(airport.code);
    const gates=local?1:large?7:['RCSS','RCMQ'].includes(airport.code)?5:3;
    const gatePitch=local?27:large?73:51, apronLength=gates*gatePitch+(local?55:80);
    const terminalX=apron+sideOfApron*(local?22:large?112:88);
    const terminalWidth=local?15:large?59:40;
    const gateWall=terminalX-sideOfApron*terminalWidth/2;
    jetwayWalls.set(airport.code,gateWall);
    const group = new THREE.Group();
    group.position.set(airport.x,airport.elevation,airport.z);
    group.rotation.y = -airport.heading;
    scene.add(group);
    airportGroups.push({group,airport});
    box(group,concrete,width+15,.08,airport.length+28,0,-.008,0);
    box(group,airport.code==='RCLY'?concrete:asphalt,width,.12,airport.length,0,0,0);
    if(!local) box(group,concrete,24,.10,airport.length-180,apron,0,0);
    box(group,concrete,local?34:large?150:113,.11,apronLength,apron+(local?0:sideOfApron*30),0,apronZ);
    const lane=material('#dbad49');
    if(!local) box(group,lane,.26,.03,airport.length-190,apron,.07,0);
    for(const z of local?[apronZ]:[half-135,-440,-950]){
      box(group,concrete,Math.abs(apron),.10,18,apron/2,0,z);
      box(group,lane,Math.abs(apron)-width/2,.025,.42,apron/2+sideOfApron*width/4,.07,z);
      const hold=sideOfApron*(width/2+(local?8:32));
      for(let i=0;i<4;i++){
        if(i<2) box(group,lane,.34,.025,14,hold+i*.78*sideOfApron,.081,z);
        else for(let m=-6;m<=6;m+=2) box(group,lane,.34,.025,1.12,hold+i*.78*sideOfApron,.081,z+m);
      }
      airportSign(group,airport.designator+'-'+airport.reciprocal,hold+sideOfApron*6,z-12,8,1.40);
    }
    for(const side of [-1,1]){
      box(group,white,1.05,.035,airport.length-38,side*(width/2-2),.08,0);
      for(const end of [-1,1]){
        if(!local) box(group,white,Math.min(8,width*.13),.035,48,side*width*.22,.086,end*(half-315));
        for(const distance of local?[145]:[200,430,520]){
          box(group,white,1.9,.035,21,side*width*.25,.086,end*(half-distance));
          if(distance===200) box(group,white,1.9,.035,21,side*width*.33,.086,end*(half-distance));
        }
      }
      for(let i=0;i<(width<50?6:8);i++){
        for(const end of [-1,1]) box(group,white,1.55,.03,30,side*(2.6+i*width/21),.085,end*(half-40));
      }
      for(let z=-half+38;z<half;z+=60) box(group,lampMaterial,.31,.13,.31,side*(width/2+.45),.09,z);
    }
    for(let z=-half+160;z<half-155;z+=65) box(group,white,1.18,.035,34,0,.08,z);
    for(let z=-half+50;z<half-50;z+=30) box(group,lampMaterial,.28,.04,.28,0,.088,z);
    const papiDark=material('#262a2e');
    const papiWhite=new THREE.MeshBasicMaterial({color:0xffffff});
    const papiRed=new THREE.MeshBasicMaterial({color:0xff2222});
    for(const end of [-1,1]){
      const papiZ=end*(half-320);
      for(let p=0;p<4;p++){
        const px=-sideOfApron*(width/2+12+p*4.2);
        box(group,papiDark,1.1,.55,1.1,px,.28,papiZ);
        box(group,p<2?papiWhite:papiRed,.65,.22,.15,px,.38,papiZ-end*.48);
      }
    }
    for(const [direction,text] of [[1,airport.designator],[-1,airport.reciprocal]]){
      const marking=new THREE.Mesh(new THREE.PlaneGeometry(width*.67,24),new THREE.MeshBasicMaterial({
        map:labelTexture(text,'#ffffff'),transparent:true,depthWrite:false
      }));
      marking.rotation.x=-Math.PI/2;
      if(direction<0) marking.rotateZ(Math.PI);
      marking.position.set(0,.11,direction*(half-106));
      group.add(marking);
      const edge=new THREE.MeshBasicMaterial({color:direction===1?0x6dffc0:0xf66c62});
      for(let x=-width/2;x<=width/2;x+=4) box(group,edge,.29,.15,.35,x,.105,direction*(half-10));
    }
    const buildingLength=gates*gatePitch+(local?13:25);
    const height=local?5:large?15:10;
    box(group,roof,terminalWidth,height,buildingLength,terminalX,height/2,apronZ);
    box(group,glass,terminalWidth+.12,height*.44,buildingLength-3,terminalX,height*.55,apronZ);
    box(group,roof,terminalWidth+5,.86,buildingLength+4,terminalX,height+.35,apronZ);
    for(let gate=0;gate<gates;gate++){
      const z=apronZ+(gate-Math.floor(gates/2))*gatePitch;
      box(group,roof,9,.34,gatePitch*.76,gateWall-sideOfApron*4,height*.69,z);
      for(let offset=-18;offset<=18;offset+=6) box(group,roof,.27,height*.52,.29,gateWall-sideOfApron*.18,height*.53,z+offset);
      box(group,lane,large?29:21,.029,.33,apron+sideOfApron*26,.091,z);
      box(group,lane,.35,.029,5,apron+sideOfApron*17,.091,z);
      airportSign(group,'G'+String(gate+1).padStart(2,'0'),gateWall-sideOfApron*2,z+9,3.8,1.12,'#15354b');
      if(gate!==Math.floor(gates/2)){
        const fixed=makeJetway();
        placeJetway(fixed,new THREE.Vector3(gateWall,4.5,z-7),new THREE.Vector3(gateWall-sideOfApron*23,3.7,z+3),0);
        group.add(fixed.root);
      }
    }
    const towerZ=apronZ-buildingLength/2-(local?10:56);
    const towerHeight=local?8:large?38:28;
    box(group,roof,8,towerHeight,8,terminalX+sideOfApron*(local?2:15),towerHeight/2,towerZ);
    box(group,glass,local?9:14,local?2.5:6,local?9:14,terminalX+sideOfApron*(local?2:15),towerHeight+(local?1.25:3),towerZ);
    if(!local) box(group,roof,15.5,.92,15.5,terminalX+sideOfApron*15,towerHeight+6.2,towerZ);
    const terminalLabel=new THREE.Mesh(new THREE.PlaneGeometry(local?13:22,local?3:6),new THREE.MeshBasicMaterial({
      map:labelTexture(airport.code,'#ffffff','#15354b'),side:THREE.DoubleSide
    }));
    terminalLabel.rotation.y=-sideOfApron*Math.PI/2;
    terminalLabel.position.set(gateWall-sideOfApron*.15,height*.78,apronZ);
    group.add(terminalLabel);
    if(!local&&typeof createAirportSurroundings==='function'&&typeof naturalTreeCrown==='function')airportDetails.push(createAirportSurroundings(group,airport,
      {terminalX,terminalWidth,height,buildingLength,apronZ,gateWall}));
    const byMaterial=new Map();
    for(const child of group.children){
      if(child.geometry?.type!=='BoxGeometry') continue;
      const batch=byMaterial.get(child.material)||[];
      batch.push(child);byMaterial.set(child.material,batch);
    }
    const transform=new THREE.Object3D();
    for(const [mat,batch] of byMaterial){
      const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(),mat,batch.length);
      batch.forEach((mesh,i)=>{
        const {width,height,depth}=mesh.geometry.parameters;
        transform.position.copy(mesh.position);
        transform.scale.set(width,height,depth);
        transform.updateMatrix();
        instances.setMatrixAt(i,transform.matrix);
        group.remove(mesh);
        mesh.geometry.dispose();
      });
      group.add(instances);
    }

    group.traverse(object=>{
      if(object.isMesh&&object.material?.isMeshStandardMaterial){
        object.receiveShadow=true;
        object.castShadow=true;
      }
    });
  }
  const taipeiCity=typeof createTaipeiCity==='function'?createTaipeiCity(scene,renderedGround,airports):
    {root:new THREE.Group(),inside:()=>false,update(){}};
  const buildingGeo = new THREE.BoxGeometry();
  const windows=document.createElement('canvas');
  windows.width=windows.height=64;
  const windowInk=windows.getContext('2d');
  windowInk.fillStyle='#000';windowInk.fillRect(0,0,64,64);
  for(let row=0;row<5;row++) for(let col=0;col<5;col++){
    if((row*3+col*7)%5<2) continue;
    windowInk.fillStyle=(row+col)%3===0?'#ebbf77':'#858b90';
    windowInk.fillRect(3+col*12,3+row*12,6,5);
  }
  const cityWindows=new THREE.CanvasTexture(windows);
  cityWindows.colorSpace=THREE.SRGBColorSpace;
  const cityWall=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.87,emissive:0xffdb9d,emissiveMap:cityWindows,emissiveIntensity:0});
  const liteRoofCanvas=document.createElement('canvas');liteRoofCanvas.width=liteRoofCanvas.height=64;
  const lrc=liteRoofCanvas.getContext('2d');
  lrc.fillStyle='#437a59';lrc.fillRect(0,0,64,64);
  lrc.fillStyle='#5c5750';
  lrc.fillRect(0,0,64,4);lrc.fillRect(0,60,64,4);lrc.fillRect(0,0,4,64);lrc.fillRect(60,0,4,64);
  lrc.fillStyle='#ccd2d8';lrc.beginPath();lrc.arc(20,22,7,0,Math.PI*2);lrc.fill();
  lrc.fillStyle='#ffffff';lrc.beginPath();lrc.arc(18,20,3,0,Math.PI*2);lrc.fill();
  const cityRoofTexture=new THREE.CanvasTexture(liteRoofCanvas);
  cityRoofTexture.colorSpace=THREE.SRGBColorSpace;
  const cityRoof=new THREE.MeshStandardMaterial({color:0xffffff,map:cityRoofTexture,roughness:.82});
  const blocks=new THREE.InstancedMesh(buildingGeo,[cityWall,cityWall,cityRoof,cityRoof,cityWall,cityWall],cityLiteVolumes.length);
  blocks.name='Lightweight airport cities';
  const dummy = new THREE.Object3D();
  const cityTones=[0xa6a3a1,0xc9c2ad,0x9fa9af,0xada299,0x9dada7,0xc7c8c2,0xa3a7b0];
  blocks.count=0;
  for(const [lat,lon,width,depth,height,tone] of cityLiteVolumes){
    if(taipeiCity.inside(lat,lon))continue;
    const {x,z}=geoPoint(lat,lon),ground=renderedGround(x,z);
    if(ground<.5||airports.some(a=>{
      const reach=a.length/2+Math.max(width,depth)+220;
      if(Math.abs(a.x-x)>reach||Math.abs(a.z-z)>reach) return false;
      const {along,cross}=runwayCoordinates(x,z,a);
      return Math.abs(along)<reach&&Math.abs(cross)<Math.abs(a.apron)+240;
    })) continue;
    dummy.position.set(x,ground+height/2,z);
    dummy.scale.set(width,height,depth);
    dummy.updateMatrix();
    blocks.setMatrixAt(blocks.count,dummy.matrix);
    blocks.setColorAt(blocks.count++,new THREE.Color(cityTones[tone]??cityTones[0]));
  }
  scene.add(blocks);
  function renderedGround(x,z){
    const col=Math.floor(x/span),row=Math.floor(z/span);
    const step=terrainChunks.get(col+':'+row)?.userData.step??terrainStep(col,row);
    const cx=Math.floor(x/step)*step,cz=Math.floor(z/step)*step;
    const u=(x-cx)/step,v=(z-cz)/step;
    const a=stitchedHeight(cx,cz,step),b=stitchedHeight(cx+step,cz,step);
    const c=stitchedHeight(cx,cz+step,step),d=stitchedHeight(cx+step,cz+step,step);
    return (u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u))-.14;
  }
  // Keep the city dataset off the mobile startup path. Failed optional
  // layers must not prevent loading the runway and flight controls.
  const sceneryLayers=new THREE.Group();
  scene.add(sceneryLayers);
  let detailedScenery,sceneryBuild,loadingScenery=false;
  const renderingQuality=()=>byId('quality').value==='satellite'?'low':byId('quality').value;
  function syncSceneryMode(){
    if(renderer.instrumentOnly) return;
    const detailed=touchControls.mode.value==='desktop'||renderingQuality()!=='low';
    sceneryLayers.visible=detailed&&Boolean(detailedScenery);
    if(!detailed||loadingScenery) return;
    loadingScenery=true;
    const assets=['taipei-data.js','forest-cover.js?v=1',
      'vegetation.js?v=scene28','taiwan-highways.js?v=1','airport-city-data.js?v=2','regional-scenery.js?v=city27'];
    Promise.all(assets.map(src=>new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Scenery asset unavailable: '+src));
      document.head.appendChild(script);
    }))).then(()=>{sceneryBuild=buildScenery();}).catch(sceneryUnavailable);
  }
  function* buildScenery(){
    const cover=createTreeCover(worldCoverTrees);
    yield;
    const taipei={update(){}}; // Taipei geometry now streams in all device modes.
    const region=yield* buildRegionalScenery(sceneryLayers,renderedGround,airports,taiwanHighways,airportCityVolumes,taipeiData.bounds);
    const plants=yield* buildVegetation(sceneryLayers,renderedGround,airports,taipeiData,cover,taiwanHighways,taipeiCity.blocked);
    detailedScenery={taipei,region,plants};
    treeCover=cover;
    terrainColorRevision++;
    syncSceneryMode();
  }
  function sceneryUnavailable(error){
    sceneryBuild=null;
    sceneryLayers.clear();
    console.warn('Continuing with base scenery:',error);
  }
  touchControls.mode.addEventListener('change',syncSceneryMode);

  const atmosphericSky=createAtmosphericSky(scene);

  const fuselage = new THREE.MeshPhysicalMaterial({color:0xe9eef2,roughness:.30,metalness:.12,clearcoat:.85,clearcoatRoughness:.12});
  const trim = new THREE.MeshPhysicalMaterial({color:0x185378,roughness:.30,clearcoat:.85,clearcoatRoughness:.12});
  const windowMat = new THREE.MeshPhysicalMaterial({color:0x132732,roughness:.06,metalness:.88,clearcoat:1.0,clearcoatRoughness:.05});
  function makeAircraft(profile,index){
    const [length,radius,span,wingHeight,count,sweep]=profile.geometry;
    const group=new THREE.Group(), gear=new THREE.Group(), blades=[], surfaces=[], navLights=[];
    const accent=material(['#185378','#9f5433','#16817b','#6a4b9b','#88404b','#354d66'][index]);
    const body=new THREE.Mesh(new THREE.SphereGeometry(1,26,16),fuselage);
    body.scale.set(radius,radius*.96,length);
    group.add(body,gear);
    const glass=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),windowMat);
    glass.position.set(0,radius*.63,-length*.37);
    glass.scale.set(radius*.92,radius*.59,length*.23);
    group.add(glass);
    for(let i=0;i<(profile.jet?6:2);i++){
      for(const side of [-1,1]) box(group,windowMat,.07,radius*.34,length*.10,side*radius*.93,radius*.20,-length*.13+i*length*.13);
    }
    function wing(side,width,rootZ,tipZ,chord,tipChord,y){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute([0,y,rootZ,side*width,y+.20,tipZ,side*width,y+.20,tipZ+tipChord,0,y,rootZ+chord],3));
      geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();
      const mat=fuselage.clone();mat.side=THREE.DoubleSide;
      group.add(new THREE.Mesh(geo,mat));
    }
    for(const side of [-1,1]){
      wing(side,span,-length*.44,-length*.4+sweep,length*.57,length*.14,wingHeight);
      wing(side,span*.34,length*.62,length*.69,length*.27,length*.14,profile.jet?radius*1.6:radius*.23);
      const hinge=new THREE.Group();
      hinge.position.set(side*span*.55,wingHeight,length*.13+sweep*.55);
      box(hinge,accent,span*.42,.07,length*.15,0,0,length*.072);
      group.add(hinge);surfaces.push(hinge);
      box(gear,windowMat,.34,.59,.57,side*span*.23,-profile.gearHeight+.27,length*.12);
      navLights.push(box(group,new THREE.MeshBasicMaterial({color:side<0?0xdc3934:0x35dba0}),.17,.13,.19,side*span,.18+wingHeight,sweep-length*.30));
    }
    const tail=new THREE.Shape();
    tail.moveTo(0,0);tail.lineTo(length*.43,0);tail.lineTo(length*.32,radius*2.2);tail.lineTo(length*.18,radius*2.2);tail.closePath();
    const fin=new THREE.Mesh(new THREE.ExtrudeGeometry(tail,{depth:.14,bevelEnabled:false}),accent);
    fin.rotation.y=-Math.PI/2;fin.position.set(0,radius*.34,length*.56);group.add(fin);
    box(gear,windowMat,.28,.48,.50,0,-profile.gearHeight+.25,-length*.55);
    for(let i=0;i<count;i++){
      const x=count===1?0:(i===0?-1:1)*span*(profile.jet?.23:.36);
      const z=profile.jet?length*.53:count===1?-length*.98:-length*.33;
      if(count===2){
        const engine=new THREE.Mesh(new THREE.CylinderGeometry(radius*.48,radius*.60,length*.40,14),accent);
        engine.rotation.x=Math.PI/2;engine.position.set(x,profile.jet?.28:wingHeight,z+length*.12);group.add(engine);
      }
      if(!profile.jet){
        const blade=box(group,windowMat,span*.43,.095,.11,x,count===1?0:wingHeight,z);
        blades.push(blade);
      }
    }
    group.userData={gear,blades,surfaces,navLights};
    scene.add(group);
    return group;
  }

  function createCrashVFX(scene){
    const group=new THREE.Group();
    group.name='Crash VFX System';
    scene.add(group);
    let active=false,startTime=0,origin=new THREE.Vector3();
    const scorchMat=new THREE.MeshBasicMaterial({color:0x111111,transparent:true,opacity:0,depthWrite:false});
    const scorch=new THREE.Mesh(new THREE.CircleGeometry(16,24),scorchMat);
    scorch.rotation.x=-Math.PI/2;
    scorch.visible=false;
    group.add(scorch);
    const fireMat=new THREE.MeshBasicMaterial({color:0xff4500,transparent:true,opacity:0,toneMapped:false});
    const fireGroup=new THREE.Group();
    for(let i=0;i<7;i++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),fireMat);
      s.position.set((Math.random()-.5)*2.5,Math.random()*2,(Math.random()-.5)*2.5);
      fireGroup.add(s);
    }
    group.add(fireGroup);
    const waveMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
    const wave=new THREE.Mesh(new THREE.RingGeometry(1,1.8,32),waveMat);
    wave.rotation.x=-Math.PI/2;
    group.add(wave);
    const debrisGeo=new THREE.BoxGeometry(.45,.32,.6);
    const debrisMat=new THREE.MeshBasicMaterial({color:0xff8822});
    const debrisList=[];
    for(let i=0;i<28;i++){
      const d=new THREE.Mesh(debrisGeo,debrisMat);
      d.visible=false;
      group.add(d);
      debrisList.push({mesh:d,pos:new THREE.Vector3(),vel:new THREE.Vector3(),rot:new THREE.Vector3()});
    }
    const smokeMat=new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:0,depthWrite:false});
    const smokeList=[];
    for(let i=0;i<20;i++){
      const sm=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),smokeMat);
      sm.visible=false;
      group.add(sm);
      smokeList.push({mesh:sm,pos:new THREE.Vector3(),vel:new THREE.Vector3(),life:0,maxLife:3.5,scale:1});
    }

    function trigger(x,y,z,vx=0,vz=0,speed=50){
      active=true;
      startTime=performance.now();
      origin.set(x,y,z);
      scorch.position.set(x,y+0.08,z);
      scorch.visible=true;
      scorchMat.opacity=0.88;
      fireGroup.position.set(x,y+1.5,z);
      fireGroup.scale.set(1,1,1);
      fireGroup.visible=true;
      fireMat.opacity=0.95;
      wave.position.set(x,y+0.3,z);
      wave.scale.set(1,1,1);
      wave.visible=true;
      waveMat.opacity=0.85;
      debrisList.forEach((d,i)=>{
        d.pos.set(x+(Math.random()-.5)*2,y+1,z+(Math.random()-.5)*2);
        const angle=(i/debrisList.length)*Math.PI*2+(Math.random()-.5)*.5;
        const hspeed=12+Math.random()*28+(speed||50)*0.25;
        d.vel.set(Math.cos(angle)*hspeed+vx*0.3,8+Math.random()*22,Math.sin(angle)*hspeed+vz*0.3);
        d.rot.set(Math.random()*8,Math.random()*8,Math.random()*8);
        d.mesh.position.copy(d.pos);
        d.mesh.visible=true;
      });
      smokeList.forEach((s,i)=>{
        s.life=-i*0.15;
        s.maxLife=3.2+Math.random()*1.5;
        s.pos.set(x+(Math.random()-.5)*3,y+0.5,z+(Math.random()-.5)*3);
        s.vel.set((Math.random()-.5)*2,5+Math.random()*6,(Math.random()-.5)*2);
        s.scale=2+Math.random()*2;
        s.mesh.visible=false;
      });
    }

    function update(dt,groundFn){
      if(!active) return;
      const elapsed=(performance.now()-startTime)/1000;
      if(elapsed>18){active=false;return;}
      if(elapsed<2.0){
        const fScale=1+elapsed*22;
        fireGroup.scale.set(fScale,fScale*0.9,fScale);
        fireGroup.position.y=origin.y+elapsed*5;
        fireMat.opacity=Math.max(0,0.95*(1-elapsed/2.0));
        if(elapsed<0.4) fireMat.color.setHex(0xffea00);
        else if(elapsed<0.9) fireMat.color.setHex(0xff5722);
        else fireMat.color.setHex(0x991b1b);
      }else{
        fireGroup.visible=false;
      }
      if(elapsed<1.4){
        const wScale=1+elapsed*45;
        wave.scale.set(wScale,wScale,1);
        waveMat.opacity=Math.max(0,0.85*(1-elapsed/1.4));
      }else{
        wave.visible=false;
      }
      debrisList.forEach(d=>{
        if(!d.mesh.visible) return;
        d.vel.y-=28*dt;
        d.pos.addScaledVector(d.vel,dt);
        const gy=groundFn?groundFn(d.pos.x,d.pos.z):origin.y;
        if(d.pos.y<=gy+0.2){
          d.pos.y=gy+0.2;
          d.vel.y=-d.vel.y*0.35;
          d.vel.x*=0.65;d.vel.z*=0.65;
        }
        d.mesh.position.copy(d.pos);
        d.mesh.rotation.x+=d.rot.x*dt;
        d.mesh.rotation.y+=d.rot.y*dt;
        if(elapsed>8) d.mesh.visible=false;
      });
      smokeList.forEach(s=>{
        s.life+=dt;
        if(s.life>0&&s.life<s.maxLife){
          s.mesh.visible=true;
          s.pos.addScaledVector(s.vel,dt);
          s.vel.x+=(Math.random()-.5)*0.5*dt;
          s.vel.z+=(Math.random()-.5)*0.5*dt;
          s.mesh.position.copy(s.pos);
          const progress=s.life/s.maxLife;
          const currentScale=s.scale*(1+progress*5.5);
          s.mesh.scale.set(currentScale,currentScale*1.2,currentScale);
          smokeMat.opacity=Math.sin(progress*Math.PI)*0.62;
        }else if(s.life>=s.maxLife&&elapsed<12){
          s.life=0;
          s.pos.set(origin.x+(Math.random()-.5)*4,origin.y+0.8,origin.z+(Math.random()-.5)*4);
          s.vel.set((Math.random()-.5)*3,6+Math.random()*7,(Math.random()-.5)*3);
        }else{
          s.mesh.visible=false;
        }
      });
      if(elapsed>10){
        scorchMat.opacity=Math.max(0,0.88*(1-(elapsed-10)/8));
      }
    }
    return {trigger,update};
  }

  function createContrailSystem(scene){
    const group=new THREE.Group();
    group.name='Engine Contrails';
    scene.add(group);
    const count=90;
    const puffGeo=new THREE.SphereGeometry(1,8,6);
    const puffMat=new THREE.MeshBasicMaterial({color:0xf5f8fb,transparent:true,opacity:0.35,depthWrite:false});
    const puffs=[];
    for(let i=0;i<count;i++){
      const m=new THREE.Mesh(puffGeo,puffMat);
      m.visible=false;
      group.add(m);
      puffs.push({mesh:m,pos:new THREE.Vector3(),age:0,life:6.0,scale:1});
    }
    let nextEmit=0,emitIndex=0;
    function update(f,dt,now){
      const highAlt=f.airborne&&f.y>7200&&f.engines?.some(Boolean)&&f.fuel>0;
      if(highAlt&&now>=nextEmit){
        nextEmit=now+65;
        const span=f.aircraft.geometry[2];
        const half=f.aircraft.geometry[0];
        const rad=f.aircraft.geometry[1];
        const count=f.aircraft.geometry[4]||2;
        const rot=new THREE.Euler(f.pitch,-f.heading,f.bank,'YXZ');
        const quat=new THREE.Quaternion().setFromEuler(rot);
        for(let e=0;e<(count===4?4:2);e++){
          const factor=count===4?[-0.65,-0.33,0.33,0.65][e]:[-0.38,0.38][e];
          const localOffset=new THREE.Vector3(factor*span,-rad*0.45,half*0.4);
          localOffset.applyQuaternion(quat);
          const p=puffs[emitIndex%puffs.length];
          emitIndex++;
          p.pos.set(f.x+localOffset.x,f.y+localOffset.y,f.z+localOffset.z);
          p.age=0;
          p.scale=1.6;
          p.mesh.position.copy(p.pos);
          p.mesh.scale.set(p.scale,p.scale,p.scale);
          p.mesh.visible=true;
        }
      }
      puffs.forEach(p=>{
        if(!p.mesh.visible) return;
        p.age+=dt;
        if(p.age>=p.life){
          p.mesh.visible=false;
        }else{
          const frac=p.age/p.life;
          const sc=p.scale*(1+frac*8.5);
          p.mesh.scale.set(sc,sc,sc);
          p.mesh.position.y+=dt*0.4;
        }
      });
    }
    return {update};
  }

  const crashVFX=createCrashVFX(scene);
  const contrailVFX=createContrailSystem(scene);
  let crashShake=0;
  const models=new Map(),airlinerDetails={};
  function aircraftModel(profile){
    if(models.has(profile.id)) return models.get(profile.id);
    const model=profile.helicopter?buildHelicopter(profile,scene):profile.role?buildBenchmarkAirframe(profile,scene):makeAircraft(profile,fleet.indexOf(profile));
    if(profile.role==='fighter')refineFighter(model,profile);
    model.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
    if(profile.id==='sa380'||profile.id==='b773'){
      airlinerDetails[profile.id]=refineAirliner(model,{twin:profile.id==='b773'});
    }
    models.set(profile.id,model);
    return model;
  }
  const raycaster=new THREE.Raycaster();
  addEventListener('click',event=>{
    if(event.target.closest('button,input,select,textarea,details,a'))return;
    if(!flight||!airlinerDetails[flight.aircraft.id]||cameraMode!==1||flight.cabinView||replay)return;
    const mouse=new THREE.Vector2(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2);
    raycaster.setFromCamera(mouse,camera);
    const hit=raycaster.intersectObjects(airlinerDetails[flight.aircraft.id].switches)[0];
    if(!hit)return;
    const label=hit.object.userData.action;
    for(const button of byId('switches').children)if(button.textContent===label){button.click();break;}
  });
  let inspectionMode=false,hangarMode=false;
  let hangarStage,planPreviewAirport;
  let flight=null, cameraMode=0, last=performance.now(), accumulator=0, paused=false, previousFlightRate=1;
  let nextNavDraw=0,nextInstrumentDraw=0;
  const attitudeCanvas=byId('adiCanvas'), attitudeToggle=byId('attitudeMode');
  const attitude=new FlightAttitudeIndicator(attitudeCanvas);
  const attitudePanel=byId('attitudePanel');
  const glassCanvas=byId('glassReadouts'),glassReadouts=makeGlassReadouts(glassCanvas);
  const waypointChip=byId('waypointChip');
  const flightBar=byId('flightBar'),flightAircraft=byId('flightAircraft');
  const glideButton=byId('touchGlide'),helpGlide=byId('helpGlide'),touchAssist=byId('touchAssist');
  const attitudeModes=['clear','hud','pfd'];
  const instrumentLabels={clear:'姿態儀：隱藏',hud:'姿態儀：抬頭',pfd:'姿態儀：面板'};
  let attitudeMode='clear';
  try{
    const saved=localStorage.getItem('skybound.attitudeMode');
    if(attitudeModes.includes(saved)) attitudeMode=saved;
  }catch{}
  let glideEnabled=false;
  const helpInstruments=byId('helpInstruments');
  function applyAttitudeMode(){
    attitudePanel.dataset.mode=attitudeMode;
    attitudeCanvas.hidden=attitudeMode==='clear';
    helpInstruments.textContent=instrumentLabels[attitudeMode];
  }
  applyAttitudeMode();
  function toggleAttitude(){
    attitudeMode=attitudeModes[(attitudeModes.indexOf(attitudeMode)+1)%attitudeModes.length];
    applyAttitudeMode();
    try{localStorage.setItem('skybound.attitudeMode',attitudeMode);}catch{}
  }
  attitudeToggle.onclick=()=>{toggleAttitude();attitudeToggle.blur();};
  helpInstruments.onclick=()=>{
    toggleAttitude();
    setMobilePanel('');
  };
  function setGlide(enabled){
    if(glideEnabled!==enabled) gateProgress=null;
    glideEnabled=enabled;
    for(const button of [glideButton,helpGlide]) button.setAttribute('aria-pressed',String(enabled));
  }
  glideButton.onclick=helpGlide.onclick=()=>setGlide(!glideEnabled);
  let savedControls={};
  try{savedControls=JSON.parse(localStorage.getItem('skybound.controls.v2')||'{}')||{};}catch{}
  let settings=upgradeControls(savedControls);
  const persistControls=()=>{
    try{localStorage.setItem('skybound.controls.v2',JSON.stringify(settings));}catch{}
  };
  function showControlDirections(){
    byId('gainValue').textContent=Math.round(settings.sensitivity*100)+'%';
    const pitch=settings.invert?'↑ 壓低 · ↓ 拉升':'↑ 拉升 · ↓ 壓低';
    const roll='← 左轉 · → 右轉';
    byId('controlDirections').textContent=touchControls.mode.value==='mobile'?
      '拖動搖桿 · '+(settings.invert?'向上壓低、向下拉升':'向上拉升、向下壓低')+'，左右轉向':pitch+' · '+roll;
    byId('quickControls').querySelector('summary').textContent='操控設定 · '+Math.round(settings.sensitivity*100)+'%';
  }
  persistControls();showControlDirections();
  touchControls.mode.addEventListener('change',showControlDirections);
  for(const [name,value] of Object.entries(settings)){
    const input=byId(name);
    if(!input) continue;
    if(typeof value==='boolean') input.checked=value;else input.value=value;
    input.onchange=()=>{
      settings[name]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
      persistControls();showControlDirections();input.blur();
    };
  }
  byId('sensitivity').oninput=()=>{
    settings.sensitivity=Number(byId('sensitivity').value);
    persistControls();showControlDirections();
  };
  byId('resetControls').onclick=()=>{
    settings={...settings,...defaultControls};
    for(const [name,value] of Object.entries(defaultControls)){
      const field=byId(name);
      if(!field) continue;
      if(typeof value==='boolean') field.checked=value;else field.value=value;
    }
    if(flight) flight.manualControls={pitch:0,roll:0,rudder:0};
    persistControls();showControlDirections();
    byId('resetControls').blur();
  };
  const legacyRoute=[worldRunway(2400,0),worldRunway(2700,2100),worldRunway(-3600,2100),worldRunway(-4000,0),worldRunway(-900,0)];
  const keys=new Set(), pointer={x:0,y:0,active:false};
  const cockpitView={preset:0,yaw:0,pitch:0,zoom:0,drag:null};
  const cockpitEye=new THREE.Vector3(), cockpitAim=new THREE.Vector3();
  const cockpitOrientation=new THREE.Quaternion(), lookRotation=new THREE.Quaternion();
  const cockpitAngles=new THREE.Euler(0,0,0,'YXZ');
  const visualPosition=new THREE.Vector3(),visualForward=new THREE.Vector3();
  const previousPose={};
  let poseFlight=null,chaseHeading=null;
  function rememberPose(f){
    previousPose.x=f.x;previousPose.y=f.y;previousPose.z=f.z;
    previousPose.heading=f.heading;previousPose.pitch=f.pitch;previousPose.bank=f.bank;
  }
  const cockpitActive=()=>Boolean(flight&&(renderer.instrumentOnly||cameraMode===1)&&!flight.cabinView);
  const twoSeats=profile=>['passenger','cargo'].includes(profile?.role);
  function resetLook(){
    Object.assign(cockpitView,{yaw:0,pitch:0,zoom:0,drag:null});
  }
  function cycleCockpitView(){
    if(!cockpitActive()) return;
    cockpitView.preset=(cockpitView.preset+1)%(twoSeats(flight.aircraft)?3:2);
    resetLook();
    changeView();
  }
  const controls=new Set(['KeyW','KeyS','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyC','KeyF','KeyR','KeyQ','KeyE','KeyX','KeyZ','KeyP','KeyB','KeyI','KeyL','KeyG','KeyV','KeyN','Home','KeyJ','KeyM','KeyH','KeyK']);
  const radar=byId('radar').getContext('2d');
  const planMap=byId('planMap').getContext('2d');
  const flightRate=byId('flightRate'),flightRateStatus=byId('flightRateStatus');
  const touchThrottle=byId('touchThrottle'),touchThrottleValue=byId('touchThrottleValue');
  flightRate.onchange=()=>{
    byId('voyageRate').value=flightRate.value;
    if(flight) saveCurrentMission(flight);
  };
  touchThrottle.oninput=()=>{
    if(!flight||replay||paused||flight.finished||flight.tow||!byId('gateGuide').hidden) return;
    if(flight.hold) stopNavigation(flight);
    if(flight.aircraft.helicopter)flight.hover=null;
    flight.power=Number(touchThrottle.value)/100;
  };
  const switches=byId('switches');
  const special=byId('special');
  let voyageFrames=[], replay=null;
  const replaySeek=byId('replaySeek');
  const replayControls=byId('replayControls');
  function updateReplayButton(){byId('playVoyage').hidden=!loadVoyage();}
  byId('replaySeek').oninput=()=>{
    if(!replay) return;
    replay.time=Number(replaySeek.value);
    trail.length=0;
  };
  byId('replayToggle').onclick=()=>{
    if(!replay) return;
    if(replay.time>=replay.duration) replay.time=0;
    replay.paused=!replay.paused;
    showTouchPause(replay.paused);
    byId('replayToggle').textContent=replay.paused?'播放回放':'暫停回放';
  };
  byId('replayRate').onclick=()=>{
    if(!replay) return;
    replay.rate=replay.rate===60?12:replay.rate===12?1:60;
    byId('replayRate').textContent='倍率 '+replay.rate+'×';
  };
  byId('playVoyage').onclick=()=>{
    const data=loadVoyage();
    if(!data) return;
    byId('aircraft').value='sf748';
    byId('lesson').value='naritaCargo';
    byId('time').value=data.time||'21:00';
    flight=makeCargoVoyage(airports.find(a=>a.code==='RCTP'),selectedAircraft(),data.node||'load',data.wind||0);
    replay={...data,time:0,duration:data.frames.at(-1)[0],rate:60,paused:false};
    beginFlight();
    replaySeek.max=replay.duration;replaySeek.value=0;
    byId('replayToggle').textContent='暫停回放';
    byId('replayRate').textContent='倍率 60×';
    replayControls.hidden=false;
    for(const control of [...switches.children,...special.querySelectorAll('input')]) control.disabled=true;
  };
  const flightAudio=makeFlightAudio();
  let audioEnabled=true, previousTouchdown=null;
  try{audioEnabled=localStorage.getItem('skybound-audio')!=='off';}catch{}
  const volume=byId('flightVolume'),volumeValue=byId('volumeValue');
  try{volume.value=localStorage.getItem('skybound-volume')??'85';}catch{}
  function syncVolume(){
    flightAudio.volume(Number(volume.value)/100);
    volumeValue.textContent=volume.value+'%';
  }
  volume.oninput=()=>{
    syncVolume();
    try{localStorage.setItem('skybound-volume',volume.value);}catch{}
  };
  syncVolume();
  const unlockAudio=()=>{if(audioEnabled) flightAudio.start();};
  addEventListener('keydown',unlockAudio,{once:true});
  addEventListener('pointerdown',unlockAudio,{once:true});
  const soundButtons=[byId('sound'),byId('mobileSound')];
  function updateAudioButtons(){
    for(const button of soundButtons){
      button.setAttribute('aria-pressed',String(audioEnabled));
      button.textContent=audioEnabled?'靜音':'開音效';
    }
  }
  for(const button of soundButtons){
    button.onclick=()=>{
      audioEnabled=!audioEnabled&&flightAudio.start();
      try{localStorage.setItem('skybound-audio',audioEnabled?'on':'off');}catch{}
      updateAudioButtons();
      button.blur();
    };
  }
  updateAudioButtons();
  const statLabels=['IAS km/h','高度 m','升降 FT/M','航向','功率','襟翼／配平','地速 GS km/h','真空速 TAS km/h','Mach'];
  byId('stats').insertAdjacentHTML('afterbegin',statLabels.map(label=>'<div class="stat"><small>'+label+'</small><b></b></div>').join(''));
  const statValues=Array.from(byId('stats').querySelectorAll('b'));
  const labelAirport=r=>r.code+' '+r.name+' · '+r.designator;
  for(const r of airports){
    byId('departure').add(new Option(labelAirport(r),r.code));
    byId('destination').add(new Option(labelAirport(r),r.code));
  }
  byId('destination').value='RCYU';
  for(const m of fleet) byId('aircraft').add(new Option(m.name,m.id));
  byId('aircraft').value='a223';
  const selectedAircraft=()=>fleet.find(m=>m.id===byId('aircraft').value);
  const selectedAirport=name=>airports.find(r=>r.code===byId(name).value);
  function parsePlan(custom=true){
    const departure=selectedAirport('departure'), destination=selectedAirport('destination');
    const auto=regionalRoute(departure,destination);
    const lines=custom?byId('waypoints').value.trim().split(/\r?\n/).filter(Boolean):[];
    const route=lines.length?lines.map((line,i)=>{
      const match=line.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
      if(!match) throw new Error('航點 '+(i+1)+' 請輸入「緯度,經度」。');
      const lat=Number(match[1]), lon=Number(match[2]);
      const point=geoPoint(lat,lon);
      const [left,top,width,height]=taiwanSatelliteData.overview;
      if(point.x<left||point.x>left+width||point.z<top||point.z>top+height)
        throw new Error('航點 '+(i+1)+' 超出台灣地景範圍。');
      return {name:'自訂航點 '+(i+1),...point};
    }).concat(auto.slice(-2)):auto;
    return {departure,destination,route};
  }
  function mapPath(context,points,project,color,width=2){
    context.strokeStyle=color;
    context.lineWidth=width;
    context.beginPath();
    points.forEach((point,i)=>i===0?context.moveTo(...project(point)):context.lineTo(...project(point)));
    context.stroke();
  }
  const airlineRoute=()=>{
    const to=byId('airlineRoute').value;
    const from=['RCQC','RCBS'].includes(to)?'RCSS':'RCTP';
    return [from,to].map(code=>airports.find(a=>a.code===code));
  };
  const compatibleAirline=(plane,from,to)=>plane.role==='passenger'&&
    (plane.regionalGates||[from,to].every(airport=>airport.length>=3000&&airport.width>=55));
  let lastBriefPlane;
  let hangarLiveries={};
  function updateHangar(){
    const career=readCareer(),aircraft=selectedAircraft();
    hangarLiveries=career.liveries??{};
    const available=Boolean(aircraft.role),owned=career.owned?.[aircraft.id];
    byId('hangarShop').hidden=!available;
    byId('buyLivery').disabled=Boolean(hangarLiveries[aircraft.id]);
    byId('buyPlane').disabled=!hangarPrices[aircraft.id]||Boolean(owned);
    byId('shopInfo').textContent='海灣青塗裝 '+(hangarLiveries[aircraft.id]?'已購買':liveryPrice.toLocaleString()+' 金幣')+
      (hangarPrices[aircraft.id]?' · '+(owned?'已擁有':'買機 '+hangarPrices[aircraft.id].toLocaleString()+' 金幣 · 未購買時每個載客航班租金 4,500'):'');
    const quote=maintenanceQuote(career,aircraft);
    const maintenance=byId('servicePlane');
    maintenance.hidden=byId('maintenanceInfo').hidden=!quote.owned;
    maintenance.disabled=quote.busy||!quote.cost||career.money<quote.cost;
    maintenance.textContent='維修至 100% · '+quote.cost.toLocaleString()+' 金幣';
    byId('maintenanceInfo').textContent='機況 '+quote.condition+'%'+(quote.busy?' · 航班進行中':
      quote.condition<minimumDispatchCondition?' · 需維修後才能接定期航班':' · 可執飛定期航班');
  }
  for(const [id,item] of [['buyLivery','livery'],['buyPlane','plane']]){
    byId(id).onclick=()=>{
      const ok=purchaseHangar(selectedAircraft(),item);
      byId('shopMessage').textContent=ok?'已購買':'餘額不足或無法儲存';
      updateAirlinePlan();
    };
  }
  byId('servicePlane').onclick=()=>{
    const ok=serviceHangar(selectedAircraft());
    byId('shopMessage').textContent=ok?'維修完成，機況已恢復至 100%':'目前無法維修';
    updateAirlinePlan();
  };
  function updateAirlinePlan(){
    updateHangar();
    const active=byId('lesson').value==='airline';
    byId('airlinePlan').hidden=!active;
    const career=readCareer();
    byId('wallet').textContent='遊戲金幣 '+career.money.toLocaleString()+' · 存在目前瀏覽器';
    const passengers=passengerCheckpoints(career);
    const missions=missionCheckpoints();
    function fillSaved(select,flights,id){
      const previous=select.value;
      select.replaceChildren(...flights.map(f=>new Option(
        f.aircraft.name+' · '+f.departure.code+' → '+f.destination.code+' · '+Math.floor(f.elapsed/60)+' 分',id(f))));
      if([...select.options].some(option=>option.value===previous)) select.value=previous;
      select.hidden=flights.length===0;
    }
    fillSaved(byId('savedAirline'),passengers,f=>f.service.id);
    fillSaved(byId('savedMission'),missions.map(checkpoint=>checkpoint.flight),f=>f.checkpointId);
    byId('resumeAirline').hidden=!passengers.length;
    byId('resumeMission').hidden=byId('discardMission').hidden=!missions.length;
    byId('planResumes').hidden=!passengers.length&&!missions.length;
    if(!active) return;
    const aircraft=selectedAircraft();
    const field=byId('airlineFuel');
    const [from,to]=airlineRoute();
    if(!compatibleAirline(aircraft,from,to)){
      byId('passengerBrief').textContent='請選擇適合此跑道和機位的客機。離島航線建議 A220-300。';
      byId('fuelPreview').textContent='';
      field.disabled=true;
      return;
    }
    const quote=maintenanceQuote(career,aircraft);
    if(quote.owned&&quote.condition<minimumDispatchCondition){
      byId('passengerBrief').textContent='自有客機機況 '+quote.condition+'%，請先在機庫工坊維修。';
      byId('fuelPreview').textContent='';
      field.disabled=true;
      return;
    }
    const brief=passengerBrief(aircraft,from,to);
    field.disabled=false;
    field.min=brief.estimated+brief.reserve;field.max=brief.capacity;
    const briefKey=aircraft.id+to.code;
    if(lastBriefPlane!==briefKey||!field.value) field.value=Math.min(Number(field.min),Number(field.max));
    lastBriefPlane=briefKey;
    const fuel=Number(field.value);
    const weight=aircraft.mass+fuel-brief.capacity;
    byId('passengerBrief').textContent=from.name+' → '+to.name+' · '+(brief.distance*1.852).toFixed(0)+' km · 班表 '+brief.schedule+
      ' 分鐘 · '+byId('weather').selectedOptions[0].text+' · '+brief.passengers+' 人／'+brief.passengers+' 座 · 行李 '+
      (brief.passengers*15).toLocaleString()+' kg · 基本報酬 '+brief.base.toLocaleString()+' 金幣';
    byId('fuelPreview').textContent='預估航程耗油 '+brief.estimated+' kg · 備降及備用 '+brief.reserve+
      ' kg · 估計起飛重量 '+weight.toLocaleString()+' kg · 估計可用 '+Math.round(60*fuel/brief.hourlyFuel)+
      ' 分鐘 · 估計用油費 '+Math.round(brief.estimated*.8).toLocaleString()+' 金幣';
  }
  byId('airlineFuel').oninput=updateAirlinePlan;
  byId('airlineRoute').onchange=drawPlan;
  byId('weather').addEventListener('change',updateAirlinePlan);
  byId('quickAirline').onclick=()=>{
    byId('aircraft').value='a320neo';
    byId('lesson').value='airline';
    byId('airlineRoute').value='RCKH';
    drawPlan();
    start(false);
  };
  byId('resumeAirline').onclick=()=>{
    const saved=passengerCheckpoints().find(f=>f.service.id===byId('savedAirline').value);
    if(!saved) return;
    const aircraft=fleet.find(a=>a.id===saved.aircraft.id);
    if(!aircraft){byId('message').textContent='此存檔的機型目前無法載入。';return;}
    saved.aircraft=aircraft;
    byId('aircraft').value=aircraft.id;byId('lesson').value='airline';
    byId('weather').value=saved.service.weather;byId('time').value=saved.service.time;
    flight=saved;
    beginFlight();
  };
  byId('resumeMission').onclick=()=>{
    const checkpoint=readMissionCheckpoint(byId('savedMission').value);
    if(!checkpoint) return;
    const {flight:saved,options,frames}=checkpoint;
    const aircraft=fleet.find(a=>a.id===saved.aircraft.id);
    if(!aircraft){byId('message').textContent='此存檔的機型目前無法載入。';return;}
    saved.aircraft=aircraft;
    byId('aircraft').value=aircraft.id;
    byId('lesson').value=options.lesson;
    byId('weather').value=options.weather;
    byId('time').value=options.time;
    if([...byId('voyageRate').options].some(option=>option.value===options.rate)) byId('voyageRate').value=options.rate;
    if(saved.voyage){
      byId('voyageNode').value=saved.node;
      byId('voyageGuided').checked=options.guided;
    }
    byId('cruiseWind').value=options.cruiseWind;
    replay=null;
    replayControls.hidden=true;
    voyageFrames=saved.voyage?frames:[];
    flight=saved;
    beginFlight();
    cameraMode=options.camera===1?1:0;
    const savedView=options.cockpitView;
    if(savedView){
      cockpitView.preset=clamp(Math.trunc(savedView.preset)||0,0,twoSeats(aircraft)?2:1);
      cockpitView.yaw=clamp(Number(savedView.yaw)||0,-100*rad,100*rad);
      cockpitView.pitch=clamp(Number(savedView.pitch)||0,-58*rad,48*rad);
      cockpitView.zoom=clamp(Number(savedView.zoom)||0,-14,22);
    }
    changeView();
    paused=true;
    nextCheckpoint=performance.now()+15000;
  };
  byId('discardMission').onclick=()=>{
    const checkpoint=readMissionCheckpoint(byId('savedMission').value);
    if(!checkpoint||!confirm('刪除尚未完成的任務進度與其未完成的回放？')) return;
    if(clearMissionCheckpoint(checkpoint.flight.checkpointId)) drawPlan();
  };
  const planModes=Array.from(document.querySelectorAll('[data-plan-mode]'));
  const terrainPreview=document.createElement('canvas');
  terrainPreview.width=430;terrainPreview.height=440;
  const terrainPreviewInk=terrainPreview.getContext('2d');
  terrainPreviewInk.fillStyle='#12364d';terrainPreviewInk.fillRect(0,0,430,440);
  for(let y=0;y<440;y+=2){
    for(let x=0;x<430;x+=2){
      const h=regionalHeight((x-290)*900,(y-43)*900);
      if(h<.8) continue;
      terrainPreviewInk.fillStyle=h>1900?'#afb7a1':h>550?'#5d805f':'#426d56';
      terrainPreviewInk.fillRect(x,y,2,2);
    }
  }
  function drawTaiwanMap(context,project){
    const [x,z,width,height]=atlasReady.value?taiwanSatelliteData.overview:[-290*900,-43*900,430*900,440*900];
    const image=atlasReady.value?atlasImage.value.image:terrainPreview;
    const [left,top]=project({x,z}),[right,bottom]=project({x:x+width,z:z+height});
    context.drawImage(image,left,top,right-left,bottom-top);
  }
  for(const button of planModes) button.onclick=()=>{
    byId('lesson').value=button.dataset.planMode;
    drawPlan();
  };
  function drawPlan(){
    const lesson=byId('lesson').value;
    const isCircuit=['circuit','crosswind'].includes(lesson);
    if(isCircuit) byId('aircraft').value='a223';
    const isTactical=lesson==='tactical';
    byId('tacticalSetup').hidden=!isTactical;
    if(isTactical&&selectedAircraft().role!=='fighter') byId('aircraft').value='sf16';
    for(const option of byId('aircraft').options){
      option.disabled=isTactical&&fleet.find(plane=>plane.id===option.value)?.role!=='fighter';
    }
    const isVoyage=lesson==='naritaCargo';
    if(isVoyage) byId('aircraft').value='sf748';
    const isClimb=lesson==='climbLesson';
    if(isClimb) byId('aircraft').value='b773';
    const isCruise=isClimb||lesson==='cruiseTrial';
    const rangeLesson=lesson==='range';
    if(rangeLesson) byId('aircraft').value='sf16';
    const contract=regionalContracts[lesson];
    if(contract) byId('aircraft').value='a223';
    if(lesson==='airline'&&selectedAircraft().role!=='passenger') byId('aircraft').value='a223';
    byId('aircraft').disabled=isVoyage||isClimb||isCircuit||rangeLesson||Boolean(contract);
    const custom=['free','cold','taxi','benchmark'].includes(lesson);
    byId('planRouteFields').hidden=!custom;
    byId('waypoints').closest('label').hidden=!custom;
    byId('startType').closest('label').hidden=lesson!=='free'&&lesson!=='route';
    byId('approach').hidden=isTactical||isCruise||lesson==='airline'||Boolean(contract)||lesson==='benchmark'||rangeLesson;
    for(const button of planModes) button.setAttribute('aria-pressed',String(button.dataset.planMode===lesson));
    byId('cruiseWeather').hidden=!isCruise;
    byId('voyageOptions').hidden=!isVoyage;
    updateAirlinePlan();
    const model=selectedAircraft();
    try{
      let {departure,destination,route}=contract?regionalContractPlan(lesson):parsePlan(custom);
      if(isCircuit){
        departure=destination=airports.find(a=>a.code==='RCSS');
        route=trainingRoute(departure);
      }
      const mission=lesson==='benchmark'?benchmarkMissions[model.role]:null;
      if(lesson==='route'){
        departure=airports.find(a=>a.code==='RCSS');
        destination=airports.find(a=>a.code==='RCYU');
        route=regionalRoute(departure,destination);
      }
      if(isTactical){
        departure=destination=airports.find(a=>a.code==='RCMQ');
        route=tacticalRoute(departure,tacticalSelection);
      }
      if(lesson==='airline'){
        [departure,destination]=airlineRoute();
        route=passengerBrief(model,departure,destination).route;
      }
      if(isCruise){
        departure=airports.find(a=>a.code==='RCTP');
        destination=airports.find(a=>a.code==='RCKH');
        const profile=isClimb?fleet.find(a=>a.id==='b773'):model;
        const wind=Number(byId('cruiseWind').value);
        route=isClimb?makeClimbLesson(departure,profile,wind).route:makeCruiseTrial(departure,destination,profile,wind).route;
        if(isClimb) destination=departure;
      }
      if(rangeLesson){
        departure=destination=airports.find(a=>a.code==='RCMQ');
        route=trainingRoute(departure);
      }
      if(isVoyage){
        departure=airports.find(a=>a.code==='RCTP');
        destination=naritaAirport;
        route=cargoVoyageRoute;
      }
      if(mission){
        departure=airports.find(a=>a.code===mission.from);
        destination=airports.find(a=>a.code===mission.to);
        route=benchmarkRoute(model.role,departure,destination);
      }
      planPreviewAirport=departure;
      const points=isClimb?[departure,...route]:[departure,...route,destination];
      const overseas=isVoyage||[departure,destination].some(a=>a.code==='RJAA'||a.code==='VHHH'||a.code==='ROAH');
      const planCanvas=planMap.canvas;
      const planDpr=Math.min(window.devicePixelRatio||1,2);
      const planW=430,planH=440;
      if(planCanvas.width!==Math.round(planW*planDpr)||planCanvas.height!==Math.round(planH*planDpr)){
        planCanvas.width=Math.round(planW*planDpr);
        planCanvas.height=Math.round(planH*planDpr);
      }
      planMap.save();
      planMap.scale(planDpr,planDpr);
      planMap.fillStyle='#12364d';planMap.fillRect(0,0,planW,planH);
      const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
      const minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z));
      const metersPerPixel=Math.max((maxX-minX)/350,(maxZ-minZ)/355,1);
      const [left,top,mapWidth,mapHeight]=taiwanSatelliteData.overview;
      const scale=Math.min(400/mapWidth,418/mapHeight);
      const project=overseas?
        (p=>[215+(p.x-(minX+maxX)/2)/metersPerPixel,220+(p.z-(minZ+maxZ)/2)/metersPerPixel]):
        (p=>[215+(p.x-left-mapWidth/2)*scale,220+(p.z-top-mapHeight/2)*scale]);
      drawTaiwanMap(planMap,project);
      if(overseas){
        // Overseas regional outline hint
        planMap.strokeStyle='rgba(130, 180, 210, 0.35)';
        planMap.lineWidth=1.5;
        planMap.strokeRect(10,10,planW-20,planH-20);
      }
      mapPath(planMap,points,project,'#6ceaff');
      planMap.font='bold 12px system-ui, sans-serif';planMap.fillStyle='#f4f9fd';
      for(const r of overseas?[departure,destination]:taiwanAirports){
        const [x,y]=project(r);
        planMap.fillStyle=r===destination?'#ffd700':'#6ceaff';
        planMap.fillRect(x-3,y-3,6,6);
        planMap.fillStyle='#ffffff';
        planMap.fillText(r.code,x+8,y+4);
      }
      // Leg Distance & Track labels for route
      if(points.length>1){
        planMap.font='10px system-ui, monospace';
        planMap.fillStyle='rgba(255, 255, 255, 0.75)';
        for(let i=0;i<points.length-1;i++){
          const pA=points[i],pB=points[i+1];
          const [ax,ay]=project(pA),[bx,by]=project(pB);
          const mx=(ax+bx)/2,my=(ay+by)/2;
          const legDist=Math.hypot(pB.x-pA.x,pB.z-pA.z);
          const legNm=Math.round(legDist/1852);
          const legDeg=Math.round((Math.atan2(pB.x-pA.x,pA.z-pB.z)/rad+360)%360);
          if(Math.hypot(bx-ax,by-ay)>45){
            planMap.fillText(legDeg+'° · '+legNm+' NM',mx+4,my-4);
          }
        }
      }
      planMap.restore();
      byId('routePreview').textContent=isClimb?'777-300ER · 桃園 05L 起飛 · 35,000 ft 巡航練習':departure.name+' → '+destination.name+' · '+route.map(p=>p.name).join(' → ');
      byId('message').textContent=contract?'基本報酬 '+contract.base+' 金幣':'';
      if(isTactical) byId('message').textContent='虛構訓練空域 · '+tacticalScenarios[tacticalSelection].brief+
        (touchControls.mode.value==='mobile'?' · 點「發射」':' · M 發射');
    }catch(error){byId('message').textContent=error.message;}
  }
  for(const name of ['aircraft','departure','destination','waypoints','lesson','cruiseWind']) byId(name).addEventListener('change',drawPlan);
  function showLog(){
    const rows=readFlightLog();
    byId('log').replaceChildren();
    for(const row of rows.slice(0,12)){
      const item=document.createElement('p');
      const time=new Date(row.date).toLocaleString('zh-TW');
      item.textContent=time+' · '+row.aircraft+' · '+row.departure+' → '+row.destination+' · '+Math.round(row.seconds/60)+' 分鐘 · '+row.result+(row.reward?' · '+row.reward+' 金幣':'');
      byId('log').append(item);
    }
    if(!rows.length) byId('log').textContent='尚無飛行紀錄';
    const progress=document.createElement('p');
    try{
      const names={cold:'冷艙',taxi:'滑行',circuit:'起落航線',crosswind:'側風進場',route:'跨機場導航'};
      progress.textContent='已完成課程 · '+(Object.keys(names).filter(k=>localStorage.getItem('skybound.lesson.'+k)).map(k=>names[k]).join('、')||'尚無');
      byId('log').append(progress);
    }catch{}
  }
  function changeView(){
    chaseHeading=null;
    const heli=Boolean(flight?.aircraft.helicopter),keysHelp=document.querySelector('#hud .keys');
    if(keysHelp){
      keysHelp.dataset.fixedHelp??=keysHelp.textContent;
      keysHelp.textContent=heli?'W / S 總距升降 · ↑/↓ 前飛／後退 · ←/→ 側飛 · Q/E 轉機頭 · J 懸停 · C 視角 · B 停機煞車':keysHelp.dataset.fixedHelp;
    }
    byId('touchStick').setAttribute('aria-label',heli?'直升機搖桿，向前推前飛、後拉後退、左右側飛':'飛行搖桿，上拉升、下壓低、左右轉向');
    const cockpit=cockpitActive();
    byId('cockpit').hidden=byId('struts').hidden=!cockpit||Boolean(flight?.aircraft.role||flight?.aircraft.helicopter);
    byId('systems').hidden=!flight?.regional;
    byId('reticle').hidden=!cockpit||Boolean(flight?.aircraft.role||flight?.aircraft.helicopter);
    document.body.classList.toggle('cockpit-active',cockpit);
    document.body.classList.toggle('cockpit-panel-view',
      cockpit&&cockpitView.preset===(twoSeats(flight.aircraft)?2:1));
    document.body.dataset.panel=flight?.aircraft?.glass?'glass':'analog';
    const mobile=touchControls.mode.value==='mobile';
    byId('view').textContent=(cockpit?'追蹤視角':'駕駛艙')+(mobile?'':' C');
    byId('cockpitViews').hidden=!cockpit;
    if(cockpit){
      const views=twoSeats(flight.aircraft)?['左座','右座','儀表近看']:['正前方','儀表近看'];
      byId('cockpitPreset').textContent=views[cockpitView.preset]+(mobile?'':' · N');
    }
  }
  function setEnvironment(){
    const [hours,minutes]=byId('time').value.split(':').map(Number);
    const hour=(hours||0)+(minutes||0)/60;
    const angle=(hour-6)/12*Math.PI;
    const elevation=Math.sin(angle);
    const day=clamp((elevation+.13)/.53,0,1);
    const weather=byId('weather').value;
    const wet=weather==='wet';
    const strength=weather==='fog'?.42:wet?.62:weather==='clouds'?.85:1;
    const warmth=clamp(1-Math.min(Math.abs(hour-6),Math.abs(hour-18))/1.45,0,1);
    sunlight.intensity=.05+day*2.3*strength;
    sunlight.color.set('#fff0d9').lerp(new THREE.Color('#ffad71'),warmth);
    ambient.intensity=.16+day*1.14*(weather==='fog'?.83:1);
    sunDirection.set(Math.cos(angle)*760,elevation*820,-280);
    atmosphericSky.setWeather(hour,day,weather,sunDirection);
    scene.background.set('#132740').lerp(new THREE.Color(weather==='fog'?'#c5ced1':wet?'#aabac5':'#b2ccdc'),day);
    scene.fog.color.copy(scene.background);
    scene.fog.density=weather==='fog'?.00064:wet?.000065:.000034;
    lampMaterial.color.set(day>.07?0xc5d7e2:0xeffaff);
    asphalt.roughness=wet?.24:.90;asphalt.metalness=wet?.27:.02;
    concrete.roughness=wet?.31:.92;concrete.metalness=wet?.19:.02;
    return day;
  }
  let activeDay=1,previewNight=false;
  let nextCheckpoint=0;
  function saveCurrentMission(f,replaces){
    if(!f||replay) return;
    if(f.service){savePassenger(f);return;}
    if(!f.checkpointId||f.finished) return;
    const options={lesson:byId('lesson').value,weather:byId('weather').value,time:byId('time').value,
      rate:byId('voyageRate').value,guided:byId('voyageGuided').checked,cruiseWind:byId('cruiseWind').value,camera:cameraMode,
      cockpitView:{preset:cockpitView.preset,yaw:cockpitView.yaw,pitch:cockpitView.pitch,zoom:cockpitView.zoom}};
    f.checkpointFailed=!writeMissionCheckpoint(f,options,f.voyage?voyageFrames:[],replaces);
    nextCheckpoint=performance.now()+15000;
  }
  function setBattery(f,on){
    f.battery=on;
    saveCurrentMission(f);
  }
  addEventListener('pagehide',()=>saveCurrentMission(flight));
  function callRunwayTow(f,skip=false){
    if(!paused&&!replay&&(f.tow?skip:f.landed?requestGateTow(f):requestRunwayTow(f))){
      f.towMessage='';
      if(skip) finishRunwayTow(f);
      if(f.cabinView){f.cabinView=false;changeView();}
      if(skip) saveCurrentMission(f);
      return;
    }
    if(!f.tow) f.towMessage=f.landed?'請先煞停，再呼叫拖車。':'請停穩、收油並關閉艙門。載客與貨運任務須先完成裝載。';
  }
  byId('skipRunwayTow').onclick=byId('gateSkipTow').onclick=()=>{
    if(flight) callRunwayTow(flight,true);
  };
  byId('startGateTow').onclick=()=>{if(flight) callRunwayTow(flight);};
  function addPassengerSystems(f,entries){
    const service=f.service;
    const atGate=()=>!f.finished&&groundServiceAllowed(f)&&!service.pushing&&(!service.pushed||f.awaitingService);
    const fuel=()=>{if(atGate()&&!f.awaitingService) service.pumping=f.fuel<service.targetFuel&&!service.pumping;};
    const bridge=()=>{if(atGate()&&!service.door) f.bridge=!f.bridge;};
    const door=()=>{if(atGate()) setPassengerDoor(f,!service.door);};
    const aisle=()=>{f.cabinView=f.cabinView==='aisle'?false:'aisle';changeView();};
    byId('gateStep').onclick=()=>{
      if(!f.parkingBrake&&f.ground&&Math.hypot(f.vx,f.vz)<.8){f.parkingBrake=true;return;}
      if(f.ground&&f.parkingBrake&&Math.hypot(f.vx,f.vz)<.8&&f.engines.some(Boolean)){
        f.engines.forEach((running,index)=>{if(running) startEngine(f,index);});
        return;
      }
      if(atGate()&&!f.awaitingService&&!f.battery){setBattery(f,true);return;}
      const complete=f.awaitingService?service.delivered===f.passengers:service.boarded===f.passengers;
      if(!f.awaitingService&&complete&&!f.bridge&&f.fuel>=service.targetFuel){callRunwayTow(f);return;}
      if(f.bridge&&(service.door||!complete)) door();
      else bridge();
    };
    byId('gateFuel').onclick=fuel;
    byId('gateView').onclick=aisle;
    entries.push(
      ['客艙廣播',()=>false,()=>{
        const message=f.awaitingService?'已抵達，請依序下機。':f.ground?'歡迎登機，請就座並繫好安全帶。':'請繫好安全帶。';
        service.announcement=message;
        if(!audioEnabled||!window.speechSynthesis) return;
        const voice=speechSynthesis.getVoices().find(v=>v.localService&&v.lang.toLowerCase().startsWith('zh'));
        if(voice){
          const audio=new SpeechSynthesisUtterance(message);
          audio.voice=voice;speechSynthesis.speak(audio);
        }
      }],
      ['加油',()=>Boolean(service.pumping),fuel],
      ['連接空橋',()=>f.bridge,bridge],
      ['客艙門',()=>service.door,door],
      ['客艙走道',()=>f.cabinView==='aisle',aisle],
      ['乘客窗景',()=>f.cabinView==='window',()=>{f.cabinView=f.cabinView==='window'?false:'window';changeView();}],
      ['客艙照明',()=>service.cabinLights,()=>{service.cabinLights=!service.cabinLights;}],
      ['安全帶燈',()=>service.seatBelts,()=>{service.seatBelts=!service.seatBelts;}]
    );
    const output=document.createElement('p');
    output.id='passengerStatus';
    special.append(output);
    const alternate=document.createElement('button');
    alternate.textContent='備降臺中';
    alternate.onclick=()=>{
      if(f.ground||f.landed||f.finished||service.diverted) return;
      const airport=airports.find(a=>a.code==='RCMQ');
      if(!reachableAlternate(f,airport)) return;
      f.destination=airport;
      f.route=regionalRoute(f.departure,airport);
      f.waypoint=0;service.diverted=true;
      savePassenger(f);
    };
    alternate.id='passengerAlternate';
    const goAround=document.createElement('button');
    goAround.textContent='重新進場';
    goAround.id='passengerGoAround';
    goAround.onclick=()=>{
      if(f.ground||f.finished||f.phase!=='approach') return;
      const runway=f.destination;
      const frame=runwayCoordinates(f.x,f.z,runway);
      const departureLeg=airportPoint(runway,Math.max(3500,frame.along+2500),0);
      f.route=[{...departureLeg,name:'重飛爬升'},...regionalRoute(f.departure,runway)];
      f.waypoint=0;f.hold=null;
    };
    const cancel=document.createElement('button');
    cancel.textContent='結束本次任務';
    cancel.onclick=()=>{
      if(f.finished) return;
      f.finished=true;f.ended=true;
      f.recorded=recordFlight(f,'任務取消');
    };
    special.append(alternate,goAround,cancel);
  }
  function reachableAlternate(f,airport){
    const distance=Math.hypot(airport.x-f.x,airport.z-f.z);
    const hourly=((f.aircraft.fuelIdle??.30)+.61*(f.aircraft.fuelPower??3.3))*3600;
    return f.fuel>hourly*(distance/1852/195+.25);
  }
  function drawPassengerStatus(f){
    const service=f.service;
    drawGateGuide(f);
    const output=byId('passengerStatus');
    byId('passengerAlternate').disabled=f.ground||f.finished||service.diverted||!reachableAlternate(f,airports.find(a=>a.code==='RCMQ'));
    byId('passengerGoAround').disabled=f.ground||f.finished||f.phase!=='approach';
    if(f.receipt){
      const r=f.receipt;
      output.textContent='基本 '+r.base+' · 準點獎金 '+r.punctual+' · 燃油費 '+r.fuel+
        ' · 地勤 '+r.handling+' · 維修 '+r.maintenance+' · 租賃 '+(r.rent||0)+' · 淨額 '+r.net+' 金幣 · 滿意度 '+r.comfort+
        '%'+(r.condition!==undefined?' · 機況 '+r.condition+'%（磨耗 '+r.wear+'）':'')+(service.roughPhase?' · 不平穩階段 '+service.roughPhase:'')+(service.landingPenalty?' · 接地扣分 '+service.landingPenalty:'');
      return;
    }
    output.textContent='登機 '+service.boarded+'/'+f.passengers+' · 空位 '+(f.passengers-service.boarded)+
      ' · 已下機 '+service.delivered+' · 行李 '+service.boarded*15+' kg · 燃油 '+Math.round(f.fuel)+'/'+service.targetFuel+
      ' kg · '+(f.fuelFlow||0).toFixed(2)+' kg/s · 重量 '+Math.round(flightMass(f)).toLocaleString()+
      ' kg · '+(service.seatBelts?'請繫安全帶':'安全帶燈已關閉')+
      (f.airborne&&f.fuel<service.brief.reserve?' · 低油量，請檢查備降':'')+
      (service.door&&service.mode&&(service.bridgeElapsed||0)<(service.bridgeDelay||0)?' · 旅客正在通過空橋':'')+
      (service.announcement?' · 廣播：'+service.announcement:'');
  }
  function drawGateGuide(f){
    const service=f.service;
    const guide=byId('gateGuide');
    guide.hidden=f.finished||!f.ground||service.pushing>0||Boolean(f.tow)||(f.landed||service.pushed)&&!f.awaitingService;
    if(guide.hidden) return;
    const arriving=f.awaitingService;
    const complete=arriving?service.delivered===f.passengers:service.boarded===f.passengers;
    const available=groundServiceAllowed(f);
    const count=arriving?service.delivered:service.boarded;
    const activity=arriving?'下機':'登機';
    let prompt, next;
    if(!f.parkingBrake){prompt='停妥後拉上停機煞車。';next='停機煞車';}
    else if(f.engines.some(Boolean)){prompt='請關閉引擎，才能使用空橋。';next='關閉引擎';}
    else if(!available){prompt='請在機位停妥後開始地勤作業。';}
    else if(!arriving&&!f.battery){prompt='先開電瓶，供電後再準備登機。';next='開電瓶';}
    else if(!f.bridge&&!complete){prompt='接上空橋，準備'+activity+'。';next='接上空橋';}
    else if(!service.door&&!complete){prompt='開門後，旅客會自動'+activity+'。';next='開艙門';}
    else if(!complete){prompt='旅客正在'+activity+'，請保持艙門開啟。';}
    else if(service.door){prompt=activity+'完成，可以關門。';next='關艙門';}
    else if(f.bridge){prompt='艙門已關閉，可以收回空橋。';next='收回空橋';}
    else if(arriving) prompt='地勤作業完成。';
    else if(f.fuel<service.targetFuel) prompt='登機完成，請完成加油。';
    else {prompt='登機與加油完成，可以呼叫拖車。';next='拖車牽引至跑道';}
    const message=activity+' '+count+'/'+f.passengers+' 人 · '+prompt;
    const caption=byId('gateCaption');
    if(caption.textContent!==message) caption.textContent=message;
    const step=byId('gateStep'), fuel=byId('gateFuel');
    step.hidden=!next;
    const skip=byId('gateSkipTow');
    skip.hidden=next!=='拖車牽引至跑道';
    skip.disabled=Math.hypot(f.vx,f.vz)>=.8||paused;
    if(next&&step.textContent!==next) step.textContent=next;
    step.disabled=paused||Boolean(replay)||Math.hypot(f.vx,f.vz)>=.8;
    fuel.hidden=arriving||!f.battery||f.fuel>=service.targetFuel;
    fuel.disabled=!available||f.fuel>=service.targetFuel;
    const fuelLabel=service.pumping?'停止加油':f.fuel>=service.targetFuel?'加油完成':'開始加油';
    if(fuel.textContent!==fuelLabel) fuel.textContent=fuelLabel;
  }
  function jetwayEndpoints(f,model){
    const airport=f.awaitingService?f.destination:f.departure;
    const {radius,half}=model.userData;
    const door=new THREE.Vector3(-radius*.94-.12,-.72,-half*.58);
    door.applyQuaternion(model.quaternion).add(model.position);
    const gate=airportPoint(airport,65,jetwayWalls.get(airport.code));
    return {terminal:new THREE.Vector3(gate.x,airport.elevation+4.5,gate.z),door,airport};
  }
  function showSystems(f){
    switches.replaceChildren();special.replaceChildren();
    const entries=[
      ['電瓶',()=>f.battery,()=>setBattery(f,!f.battery)],
      ...f.engines.map((_,i)=>['引擎 '+(i+1),()=>f.engines[i],()=>startEngine(f,i)]),
      ['停機煞車',()=>f.parkingBrake,()=>f.parkingBrake=!f.parkingBrake],
      ['燈光',()=>f.lights,()=>{if(f.battery) f.lights=!f.lights;}],
      ...(!f.aircraft.helicopter?[['襟翼',()=>f.flaps>0,()=>f.flaps=(f.flaps+1)%3]]:[])
    ];
    if(f.aircraft.retract) entries.push(['起落架',()=>f.gear,()=>{if(!f.ground&&f.battery) f.gear=!f.gear;}]);
    if(f.aircraft.reverse){
      if(!f.aircraft.jet) entries.push(['螺旋槳低轉速',()=>f.propLow,()=>f.propLow=!f.propLow]);
      entries.push(['反推',()=>f.reverse,()=>{if(f.ground) f.reverse=!f.reverse;}]);
    }
    if(f.aircraft.jet){
      entries.push(['擾流板',()=>f.spoilers,()=>f.spoilers=!f.spoilers]);
      entries.push(['高速遊戲 · 2,000 km/h IAS',()=>Boolean(f.fastCruise),()=>{
        f.fastCruise=!f.fastCruise;
        if(f.hold?.mach) f.hold.mach=cruiseMachTarget(f);
      }]);
      entries.push(['爬升／巡航 35,000 ft',()=>Boolean(f.hold?.climb),()=>{
        if(f.hold?.climb){f.hold=null;return;}
        if(climbReady(f)){
          f.hold={heading:f.heading,altitude:35000*.3048,mach:cruiseMachTarget(f),climb:true};
        }
      }]);
      entries.push(['航向／高度保持',()=>Boolean(f.hold),()=>{f.hold=f.hold?null:!f.ground&&f.battery?{heading:f.heading,altitude:f.y,mach:f.y>7000&&!f.flaps&&!f.gear?cruiseMachTarget(f):null}:null;}]);
    }
    if(f.aircraft.helicopter)entries.push(['懸停輔助',()=>Boolean(f.hover),()=>toggleHelicopterHover(f)]);
    else entries.push(['自動導航',()=>Boolean(f.hold?.nav),()=>toggleNavigation(f)]);
    if(f.range) entries.push(['射擊訓練靶 M',()=>f.range.hit,()=>{if(!paused&&!replay) rangeShot(f);}]);
    if(f.aircraft.role==='fighter') entries.push(['加力待命',()=>f.boost,()=>{if(f.engines[0]) f.boost=!f.boost;}]);
    if(!f.aircraft.helicopter)entries.push(['拖車牽引至跑道',()=>Boolean(f.tow),()=>callRunwayTow(f)]);
    if(f.service) addPassengerSystems(f,entries);
    if(f.aircraft.role==='passenger'&&!f.service) entries.push(['連接空橋',()=>f.bridge,()=>{
      if(f.awaitingService&&groundServiceAllowed(f)) f.bridge=!f.bridge;
    }]);
    if(f.aircraft.role==='cargo'){
      if(!f.aircraft.sideCargo) entries.push(['機鼻貨門',()=>f.noseDoor,()=>{if(groundServiceAllowed(f)) f.noseDoor=!f.noseDoor;}]);
      if(f.voyage||f.aircraft.sideCargo) entries.push(['側貨門',()=>f.sideDoor,()=>{if(groundServiceAllowed(f)) f.sideDoor=!f.sideDoor;}]);
      entries.push(['主貨艙檢視',()=>f.cabinView,()=>{if(f.ground) f.cabinView=!f.cabinView;}]);
      const sheet=document.createElement('details');
      const summary=document.createElement('summary');
      summary.textContent='貨物與重心';
      sheet.append(summary);
      for(const [index,slot] of palletStations.entries()){
        const row=document.createElement('label'),mass=document.createElement('input');
        mass.type='number';mass.min=0;mass.max=f.aircraft.cargoSlotLimit??38000;mass.step=1000;mass.value=f.pallets[index];
        mass.dataset.pallet=String(index);
        mass.style.width='85px';
        row.append(slot.name+' · '+slot.size+' · kg ',mass);
        mass.onchange=()=>{
          if(setPallet(f,index,Number(mass.value))&&f.phase==='cold'&&f.pallets.some(Boolean)) f.loadedAtDeparture=true;
          mass.value=f.pallets[index];
          if(f.voyage) captureVoyage(f,voyageFrames,true);
        };
        sheet.append(row);
      }
      const output=document.createElement('p');output.id='cargoBalance';
      sheet.append(output);special.append(sheet);
    }
    for(const [label,get,toggle] of entries){
      const b=document.createElement('button');
      b.textContent=label;
      b.update=()=>{
        b.setAttribute('aria-pressed',String(Boolean(get())));
        if(label==='爬升／巡航 35,000 ft'){
          b.disabled=!get()&&!climbReady(f);
          b.title='離地至少 500 呎，收起落架、襟翼與擾流板，並加速至抬輪速度以上 28 km/h';
        }
      };
      b.onclick=()=>{
        const before=get();
        toggle();b.update();b.blur();
        if(f.voyage&&before!==get()) captureVoyage(f,voyageFrames,true);
        if(audioEnabled&&before!==get()) flightAudio.effect(label.startsWith('引擎')?110:62,.04);
      };
      b.update();switches.append(b);
    }
    const items=['電瓶開啟',f.engines.length===2?'兩具引擎啟動':'啟動引擎',f.aircraft.reverse?'確認扭矩及螺旋槳轉速':'確認油門及儀表',
      '滑行前鬆開停機煞車','起飛前襟翼確認','進場 '+knotsToKmh(f.aircraft.approach)+' km/h'+(f.aircraft.retract?'，放下起落架':''),'停妥後拉停機煞車'];
    byId('checklist').replaceChildren(...items.map(label=>{
      const row=document.createElement('label'),box=document.createElement('input');
      box.type='checkbox';row.append(box,' '+label);return row;
    }));
  }
  function beginFlight(){
    // Unlock the audio graph in the same tap that starts or resumes a flight.
    if(audioEnabled&&!flightAudio.start()){
      audioEnabled=false;
      updateAudioButtons();
    }
    byId('gateGuide').hidden=true;
    setOverview(false);
    setGlide(Boolean(flight.approach&&!flight.voyage));
    byId('landingCard').hidden=true;
    shownLanding=null;
    gateProgress=null;
    previousCalloutHeight=null;
    sinkWarning=false;
    setMobilePanel('');
    tacticalView.start(flight);
    byId('tacticalPanel').open=false;
    touchControls.reset();
    showTouchPause(false);
    cockpitView.preset=0;
    resetLook();
    if(flight.regional) showSystems(flight);
    activeDay=setEnvironment();paused=false;accumulator=0;previousFlightRate=1;nextNavDraw=nextInstrumentDraw=0;
    flightRate.value=byId('voyageRate').value||'1';
    releaseFlightInputs();trail.length=0;previousTouchdown=null;
    byId('plan').hidden=byId('edition').hidden=true;
    byId('hud').hidden=byId('menu').hidden=false;
    flightBar.hidden=flightAircraft.hidden=false;
    flightAircraft.textContent=flight.aircraft.name.split(' · ')[0];
    document.body.classList.add('flight-ui');
    changeView();
  }
  function start(approach,restart=false,preset=restart?flight?.quickPreset:null){
    try{
      const lesson=byId('lesson').value;
      const selection=regionalContracts[lesson]?regionalContractPlan(lesson):
        parsePlan(['free','cold','taxi','benchmark'].includes(lesson));
      const weather=byId('weather').value;
      const savesMission=Boolean(regionalContracts[lesson]||lesson==='climbLesson'||lesson==='naritaCargo'||
        (lesson==='benchmark'&&['fighter','cargo'].includes(selectedAircraft().role)||lesson==='range'));
      const replacedId=restart?flight?.checkpointId:undefined;
      const wind=lesson==='crosswind'?5.144:['fog','wet','clouds'].includes(weather)?0:Number(weather);
      replay=null;replayControls.hidden=true;
      if(lesson==='tactical'){
        if(approach) throw new Error('請按「開始飛行」載入戰術任務。');
        flight=makeTacticalFlight(airports.find(a=>a.code==='RCMQ'),selectedAircraft(),tacticalSelection,wind,
          byId('tacticalGuided').value==='guided',byId('tacticalDifficulty').value==='advanced');
      }else if(lesson==='range'){
        if(approach) throw new Error('靶場訓練由臺中跑道開始。');
        const airport=airports.find(a=>a.code==='RCMQ');
        const fighter=fleet.find(a=>a.id==='sf16');
        byId('aircraft').value=fighter.id;
        flight=makeRegionalFlight(airport,airport,fighter,'runway',wind,trainingRoute(airport));
        flight.mission='fighter';
        flight.lesson='range';
        const target=airportPoint(airport,13200,0);
        flight.range={...target,y:terrainHeight(target.x,target.z)+5,rounds:8,hit:false,message:''};
        attachContract(flight,'fighter',8200);
      }else if(regionalContracts[lesson]){
        if(approach) throw new Error('請從機位開始任務。');
        flight=makeRegionalContract(lesson,wind);
        byId('aircraft').value=flight.aircraft.id;
      }else if(lesson==='airline'){
        if(approach) throw new Error('載客任務請從機位開始。');
        const profile=selectedAircraft();
        const [from,to]=airlineRoute();
        if(!compatibleAirline(profile,from,to)) throw new Error('此機型不適用所選機位或跑道。');
        flight=makePassengerFlight(from,to,profile,wind,Number(byId('airlineFuel').value),weather,byId('time').value);
        savePassenger(flight);
      }else if(lesson==='climbLesson'){
        if(approach) throw new Error('請按開始飛行，從桃園跑道開始練習。');
        const profile=fleet.find(a=>a.id==='b773');
        byId('aircraft').value=profile.id;
        flight=makeClimbLesson(airports.find(a=>a.code==='RCTP'),profile,Number(byId('cruiseWind').value));
      }else if(lesson==='cruiseTrial'){
        if(approach) throw new Error('請按開始飛行進入巡航驗證。');
        const profile=selectedAircraft();
        flight=makeCruiseTrial(airports.find(a=>a.code==='RCTP'),airports.find(a=>a.code==='RCKH'),profile,Number(byId('cruiseWind').value),byId('speedProfile').value==='fast',preset==='ias');
      }else if(lesson==='naritaCargo'){
        if(approach) byId('voyageNode').value='approach';
        const profile=fleet.find(m=>m.id==='sf748');
        byId('aircraft').value=profile.id;
        flight=makeCargoVoyage(airports.find(a=>a.code==='RCTP'),profile,byId('voyageNode').value,wind);
        flight.approach=approach;
        if(flight.node==='load'){
          flight.fuelStart=flight.fuel;
          attachContract(flight,'cargo',40000);
        }
        flight.voyageTime=byId('time').value;
        if(Number(flight.voyageTime.slice(0,2))>=6&&Number(flight.voyageTime.slice(0,2))<19) flight.voyageTime='21:00';
        byId('time').value=flight.voyageTime;
        voyageFrames=[];captureVoyage(flight,voyageFrames,true);
      }else{
        const circuit=lesson==='circuit'||lesson==='crosswind';
        if(circuit) byId('aircraft').value='a223';
        const chosen=selectedAircraft();
        const mission=lesson==='benchmark'?benchmarkMissions[chosen.role]:null;
        if(lesson==='benchmark'&&!mission) throw new Error('請在機庫選擇有基準任務的機型。');
        if(mission&&approach) throw new Error('基準任務請使用「開始飛行」從冷艙開始。');
        const departure=circuit?airports.find(a=>a.code==='RCSS'):
          mission?airports.find(a=>a.code===mission.from):lesson==='route'?airports[0]:selection.departure;
        const destination=circuit?departure:
          mission?airports.find(a=>a.code===mission.to):lesson==='route'?airports[1]:selection.destination;
        if(['passenger','cargo'].includes(chosen.role)&&!chosen.regionalGates&&[departure,destination].some(r=>r.width<55||r.length<3000)){
          throw new Error('此廣體機請選桃園、臺中或高雄的寬體起降場。');
        }
        if(departure===destination&&!mission&&!circuit&&!chosen.helicopter) throw new Error('請選不同的起降機場，或使用松山起落航線訓練。');
        const mode=circuit?'runway':mission||['cold','taxi'].includes(lesson)?'cold':byId('startType').value;
        const route=circuit?trainingRoute(departure):mission?(chosen.role==='fighter'||!byId('waypoints').value.trim()?
          benchmarkRoute(chosen.role,departure,destination):[...selection.route.slice(0,-2),...regionalRoute(departure,destination).slice(-2)]):
          lesson==='route'?regionalRoute(departure,destination):selection.route;
        flight=makeRegionalFlight(departure,destination,chosen,mode,wind,route);
        flight.approach=approach||lesson==='crosswind';flight.lesson=lesson;flight.mission=mission?chosen.role:null;
        if(['cargo','fighter'].includes(flight.mission)){
          attachContract(flight,flight.mission,flight.mission==='cargo'?9500:6500);
          if(flight.mission==='cargo') Object.assign(flight,{fuel:18000,fuelStart:18000});
        }
        if(flight.mission==='passenger'){
          const fuel=chosen.missionFuel??56000;
          Object.assign(flight,{passengers:chosen.passengers??320,fuel,fuelStart:fuel});
        }
        if(preset==='mountains'){
          const position=geoPoint(24.16,121.67),heading=275*rad,speed=160;
          const altitude=4600;
          Object.assign(flight,{...position,y:altitude,heading,speed,vx:Math.sin(heading)*speed,vz:-Math.cos(heading)*speed,
            power:.66,hold:{heading,altitude},gear:false,parkingBrake:false});
        }
        if(preset==='taipei'){
          const position=geoPoint(25.0225,121.5490),heading=55*rad,speed=99;
          Object.assign(flight,{...position,y:1050,heading,speed,vx:Math.sin(heading)*speed,vz:-Math.cos(heading)*speed,
            pitch:.08,trim:.06,power:.43,gear:false,parkingBrake:false});
        }
        if(flight.approach){
          const distance=preset==='landing'?9100:3700-destination.length/2;
          const p=airportPoint(destination,-destination.length/2-distance,0);
          const speed=flight.aircraft.approach/knotsPerMps;
          Object.assign(flight,{...p,heading:destination.heading,
            y:destination.elevation+(preset==='landing'?15+distance*Math.tan(Math.PI/60):123),
            vx:Math.sin(destination.heading)*speed,vz:-Math.cos(destination.heading)*speed,
            vy:preset==='landing'?-speed*Math.tan(Math.PI/60):-1.5,
            speed,ground:false,airborne:true,flaps:2,gear:true,power:.23,parkingBrake:false,
            battery:true,phase:'approach',waypoint:route.length-1});
          flight.engines.fill(true);
        }
      }
      if(!Number.isFinite(flight.fuel)){
        const aircraft=flight.aircraft;
        flight.fuel=aircraft.missionFuel??(aircraft.role==='fighter'?2700:aircraft.jet?18000:Math.round(aircraft.mass*.10));
        flight.fuelStart=flight.fuel;
      }
      flight.quickPreset=preset;
      flight.fastCruise=!flight.aircraft.helicopter&&byId('speedProfile').value==='fast';
      if(preset==='helipad'&&flight.aircraft.helicopter){
        const p=airportPoint(flight.departure,385,flight.departure.apron+46);
        Object.assign(flight,p,{y:flight.departure.elevation+flight.aircraft.gearHeight,parkingBrake:true});
      }
      beginFlight();
      if(savesMission){
        flight.checkpointId=crypto.randomUUID();
        saveCurrentMission(flight,replacedId);
      }
    }catch(error){byId('message').textContent=error.message;}
  }
  function menu(){
    flightAudio.stopSpeech();
    setMobilePanel('');
    setOverview(false);
    tacticalView.clear();
    touchControls.reset();
    touchControls.stopMotion();
    saveCurrentMission(flight);
    replay=null;replayControls.hidden=true;updateReplayButton();
    flight=null;pointer.active=false;keys.clear();
    byId('hud').hidden=byId('menu').hidden=true;
    flightBar.hidden=flightAircraft.hidden=true;
    document.body.classList.remove('flight-ui');
    byId('plan').hidden=byId('edition').hidden=false;
    showLog();drawPlan();changeView();
  }
  function toggleNavigation(f){
    if(f.aircraft.helicopter){toggleHelicopterHover(f);return;}
    if(f.iasTrial&&!f.ground&&!f.finished&&f.battery){
      f.hold=f.hold?null:{heading:f.heading,altitude:f.y,mach:cruiseMachTarget(f)};
      return;
    }
    if(f.hold?.nav){stopNavigation(f);return;}
    if(f.regional&&!f.ground&&f.battery&&!f.finished&&!f.tactical&&!f.climbLesson&&!f.cruiseTrial){
      f.navMessage='';
      f.hold={nav:true,altitude:f.mission==='cargo'&&f.waypoint===0?
        Math.max(f.y,f.departure.elevation+1800):f.y};
    }
  }
  function showTouchPause(isPaused){
    const button=byId('mobilePause');
    button.textContent=isPaused?'繼續':'暫停';
    button.setAttribute('aria-pressed',String(isPaused));
  }
  function action(code){
    if(code==='KeyH'&&!attitudePanel.hidden){toggleAttitude();return;}
    if(replay&&!['KeyC','KeyP','KeyN','Home'].includes(code)) return;
    if(replay&&code==='KeyP'){byId('replayToggle').click();return;}
    if(code==='KeyJ') toggleNavigation(flight);
    if(code==='KeyM'&&!paused){
      if(flight.tactical) {
        tacticalView.command('fire');
        if(typeof navigator!=='undefined'&&navigator.vibrate) navigator.vibrate([20,15,30]);
      }
      else if(flight.range) {
        rangeShot(flight);
        if(typeof navigator!=='undefined'&&navigator.vibrate) navigator.vibrate([20,15,30]);
      }
      else {
        const hud=byId('hud');
        setMobilePanel(hud.dataset.mobilePanel==='nav'?'':'nav');
      }
    }
    if(code==='KeyK'&&!paused&&flight.tactical) {
      tacticalView.command('gun');
      if(typeof navigator!=='undefined'&&navigator.vibrate) navigator.vibrate(18);
    }
    if(code==='KeyV'){flight.bankCommand=0;flight.levelWings=true;}
    if(code==='KeyN') cycleCockpitView();
    if(code==='Home'&&cockpitActive()){
      cockpitView.preset=0;
      resetLook();
      changeView();
    }
    if(code==='KeyC'){
      pointer.active=false;pointer.x=pointer.y=0;
      if(flight.cabinView) flight.cabinView=false;else cameraMode=1-cameraMode;
      changeView();
    }
    if(code==='KeyP'){
      paused=!paused;accumulator=0;last=performance.now();
      releaseFlightInputs();touchControls.reset();showTouchPause(paused);
    }
    if(code==='KeyF') {
      flight.flaps=(flight.flaps+1)%3;
      if(typeof navigator!=='undefined'&&navigator.vibrate) navigator.vibrate(25);
    }
    if(code==='KeyR'&&!flight.service) start(flight.approach,true);
    if(!flight.regional) return;
    if(code==='KeyB'&&!flight.tow) flight.parkingBrake=!flight.parkingBrake;
    if(code==='KeyI') startEngine(flight,0);
    if(code==='KeyL'&&flight.battery) flight.lights=!flight.lights;
    if(code==='KeyG'&&flight.aircraft.retract&&!flight.ground&&flight.battery) {
      flight.gear=!flight.gear;
      if(typeof navigator!=='undefined'&&navigator.vibrate) navigator.vibrate(35);
    }
  }
  function throttleKeys(){return settings.throttleKeys.split(',').map(s=>s.trim());}
  const bindingLabels={ArrowUp:'抬頭',ArrowDown:'低頭',ArrowLeft:'左坡度',ArrowRight:'右坡度',KeyQ:'左舵',KeyE:'右舵',KeyX:'抬頭配平',KeyZ:'低頭配平',Space:'煞車',KeyC:'切換視角',KeyF:'襟翼',KeyG:'起落架',KeyP:'暫停',KeyR:'重飛',KeyB:'停機煞車',KeyI:'引擎 1',KeyL:'燈光',KeyV:'回正坡度'};
  const bindings=byId('bindings');
  function drawBindings(){
    bindings.replaceChildren();
    for(const [code,label] of Object.entries(bindingLabels)){
      const b=document.createElement('button');
      b.textContent=label+' · '+(settings.bindings?.[code]||code);
      let binding=false;
      b.onclick=()=>{
        b.focus();
        binding=true;
        b.textContent=label+' · 按下新按鍵';
      };
      b.onblur=()=>{binding=false;b.textContent=label+' · '+(settings.bindings?.[code]||code);};
      b.onkeydown=event=>{
        if(!binding||event.code==='Tab') return;
        event.preventDefault();
        if(event.code==='Escape'){b.blur();return;}
        const assigned=settings.bindings||{};
        const clash=Object.keys(bindingLabels).some(other=>other!==code&&(assigned[other]||other)===event.code)||throttleKeys().includes(event.code);
        if(clash){b.textContent=label+' · 按鍵已使用';return;}
        settings.bindings={...assigned,[code]:event.code};
        keys.clear();
        persistControls();
        drawBindings();
      };
      bindings.append(b);
    }
  }
  function boundCode(physical){
    return Object.keys(bindingLabels).find(code=>(settings.bindings?.[code]||code)===physical)||
      (Object.hasOwn(bindingLabels,physical)?null:physical);
  }
  drawBindings();
  addEventListener('keydown',event=>{
    if(event.code==='Escape'&&byId('hud').dataset.mobilePanel){
      event.preventDefault();setMobilePanel('');mapButton.focus();return;
    }
    if(event.target.closest('input,select,textarea,#quickControls[open]')) return;
    if(/^Digit[0-9]$/.test(event.code)&&flight&&!paused&&!flight.tow){
      event.preventDefault();
      const num=parseInt(event.code.slice(5),10);
      flight.power=num/10;
      if(flight.power>0&&flight.battery) flight.engines.fill(true);
      if(typeof navigator!=='undefined'&&navigator.vibrate) navigator.vibrate(20);
      return;
    }
    const code=boundCode(event.code);
    if(!flight||(!controls.has(code)&&!throttleKeys().includes(event.code))) return;
    if(event.target instanceof HTMLButtonElement&&code==='Space') return;
    event.preventDefault();if(code) keys.add(code);if(throttleKeys().includes(event.code)) keys.add(event.code);
    if(!event.repeat) action(code);
  });
  addEventListener('keyup',event=>{keys.delete(event.code);keys.delete(boundCode(event.code));});
  function releaseFlightInputs(){
    keys.clear();pointer.active=false;cockpitView.drag=null;
    if(flight) flight.bankCommand=0;
  }
  addEventListener('blur',releaseFlightInputs);
  document.addEventListener('visibilitychange',()=>{
    releaseFlightInputs();
    accumulator=0;
    last=performance.now();
  });
  touchControls.mode.addEventListener('change',releaseFlightInputs);
  const overControls=target=>target.closest('button,details,input,select,textarea,a,.systems,.right,header,#touchFlight,#mobileExtras,#tacticalGuide,#tacticalReport');
  addEventListener('contextmenu',event=>{
    if(cockpitActive()&&!overControls(event.target)) event.preventDefault();
  });
  addEventListener('wheel',event=>{
    if(!cockpitActive()||overControls(event.target)) return;
    event.preventDefault();
    cockpitView.zoom=clamp(cockpitView.zoom+Math.sign(event.deltaY)*4,-14,22);
  },{passive:false});
  addEventListener('pointerdown',event=>{
    if(!flight||overControls(event.target)) return;
    if(event.button===1&&settings.mouse){
      event.preventDefault();
      pointer.x=pointer.y=0;
      pointer.left=event.clientX;pointer.top=event.clientY;
      return;
    }
    if(event.button===2&&cockpitActive()){
      event.preventDefault();
      pointer.active=false;
      cockpitView.drag={id:event.pointerId,x:event.clientX,y:event.clientY};
      return;
    }
    if(event.button!==0||event.pointerType==='touch'||!settings.mouse||cockpitView.drag) return;
    pointer.active=true;pointer.id=event.pointerId;pointer.x=0;pointer.y=0;
    pointer.left=event.clientX;pointer.top=event.clientY;
  });
  addEventListener('pointermove',event=>{
    const drag=cockpitView.drag;
    if(drag?.id===event.pointerId){
      cockpitView.yaw=clamp(cockpitView.yaw-(event.clientX-drag.x)*.004,-100*rad,100*rad);
      cockpitView.pitch=clamp(cockpitView.pitch-(event.clientY-drag.y)*.004,-58*rad,48*rad);
      drag.x=event.clientX;
      drag.y=event.clientY;
      return;
    }
    if(!pointer.active||pointer.id!==event.pointerId) return;
    pointer.x=clamp((event.clientX-pointer.left)/130,-1,1);
    pointer.y=clamp((pointer.top-event.clientY)/130,-1,1);
  });
  addEventListener('pointercancel',event=>{
    if(event.pointerId===pointer.id) pointer.active=false;
    if(event.pointerId===cockpitView.drag?.id) cockpitView.drag=null;
  });
  addEventListener('pointerup',event=>{
    if(event.pointerId===cockpitView.drag?.id&&event.button===2) cockpitView.drag=null;
    if(event.button===0&&event.pointerId===pointer.id) pointer.active=false;
    if(event.target instanceof HTMLInputElement&&event.target.type==='range'&&event.target.closest('#quickControls')) event.target.blur();
  });
  const hangarAircraft=byId('hangarAircraft'),hangarView=byId('hangarView'),hangarFilter=byId('hangarFilter');
  const hangarControls=byId('hangarControls'),hangarOptions=byId('hangarOptions');
  const hangarPointers=new Map();
  let hangarYaw=null,hangarElevation=.59,hangarZoom=1;
  const displayedAircraft=()=>fleet.find(a=>a.id===hangarAircraft.value);
  function populateHangar(selected){
    const matching=fleet.filter(plane=>hangarFilter.value==='all'||(plane.helicopter?'helicopter':plane.role)===hangarFilter.value);
    hangarAircraft.replaceChildren(...matching.map(plane=>new Option(plane.name,plane.id)));
    if(matching.some(plane=>plane.id===selected)) hangarAircraft.value=selected;
    updateHangarInfo();
  }
  function updateHangarInfo(){
    const plane=displayedAircraft();
    byId('hangarInfo').textContent=plane.type+' · 機長 '+(plane.geometry[0]*2).toFixed(1)+
      ' m · 翼展 '+(plane.geometry[2]*2).toFixed(1)+' m';
    for(const option of hangarView.options){
      option.disabled=(option.value==='cabin'&&plane.role==='fighter')||
        (option.value==='cargoDoor'&&plane.role!=='cargo');
    }
    if(hangarView.selectedOptions[0]?.disabled) hangarView.value='orbit';
  }
  hangarAircraft.onchange=updateHangarInfo;
  hangarFilter.onchange=()=>populateHangar(hangarAircraft.value);
  hangarView.onchange=()=>{hangarZoom=1;hangarYaw=null;hangarElevation=.59;};
  byId('hangarControlsToggle').onclick=()=>{
    hangarOptions.hidden=!hangarOptions.hidden;
    byId('hangarControlsToggle').textContent=hangarOptions.hidden?'展開選單':'收合選單';
    byId('hangarControlsToggle').setAttribute('aria-expanded',String(!hangarOptions.hidden));
  };
  const pointerDistance=()=>{
    const [a,b]=hangarPointers.values();
    return Math.hypot(a.x-b.x,a.y-b.y);
  };
  addEventListener('pointerdown',event=>{
    if(!hangarMode||event.button!==0||overControls(event.target)||hangarControls.contains(event.target)) return;
    if(hangarPointers.size<2) hangarPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  });
  addEventListener('pointermove',event=>{
    const previous=hangarPointers.get(event.pointerId);
    if(!hangarMode||!previous) return;
    const distance=hangarPointers.size===2?pointerDistance():0;
    hangarPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(distance>0){
      hangarZoom=clamp(hangarZoom*pointerDistance()/distance,.65,1.8);
    }else{
      if(hangarView.value!=='orbit') hangarView.value='orbit';
      hangarYaw=(hangarYaw??performance.now()*.00038)-(event.clientX-previous.x)*.009;
      hangarElevation=clamp(hangarElevation+(event.clientY-previous.y)*.01,.14,1.85);
    }
  });
  for(const type of ['pointerup','pointercancel']) addEventListener(type,event=>hangarPointers.delete(event.pointerId));
  addEventListener('blur',()=>hangarPointers.clear());
  addEventListener('wheel',event=>{
    if(!hangarMode||hangarControls.contains(event.target)||overControls(event.target)) return;
    event.preventDefault();
    hangarZoom=clamp(hangarZoom*Math.exp(-event.deltaY*.0015),.65,1.8);
  },{passive:false});
  function openInspection(inHangar,view='orbit'){
    if(inHangar){
      if(!hangarStage){hangarStage=createHangar(box,material);scene.add(hangarStage);}
      hangarView.value=view;
      hangarView.onchange();
      hangarFilter.value='all';
      populateHangar(byId('aircraft').value);
      if(hangarOptions.hidden!==(touchControls.mode.value==='mobile')) byId('hangarControlsToggle').click();
    }
    inspectionMode=true;hangarMode=inHangar;
    document.body.classList.toggle('hangar-active',inHangar);
    byId('plan').hidden=true;byId('exitInspection').hidden=false;
    byId('exitInspection').textContent=inHangar?'返回飛行計畫':'結束巡覽';
    byId('hangarControls').hidden=!inHangar;
    if(inHangar) resize();
  }
  function closeInspection(){
    const wasHangar=hangarMode;
    inspectionMode=hangarMode=false;
    hangarPointers.clear();
    document.body.classList.remove('hangar-active');
    byId('plan').hidden=false;byId('exitInspection').hidden=byId('hangarControls').hidden=true;
    if(wasHangar) resize();
  }
  byId('openHangar').onclick=()=>openInspection(true);
  byId('viewScene').onclick=()=>{
    if(byId('inspect').value==='tour-landside')planPreviewAirport=airports.find(a=>a.code==='RCSS');
    openInspection(false);
  };
  byId('exitInspection').onclick=closeInspection;
  byId('hangarFly').onclick=()=>{
    byId('aircraft').value=hangarAircraft.value;
    byId('lesson').value='free';
    closeInspection();drawPlan();byId('fly').focus();
  };
  byId('view').onclick=()=>{if(flight) action('KeyC');};
  byId('cockpitPreset').onclick=cycleCockpitView;
  byId('resetLook').onclick=()=>action('Home');
  byId('fly').onclick=()=>{byId('fly').blur();start(false);};
  byId('quickMountains').onclick=()=>{
    byId('lesson').value='free';
    byId('aircraft').value='fck1';
    byId('departure').value='RCSS';
    byId('destination').value='RCYU';
    byId('startType').value='air';
    byId('weather').value='0';
    byId('time').value='14:00';
    byId('waypoints').value='';
    drawPlan();
    start(false,false,'mountains');
  };
  byId('quickTaipei').onclick=()=>{
    byId('lesson').value='free';
    byId('aircraft').value='a223';
    byId('departure').value='RCSS';
    byId('destination').value='RCYU';
    byId('startType').value='air';
    byId('weather').value='0';
    byId('time').value='13:00';
    byId('waypoints').value='';
    drawPlan();
    start(false,false,'taipei');
  };
  byId('quickHelicopter').onclick=()=>{
    byId('lesson').value='free';byId('aircraft').value='sh6';
    byId('departure').value=byId('destination').value='RCSS';
    byId('startType').value='runway';drawPlan();start(false,false,'helipad');
  };
  for(const button of document.querySelectorAll('[data-island-departure]')){
    button.onclick=()=>{
      const island=button.dataset.islandDeparture;
      byId('lesson').value='free';
      byId('aircraft').value='c172s';
      byId('departure').value=island;
      byId('destination').value=island==='RCGI'?'RCLY':'RCGI';
      byId('startType').value='runway';
      byId('waypoints').value='';
      drawPlan();
      start(false);
    };
  }
  byId('quickFlights').onclick=event=>{
    const button=event.target.closest('[data-quick]');
    if(!button) return;
    const preset=button.dataset.quick;
    byId('lesson').value=preset==='duel'?'tactical':preset==='sunset'?'circuit':'free';
    if(preset!=='duel'||selectedAircraft().role!=='fighter') byId('aircraft').value=preset==='duel'?'f16v':preset==='mirage'?'m2000':'a223';
    byId('departure').value=preset==='mirage'?'RCTP':'RCSS';
    byId('destination').value=preset==='mirage'?'RCKH':'RCTP';
    byId('startType').value='runway';
    if(preset==='mirage') byId('speedProfile').value='fast';
    byId('time').value=preset==='sunset'?'17:45':'12:00';
    byId('weather').value='0';
    byId('waypoints').value='';
    if(preset==='duel'){
      tacticalSelection='duel';
      byId('tacticalGuided').value='guided';
      byId('tacticalDifficulty').value='normal';
      for(const card of byId('tacticalCards').children) card.setAttribute('aria-pressed',String(card.dataset.scenario==='duel'));
    }
    drawPlan();
    start(preset==='landing',false,preset);
    button.blur();
  };
  function quickCruise(preset){
    byId('lesson').value='cruiseTrial';
    byId('speedProfile').value='fast';
    byId('cruiseWind').value='0';
    drawPlan();
    start(false,false,preset);
  }
  byId('quickFastCruise').onclick=()=>quickCruise('ias');
  byId('quickHighCruise').onclick=()=>quickCruise('high');
  byId('approach').onclick=()=>{byId('approach').blur();start(true);};
  byId('menu').onclick=menu;
  const mobilePanels=Array.from(document.querySelectorAll('#flightBar [data-panel],#mobileExtras [data-panel]'));
  function setMobilePanel(name){
    // The overview hides cockpit panels. Leave it before opening any menu.
    if(name&&overviewActive)setOverview(false);
    if(name){releaseFlightInputs();touchControls.reset();}
    byId('hud').dataset.mobilePanel=name;
    document.body.classList.toggle('flight-panel-open',Boolean(name));
    byId('tacticalPanel').open=name==='nav'&&Boolean(flight?.tactical);
    for(const button of mobilePanels){
      button.setAttribute('aria-expanded',String(button.dataset.panel===name));
    }
    byId('quickControls').open=false;
  }
  // A consistent exit remains reachable even on short phone screens.
  for(const id of ['flightNavigation','systems','mobileExtras','quickControls']){
    const close=document.createElement('button');close.type='button';
    close.className='flight-panel-close';close.textContent='關閉 ×';
    close.setAttribute('aria-label','關閉選單');
    close.onclick=()=>{setMobilePanel('');mapButton.focus();};
    const panel=byId(id);
    if(id==='quickControls')panel.querySelector('summary').after(close);
    else panel.prepend(close);
  }
  byId('quickControls').addEventListener('toggle',()=>{
    if(!byId('quickControls').open&&byId('hud').dataset.mobilePanel==='settings')setMobilePanel('');
  });
  byId('tacticalPanel').addEventListener('toggle',()=>{
    if(!byId('tacticalPanel').open&&flight?.tactical&&byId('hud').dataset.mobilePanel==='nav')setMobilePanel('');
  });
  for(const button of mobilePanels){
    button.onclick=()=>{
      if(overviewActive&&button===mapButton){setOverview(false);setMobilePanel('');return;}
      setMobilePanel(byId('hud').dataset.mobilePanel===button.dataset.panel?'':button.dataset.panel);
    };
  }
  byId('touchSettings').onclick=()=>{
    setMobilePanel('settings');
    byId('quickControls').open=true;
  };
  byId('mobilePause').onclick=()=>{if(flight) action('KeyP');};
  byId('helpRetry').onclick=()=>{if(flight) action('KeyR');};
  byId('helpCenter').onclick=()=>{
    if(!flight) return;
    touchControls.reset();
    action('KeyV');
    setMobilePanel('');
  };
  touchControls.mode.addEventListener('change',()=>{
    setMobilePanel('');
    changeView();
    if(!flight) drawPlan();
  });
  touchControls.panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');
    if(flight&&button) action(button.dataset.action);
  });
  const qualitySelect=byId('quality');
  const defaultQuality=touchControls.mode.value==='mobile'?'low':'balanced';
  let savedQuality;
  try{savedQuality=localStorage.getItem('skybound-quality');}catch{}
  qualitySelect.value=savedQuality||defaultQuality;
  if(!qualitySelect.value)qualitySelect.value=defaultQuality;
  const flightQuality=byId('flightQuality');
  flightQuality.replaceChildren(...Array.from(qualitySelect.options,option=>option.cloneNode(true)));
  flightQuality.value=qualitySelect.value;
  qualitySelect.onchange=()=>{
    flightQuality.value=qualitySelect.value;
    try{localStorage.setItem('skybound-quality',qualitySelect.value);}catch{}
    resize();
    syncSceneryMode();
  };
  flightQuality.onchange=()=>{
    qualitySelect.value=flightQuality.value;
    qualitySelect.onchange();
  };
  let resolutionScale=1,basePixelRatio=1,nextResolutionReview=0;
  let measuredFrameTime=0,measuredFrames=0;
  function resize(){
    const ultra=qualitySelect.value==='ultra';
    const scale={low:.6,balanced:1,high:1.75}[renderingQuality()]||1;
    const mobile=touchControls.mode.value==='mobile';
    basePixelRatio=ultra?Math.min(Math.max(1.5,devicePixelRatio),mobile?1.85:2.5,Math.sqrt(6500000/(innerWidth*innerHeight))):
      Math.min(devicePixelRatio,scale,mobile?1:Infinity);
    if(hangarMode) basePixelRatio=Math.max(basePixelRatio,Math.min(devicePixelRatio,1));
    resolutionScale=1;
    measuredFrameTime=measuredFrames=0;
    nextResolutionReview=performance.now()+2200;
    renderer.setPixelRatio(basePixelRatio);
    const isHigh=qualitySelect.value==='high';
    renderer.shadowMap.enabled=ultra||isHigh;
    if(ultra){
      if(sunlight.shadow.mapSize.x!==4096){
        sunlight.shadow.mapSize.set(4096,4096);
        if(sunlight.shadow.map){sunlight.shadow.map.dispose();sunlight.shadow.map=null;}
      }
    }else if(isHigh){
      if(sunlight.shadow.mapSize.x!==2048){
        sunlight.shadow.mapSize.set(2048,2048);
        if(sunlight.shadow.map){sunlight.shadow.map.dispose();sunlight.shadow.map=null;}
      }
    }
    renderer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
    resizeOverview();
  }
  function adjustResolution(now,seconds){
    if(qualitySelect.value!=='balanced'&&qualitySelect.value!=='high') return;
    measuredFrameTime+=seconds;
    measuredFrames++;
    if(now<nextResolutionReview) return;
    const average=measuredFrameTime/measuredFrames;
    const target=average>.035?Math.max(.72,resolutionScale-.14):
      average<.023?Math.min(1,resolutionScale+.07):resolutionScale;
    if(target!==resolutionScale){
      resolutionScale=target;
      renderer.setPixelRatio(basePixelRatio*target);
    }
    measuredFrameTime=measuredFrames=0;
    nextResolutionReview=now+2200;
  }
  addEventListener('resize',resize);resize();
  touchControls.mode.addEventListener('change',resize);

  function setupMultiplayerUI(){
    const joinBtn=byId('mpJoinBtn'), randomBtn=byId('mpRandomBtn'), leaveBtn=byId('mpLeaveBtn');
    const roomInput=byId('mpRoomInput'), callsignInput=byId('mpCallsignInput');
    const badge=byId('mpStatusBadge'), statusText=byId('mpStatusText');
    const peerBox=byId('mpPeerBox'), peerList=byId('mpPeerList'), peerCount=byId('mpPeerCount');
    const radioPill=byId('mpRadioPill'), radioPillText=byId('mpRadioPillText');
    let pillTimer=null;

    function showPill(text){
      if(!radioPill||!radioPillText) return;
      radioPillText.textContent=text;
      radioPill.hidden=false;
      clearTimeout(pillTimer);
      pillTimer=setTimeout(()=>{radioPill.hidden=true;},5000);
    }

    if(callsignInput&&!callsignInput.value){
      callsignInput.value='SKY-'+Math.floor(100+Math.random()*900);
    }

    if(randomBtn){
      randomBtn.onclick=()=>{
        const prefixes=['AIR','SKY','TW','FLY','WING','ACE'];
        roomInput.value=prefixes[Math.floor(Math.random()*prefixes.length)]+Math.floor(10+Math.random()*90);
      };
    }

    if(joinBtn){
      joinBtn.onclick=()=>{
        const r=roomInput.value||'8888';
        const c=callsignInput.value||('SKY-'+Math.floor(100+Math.random()*900));
        multiplayer.joinRoom(r,c);
      };
    }

    if(leaveBtn){
      leaveBtn.onclick=()=>multiplayer.leaveRoom();
    }

    document.querySelectorAll('.mp-radio-btn').forEach(btn=>{
      btn.onclick=()=>multiplayer.sendRadio(btn.dataset.radio);
    });

    const touchRadio=byId('touchRadio');
    const quickCalls=['🛫 已進入跑道起飛','🛬 五邊進場，準備降落','✈ 編隊飛行跟隨中','👋 向你致敬 (Wing Wave)'];
    let quickCallIdx=0;
    if(touchRadio){
      touchRadio.onclick=()=>{
        if(typeof multiplayer!=='undefined'){
          if(!multiplayer.isConnected()) multiplayer.joinRoom('8888',callsignInput?.value);
          const msg=quickCalls[quickCallIdx%quickCalls.length];
          quickCallIdx++;
          multiplayer.sendRadio(msg);
        }
      };
    }

    const mobileMpBtn=byId('mobileMultiplayer');
    if(mobileMpBtn){
      mobileMpBtn.onclick=()=>{
        const mpSection=byId('multiplayerSection');
        if(mpSection){
          mpSection.open=true;
          mpSection.scrollIntoView({behavior:'smooth'});
        }
      };
    }

    const sendCustomBtn=byId('mpSendCustomBtn'), customInput=byId('mpCustomMsg');
    if(sendCustomBtn&&customInput){
      sendCustomBtn.onclick=()=>{
        if(customInput.value.trim()){
          multiplayer.sendRadio(customInput.value.trim());
          customInput.value='';
        }
      };
      customInput.onkeydown=e=>{
        if(e.key==='Enter'&&customInput.value.trim()){
          multiplayer.sendRadio(customInput.value.trim());
          customInput.value='';
        }
      };
    }

    function renderPeerList(){
      if(!peerList||!peerCount||typeof multiplayer==='undefined') return;
      const peers=multiplayer.getPeers();
      peerCount.textContent=peers.length;
      peerList.replaceChildren();
      if(peers.length===0){
        const empty=document.createElement('div');
        empty.style.color='#97aeb2';
        empty.style.fontSize='12px';
        empty.textContent='房間內暫無其他連線機長（等待其他玩家加入中…）';
        peerList.appendChild(empty);
        return;
      }
      peers.forEach(p=>{
        const item=document.createElement('div');
        item.className='mp-peer-item';
        const dist=flight?Math.hypot(p.state.x-flight.x,p.state.z-flight.z)/1000:0;
        item.innerHTML=`<span class="callsign">✈ ${p.callsign}</span><span class="details">${(p.aircraftId||'').toUpperCase()} · ${Math.round(p.state.y||0)}m · ${dist>0?dist.toFixed(1)+'km':'--'}</span>`;
        peerList.appendChild(item);
      });
    }

    if(typeof multiplayer!=='undefined'){
      multiplayer.addListener((event,data)=>{
        if(event==='connect'){
          if(badge){badge.classList.remove('offline');statusText.textContent=`已連線 (${data.roomId})`;}
          if(joinBtn) joinBtn.hidden=true;
          if(leaveBtn) leaveBtn.hidden=false;
          if(peerBox) peerBox.hidden=false;
          showPill(`🟢 已進入房間 [${data.roomId}] 呼號 ${data.callsign}`);
        }else if(event==='disconnect'){
          if(badge){badge.classList.add('offline');statusText.textContent='未連線';}
          if(joinBtn) joinBtn.hidden=false;
          if(leaveBtn) leaveBtn.hidden=true;
          if(peerBox) peerBox.hidden=true;
          showPill('⚪ 已退出連線房間');
        }else if(event==='peer_joined'){
          showPill(`✈ 機長 [${data.callsign}] 加入了房間！`);
          renderPeerList();
        }else if(event==='peer_left'){
          showPill(`✈ 機長 [${data.callsign}] 離開了房間。`);
          renderPeerList();
        }else if(event==='radio'){
          showPill(`📻 [${data.sender}]: ${data.text}`);
        }
      });
    }

    setInterval(renderPeerList,2500);
  }
  setupMultiplayerUI();
  const forward=heading=>new THREE.Vector3(Math.sin(heading),0,-Math.cos(heading));
  const axis=(positive,negative)=>Number(keys.has(positive))-Number(keys.has(negative));
  const padAxis=value=>gamepadAxis(value,settings.deadzone);
  let previousButtons=[];
  function inputs(f){
    let pad;
    try{pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);}catch{}
    const buttons=pad?.buttons||[];
    for(const [i,code] of [[2,'KeyF'],[3,'KeyC'],[8,'KeyB'],[9,'KeyP']]){
      if(buttons[i]?.pressed&&!previousButtons[i]) action(code);
    }
    previousButtons=Array.from(buttons,button=>button.pressed);
    const [up,down]=throttleKeys();
    const touch=touchControls.input,touchAxes=touchControls.axes();
    const controlAxes=touchAxes!==touch&&byId('hud').dataset.mobilePanel?touch:touchAxes;
    const touchGain=Math.min(1.25,.80+settings.sensitivity*.45);
    const rawRoll=axis('ArrowRight','ArrowLeft')+axis('Numpad6','Numpad4')+(throttleKeys().includes('KeyA')?0:axis('KeyD','KeyA'))+padAxis(pad?.axes[0])+(pointer.active?padAxis(pointer.x):0)+gamepadAxis(controlAxes.roll,.06)*touchGain;
    const rawPitch=axis('ArrowUp','ArrowDown')+axis('Numpad8','Numpad2')-padAxis(pad?.axes[1])+(pointer.active?padAxis(pointer.y):0)+gamepadAxis(controlAxes.pitch,.06)*touchGain;
    const manual=manualAxes({pitch:rawPitch,roll:rawRoll,
      rudder:axis('KeyE','KeyQ')+axis('NumpadEnter','Numpad0')+padAxis(pad?.axes[2])+gamepadAxis(touch.rudder,.06)*touchGain},settings);
    let {roll,pitch}=manual;
    let assistedRudder;
    const auxThrottleUp=keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('PageUp')||keys.has('NumpadAdd');
    const auxThrottleDown=keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('PageDown')||keys.has('NumpadSubtract');
    let throttle=clamp((axis(up,down)+Number(auxThrottleUp)-Number(auxThrottleDown)+Number(Boolean(buttons[5]?.pressed))-Number(Boolean(buttons[4]?.pressed)))*.52,-.52,.52);
    if(f.hold&&(!f.battery||f.ended||(f.ground&&!(f.hold.nav&&f.landed)))) stopNavigation(f);
    if(f.hold?.climb&&(f.ground||!f.battery||f.flaps||f.gear||f.spoilers||!f.engines.every(Boolean)||f.fuel===0)){
      f.hold=null;
    }
    // Holding bank must not latch the last aileron input into an endless roll.
    f.bankCommand=0;
    if(Math.abs(roll)>.04)f.levelWings=false;
    if(f.hold){
      const manualThrottle=throttle;
      if(Math.abs(roll)+Math.abs(pitch)+Math.abs(manual.rudder)+(!f.hold.climb?Math.abs(throttle):0)>.15) stopNavigation(f);
      else {
        if(!f.hold.nav){
          roll=clamp(wrapAngle(f.hold.heading-f.heading)*2,-.45,.45);
          const desiredVS=clamp((f.hold.altitude-f.y)*.14,-5,5);
          pitch=clamp(.36+(desiredVS-f.vy)*.11,-.7,.85);
          throttle=1;
          if(f.hold.mach||f.fastCruise) ({pitch,throttle}=f.hold.climb?climbCruiseControls(f):cruiseControls(f));
          if(f.hold.climb&&manualThrottle) throttle=manualThrottle;
        }
      }
    }
    if(f.tactical?.aimAssist){
      const assist=tacticalAssistControls(f);
      if(!assist||Math.abs(manual.pitch)+Math.abs(manual.roll)+Math.abs(manual.rudder)>.15){
        f.tactical.aimAssist=false;
        f.tactical.notice='手動接管';
      }else ({roll,pitch,rudder:assistedRudder}=assist);
    }
    return {autoLevel:!settings.keepBank||Boolean(f.levelWings),response:settings.sensitivity,yokeDamping:settings.mouse&&!f.hold&&!f.tactical?.aimAssist&&Math.abs(manual.pitch)<.07,maneuver:f.hold?1:(f.ground?1:1.20-.38*clamp((f.speed-100)/200,0,1)),pitch:clamp(pitch,-1,1),roll:clamp(roll,-1,1),
      rudder:assistedRudder??clamp(manual.rudder+(f.ground?roll:0),-1,1),
      throttle,
      trim:axis('KeyX','KeyZ')*.22,brake:touch.brake||keys.has('Space')||keys.has('NumpadDecimal')||Boolean(buttons[0]?.pressed)};
  }
  const trail=[];
  let trailFrame=0;
  function drawNav(f,target){
    if(byId('hud').dataset.mobilePanel!=='nav') return;
    const canvas=radar.canvas;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const displayW=canvas.clientWidth||326;
    const displayH=canvas.clientHeight||201;
    if(canvas.width!==Math.round(displayW*dpr)||canvas.height!==Math.round(displayH*dpr)){
      canvas.width=Math.round(displayW*dpr);
      canvas.height=Math.round(displayH*dpr);
    }
    radar.save();
    radar.scale(dpr,dpr);
    const width=displayW,height=displayH;
    radar.fillStyle='#12364d';radar.fillRect(0,0,width,height);
    if(f.regional&&!f.battery){
      byId('speedDetails').textContent='';byId('nav').textContent='航電未供電';byId('coords').textContent='';
      radar.restore();
      return;
    }
    const destination=f.destination;
    const destinationDistance=destination?Math.hypot(destination.x-f.x,destination.z-f.z):Infinity;
    const visiblePoints=!f.ground&&destinationDistance<120000?[f,target,destination]:[f,target];
    const distance=Math.hypot(target.x-f.x,target.z-f.z);
    const speeds=flightSpeeds(f);
    const closing=distance>0?((target.x-f.x)*f.vx+(target.z-f.z)*f.vz)/distance:0;
    byId('speedDetails').textContent='TAS '+displayKmh(speeds.tas)+' km/h · GS '+displayKmh(speeds.gs)+
      ' km/h · Mach '+speeds.mach.toFixed(2)+(closing>5&&!f.ground?' · 航點 ETA '+(distance/closing/60).toFixed(1)+' 分':'');
    const xs=visiblePoints.map(p=>p.x),zs=visiblePoints.map(p=>p.z);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
    const scale=Math.min(f.ground?.11:.018,width*.72/Math.max(1,maxX-minX),height*.64/Math.max(1,maxZ-minZ));
    const project=p=>[width/2+(p.x-centerX)*scale,height/2+(p.z-centerZ)*scale];
    if(f.ground) {
      radar.fillStyle='#2c443b';
      radar.fillRect(0,0,width,height);
      // Airport Surface Map elements
      for(const ap of airports){
        if(Math.hypot(ap.x-f.x,ap.z-f.z)<8000){
          const t1=airportPoint(ap,-ap.length/2,ap.apron||65);
          const t2=airportPoint(ap,ap.length/2,ap.apron||65);
          mapPath(radar,[t1,t2],project,'#38564a',8);
          mapPath(radar,[airportPoint(ap,-ap.length/2,0),airportPoint(ap,ap.length/2,0)],project,'#d9e2e5',5);
        }
      }
    }else drawTaiwanMap(radar,project);
    const nextLegs=f.ground?[]:f.route?.slice((f.waypoint??0)+1)||[];
    radar.lineWidth=2;
    if(trail.length>1) mapPath(radar,trail,project,'#dcb771');
    radar.setLineDash([5,4]);
    mapPath(radar,[target,...nextLegs],project,'#9ae6fc');
    radar.setLineDash([]);
    mapPath(radar,[f,target],project,'#80dcff');
    const [ownX,ownY]=project(f);
    // Extended Runway Centerline / Localizer Guidance
    if(destination&&!f.ground){
      const extLen=15000;
      const p1=airportPoint(destination,-destination.length/2-extLen,0);
      const p2=airportPoint(destination,destination.length/2+extLen,0);
      const [x1,y1]=project(p1);
      const [x2,y2]=project(p2);
      radar.save();
      radar.strokeStyle='rgba(255, 207, 94, 0.4)';
      radar.lineWidth=1.5;
      radar.setLineDash([4,4]);
      radar.beginPath();radar.moveTo(x1,y1);radar.lineTo(x2,y2);radar.stroke();
      const r1=airportPoint(destination,-destination.length/2,0);
      const r2=airportPoint(destination,destination.length/2,0);
      const [rx1,ry1]=project(r1);
      const [rx2,ry2]=project(r2);
      radar.strokeStyle='#ffd700';radar.lineWidth=3.5;radar.setLineDash([]);
      radar.beginPath();radar.moveTo(rx1,ry1);radar.lineTo(rx2,ry2);radar.stroke();
      radar.restore();
    }
    // Concentric Range Rings (5km, 15km, 30km)
    if(!f.ground){
      radar.save();
      radar.strokeStyle='rgba(120, 205, 255, 0.22)';
      radar.lineWidth=1;
      radar.setLineDash([3,4]);
      radar.font='bold 9px system-ui';
      radar.fillStyle='rgba(120, 205, 255, 0.65)';
      radar.textBaseline='bottom';
      for(const r of [5000, 15000, 30000]){
        const rPx=r*scale;
        if(rPx>16&&rPx<Math.max(width,height)*0.95){
          radar.beginPath();radar.arc(ownX,ownY,rPx,0,Math.PI*2);radar.stroke();
          radar.fillText((r/1000)+' km',ownX+rPx+2,ownY);
        }
      }
      radar.restore();
    }
    const labeled=[[ownX,ownY]];
    const mapAirports=[...new Set([destination,f.departure,...airports].filter(Boolean))];
    radar.font='bold 13px system-ui';
    for(const airport of mapAirports){
      const [x,y]=project(airport);
      if(x<11||x>width-11||y<14||y>height-18) continue;
      const active=airport===destination&&!f.ground;
      radar.fillStyle=active?'#78effe':'#e6f4f9';
      if(f.ground){
        mapPath(radar,[airportPoint(airport,-airport.length/2,0),airportPoint(airport,airport.length/2,0)],project,'#d9e2e5',4);
      }else{
        radar.fillRect(x-3,y-3,6,6);
      }
      if(!active&&labeled.some(([px,py])=>Math.abs(px-x)<63&&Math.abs(py-y)<20)) continue;
      radar.textBaseline='middle';
      const name=active?'目的地 '+airport.name:airport.name;
      const labelWidth=radar.measureText(name).width;
      const labelX=clamp(x+9,4,width-labelWidth-5);
      radar.strokeStyle='#122b31';radar.lineWidth=3;
      radar.strokeText(name,labelX,y);
      radar.fillText(name,labelX,y);
      labeled.push([x,y]);
    }
    radar.save();radar.translate(ownX,ownY);radar.rotate(f.heading);
    radar.beginPath();radar.moveTo(0,-9);radar.lineTo(6,7);radar.lineTo(0,4);radar.lineTo(-6,7);radar.closePath();
    radar.fillStyle='#ffcf5e';radar.fill();radar.strokeStyle='#122b31';radar.lineWidth=1.5;radar.stroke();radar.restore();
    if(typeof multiplayer!=='undefined'&&multiplayer.isConnected()){
      for(const peer of multiplayer.getPeers()){
        if(!peer.state) continue;
        const [px,py]=project(peer.state);
        if(px<-15||px>width+15||py<-15||py>height+15) continue;
        radar.save();radar.translate(px,py);radar.rotate(peer.state.heading||0);
        radar.beginPath();radar.moveTo(0,-7);radar.lineTo(5,5);radar.lineTo(0,3);radar.lineTo(-5,5);radar.closePath();
        radar.fillStyle='#00e5ff';radar.fill();radar.strokeStyle='#0b1a24';radar.lineWidth=1.2;radar.stroke();radar.restore();
        radar.font='bold 10px system-ui';radar.fillStyle='#7affbe';
        radar.fillText(peer.callsign,px+7,py-3);
      }
    }
    radar.font='bold 12px system-ui';radar.textBaseline='middle';
    radar.fillStyle='#102638';radar.fillRect(width-32,5,26,21);
    radar.fillStyle='#eef9ff';radar.fillText('北 ↑',width-31,16);
    const scaleDistance=([100,250,500,1000,2000,5000,10000,25000,50000,100000,250000,500000].find(n=>n*scale>=32)||1000000);
    radar.fillStyle='#102638';radar.fillRect(5,height-26,Math.max(53,scaleDistance*scale+12),20);
    radar.fillStyle='#eef9ff';
    radar.fillRect(10,height-12,scaleDistance*scale,2);
    radar.fillText(scaleDistance>=1000?(scaleDistance/1000)+' km':scaleDistance+' m',10,height-19);
    const bearing=(Math.atan2(target.x-f.x,f.z-target.z)/rad+360)%360;
    const direction=['北','東北','東','東南','南','西南','西','西北'][Math.round(bearing/45)%8];
    byId('nav').textContent='下一站 '+(target.name||'松山跑道')+'\n往'+direction+' '+Math.round(bearing)+'° · '+(f.ground?Math.round(distance)+' m':(distance/1000).toFixed(1)+' km');
    const geo=latLon(f.x,f.z);
    byId('coords').textContent=geo.lat.toFixed(4)+'°N · '+geo.lon.toFixed(4)+'°E';
    radar.restore();
  }
  function drawWaypointChip(f){
    const airport=f.destination;
    waypointChip.hidden=!airport||f.ground||f.tactical||f.finished||Boolean(f.cabinView)||Boolean(replay);
    if(waypointChip.hidden) return;
    const distance=Math.hypot(airport.x-f.x,airport.z-f.z);
    if(distance<2600){waypointChip.hidden=true;return;}
    const bearing=(Math.atan2(airport.x-f.x,f.z-airport.z)/rad+360)%360;
    waypointChip.textContent='✈ '+airport.code+' '+airport.name+' · '+(distance/1000).toFixed(distance<10?1:0)+' km · '+
      String(Math.round(bearing)%360).padStart(3,'0')+'°';
  }
  function takeoffCoach(f,knots,mobile){
    if(f.start!=='runway'||!['free','circuit'].includes(f.lesson)||f.approach||f.landed) return '';
    if(!f.airborne){
      if(f.parkingBrake) return '起飛 1/4 · 鬆開停機煞車';
      if(knots<f.aircraft.rotation&&f.pitch>8*rad) return '起飛警告 · 速度未達抬輪門檻，先放低機鼻';
      if(knots>f.aircraft.rotation+45) return '起飛警告 · 滑跑速度過高，確認可安全起飛或收油煞停';
      if(f.power<.55&&knots<10) return '起飛 1/4 · '+(mobile?'將油門滑桿推到 100%':'按住 W 加油門');
      if(knots<f.aircraft.rotation) return '起飛 2/4 · 保持跑道中線 · '+knotsToKmh(knots)+' / '+knotsToKmh(f.aircraft.rotation)+' km/h IAS';
      const rotate=mobile?(settings.invert?'輕推搖桿向下':'輕推搖桿向上'):(settings.invert?'輕按 ↓':'輕按 ↑');
      return '起飛 3/4 · '+rotate+'，緩慢抬起機鼻';
    }
    if(f.y-f.departure.elevation<110&&f.phase!=='approach'){
      if(f.pitch>20*rad&&f.vy<5) return '起飛警告 · 仰角過高，放低機鼻以維持空速';
      return '起飛 4/4 · 保持正爬升'+(f.gear&&f.aircraft.retract?'，確認離地後收起落架':'');
    }
    return '';
  }
  const yoke=byId('mouseYoke'), yokeLine=byId('mouseYokeLine'), yokeDot=byId('mouseYokeDot');
  const mouseDeadzone=byId('mouseDeadzone');
  function drawMouseYoke(){
    const hidden=!pointer.active||!settings.mouse||paused||Boolean(replay);
    yoke.toggleAttribute('hidden',hidden);
    if(hidden) return;
    mouseDeadzone.setAttribute('r',String(92*settings.deadzone));
    const x=String(105+pointer.x*92),y=String(105-pointer.y*92);
    yokeLine.setAttribute('x2',x);yokeLine.setAttribute('y2',y);
    yokeDot.setAttribute('cx',x);yokeDot.setAttribute('cy',y);
  }
  const landingCard=byId('landingCard'), landingGrade=byId('landingGrade'), landingDetails=byId('landingDetails');
  let shownLanding=null, previousCalloutHeight=null, sinkWarning=false;
  const calloutHeights=[500,200,100,50,30,10];
  const calloutNames=['Five hundred','Two hundred','One hundred','Fifty','Thirty','Ten'];
  byId('closeLanding').onclick=()=>{landingCard.hidden=true;};
  byId('retryLanding').onclick=()=>start(true,true);
  function drawLandingCard(f,speeds){
    const touchdown=f.touchdown;
    if(!f.approach||f.voyage||replay||!touchdown||shownLanding===touchdown||(!f.ended&&speeds.gs>40/knotsPerMps)) return;
    shownLanding=touchdown;
    const descent=Math.round(-touchdown.verticalSpeed*196.85), offset=Math.abs(touchdown.cross);
    // The ground model has rigid contact. Report an estimate for 45 cm of gear travel.
    const impact=1+touchdown.verticalSpeed**2/(2*.45*9.80665);
    const grade=descent<180&&offset<5?'S 級 · ★★★':descent<240&&offset<5?'A 級 · ★★★':
      descent<460&&offset<14?'B 級 · ★★':'C 級 · ★';
    landingGrade.textContent=f.ended?'降落失敗':grade;
    landingDetails.textContent='接地 '+descent+' ft/min · 中線偏差 '+offset.toFixed(1)+' m · 接地推算 '+impact.toFixed(2)+' G';
    landingCard.hidden=false;
  }
  function approachCallouts(f){
    if(!audioEnabled||paused||replay||f.ground||f.ended||f.tactical||f.phase!=='approach'){
      previousCalloutHeight=null;sinkWarning=false;
      return;
    }
    const airport=f.destination;
    if(!airport||f.y-airport.elevation>250||Math.hypot(f.x-airport.x,f.z-airport.z)>15000) return;
    const height=(f.y-terrainHeight(f.x,f.z)-f.aircraft.gearHeight)*3.28084;
    const unsafe=height>12&&height<350&&f.vy*196.85<-1200;
    if(unsafe&&!sinkWarning) flightAudio.callout(height<130?'Pull up':'Sink rate',true);
    else if(!unsafe&&f.vy<0&&previousCalloutHeight!==null){
      const index=calloutHeights.findIndex(value=>previousCalloutHeight>value&&height<=value);
      if(index>=0) flightAudio.callout(calloutNames[index]);
    }
    sinkWarning=unsafe;
    previousCalloutHeight=height;
  }
  function status(f,knots,target){
    if(f.aircraft.helicopter){
      if(f.ended)return '接地過重 · 重新練習';
      if(f.finished)return '直升機飛行已儲存';
      if(!f.battery)return '開電瓶，再啟動引擎';
      if(!f.engines.some(Boolean))return '啟動引擎 · 右側總距控制升降';
      if(f.rotorRPM<.9)return '旋翼加速中 · NR '+Math.round(f.rotorRPM*100)+'%';
      if(f.ground)return f.parkingBrake?'鬆開停機煞車，再將總距提高至約 60%':'總距 60% 起飛 · 約 55% 懸停';
      return f.hover?'懸停輔助 · 搖桿或總距輸入可接管':'搖桿控制前後左右 · 右側方向舵轉機頭 · 總距控制升降';
    }
    const mobile=touchControls.mode.value==='mobile';
    const retry=mobile?'':' · R 重飛';
    if(replay) return '貨運回放 · '+Math.floor(replay.time/60)+' 分鐘 · '+f.phase;
    if(paused) return touchControls.mode.value==='mobile'?'已暫停 · 點「繼續」':'已暫停 · P 繼續';
    if(f.tow) return f.tow.arrival?(f.mission==='cargo'?'拖往貨運機位':'拖往下客機位'):'拖往跑道';
    if(f.ground&&f.towMessage) return f.towMessage;
    if(f.approach&&!f.voyage&&f.touchdown&&(f.finished||f.ended)){
      const {cross,verticalSpeed}=f.touchdown;
      const impact=Math.round(-verticalSpeed*196.85);
      const score=f.ended?'降落失敗':impact<240&&Math.abs(cross)<5?'降落 ★★★':impact<460&&Math.abs(cross)<14?'降落 ★★':'降落 ★';
      return score+' · 接地 '+impact+' ft/min · 偏離中線 '+Math.round(Math.abs(cross))+' m'+retry;
    }
    if(f.approach&&f.lesson==='free'&&f.landed&&!f.hold?.nav){
      return '已接地 · 收油煞停，再拉上停機煞車查看成績';
    }
    if(!f.finished&&!f.ended&&!f.hold){
      const coach=takeoffCoach(f,knots,mobile);
      if(coach) return coach;
    }
    if(f.ground&&!f.landed&&f.start==='runway'&&f.parkingBrake&&f.taxiIndex>=f.taxi.length)
      return '已對正跑道 · '+(!f.battery?'請開電瓶':f.engines.every(Boolean)?'可鬆開停機煞車':'請啟動引擎');
    if(f.checkpointFailed&&!f.finished) return '任務存檔未更新 · 請檢查瀏覽器儲存空間或其他分頁';
    if(f.contract&&f.finished){
      const receipt=f.receipt;
      const payout=receipt?' · 收入 '+receipt.base+' − 燃油 '+receipt.fuel+' = '+receipt.net+' 金幣':'';
      return (f.ended?'落地失敗':f.contract.result)+payout+' · '+(f.recorded?'已儲存':'未能儲存')+
        (f.replaySaved?' · 回放已儲存':'')+retry;
    }
    if(f.voyage){
      if(f.finished) return (f.landed?'成田貨運任務完成':'落地失敗')+' · '+(f.replaySaved?'回放已儲存':'回放未儲存')+retry;
      if(f.noseDoor||f.sideDoor) return '貨門警告 · 關門前禁止滑行及啟動引擎';
      if(!byId('voyageGuided').checked&&!paused) return '貨運任務 · '+Math.round(f.fuel)+' kg 燃油';
    }
    if(f.climbLesson){
      if(f.finished){
        if(f.climbLesson.failed) return '巡航練習失敗'+retry;
        const {gs,mach}=flightSpeeds(f);
        return '巡航練習完成 · Mach '+mach.toFixed(3)+' · GS '+displayKmh(gs)+' km/h · '+
          (f.recorded?'已儲存紀錄':'未能儲存')+retry;
      }
      if(f.ground) return knots<f.aircraft.rotation?'桃園 05L · 增加油門，達到 '+knotsToKmh(f.aircraft.rotation)+' km/h IAS 再抬頭':'抬頭離地 · 正爬升後收起落架';
      if(f.stall) return '失速 · 放低機鼻';
      if(f.hold?.climb||f.climbLesson.stable>0) return '自動油門 · 目標 35,000 ft · Mach '+cruiseMachTarget(f).toFixed(2)+' · 穩定 '+Math.floor(f.climbLesson.stable)+'/60 秒 · 剩油 '+Math.round(f.fuel)+' kg';
      if(f.gear||f.flaps||f.spoilers) return '保持正爬升 · 收起落架、襟翼及擾流板';
      return climbReady(f)?'接通「爬升／巡航 35,000 ft」':'保持正爬升 · 離地約 500 呎且至少 304 km/h IAS 後接通爬升';
    }
    if(f.finished&&f.service) return '載客航班已結算 · 請查看地勤面板';
    if(f.finished) return (f.ended?'落地失敗':f.mission?'任務完成'+(f.rewardPaid?' · 獎金 $'+f.reward.toLocaleString():''):'已落地並停妥')+' · '+(f.recorded?'已儲存紀錄':'未能儲存')+retry;
    if(f.ended) return '落地失敗'+retry;
    if(f.hold?.nav){
      const phase={route:'沿航線飛行',descent:'自動下降至進場定位點',final:'對正跑道並自動降落',rollout:'接地後自動煞停'}[f.hold.stage]||'準備接入航線';
      return '自動導航 · '+phase+' · 油門 '+Math.round(f.power*100)+'%';
    }
    if(f.navMessage&&!f.ground) return f.navMessage;
    const machLimit=fastCruiseActive(f)?cruiseMachTarget(f)+.07:f.aircraft.maxMach;
    if(machLimit&&flightSpeeds(f).mach>machLimit) return '超速 · 請降低油門';
    if(f.range&&!f.range.hit&&!f.ground){
      const d=Math.hypot(f.range.x-f.x,f.range.z-f.z);
      return (f.range.message||'對準橘色地面靶，距離 250–2600 m '+(mobile?'點「訓練射擊」':'按 M'))+' · '+Math.round(d)+' m · '+f.range.rounds+' 發';
    }
    if(f.airBrake) return '空中減速板已展開';
    if(f.cruiseTrial) return (f.fastCruise?'高速試飛 · 目標 IAS 2,000 km/h':'寫實巡航')+' · '+Math.floor(f.elapsed/60)+' 分 '+Math.floor(f.elapsed%60)+' 秒';
    if(!f.regional){
      if(f.landed) return '已接地 · 收油並煞車'+retry;
      if(f.ground) return knots>=51?(mobile?'向上拖搖桿拉升':'按 ↑ 拉升'):(mobile?'調高油門':'按住 W')+' 加速至約 94 km/h';
      return f.stall?'失速 · 放低機鼻':'松山起落航線 · 依地圖飛行';
    }
    if(f.service){
      const service=f.service;
      if(f.awaitingService) return service.delivered===f.passengers?'下機完成 · 關艙門並收回空橋':'關閉引擎 · 接空橋、開艙門讓旅客下機';
      if(f.landed) return arrivalTowReady(f)?'已停穩 · 可請拖車拖到機位':'已接地 · 煞停後可請拖車';
      if(!service.pushed) return service.pushing?'地勤推離中':service.boarded===f.passengers&&f.fuel>=service.targetFuel?
        '關艙門、收空橋，再按「拖車牽引至跑道」':'停妥後接空橋並開艙門，同時加油';
    }
    if(arrivalTowReady(f)&&f.mission==='cargo') return '已停穩 · 選擇前往貨運機位的方式';
    if(f.awaitingService) return f.mission==='cargo'?'關閉引擎 · 開貨門卸貨，卸完關門':'關閉引擎 · 連接空橋';
    if(f.phase==='cold'){
      if(!f.battery) return '冷艙 · 請開電瓶';
      if(f.mission==='cargo'&&!f.pallets.some(Boolean)) return '開貨門，裝載貨盤後關門';
      return '電瓶已供電 · 請啟動引擎';
    }
    if(f.phase==='taxi'||f.phase==='arrival'){
      if(f.parkingBrake) return '停機煞車已拉上 · '+(mobile?'點「停機煞車」鬆開':'B 鬆開');
      return target.name+' · '+(mobile?'停妥後點「停機煞車」':'停妥按 B');
    }
    if(f.ground) return knots>=f.aircraft.rotation?(mobile?'向上拖動搖桿抬頭':'按 ↑ 拉升'):
      '對正跑道 · '+(mobile?'調高油門，加速至 ':'加速至 ')+knotsToKmh(f.aircraft.rotation)+' km/h';
    if(f.stall) return '失速 · 放低機鼻';
    return f.phase==='approach'?'最後進場 · 目標 '+knotsToKmh(f.aircraft.approach)+' km/h':target.name+' · 依導航轉向';
  }
  const flightNext=byId('flightNext');
  const touchQuick=byId('touchQuick');
  const touchBrake=touchQuick.querySelector('[data-hold="brake"]');
  const touchFlaps=touchQuick.querySelector('[data-action="KeyF"]');
  const touchGear=touchQuick.querySelector('[data-action="KeyG"]');
  const touchParking=touchQuick.querySelector('[data-action="KeyB"]');
  let nextFlightAction;
  flightNext.onclick=()=>{
    const run=nextFlightAction;
    nextFlightAction=undefined;
    run?.();
  };
  function drawFlightNext(f){
    let label='',run;
    if(paused){label='繼續';run=()=>action('KeyP');}
    else if(!replay&&(f.finished||f.ended)&&!f.tactical){
      label=f.service?'返回飛行計畫':'重飛';
      run=f.service?menu:()=>action('KeyR');
    }
    else if(!replay&&!f.finished&&!f.ended&&!f.tow&&byId('gateGuide').hidden){
      if(f.aircraft.helicopter){
        if(!f.battery){label='開電瓶';run=()=>setBattery(f,true);}
        else if(!f.engines.some(Boolean)){label='啟動引擎';run=()=>startEngine(f,0);}
        else if(f.ground&&f.parkingBrake){label='鬆開停機煞車';run=()=>action('KeyB');}
        else if(!f.ground){label=f.hover?'接回手動':'懸停輔助';run=()=>toggleHelicopterHover(f);}
      }
      else if(f.hold?.nav){label='接回手動';run=()=>toggleNavigation(f);}
      else if(f.climbLesson&&!f.hold?.climb&&climbReady(f)){
        label='自動爬升';
        run=()=>{f.hold={heading:f.heading,altitude:35000*.3048,mach:cruiseMachTarget(f),climb:true};};
      }
      else if(!f.ground&&!f.tactical&&!f.climbLesson&&!f.cruiseTrial){
        label='自動導航與降落';run=()=>toggleNavigation(f);
        if(!f.battery) label='';
      }else if(f.ground&&!f.awaitingService&&!f.landed&&!f.battery){
        label='開電瓶';run=()=>setBattery(f,true);
      }else if(f.ground&&f.mission==='cargo'&&(f.awaitingService||f.phase==='cold')){
        ({label,run}=cargoNextAction(f));
      }else if(f.ground&&!f.awaitingService&&!(f.landed&&f.service)){
        if(!f.engines.every(Boolean)){
          const engine=f.engines.findIndex(running=>!running);
          label='啟動引擎 '+(engine+1);run=()=>startEngine(f,engine);
        }else if(f.start==='cold'&&runwayTowReady(f)){label='跳至跑道';run=()=>callRunwayTow(f,true);}
        else if(f.parkingBrake){label='鬆開停機煞車';run=()=>action('KeyB');}
      }
    }
    nextFlightAction=run;
    flightNext.classList.toggle('flight-assist-duplicate',label==='自動導航與降落'||label==='接回手動');
    flightNext.hidden=!label;
    if(flightNext.textContent!==label) flightNext.textContent=label;
    touchQuick.hidden=Boolean(f.tow)||!byId('gateGuide').hidden||f.finished;
    const brakeLabel=f.ground?'煞車':'空中煞車';
    if(touchBrake.textContent!==brakeLabel) touchBrake.textContent=brakeLabel;
    touchBrake.setAttribute('aria-pressed',String(Boolean(f.airBrake)));
    touchGear.hidden=!f.aircraft.retract;
    touchFlaps.hidden=Boolean(f.aircraft.helicopter);
    touchGlide.hidden=Boolean(f.aircraft.helicopter);
    touchAssist.textContent=f.aircraft.helicopter?(f.hover?'手動':'懸停'):'輔助';
    touchThrottle.setAttribute('aria-label',f.aircraft.helicopter?'總距（控制升降）':'油門');
    touchGear.disabled=f.ground||!f.battery||Boolean(replay);
    touchParking.hidden=!f.ground;
    touchParking.setAttribute('aria-pressed',String(f.parkingBrake));
    const flapLabel='襟翼 '+f.flaps;
    if(touchFlaps.textContent!==flapLabel) touchFlaps.textContent=flapLabel;
    const gearLabel=f.gear?'收起落架':'放起落架';
    touchGear.setAttribute('aria-label',gearLabel);
    touchGear.setAttribute('aria-pressed',String(f.gear));
    touchAssist.disabled=f.ground||!f.battery||Boolean(f.tactical)||Boolean(replay)||(f.cruiseTrial&&!f.iasTrial)||Boolean(f.climbLesson);
    touchAssist.setAttribute('aria-pressed',String(Boolean(f.hold?.nav||f.iasTrial&&f.hold)));
    glideButton.disabled=f.ground||Boolean(f.tactical)||Boolean(replay)||!f.destination;
    helpGlide.disabled=glideButton.disabled;
  }
  function cargoNextAction(f){
    const hasCargo=f.pallets.some(Boolean);
    const door=f.aircraft.sideCargo?'sideDoor':'noseDoor';
    const doorOpen=f.noseDoor||f.sideDoor;
    const standardCargo=f.aircraft.antonov?[24000,30000,20000]:[9000,12000,8000];
    const setDoor=open=>{
      if(!groundServiceAllowed(f)) return;
      if(open) f[door]=true;
      else f.noseDoor=f.sideDoor=false;
      saveCurrentMission(f);
    };
    const load=masses=>{
      if(!setCargoManifest(f,masses)) return;
      for(const field of special.querySelectorAll('[data-pallet]')) field.value=f.pallets[Number(field.dataset.pallet)];
      if(f.voyage) captureVoyage(f,voyageFrames,true);
      saveCurrentMission(f);
    };
    if(!f.parkingBrake) return {label:'拉上停機煞車',run:()=>action('KeyB')};
    if(f.awaitingService){
      if(f.engines.some(Boolean)) return {label:'關閉引擎',run:()=>{f.power=0;f.engines.fill(false);saveCurrentMission(f);}};
      if(hasCargo&&!doorOpen) return {label:'開啟貨門卸貨',run:()=>setDoor(true)};
      if(hasCargo) return {label:'卸下所有貨盤',run:()=>load([0,0,0])};
      if(doorOpen) return {label:'關閉貨門並結算',run:()=>setDoor(false)};
    }else if(!hasCargo||doorOpen){
      if(f.engines.some(Boolean)) return {label:'關閉引擎以裝貨',run:()=>{f.power=0;f.engines.fill(false);saveCurrentMission(f);}};
      if(!doorOpen) return {label:'開啟貨門裝載',run:()=>setDoor(true)};
      if(!hasCargo) return {label:'裝載標準貨盤',run:()=>load(standardCargo)};
      if(cargoBalance(f).problems.length) return {label:'恢復標準貨盤',run:()=>load(standardCargo)};
      return {label:'關閉貨門',run:()=>setDoor(false)};
    }else if(runwayTowReady(f)) return {label:'跳至跑道',run:()=>callRunwayTow(f,true)};
    else if(!f.engines.some(Boolean)) return {label:'開啟貨門檢查配載',run:()=>setDoor(true)};
    return {label:'',run:null};
  }
  function completeLesson(f){
    const done=f.lesson==='cold'?f.engines?.every(Boolean):
      f.lesson==='taxi'?f.phase==='takeoff':
      f.lesson==='circuit'||f.lesson==='crosswind'?f.landed&&Math.hypot(f.vx,f.vz)<1:
      f.lesson==='route'?f.finished&&f.landed:false;
    if(!done||f.lessonSaved) return;
    f.lessonSaved=true;
    try{localStorage.setItem('skybound.lesson.'+f.lesson,'完成');}catch{}
  }
  const rangeMarker=new THREE.Mesh(new THREE.OctahedronGeometry(26),new THREE.MeshBasicMaterial({color:0xff7928}));
  rangeMarker.visible=false;
  scene.add(rangeMarker);
  const activeJetway=makeJetway(),bridgeMesh=activeJetway.root;
  scene.add(bridgeMesh);
  bridgeMesh.visible=false;
  // Two local ground decals avoid a second full scenery render for shadows.
  function groundShadow(paint){
    const image=document.createElement('canvas');
    image.width=image.height=128;
    const ink=image.getContext('2d');
    ink.fillStyle='#16202c';
    ink.filter='blur(3px)';
    paint(ink);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({
      map:new THREE.CanvasTexture(image),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2
    }));
    mesh.visible=false;
    scene.add(mesh);
    return mesh;
  }
  const aircraftShadow=groundShadow(ink=>{
    ink.beginPath();ink.ellipse(64,64,7,56,0,0,Math.PI*2);ink.fill();
    ink.beginPath();
    for(const [x,y] of [[64,48],[120,79],[119,86],[64,70],[9,86],[8,79]]) ink.lineTo(x,y);
    ink.fill();
    ink.fillRect(43,101,42,7);
  });
  const jetwayShadow=groundShadow(ink=>ink.fillRect(28,6,72,116));
  function placeGroundShadow(mesh,x,z,y,heading,width,length,height){
    const light=sunDirection;
    const projection=height/Math.max(230,light.y);
    mesh.position.set(x-light.x*projection,y+.16,z-light.z*projection);
    mesh.rotation.set(-Math.PI/2,0,-heading);
    mesh.scale.set(width,length,1);
    mesh.material.opacity=(.25+.28*clamp(sunlight.intensity/2.3,0,1))*activeDay;
    mesh.visible=mesh.material.opacity>.02;
  }
  const bridgeQueue=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0xc99c78});
  const queuePeople=Array.from({length:9},(_,i)=>{
    const person=new THREE.Group();
    box(person,skin,.18,.22,.17,0,.78,0);
    box(person,material([0x547694,0x9b6557,0x69795c][i%3]),.32,.44,.20,0,.45,0);
    box(person,material(0x263540),.12,.42,.14,-.083,.04,0);
    box(person,material(0x263540),.12,.42,.14,.083,.04,0);
    bridgeQueue.add(person);
    return person;
  });
  scene.add(bridgeQueue);
  function makeFuelTanker(){
    const vehicle=new THREE.Group(),paint=material('#f1eeea'),wheel=material('#252932');
    const length=6.2;
    box(vehicle,paint,2.3,.58,length,0,.58,0);
    box(vehicle,paint,2.05,1.68,1.6,0,1.55,-length*.31);
    box(vehicle,material('#405d76'),1.72,.35,.08,0,2,-length*.44);
    for(const side of [-1,1]) for(const end of [-1,1]){
      const tire=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.24,12),wheel);
      tire.rotation.z=Math.PI/2;
      tire.position.set(side*1.11,.34,end*length*.30);
      vehicle.add(tire);
    }
    const tank=new THREE.Mesh(new THREE.CylinderGeometry(.84,.84,3.7,16),material('#ccd8df'));
    tank.rotation.x=Math.PI/2;tank.position.set(0,1.35,.96);vehicle.add(tank);
    vehicle.visible=false;scene.add(vehicle);
    return vehicle;
  }
  const tug=new THREE.Group(),towbar=new THREE.Group(),tugWheels=[];
  tug.name='Airport tug';
  towbar.name='Aircraft towbar';
  const tugPaint=material('#ffbd30'),tugTrim=material('#293039'),tugHub=material('#b3c0ca');
  const tugGlass=new THREE.MeshStandardMaterial({color:0x354f60,roughness:.22,metalness:.22});
  const tugLight=new THREE.MeshBasicMaterial({color:0xfff3d5});
  const tugTailLight=new THREE.MeshBasicMaterial({color:0xdb3127});
  const tugBeacon=new THREE.MeshBasicMaterial({color:0xffaf37});
  const towbarLength=5.5,tugWheelRadius=.43,tugHitchZ=2.52,tugHitchHeight=.48;
  box(tug,tugTrim,2.9,.23,4.9,0,.47,0);
  box(tug,tugPaint,2.75,.61,4.55,0,.80,0);
  box(tug,tugTrim,2.91,.31,.23,0,.65,-2.41);
  box(tug,tugTrim,2.91,.31,.23,0,.65,2.41);
  box(tug,tugPaint,2.58,.25,1.66,0,1.22,.68);
  box(tug,tugTrim,1.3,.035,.77,0,1.36,.68);
  for(let i=0;i<5;i++) box(tug,tugHub,1.18,.012,.035,0,1.382,.40+i*.14);
  box(tug,tugPaint,1.53,1.12,1.59,-.46,1.55,-1.13);
  box(tug,tugPaint,1.67,.12,1.68,-.46,2.16,-1.13);
  box(tug,tugGlass,1.29,.53,.035,-.46,1.75,-1.94);
  box(tug,tugGlass,1.29,.53,.035,-.46,1.75,-.32);
  box(tug,tugTrim,.26,.13,.26,.09,2.26,-1.49);
  box(tug,tugBeacon,.18,.13,.18,.09,2.38,-1.49);
  for(const side of [-1,1]){
    box(tug,tugGlass,.04,.53,1.21,-.46+side*.776,1.75,-1.13);
    box(tug,tugTrim,.09,.10,.29,-.46+side*.80,1.38,-1.22);
    box(tug,tugTrim,.31,.10,.67,-.46+side*.88,.53,-1.11);
    box(tug,tugLight,.29,.15,.042,side*1.10,.81,-2.54);
    box(tug,tugTailLight,.23,.14,.042,side*1.12,.82,2.54);
    for(let i=0;i<3;i++){
      box(tug,tugPaint,.20,.16,.015,side*(.68-i*.25),.64,-2.535).rotation.z=side*.56;
      box(tug,tugPaint,.20,.16,.015,side*(.68-i*.25),.64,2.535).rotation.z=-side*.56;
    }
    for(const axle of [-1.53,1.52]){
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(tugWheelRadius,tugWheelRadius,.37,16),tugTrim);
      wheel.position.set(side*1.29,tugWheelRadius,axle);
      wheel.rotation.z=Math.PI/2;
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.055,12),tugHub);
      hub.position.y=-side*.19;
      wheel.add(hub);
      box(wheel,tugTrim,.12,.014,.062,.10,-side*.22,.03);
      tug.add(wheel);
      tugWheels.push(wheel);
    }
  }
  box(tug,tugHub,.28,.20,.21,0,tugHitchHeight,tugHitchZ);
  box(towbar,tugPaint,.18,1,.18,0,.5,0);
  const towEye=new THREE.Mesh(new THREE.TorusGeometry(.15,.035,8,14),tugHub);
  towEye.rotation.x=Math.PI/2;
  towbar.add(towEye);
  const tugShadow=groundShadow(ink=>ink.fillRect(16,6,96,116));
  const tugHitch=new THREE.Vector3(),noseHitch=new THREE.Vector3(),towSpan=new THREE.Vector3();
  const towbarAxis=new THREE.Vector3(0,1,0);
  scene.add(tug,towbar);
  const tanker=makeFuelTanker();
  const cargoLoader=new THREE.Group();
  const loaderPaint=material('#ebad35'), loaderMetal=material('#667480');
  box(cargoLoader,loaderPaint,4.2,.65,6,0,0,0);
  box(cargoLoader,loaderMetal,3.5,.38,6.5,0,4.3,0);
  for(const side of [-1,1]){
    box(cargoLoader,loaderPaint,.24,4,.24,side*1.60,2,1.8);
    box(cargoLoader,loaderPaint,.24,4,.24,side*1.60,2,-1.8);
  }
  const serviceLamp=new THREE.PointLight(0xffecce,0,95,1.2);
  scene.add(cargoLoader,serviceLamp);
  const taxiLamp=new THREE.SpotLight(0xffebc9,0,240,.40,.62,1.35);
  scene.add(taxiLamp,taxiLamp.target);
  function drawInstruments(f,profile,speeds,knots,live){
    const fuelLabel=Number.isFinite(f.fuel)?Math.round(f.fuel).toLocaleString()+' kg':'—';
    const occupants=f.service?f.service.boarded:f.passengers??0;
    const loadStatus=byId('flightLoad');
    const loadText='燃油 '+fuelLabel+' · 旅客 '+occupants+(f.service?'/'+f.passengers:'')+' 人';
    if(loadStatus.textContent!==loadText) loadStatus.textContent=loadText;
    const values=[displayKmh(speeds.ias),Math.round(f.y),Math.round(f.vs*196.85),String(Math.round(((f.heading/rad)%360+360)%360)%360).padStart(3,'0')+'°',Math.round(f.power*100)+'%',f.flaps+' / '+Math.round(f.trim/rad)+'°',displayKmh(speeds.gs),displayKmh(speeds.tas),speeds.mach.toFixed(2)];
    values.forEach((value,i)=>{
      const text=live?String(value):'—';
      if(statValues[i].textContent!==text) statValues[i].textContent=text;
    });
    byId('attitudeReadout').textContent=live?
      '俯仰 '+Math.round(f.pitch/rad)+'° · 坡度 '+Math.round(f.bank/rad)+'°':'';
    if(f.regional){
      for(const b of switches.children) b.update();
      const hold=f.hold;
      const autoStatus=hold?.nav&&['descent','final','rollout'].includes(hold.stage)?'自動導航接通 · 進場控速':
        hold?.climb&&!hold.levelOff?'自動爬升至 35,000 ft · 全油門':
        hold?.climb?'自動油門／巡航保持 · 全油門':
        hold?.nav?'自動導航接通 · 全油門':hold?'航向／高度保持 · 全油門':'';
      byId('instrumentType').textContent=live?
        f.aircraft.type+' · '+f.engines.map((running,i)=>'ENG '+(i+1)+' '+(running?Math.round(f.power*100)+'%':'OFF')).join(' / ')+
        (f.aircraft.reverse?' · 扭矩 '+(f.engines[0]?Math.round(f.power*100):0)+'%':'')+
        (autoStatus?' · '+autoStatus:''):'航電未供電';
      if(profile.role&&live){
        const guide=approachGuidance(f);
        byId('instrumentType').textContent+=' · VAPP '+knotsToKmh(profile.approach)+' km/h'+(f.boost&&f.power>.89?' · 加力':'');
        if(guide.valid) byId('instrumentType').textContent+=' · 下滑偏差 '+Math.round(guide.height)+' m · 航向道 '+Math.round(guide.cross)+' m';
      }
      if(profile.role==='cargo'){
        const balance=cargoBalance(f);
        byId('cargoBalance').textContent='貨重 '+balance.mass.toLocaleString()+' kg · CG '+balance.shift.toFixed(2)+' m'+(f.voyage?' · 燃油 '+Math.round(f.fuel).toLocaleString()+' kg':'')+
          (balance.problems.length?' · 超限：'+balance.problems.join('、'):'');
      }
      byId('cockpit').style.filter=activeDay<.15&&!f.lights?'brightness(.40)':'none';
    }
    if(f.contract&&Number.isFinite(f.fuel)){
      byId('instrumentType').textContent+=' · 燃油 '+Math.round(f.fuel)+' kg'+(f.passengers?' · '+f.passengers+' 名旅客':'');
    }
    if(f.mission==='passenger') byId('instrumentType').textContent='旅客 '+f.passengers+' 人 · 燃油 '+Math.round(f.fuel).toLocaleString()+' kg · 餘額 $'+readMoney().toLocaleString();
  }
  const approachGateGeometry=new THREE.BufferGeometry();
  approachGateGeometry.setAttribute('position',new THREE.Float32BufferAttribute(
    [-27,-12,0,27,-12,0,27,12,0,-27,12,0],3));
  const nextGateMaterial=new THREE.LineBasicMaterial({color:0x76ffd4,transparent:true,opacity:.90,depthWrite:false});
  const laterGateMaterial=new THREE.LineBasicMaterial({color:0x8bcaff,transparent:true,opacity:.40,depthWrite:false});
  const gateFlashMaterial=nextGateMaterial.clone();
  const approachGates=new THREE.Group();
  let gateProgress=null;
  const approachGateDistances=[4.5,3.9,3.3,2.7,2.1,1.5,.9,.3].map(nm=>nm*1852);
  for(const distance of approachGateDistances){
    const gate=new THREE.LineLoop(approachGateGeometry,laterGateMaterial);
    gate.userData.distance=distance;
    approachGates.add(gate);
  }
  scene.add(approachGates);
  const labelCanvas=document.createElement('canvas');
  labelCanvas.width=384;labelCanvas.height=84;
  const labelInk=labelCanvas.getContext('2d');
  const airportLabelTexture=new THREE.CanvasTexture(labelCanvas);
  airportLabelTexture.colorSpace=THREE.SRGBColorSpace;
  const airportLabel=new THREE.Sprite(new THREE.SpriteMaterial({
    map:airportLabelTexture,transparent:true,depthTest:false,depthWrite:false,sizeAttenuation:false,fog:false,toneMapped:false
  }));
  airportLabel.scale.set(.34,.0744,1);
  airportLabel.renderOrder=20;
  const runwayMarker=new THREE.Mesh(new THREE.RingGeometry(.70,1,32),new THREE.MeshBasicMaterial({
    color:0x71e9ff,transparent:true,depthWrite:false,side:THREE.DoubleSide
  }));
  runwayMarker.rotation.x=-Math.PI/2;
  const markerStem=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),new THREE.Vector3(0,1,0)
  ]),new THREE.LineBasicMaterial({color:0x71e9ff,transparent:true,depthWrite:false}));
  scene.add(airportLabel,runwayMarker,markerStem);
  let lastAirportLabel='';
  function drawAirportLabel(f){
    const r=f?.destination;
    const distance=r?Math.hypot(f.x-r.x,f.z-r.z):Infinity;
    const range=byId('weather').value==='fog'?6500:65000;
    const visible=!renderer.instrumentOnly&&f&&!f.ground&&!f.tactical&&!f.finished&&!replay&&!overviewActive&&
      distance>2600&&distance<range;
    airportLabel.visible=runwayMarker.visible=markerStem.visible=Boolean(visible);
    if(!visible) return;
    const alpha=clamp(Math.min((distance-2600)/1800,(range-distance)/1600),0,1);
    const height=90+distance*.021,radius=clamp(distance*.012,40,390);
    airportLabel.material.opacity=alpha;
    runwayMarker.material.opacity=markerStem.material.opacity=.78*alpha;
    airportLabel.position.set(r.x,r.elevation+height+6,r.z);
    runwayMarker.position.set(r.x,r.elevation+6,r.z);
    runwayMarker.scale.set(radius,radius,1);
    markerStem.position.copy(runwayMarker.position);
    markerStem.scale.y=height;
    const name=r.name+' '+r.designator+' 跑道 · '+(distance/1000).toFixed(1)+' km';
    if(name!==lastAirportLabel){
      lastAirportLabel=name;
      labelInk.clearRect(0,0,384,84);
      labelInk.fillStyle='#132f43ed';labelInk.fillRect(12,8,360,68);
      labelInk.strokeStyle='#8ccfe5';labelInk.lineWidth=2;labelInk.strokeRect(12,8,360,68);
      labelInk.fillStyle='#f1fcff';labelInk.font='700 30px system-ui';
      labelInk.textAlign='center';labelInk.textBaseline='middle';labelInk.fillText(name,192,42);
      airportLabelTexture.needsUpdate=true;
    }
  }
  function drawApproachGates(f){
    const departure=f?.quickPreset==='sunset'&&!f.approach&&f.waypoint<2;
    const arrival=f?.regional&&glideEnabled&&!f.tactical&&f.destination;
    approachGates.visible=Boolean((departure||arrival)&&!replay&&!f.ground&&!f.ended);
    if(!approachGates.visible) return;
    const runway=departure?f.departure:f.destination;
    const {along,cross}=runwayCoordinates(f.x,f.z,runway);
    if(gateProgress?.runway!==runway||gateProgress?.departure!==departure){
      gateProgress={runway,departure,along,cross,y:f.y,combo:0,flashUntil:0};
      approachGates.children.forEach((gate,i)=>{
        const distance=gate.userData.distance;
        const at=departure?runway.length/2+240+i*550:-runway.length/2-distance;
        const {x,z}=airportPoint(runway,at,0);
        gate.position.set(x,runway.elevation+(departure?48+i*30:15+distance*Math.tan(Math.PI/60)),z);
        gate.rotation.y=-runway.heading;
        Object.assign(gate.userData,{at,passed:false,flash:0});
      });
    }
    const progress=gateProgress;
    let first=true;
    for(let i=0;i<approachGates.children.length;i++){
      const gate=approachGates.children[i],data=gate.userData;
      if(!paused&&!data.passed&&(!departure||i<3)&&progress.along<data.at&&along>=data.at){
        const blend=(data.at-progress.along)/(along-progress.along);
        const offset=THREE.MathUtils.lerp(progress.cross,cross,blend);
        const height=THREE.MathUtils.lerp(progress.y,f.y,blend)-gate.position.y;
        data.passed=true;
        if(Math.abs(offset)<=27*1.35&&Math.abs(height)<=12*1.35){
          data.flash=f.elapsed+.55;
          progress.combo++;
          progress.flashUntil=f.elapsed+1.5;
          if(audioEnabled) flightAudio.gateChime();
        }else progress.combo=0;
      }
      const flash=Math.max(0,data.flash-f.elapsed);
      gate.visible=(!departure||i<3)&&(data.at>along||flash>0);
      if(!gate.visible) continue;
      gate.scale.setScalar(1+(flash>0?(.55-flash)*1.6:0));
      if(flash>0) gateFlashMaterial.opacity=flash/.55;
      gate.material=flash>0?gateFlashMaterial:first?nextGateMaterial:laterGateMaterial;
      first=false;
    }
    Object.assign(progress,{along,cross,y:f.y});
  }
  function animateCargoDoors(data,noseOpen,sideOpen,dt){
    const blend=Math.min(1,dt*2.8);
    data.sideDoor.rotation.z+=(Number(sideOpen)*-1.33-data.sideDoor.rotation.z)*blend;
    data.noseDoor.rotation.x+=(Number(noseOpen)*1.37-data.noseDoor.rotation.x)*blend;
    if(data.cargoRamp){
      const extension=clamp((data.noseDoor.rotation.x-.31)/.98,0,1);
      data.cargoRamp.visible=extension>.025;
      data.cargoRamp.rotation.x=THREE.MathUtils.lerp(1.45,-.19,extension);
    }
  }
  function render(now){
    requestAnimationFrame(render);
    if(document.hidden){last=now;return;}
    const frameSeconds=clamp((now-last)/1000,0,1);
    const dt=Math.min(.25,frameSeconds);last=now;
    adjustResolution(now,frameSeconds);
    const profile=flight?.aircraft||(hangarMode?displayedAircraft():selectedAircraft());
    const previewInspection=hangarMode?hangarView.value:inspectionMode?byId('inspect').value:'orbit';
    if(hangarStage) hangarStage.visible=hangarMode;
    const model=aircraftModel(profile);
    const livery=hangarLiveries[profile.id]||!flight&&byId('liveryPreview').checked;
    if(!renderer.instrumentOnly) updateDownloadedAircraft(model,profile,flight,livery,renderer.capabilities.getMaxAnisotropy());
    model.userData.setLivery?.(livery);
    for(const other of models.values()){
      other.visible=other===model&&(!flight||cameraMode===0)&&!flight?.cabinView;
      if(other.userData.cabin) other.userData.cabin.visible=false;
    }
    rangeMarker.visible=Boolean(flight?.range&&!flight.range.hit);
    if(rangeMarker.visible) rangeMarker.position.set(flight.range.x,flight.range.y+12,flight.range.z);
    bridgeMesh.visible=false;
    aircraftShadow.visible=jetwayShadow.visible=tugShadow.visible=false;
    towbar.visible=false;
    bridgeQueue.visible=tug.visible=tanker.visible=false;
    cargoLoader.visible=false;
    serviceLamp.intensity=0;
    if(flight){
      const f=flight,input=replay?{roll:0}:inputs(f);
      if(poseFlight!==f){
        poseFlight=f;
        rememberPose(f);
        chaseHeading=null;
      }
      if(replay){
        if(!replay.paused) replay.time=Math.min(replay.duration,replay.time+dt*replay.rate);
        applyVoyageFrame(f,replay.frames,replay.time);
        replaySeek.value=replay.time;
        if(replay.time>=replay.duration){
          replay.paused=true;showTouchPause(true);byId('replayToggle').textContent='重新播放';
        }
        special.querySelectorAll('input').forEach((field,i)=>field.value=f.pallets[i]);
      }else{
        const rate=Number(flightRate.value)||1;
        if(rate<previousFlightRate) accumulator*=rate/previousFlightRate;
        if(!paused&&!f.finished) accumulator+=frameSeconds*rate;
        // Catch up gradually after a long frame so fast-forward cannot stall rendering.
        const simDeadline=performance.now()+5;
        let autopilotInput;
        for(let ticks=0;!paused&&!f.finished&&!document.hidden&&accumulator+1e-10>=simTick&&
            (ticks<12||performance.now()<simDeadline);ticks++){
          rememberPose(f);
          if(f.tow) stepRunwayTow(f,simTick);
          else{
            if(!f.hold?.nav) autopilotInput=null;
            else if(!autopilotInput||ticks%4===0){
              const guidance=navigationControls(f,activeTarget(f));
              autopilotInput={...input,...guidance,brake:input.brake||guidance.brake};
            }
            stepTrainer(f,smoothControls(f,autopilotInput||input,simTick));
          }
          if(f.service) updatePassengerService(f,simTick);
          if(f.tactical) stepTactical(f,simTick);
          else if(f.regional) updateRegionalFlight(f);
          if(f.ended&&!f.crashTriggered){
            f.crashTriggered=true;
            flightAudio.crashExplosion?.();
            crashVFX.trigger(f.x,f.y,f.z,f.vx,f.vz,f.speed);
            crashShake=1.35;
            if(typeof navigator!=='undefined'&&navigator.vibrate) navigator.vibrate([120,50,180,50,240]);
          }
          if(f.voyage) captureVoyage(f,voyageFrames,f.finished);
          accumulator-=simTick;
          if(f.finished){
            if(f.voyage) f.replaySaved=storeVoyage(voyageFrames,f);
            if(f.checkpointId) clearMissionCheckpoint(f.checkpointId);
            accumulator=0;break;
          }
        }
        accumulator=Math.min(accumulator,rate);
        previousFlightRate=rate;
        const rateText=rate===1?'':'目前 '+rate+'×';
        if(flightRateStatus.textContent!==rateText) flightRateStatus.textContent=rateText;
      }
      byId('flightTimeControls').hidden=Boolean(replay)||f.finished;
      touchThrottle.disabled=paused||Boolean(replay)||f.finished||Boolean(f.tow)||!byId('gateGuide').hidden;
      const powerPercent=Math.round(f.power*100);
      if(Number(touchThrottle.value)!==powerPercent) touchThrottle.value=powerPercent;
      if(touchThrottleValue.textContent!==powerPercent+'%'){
        touchThrottleValue.textContent=powerPercent+'%';
        touchThrottle.style.setProperty('--throttle-level',powerPercent+'%');
      }
      if(f.checkpointId&&!replay&&!f.finished&&!paused&&now>=nextCheckpoint) saveCurrentMission(f);
      if(f.service){
        if(Math.floor(f.elapsed/5)!==f.service.checkpoint){
          f.service.checkpoint=Math.floor(f.elapsed/5);
          savePassenger(f);
        }
        drawPassengerStatus(f);
      }
      completeLesson(f);
      drawApproachGates(f);
      if(f.touchdown&&previousTouchdown!==f.touchdown){
        if(audioEnabled&&!replay) flightAudio.touchdown(f.touchdown.verticalSpeed);
        if(typeof navigator!=='undefined'&&navigator.vibrate) navigator.vibrate([40,30,60]);
        previousTouchdown=f.touchdown;
      }
      const continuous=Math.hypot(f.x-previousPose.x,f.y-previousPose.y,f.z-previousPose.z)<30;
      const blend=replay||paused||f.finished||!continuous?1:clamp(accumulator/simTick,0,1);
      const heading=previousPose.heading+wrapAngle(f.heading-previousPose.heading)*blend;
      const pitch=THREE.MathUtils.lerp(previousPose.pitch,f.pitch,blend);
      const bank=previousPose.bank+wrapAngle(f.bank-previousPose.bank)*blend;
      const pos=visualPosition.set(
        THREE.MathUtils.lerp(previousPose.x,f.x,blend),
        THREE.MathUtils.lerp(previousPose.y,f.y,blend),
        THREE.MathUtils.lerp(previousPose.z,f.z,blend));
      const dir=visualForward.set(Math.sin(heading),0,-Math.cos(heading));
      updateTerrain(f.x,f.z);
      taxiLamp.intensity=f.voyage&&f.ground&&f.battery&&f.lights?470:0;
      taxiLamp.position.copy(pos).addScaledVector(dir,14);
      taxiLamp.target.position.copy(pos).addScaledVector(dir,62);
      taxiLamp.target.position.y=f.y-5;
      model.position.copy(pos);model.rotation.set(pitch,-heading,-bank,'YXZ');
      if(typeof multiplayer!=='undefined'){
        multiplayer.broadcastFlight(f,profile);
        multiplayer.updatePeers3D(dt,now,f,scene,camera);
      }
      const airport=f.landed?f.destination:f.departure;
      if(f.ground&&airport&&Math.hypot(f.x-airport.x,f.z-airport.z)<airport.length*.5+450){
        placeGroundShadow(aircraftShadow,f.x,f.z,airport.elevation,f.heading,
          profile.geometry[2]*2.22,profile.geometry[0]*2.24,profile.gearHeight*.8);
      }
      if(f.ground){
        if(f.tow||f.service?.pushing){
          const noseWheel=model.userData.wheels?.[0];
          const noseOffset=noseWheel?.position.z??-profile.geometry[0]*.55;
          noseHitch.set(0,noseWheel?.position.y??(-profile.gearHeight+.25),noseOffset)
            .applyQuaternion(model.quaternion).add(pos);
          tug.position.copy(noseHitch).addScaledVector(dir,towbarLength+tugHitchZ);
          tug.position.y=terrainHeight(tug.position.x,tug.position.z);
          tug.rotation.y=-heading;
          tugHitch.copy(tug.position).addScaledVector(dir,-tugHitchZ);
          tugHitch.y+=tugHitchHeight;
          towSpan.subVectors(noseHitch,tugHitch);
          towbar.position.copy(tugHitch);
          towbar.scale.y=towSpan.length();
          towbar.quaternion.setFromUnitVectors(towbarAxis,towSpan.normalize());
          if(!paused){
            const travel=f.service?.pushing?-2:Math.hypot(f.vx,f.vz);
            for(const wheel of tugWheels) wheel.rotateY(travel*dt/tugWheelRadius);
          }
          tugBeacon.color.setHex(activeDay<.6&&now%1000<360?0xffe2aa:0xe5891d);
          placeGroundShadow(tugShadow,tug.position.x,tug.position.z,tug.position.y,f.heading,3.35,5.4,.7);
          tug.visible=towbar.visible=true;
        }
        if(f.service?.pumping){
          const side=new THREE.Vector3(Math.cos(f.heading),0,Math.sin(f.heading));
          tanker.position.copy(pos).addScaledVector(side,profile.geometry[1]+4);
          tanker.position.y=terrainHeight(tanker.position.x,tanker.position.z);
          tanker.rotation.y=-f.heading;tanker.visible=true;
        }
      }
      const gear=model.userData.gear;
      const gearTarget=f.gear===false?0:1;
      if(!paused) gear.scale.y+=(gearTarget-gear.scale.y)*Math.min(1,dt*4);
      gear.visible=gear.scale.y>.06;
      model.userData.blades.forEach((blade,i)=>{if(!paused&&(f.engines?.[i]??true)) blade.rotation.z+=dt*(9+f.power*135)*(f.propLow?.72:1);});
      model.userData.navLights.forEach(lamp=>lamp.visible=Boolean(f.battery&&f.lights));
      if(model.userData.strobes){
        const strobeFlash=Boolean(f.battery&&f.lights&&((now%1200<50)||(now%1200>130&&now%1200<180)));
        model.userData.strobes.forEach(s=>s.visible=strobeFlash);
      }
      if(model.userData.beacons){
        const beaconOn=Boolean(f.battery&&(f.engines?.some(Boolean)||f.lights)&&(now%1100<240));
        model.userData.beacons.forEach(b=>b.visible=beaconOn);
      }
      model.userData.updateHelicopter?.(f,dt,now,cameraMode===1,paused||Boolean(replay));
      model.userData.updateFighterDeck?.(f,now);
      if(profile.role){
        const data=model.userData;
        data.flaps.forEach(part=>part.rotation.x=-f.flaps*.21);
        data.airBrakes?.forEach(part=>{
          part.rotation.x+=(Number(Boolean(f.airBrake||f.spoilers))*(-.85)-part.rotation.x)*Math.min(1,dt*9);
        });
        data.exhaustPlumes?.forEach((plume,i)=>{
          plume.visible=Boolean(f.engines?.[i]&&f.fuel!==0&&f.power>.88&&(f.boost||f.fastCruise));
          plume.scale.z=.68+(f.power-.88)*4.5+.10*Math.sin(now*.038+i*1.4);
        });
        const wheelTravel=paused?0:Math.hypot(f.vx,f.vz)*dt;
        data.wheels.forEach(wheel=>wheel.rotateY(wheelTravel/wheel.userData.radius));
        if(f.voyage){
          data.gear.position.y=f.ground?Math.max(0,.13-Math.hypot(f.vx,f.vz)*.001):0;
        }
        if(profile.role==='cargo'){
          if(f.ground&&(f.noseDoor||f.sideDoor)&&!f.cabinView){
            const offset=new THREE.Vector3(f.sideDoor?-data.radius-5:0,-profile.gearHeight+.5,f.sideDoor?data.sideDoor.position.z:-data.half-4);
            cargoLoader.position.copy(pos).add(offset.applyQuaternion(model.quaternion));
            cargoLoader.rotation.y=model.rotation.y+(f.sideDoor?Math.PI/2:0);
            cargoLoader.visible=true;
            serviceLamp.position.copy(cargoLoader.position).add(new THREE.Vector3(0,13,0));
            serviceLamp.intensity=f.lights?750:170;
          }
        }
        animateCargoDoors(data,Boolean(f.noseDoor),Boolean(f.sideDoor),dt);
        data.cabin.position.copy(pos);data.cabin.quaternion.copy(model.quaternion);
        data.cabin.visible=cameraMode===1||Boolean(f.cabinView);
        data.palletMeshes.forEach((pallet,index)=>{
          const loaded=f.pallets[index]>0;
          const entry=profile.sideCargo?data.sideDoor.position.z:-data.half-4;
          const station=palletStations[index].arm;
          const doorOpen=f.noseDoor||f.sideDoor;
          const desired=loaded?station:entry;
          if(pallet.userData.flight!==f||!doorOpen) pallet.position.z=desired;
          pallet.userData.flight=f;
          pallet.position.z+=(desired-pallet.position.z)*Math.min(1,dt*.95);
          pallet.visible=loaded||doorOpen&&Math.abs(pallet.position.z-entry)>.2;
          if(loaded) pallet.scale.y=.45+f.pallets[index]/42000;
        });
        data.passengerCabin?.update(f,dt);
        if(f.bridge){
          const {terminal,door,airport}=jetwayEndpoints(f,model);
          placeJetway(activeJetway,terminal,door,airport.elevation);
          bridgeMesh.visible=true;
          placeGroundShadow(jetwayShadow,(terminal.x+door.x)/2,(terminal.z+door.z)/2,
            airport.elevation,Math.atan2(door.x-terminal.x,terminal.z-door.z),4.2,
            Math.hypot(door.x-terminal.x,door.z-terminal.z)*1.1,3.8);
          if(f.service?.door){
            const exit=f.service.mode==='exit';
            const waiting=exit?f.service.boarded:f.passengers-f.service.boarded;
            bridgeQueue.position.copy(bridgeMesh.position);
            bridgeQueue.quaternion.copy(bridgeMesh.quaternion);
            bridgeQueue.visible=waiting>0;
            const distance=bridgeMesh.position.distanceTo(door);
            queuePeople.forEach((person,index)=>{
              const seconds=Math.min(f.service.bridgeDelay??passengerBridgeSeconds,passengerBridgeSeconds)||passengerBridgeSeconds;
              const travel=(f.service.bridgeElapsed||0)/seconds-index/queuePeople.length;
              person.visible=index<waiting&&travel>=0;
              const moving=(travel%1)*Math.max(0,distance-.5);
              person.position.set(index%2?.34:-.34,Math.sin(moving*8)*.035,exit?distance-.25-moving:moving+.25);
              person.rotation.y=exit?Math.PI:0;
            });
          }
        }
      }
      const aileron=replay||f.tow?0:(f.manualControls?.roll??0);
      model.userData.surfaces.forEach((part,i)=>part.rotation.x=-f.flaps*.16+aileron*(i===0?-.22:.22));
      if(cameraMode===0||f.ended){
        camera.up.set(0,1,0);
        if(tug.visible){
          chaseHeading=null;
          camera.position.copy(tug.position).addScaledVector(dir,5);
          camera.position.x+=Math.cos(f.heading)*15;
          camera.position.z+=Math.sin(f.heading)*15;
          camera.position.y+=5.8;
          camera.lookAt(tug.position.x-dir.x*4,tug.position.y+1.7,tug.position.z-dir.z*4);
        }else if(f.ended){
          const crashDist=profile.geometry[0]*2.8+18;
          const cx=pos.x-Math.sin(chaseHeading??heading)*crashDist;
          const cz=pos.z+Math.cos(chaseHeading??heading)*crashDist;
          const groundAtCam=renderedGround(cx,cz);
          camera.position.set(cx,Math.max(pos.y+8.5,groundAtCam+4.8),cz);
          camera.lookAt(pos.x,pos.y+1.5,pos.z);
        }else{
          if(chaseHeading===null||!continuous||replay) chaseHeading=heading;
          chaseHeading+=wrapAngle(heading-chaseHeading)*(1-Math.exp(-dt*5.5));
          const distance=profile.geometry[0]*(profile.helicopter?3.1:profile.id==='b773'?2.7:5);
          camera.position.set(pos.x-Math.sin(chaseHeading)*distance,
            pos.y+profile.gearHeight*4,pos.z+Math.cos(chaseHeading)*distance);
          camera.lookAt(pos.x+dir.x*12,pos.y+Math.sin(pitch)*8,pos.z+dir.z*12);
        }
      }else{
        const airliner=twoSeats(profile);
        const panel=cockpitView.preset===(airliner?2:1);
        const half=profile.geometry[0],radius=profile.geometry[1];
        const seat=airliner?(cockpitView.preset===1?.70:-.70):0;
        const height=profile.role?(airliner?radius*.17+.64:.68):radius*.85;
        const setback=airliner?(profile.id==='b773'?.86:.64):0;
        cockpitEye.set(panel&&airliner?-.28:seat,height-(panel?.08:0),
          -half*(profile.role?.56:.30)+setback+(panel?.26:0));
        if(profile.helicopter)cockpitEye.set(.42,.60,panel?-.92:-.65);
        if(model.userData.cockpitEye){const eye=model.userData.cockpitEye;cockpitEye.set(eye.x,eye.y,eye.z+(panel?.14:0));}
        camera.position.copy(cockpitEye.applyQuaternion(model.quaternion).add(pos));
        cockpitAngles.set(cockpitView.pitch-(panel?(airliner?.24:.31):0),cockpitView.yaw,0);
        lookRotation.setFromEuler(cockpitAngles);
        cockpitOrientation.copy(model.quaternion).multiply(lookRotation);
        cockpitAim.set(0,1,0).applyQuaternion(cockpitOrientation);
        camera.up.copy(cockpitAim);
        cockpitAim.set(0,0,-1).applyQuaternion(cockpitOrientation).add(camera.position);
        camera.lookAt(cockpitAim);
      }
      if(crashShake>0.005){
        const s=crashShake*3.8;
        camera.position.x+=(Math.random()-.5)*s;
        camera.position.y+=(Math.random()-.5)*s;
        camera.position.z+=(Math.random()-.5)*s;
        crashShake*=Math.exp(-dt*2.8);
      }
      const watchingCargo=cargoLoader.visible||(profile.antonov&&f.noseDoor&&f.ground&&!f.cabinView);
      if(cameraMode===0&&watchingCargo){
        const door=new THREE.Vector3(f.sideDoor?-model.userData.radius:0,2,
          f.sideDoor?model.userData.sideDoor.position.z:-model.userData.half*.78);
        const eye=door.clone().add(new THREE.Vector3(-24,9,f.sideDoor?7:-20));
        camera.position.copy(eye.applyQuaternion(model.quaternion).add(pos));
        camera.lookAt(door.applyQuaternion(model.quaternion).add(pos));
      }
      if(f.service&&f.cabinView){
        const window=f.cabinView==='window';
        const eye=new THREE.Vector3(window?profile.geometry[1]-.4:profile.centerSeats?.89:0,.68,2);
        const look=window?new THREE.Vector3(30,-1,0):new THREE.Vector3(0,.2,-profile.geometry[0]*.55);
        camera.position.copy(eye.applyQuaternion(model.quaternion).add(pos));
        camera.up.set(0,1,0);
        camera.lookAt(look.applyQuaternion(model.quaternion).add(pos));
      }else if(profile.role&&f.cabinView&&f.ground){
        const eye=new THREE.Vector3(.23,.92,18).applyQuaternion(model.quaternion).add(pos);
        camera.position.copy(eye);camera.up.set(0,1,0);
        camera.lookAt(pos.clone().addScaledVector(dir,11).add(new THREE.Vector3(0,.44,0)));
      }
      if(cameraMode===0||f.ended){
        camera.position.y=Math.max(camera.position.y,renderedGround(camera.position.x,camera.position.z)+1.6);
      }
      const speeds=flightSpeeds(f);
      const knots=Math.round(speeds.ias*knotsPerMps), live=!f.regional||f.battery;
      if(now>=nextInstrumentDraw){
        nextInstrumentDraw=now+80;
        drawInstruments(f,profile,speeds,knots,live);
        approachCallouts(f);
        drawLandingCard(f,speeds);
        drawWaypointChip(f);
      }
      attitudePanel.hidden=!live||Boolean(f.cabinView)||Boolean(f.tow);
      glassCanvas.hidden=attitudePanel.hidden;
      if(!attitudePanel.hidden){
        if(attitudeMode!=='clear') attitude.draw(f,pitch,bank,heading,attitudeCanvas.clientWidth,attitudeMode);
        glassReadouts.draw(f,speeds,cockpitActive()?'駕駛艙':'追蹤視角');
      }
      if(!f.regional&&!f.ground&&f.waypoint<4&&Math.hypot(legacyRoute[f.waypoint].x-f.x,legacyRoute[f.waypoint].z-f.z)<420) f.waypoint++;
      const target=f.regional?activeTarget(f):legacyRoute[f.waypoint];
      if(!paused&&++trailFrame%60===0){trail.push({x:f.x,z:f.z});if(trail.length>140) trail.shift();}
      const statusBox=byId('status');
      statusBox.hidden=Boolean(f.tactical&&!paused)||!byId('gateGuide').hidden&&!paused&&!f.towMessage;
      const hint=status(f,knots,target);
      const statusText=!paused&&approachGates.visible&&gateProgress.flashUntil>f.elapsed?
        hint+' · +100 分 ×'+gateProgress.combo:hint;
      if(statusBox.textContent!==statusText) statusBox.textContent=statusText;
      statusBox.classList.toggle('practice-status',statusText.startsWith('起飛 ')||Boolean(f.approach&&!f.voyage));
      statusBox.classList.toggle('coach-warning',statusText.startsWith('起飛警告'));
      const readyToTowIn=!f.aircraft.helicopter&&arrivalTowReady(f);
      byId('towControls').hidden=!f.tow&&!readyToTowIn;
      byId('startGateTow').hidden=!readyToTowIn;
      byId('startGateTow').disabled=paused||Boolean(replay);
      const cargo=f.mission==='cargo';
      const towLabel=cargo?'拖往貨運機位':'拖往機位';
      if(byId('startGateTow').textContent!==towLabel) byId('startGateTow').textContent=towLabel;
      const skipTowLabel=f.tow?.arrival||readyToTowIn?(cargo?'跳至貨運機位':'跳至機位'):'跳至跑道';
      if(byId('skipRunwayTow').textContent!==skipTowLabel) byId('skipRunwayTow').textContent=skipTowLabel;
      byId('skipRunwayTow').disabled=paused||Boolean(replay);
      drawFlightNext(f);
      if(now>=nextNavDraw){drawNav(f,target);nextNavDraw=now+100;}
    }else{
      approachGates.visible=false;
      taxiLamp.intensity=0;
      const airport=planPreviewAirport||selectedAirport('departure');
      model.userData.passengerCabin?.update(null,dt);
      const p=profile.role?airportPoint(airport,230,0):parkingPoint(airport);
      if(!hangarMode) updateTerrain(airport.x,airport.z);
      model.userData.gear.scale.y=1;model.userData.gear.visible=true;
      model.position.set(p.x,airport.elevation+profile.gearHeight+(hangarMode?.12:0),p.z);
      if(hangarMode) hangarStage.position.set(p.x,airport.elevation,p.z);
      model.rotation.set(0,now*.00045,0);
      camera.up.set(0,1,0);
      camera.position.set(p.x-21,airport.elevation+8,p.z+16);
      camera.lookAt(p.x,airport.elevation+profile.gearHeight,p.z);
      const inspection=previewInspection;
      if(profile.helicopter){
        model.userData.updateHelicopter(null,dt,now,['panel','night','cabin'].includes(inspection),false);
        if(['panel','night','cabin'].includes(inspection)){
          model.visible=false;model.rotation.set(0,0,0);
          const data=model.userData;data.cabin.quaternion.identity();
          camera.position.copy(model.position).add(new THREE.Vector3(.42,.60,-.65));
          camera.lookAt(camera.position.x,camera.position.y-.1,camera.position.z-10);
        }else if(hangarMode){
          model.rotation.set(0,0,0);
          const station={nose:[0,3,-18],side:[19,4,0],tail:[0,4,18],belly:[0,-9,4]}[inspection];
          const angle=hangarYaw??now*.0003;
          const offset=station?new THREE.Vector3(...station):new THREE.Vector3(Math.sin(angle)*18,18*hangarElevation,Math.cos(angle)*18);
          camera.position.copy(model.position).addScaledVector(offset,hangarZoom);camera.lookAt(model.position);
        }
      }
      if(profile.role){
        const data=model.userData;
        data.updateFighterDeck?.(null,now);
        const h=data.half;
        const showCargo=hangarMode&&inspection==='cargoDoor';
        animateCargoDoors(data,showCargo&&!profile.sideCargo,showCargo&&Boolean(profile.sideCargo),dt);
        const station={nose:[0,3,-2.9],side:[2.8,3,0],tail:[0,3,2.9],belly:[.3,-9,2.6]}[inspection];
        if(inspection==='orbit'){
          if(hangarMode){
            const angle=hangarYaw??now*.00038;
            model.rotation.set(0,0,0);
            camera.position.set(p.x+Math.sin(angle)*h*2.32,model.position.y+h*hangarElevation,p.z+Math.cos(angle)*h*2.32);
          }else camera.position.set(p.x-h*1.62,model.position.y+h*.64,p.z+h*1.42);
          camera.lookAt(model.position);
        }else if(showCargo){
          model.rotation.set(0,0,0);
          const doorZ=p.z+(profile.sideCargo?data.sideDoor.position.z:-h*.82);
          camera.position.set(p.x-25,model.position.y+9,doorZ-(profile.sideCargo?6:19));
          camera.lookAt(p.x,model.position.y-1,doorZ);
        }else{
          model.rotation.set(0,0,0);
          if(inspection==='belly'){
            model.position.y+=16;
            camera.lookAt(model.position);
          }
          if(station) camera.position.set(p.x+station[0]*h,model.position.y+station[1]*(inspection==='belly'?1:h*.10),p.z+station[2]*h);
          if(station) camera.lookAt(model.position);
          if(['panel','night','cabin'].includes(inspection)){
            model.visible=false;data.cabin.visible=true;
            data.cabin.position.copy(model.position);data.cabin.quaternion.identity();
            const interior=inspection==='cabin'&&profile.role!=='fighter';
            camera.position.copy(model.position).add(new THREE.Vector3(.20,interior?.88:profile.role==='fighter'?.68:data.radius*.17+.62,interior?h*.39:-h*.56));
            if(data.cockpitEye){const eye=data.cockpitEye;camera.position.copy(model.position).add(new THREE.Vector3(eye.x,eye.y,eye.z));}
            camera.lookAt(p.x,model.position.y+(interior?.45:.20),interior?p.z-h*.44:p.z-h*.72);
            if(profile.id==='b773'&&!interior){
              camera.position.set(p.x-.72,model.position.y+data.radius*.17+.60,p.z-h*.56+1.20);
              camera.lookAt(p.x-.38,model.position.y+data.radius*.17+.14,p.z-h*.56-1.31);
            }
          }
        }
      }
      const night=profile.role&&inspection==='night';
      if(night){ambient.intensity=.25;sunlight.intensity=.08;}
      else if(previewNight) activeDay=setEnvironment();
      previewNight=Boolean(night);
      if(hangarMode&&model.visible&&inspection!=='belly'){
        placeGroundShadow(aircraftShadow,p.x,p.z,airport.elevation,0,
          profile.geometry[2]*2.12,profile.geometry[0]*2.15,0);
      }
    }
    const px=flight?.x??0,pz=flight?.z??0;
    for(const {group,airport} of airportGroups) group.visible=!hangarMode&&
      (Math.hypot(px-airport.x,pz-airport.z)<24000||!flight&&planPreviewAirport===airport);
    if(!flight&&previewInspection.startsWith('tour-')){
      models.forEach(model=>{model.visible=false;if(model.userData.cabin)model.userData.cabin.visible=false;});
      const tour=previewInspection;
      const airport=planPreviewAirport||selectedAirport('departure');
      if(tour==='tour-terminal'||tour==='tour-runway'||tour==='tour-landside'){
        const apron=airport.apron, half=airport.length/2;
        const terminal=tour==='tour-terminal';
        const landside=tour==='tour-landside';
        const eye=landside?airportPoint(airport,155,apron+Math.sign(apron)*210):
          terminal?airportPoint(airport,-122,apron*.62):airportPoint(airport,-half+14,0);
        const target=landside?airportPoint(airport,25,apron+Math.sign(apron)*98):
          terminal?airportPoint(airport,65,jetwayWalls.get(airport.code)):airportPoint(airport,-half+300,0);
        camera.position.set(eye.x,airport.elevation+(landside?32:terminal?27:21),eye.z);
        camera.up.set(0,1,0);
        camera.lookAt(target.x,airport.elevation+(landside?4:terminal?5:0),target.z);
      }else{
        const tours={
          'tour-apron':[25.0652,121.5507,28,25.0646,121.5527,10],
          'tour-river':[25.0787,121.5531,280,25.0742,121.5475,12],
          'tour-city':[25.0262,121.5534,650,25.0351,121.5649,190],
          'tour-glass':[25.0377,121.5622,160,25.0396,121.5642,95],
          'tour-downtown':[25.0401,121.5047,550,25.0470,121.5160,85],
          'tour-woods':[25.1122,121.5770,34,25.1132,121.5777,12]
        };
        const t=tours[tour],eye=geoPoint(t[0],t[1]),target=geoPoint(t[3],t[4]);
        camera.position.set(eye.x,terrainHeight(eye.x,eye.z)+t[2],eye.z);
        camera.up.set(0,1,0);
        camera.lookAt(target.x,terrainHeight(target.x,target.z)+t[5],target.z);
      }
    }
    const viewerX=flight?.x??selectedAirport('departure').x;
    const viewerZ=flight?.z??selectedAirport('departure').z;
    for(const detail of airportDetails)detail.update(camera.position.x,camera.position.z,activeDay,renderingQuality());
    taipeiCity.root.visible=!hangarMode;
    if(!renderer.instrumentOnly&&!hangarMode)taipeiCity.update(dt,camera.position.x,camera.position.z,
      renderingQuality(),activeDay,byId('weather').value==='wet',paused||Boolean(replay));
    blocks.visible=!(detailedScenery&&sceneryLayers.visible);
    cityWall.emissiveIntensity=(1-activeDay)*.85;
    sunlight.target.position.set(viewerX,model.position.y,viewerZ);
    sunlight.position.copy(sunlight.target.position).add(sunDirection);
    if(renderer.shadowMap.enabled&&activeDay>.18&&!hangarMode) aircraftShadow.visible=false;
    if(sceneryBuild&&(touchControls.mode.value==='desktop'||renderingQuality()!=='low')){
      const budget=performance.now()+3;
      try{
        do {
          if(sceneryBuild.next().done){sceneryBuild=null;break;}
        }while(performance.now()<budget);
      }catch(error){sceneryUnavailable(error);}
    }
    if(detailedScenery&&sceneryLayers.visible&&!hangarMode){
      const {x,y,z}=camera.position;
      const heightAboveGround=y-renderedGround(x,z);
      const groundTraffic=heightAboveGround<1500;
      detailedScenery.plants.update(x,z,renderingQuality(),heightAboveGround<3200,taipeiCity.stats?.maskRevision??0);
      detailedScenery.region.update(x,z,renderingQuality(),dt,activeDay,groundTraffic);
      detailedScenery.taipei.update(dt,viewerX,viewerZ,activeDay,byId('weather').value==='wet',
        paused||Boolean(replay),renderingQuality(),groundTraffic);
    }
    airlinerDetails[profile.id]?.update(flight,now,flight?activeDay:previewInspection==='night'?0:1);
    flightAudio.update(flight,cameraMode===1,audioEnabled&&!paused);
    glassCanvas.style.opacity=cockpitActive()&&profile.role==='fighter'?'0':'1';
    const panelView=cockpitActive()&&cockpitView.preset===(twoSeats(profile)?2:1);
    let viewFov=cockpitActive()?clamp((panelView?53:69)+cockpitView.zoom,34,86):
      !flight&&['panel','night'].includes(previewInspection)?82:64;
    if(hangarMode&&model.visible&&previewInspection!=='cargoDoor'){
      const [half,,span]=profile.geometry;
      const halfWidth=['nose','tail'].includes(previewInspection)?span:Math.max(half,span);
      const distance=camera.position.distanceTo(model.position);
      viewFov=clamp(2*Math.atan(halfWidth/(distance*camera.aspect*.67))/rad,24,104);
    }
    if(hangarMode) viewFov=clamp(2*Math.atan(Math.tan(viewFov*rad/2)/hangarZoom)/rad,19,115);
    if(model.userData.closeDetails){
      const distance=Math.max(1,camera.position.distanceTo(model.position));
      const apparentSize=innerHeight*model.userData.half/(distance*Math.tan(viewFov*rad/2));
      model.userData.closeDetails.visible=hangarMode||apparentSize>145;
    }
    if(camera.fov!==viewFov){camera.fov=viewFov;camera.updateProjectionMatrix();}
    drawMouseYoke();
    updateTaiwanOverview(flight);
    drawAirportLabel(flight);
    const weather=byId('weather').value;
    scene.fog.density=weather==='fog'?.00064:weather==='wet'?.000065:
      THREE.MathUtils.lerp(.000034,.000007,clamp(((flight?.y||0)-2400)/6600,0,1));
    if(renderer.instrumentOnly&&flight){
      camera.position.set(flight.x,flight.y+1.4,flight.z);
      camera.rotation.set(flight.pitch,-flight.heading,-flight.bank,'YXZ');
      renderer.draw(flight,camera,approachGates,activeDay);
    }else if(!renderer.instrumentOnly) atmosphericSky.update(camera,dt,renderingQuality());
    crashVFX.update(dt,renderedGround);
    if(flight) contrailVFX.update(flight,dt,now);
    tacticalView.render(flight,dt,now,qualitySelect.value==='low'||touchControls.mode.value==='mobile');
    if(overviewActive) taiwanOverview.draw(renderer,flight);
    else renderer.render(scene,camera);
  }
  let tacticalSelection='radar';
  for(const [id,mission] of Object.entries(tacticalScenarios)){
    const card=document.createElement('button');
    const name=document.createElement('strong'), details=document.createElement('small'), brief=document.createElement('small');
    name.textContent=mission.name;
    details.textContent='SF-16 · '+mission.difficulty+' · '+mission.minutes+' 分 · '+mission.base+' 金幣';
    brief.textContent=(id==='intercept'?'跑道起飛':'空中開始')+' · '+mission.brief;
    card.type='button';
    card.dataset.scenario=id;
    card.setAttribute('aria-pressed',String(id===tacticalSelection));
    card.append(name,details,brief);
    card.onclick=()=>{
      tacticalSelection=id;
      for(const option of byId('tacticalCards').children) option.setAttribute('aria-pressed',String(option===card));
      drawPlan();
    };
    byId('tacticalCards').append(card);
  }
  const tacticalView=createTacticalView(scene,camera,{
    paused:()=>paused,
    retry:()=>start(false,true),
    menu,
    activateAudio:()=>{if(audioEnabled) flightAudio.start();},
    sound:frequency=>{if(audioEnabled) flightAudio.effect(frequency,.18);},
    radarSound:phase=>{if(audioEnabled) flightAudio.radarTone(phase);},
    replayPlane:([x,y,z,heading,pitch,bank],inside)=>{
      const model=aircraftModel(flight.aircraft);
      model.visible=!inside;
      model.position.set(x,y,z);
      model.rotation.set(pitch,-heading,-bank,'YXZ');
    }
  });
  drawPlan();showLog();updateReplayButton();activeDay=setEnvironment();
  byId('time').addEventListener('change',()=>{activeDay=setEnvironment();});
  byId('weather').addEventListener('change',()=>{activeDay=setEnvironment();});
  requestAnimationFrame(render);
  byId('startupNotice').style.display='none';
  byId('startupNotice').hidden=true;
  syncSceneryMode();
}









