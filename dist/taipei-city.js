'use strict';
// Offline OSM footprints, locally generated facades and original landmark models.
// City streaming is independent of the optional desktop forest/road layers.
function createTaipeiCity(scene,ground,airports){
  const root=new THREE.Group();root.name='Taipei 3D city';scene.add(root);
  const loaded=new Map(),pending=new Set(),failed=new Map();
  const masks=new Map();
  function mask(group,x0,z0,x1,z1){
    const rect=[x0,z0,x1,z1];
    for(let x=Math.floor(x0/100);x<=Math.floor(x1/100);x++)for(let z=Math.floor(z0/100);z<=Math.floor(z1/100);z++){
      const key=x+':'+z;if(!masks.has(key))masks.set(key,new Set());
      masks.get(key).add(rect);group.userData.masks.push([key,rect]);
    }
  }
  function blocked(x,z,radius){
    for(let cx=Math.floor((x-radius)/100);cx<=Math.floor((x+radius)/100);cx++)for(let cz=Math.floor((z-radius)/100);cz<=Math.floor((z+radius)/100);cz++){
      const cell=masks.get(cx+':'+cz);if(cell)for(const r of cell)if(x+radius>r[0]&&x-radius<r[2]&&z+radius>r[1]&&z-radius<r[3])return true;
    }
    return false;
  }
  const stats={buildings:0,tiles:0,roads:0,loading:0,vehicles:0,maskRevision:0};
  let index=null,indexRequest=false,nextScan=0,clock=0,jobs=[],day=1;
  const bounds=[24.97,121.43,25.14,121.65];
  const inside=(lat,lon)=>lat>=bounds[0]&&lat<=bounds[2]&&lon>=bounds[1]&&lon<=bounds[3];
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#eee9e0';ctx.fillRect(0,0,256,128);
  for(let i=0;i<4;i++){
    ctx.fillStyle=i%2?'#455e69':'#71858c';ctx.fillRect(i*64+9,16,45,72);
    ctx.fillStyle='#b4c8cb';ctx.fillRect(i*64+11,18,20,65);
    ctx.fillStyle='#c7c3b8';ctx.fillRect(i*64+29,16,3,72);
    ctx.fillStyle='#999d98';ctx.fillRect(i*64+8,96,47,12);
  }
  const facade=new THREE.CanvasTexture(canvas);facade.colorSpace=THREE.SRGBColorSpace;
  facade.wrapS=facade.wrapT=THREE.RepeatWrapping;facade.anisotropy=8;
  const night=document.createElement('canvas');night.width=256;night.height=128;
  const ink=night.getContext('2d');ink.fillStyle='#000';ink.fillRect(0,0,256,128);
  for(let i=0;i<4;i++){ink.fillStyle=i===1?'#d7b37c':'#080c10';ink.fillRect(i*64+11,18,40,66);}
  const lights=new THREE.CanvasTexture(night);lights.wrapS=lights.wrapT=THREE.RepeatWrapping;
  const wall=new THREE.MeshStandardMaterial({color:0xffffff,map:facade,vertexColors:true,roughness:.83,
    emissiveMap:lights,emissive:0xffd6a2,emissiveIntensity:0});
  const roof=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.88});
  // Procedural PBR Multi-Lane Asphalt, Curb, Roughness & Illuminated Night Streetlamp Texture
  function makeRoadTextures(){
    const dayC=document.createElement('canvas');dayC.width=512;dayC.height=512;
    const d=dayC.getContext('2d');
    d.fillStyle='#8d9092';d.fillRect(0,0,512,512); // outer concrete curb & shoulder
    d.fillStyle='#5c6064';d.fillRect(16,0,480,512); // curb bevel shadow
    d.fillStyle='#31353a';d.fillRect(24,0,464,512); // main asphalt carriageways
    for(let i=0;i<7200;i++){
      const px=24+((i*173)%464),py=(i*311)%512;
      d.fillStyle=i%3===0?'#3b4046':i%2===0?'#272a2e':'#43474d';
      d.fillRect(px,py,2,2);
    }
    // Longitudinal rubber tire wear channels inside 4 lanes
    for(const lx of [102,190,322,410]){
      const wg=d.createLinearGradient(lx-32,0,lx+32,0);
      wg.addColorStop(0,'rgba(22,25,28,0)');
      wg.addColorStop(.32,'rgba(18,20,23,0.42)');
      wg.addColorStop(.5,'rgba(26,29,33,0.12)');
      wg.addColorStop(.68,'rgba(18,20,23,0.42)');
      wg.addColorStop(1,'rgba(22,25,28,0)');
      d.fillStyle=wg;d.fillRect(lx-32,0,64,512);
    }
    // Shoulder solid white fog lines
    d.fillStyle='#e8e6d8';d.fillRect(34,0,6,512);d.fillRect(472,0,6,512);
    // Double yellow Taiwan center divider
    d.fillStyle='#e8b838';d.fillRect(249,0,5,512);d.fillRect(258,0,5,512);
    // Crisp dashed white lane dividers
    d.fillStyle='#ecece4';
    for(let y=16;y<512;y+=128){d.fillRect(142,y,5,68);d.fillRect(365,y,5,68);}

    const nightC=document.createElement('canvas');nightC.width=512;nightC.height=512;
    const n=nightC.getContext('2d');
    n.fillStyle='#000';n.fillRect(0,0,512,512);
    // Warm sodium & LED streetlamp pools along both shoulders
    for(const sy of [128,384]){
      for(const sx of [52,460]){
        const g=n.createRadialGradient(sx,sy,4,sx,sy,155);
        g.addColorStop(0,'rgba(255,222,168,0.88)');
        g.addColorStop(0.28,'rgba(255,180,94,0.46)');
        g.addColorStop(0.68,'rgba(230,132,58,0.14)');
        g.addColorStop(1,'rgba(0,0,0,0)');
        n.fillStyle=g;n.fillRect(0,sy-160,512,320);
      }
    }
    // Nighttime illuminated center reflectors & directional headlight/taillight streaks
    n.fillStyle='rgba(255,208,90,0.42)';n.fillRect(250,0,12,512);
    for(let y=28;y<512;y+=128){
      n.fillStyle='rgba(255,244,210,0.85)';n.fillRect(92,y,5,9);n.fillRect(114,y,5,9);
      n.fillStyle='rgba(255,56,42,0.85)';n.fillRect(390,y+44,5,8);n.fillRect(412,y+44,5,8);
      n.fillStyle='rgba(255,244,210,0.65)';n.fillRect(178,y+64,4,8);n.fillRect(198,y+64,4,8);
      n.fillStyle='rgba(255,56,42,0.70)';n.fillRect(308,y+8,4,8);n.fillRect(328,y+8,4,8);
    }

    const roughC=document.createElement('canvas');roughC.width=256;roughC.height=256;
    const rc=roughC.getContext('2d');rc.fillStyle='#cfcfcf';rc.fillRect(0,0,256,256);
    for(const lx of [51,95,161,205]){rc.fillStyle='#727272';rc.fillRect(lx-10,0,20,256);}

    const map=new THREE.CanvasTexture(dayC);map.wrapS=THREE.ClampToEdgeWrapping;map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
    const eMap=new THREE.CanvasTexture(nightC);eMap.wrapS=THREE.ClampToEdgeWrapping;eMap.wrapT=THREE.RepeatWrapping;eMap.colorSpace=THREE.SRGBColorSpace;eMap.anisotropy=4;
    const rMap=new THREE.CanvasTexture(roughC);rMap.wrapS=THREE.ClampToEdgeWrapping;rMap.wrapT=THREE.RepeatWrapping;
    return {map,eMap,rMap};
  }
  const roadTex=makeRoadTextures();
  const asphalt=new THREE.MeshStandardMaterial({color:0xffffff,map:roadTex.map,roughnessMap:roadTex.rMap,roughness:.86,emissive:0xffd89c,emissiveMap:roadTex.eMap,emissiveIntensity:0,side:THREE.DoubleSide});
  const concreteCurb=new THREE.MeshStandardMaterial({color:0xb9bec2,roughness:.85,vertexColors:true});
  const stripe=new THREE.MeshStandardMaterial({color:0xf3efd9,roughness:.82,emissive:0xffebb5,emissiveIntensity:0,side:THREE.DoubleSide});
  const water=new THREE.MeshStandardMaterial({color:0x486f76,roughness:.3,metalness:.2,side:THREE.DoubleSide});
  for(const mat of [asphalt,stripe,water]){mat.polygonOffset=true;mat.polygonOffsetFactor=-3;mat.polygonOffsetUnits=-3;}
  const palette=['#9b7f6d','#b7ab8e','#8b9f9c','#8896a3','#ad9585','#c8c2b2','#96a08a','#929599'].map(c=>new THREE.Color(c));
  const roofPalette=['#85675a','#888a81','#496b67','#526675','#96745f','#92958c','#727d66','#626b73'].map(c=>new THREE.Color(c));
  const officeCanvas=document.createElement('canvas');officeCanvas.width=officeCanvas.height=256;
  const oi=officeCanvas.getContext('2d');
  const officeNight=document.createElement('canvas');officeNight.width=officeNight.height=256;
  const ni=officeNight.getContext('2d');ni.fillStyle='#000';ni.fillRect(0,0,256,256);
  const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=256;
  const ri=roughCanvas.getContext('2d');ri.fillStyle='#999';ri.fillRect(0,0,256,256);
  oi.fillStyle='#1c2429';oi.fillRect(0,0,256,256);
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const x=col*64,y=row*64;
    oi.fillStyle='#27333b';oi.fillRect(x+2,y+2,60,8);
    ri.fillStyle='#777';ri.fillRect(x+2,y+2,60,8);
    const reflection=oi.createLinearGradient(x+3,y+12,x+61,y+60);
    reflection.addColorStop(0,['#4b6e82','#5c8296','#436376','#648b9f'][(row+col)%4]);
    reflection.addColorStop(.48,'#1c3445');
    reflection.addColorStop(.52,'#244254');
    reflection.addColorStop(1,'#6b8fa1');
    oi.fillStyle=reflection;oi.fillRect(x+3,y+12,58,48);
    oi.fillStyle='#222b31';oi.fillRect(x+31,y+12,2,48);
    oi.fillStyle='#4c5d67';oi.fillRect(x+32,y+12,.8,48);
    ri.fillStyle='#292929';ri.fillRect(x+3,y+12,58,48);
    if((row*5+col*7)%9<4){
      const warm=(row+col)%3!==0;
      ni.fillStyle=warm?'#fce0b0':'#d2e8f7';
      ni.fillRect(x+5,y+14,54,44);
      ni.fillStyle=warm?'#fff4d8':'#f0f8ff';
      ni.fillRect(x+7,y+20,50,4);
      ni.fillRect(x+7,y+32,50,4);
      ni.fillRect(x+7,y+44,50,4);
    }
  }
  function repeatTexture(canvas,color=false){const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(color)t.colorSpace=THREE.SRGBColorSpace;return t;}
  const reflectedCity=document.createElement('canvas');reflectedCity.width=1024;reflectedCity.height=512;
  const reflected=reflectedCity.getContext('2d'),sky=reflected.createLinearGradient(0,0,0,512);
  sky.addColorStop(0,'#1c4270');sky.addColorStop(.36,'#497fa9');sky.addColorStop(.52,'#98bfd4');
  sky.addColorStop(.56,'#c8dbe4');sky.addColorStop(.60,'#4c5d68');sky.addColorStop(1,'#2c373d');
  reflected.fillStyle=sky;reflected.fillRect(0,0,1024,512);
  reflected.fillStyle='#3e4e58';
  reflected.beginPath();reflected.moveTo(0,307);
  for(let x=0;x<=1024;x+=32){reflected.lineTo(x,295-Math.sin(x*.02)*18-Math.cos(x*.007)*14);}
  reflected.lineTo(1024,350);reflected.lineTo(0,350);reflected.fill();
  for(let i=0;i<64;i++){
    const x=i*16,h=28+(i*53%135);reflected.fillStyle=['#556874','#6d808c','#485a65','#7a8e9b'][i%4];
    reflected.fillRect(x,300-h,13,h+120);
    reflected.fillStyle='#c8dbe2';for(let y=308-h;y<360;y+=8)reflected.fillRect(x+2,y,9,1.8);
  }
  const reflectedMap=new THREE.CanvasTexture(reflectedCity);reflectedMap.colorSpace=THREE.SRGBColorSpace;
  reflectedMap.mapping=THREE.EquirectangularReflectionMapping;
  const officeGlass=new THREE.MeshPhysicalMaterial({map:repeatTexture(officeCanvas,true),roughnessMap:repeatTexture(roughCanvas),
    color:0x36586c,metalness:.82,roughness:.22,clearcoat:1.0,clearcoatRoughness:.09,envMap:reflectedMap,envMapIntensity:1.15,
    emissiveMap:repeatTexture(officeNight),emissive:0xffdfab,emissiveIntensity:0,side:THREE.DoubleSide});
  const landmarks=new THREE.Group();landmarks.name='Taipei landmarks';root.add(landmarks);
  const landmarkSites=[
    {name:'臺北101',lat:25.03396,lon:121.56450,radius:53,height:508,type:'101'},
    {name:'新光摩天大樓',lat:25.04625,lon:121.51520,radius:44,height:245,type:'tower'},
    {name:'臺北大巨蛋',lat:25.04242,lon:121.55940,radius:151,height:74.5,type:'dome'},
    {name:'臺北小巨蛋',lat:25.05190,lon:121.55074,radius:115,height:42,type:'arena'},
    {name:'圓山大飯店',lat:25.07846,lon:121.52648,radius:83,height:87,type:'hotel'},
    {name:'臺北車站',lat:25.0478,lon:121.5170,radius:115,height:49,type:'station'},
    {name:'中正紀念堂',lat:25.0346,lon:121.5219,radius:55,height:70,type:'memorial'},
    {name:'臺北南山廣場',lat:25.03540,lon:121.56630,radius:55,height:272,type:'nanshan'},
    {name:'富邦信義A25',lat:25.03920,lon:121.56750,radius:46,height:266,type:'fubon'},
    {name:'國泰置地廣場',lat:25.04070,lon:121.56680,radius:48,height:212,type:'cathay'},
    {name:'陶朱隱園',lat:25.03780,lon:121.57140,radius:42,height:100,type:'taozhu'},
    {name:'美麗華百樂園摩天輪',lat:25.08330,lon:121.55740,radius:65,height:100,type:'miramar'},
    {name:'台北流行音樂中心',lat:25.05190,lon:121.59750,radius:68,height:45,type:'tmc'},
    {name:'板橋百揚大樓',lat:25.01250,lon:121.46550,radius:52,height:220,type:'megatower'}
  ];
  const glass=new THREE.MeshStandardMaterial({color:0x5e9e99,metalness:.48,roughness:.20,map:facade,
    envMap:reflectedMap,emissiveMap:lights,emissive:0xffd6a2,emissiveIntensity:0});
  const stone=new THREE.MeshStandardMaterial({color:0xc1c1ae,roughness:.82});
  const darkGlass=new THREE.MeshStandardMaterial({color:0x416572,roughness:.22,metalness:.58,map:facade,envMap:reflectedMap});
  const metal=new THREE.MeshStandardMaterial({color:0xa5aeb0,roughness:.4,metalness:.35});
  const red=new THREE.MeshStandardMaterial({color:0xa14735,roughness:.78});
  const gold=new THREE.MeshStandardMaterial({color:0xe1b866,roughness:.65});
  const whiteFrame=new THREE.MeshStandardMaterial({color:0xf0f3f5,roughness:.32,metalness:.25});
  const greenGarden=new THREE.MeshStandardMaterial({color:0x3b6e3f,roughness:.86});
  const ferrisGreen=new THREE.MeshStandardMaterial({color:0x22c55e,roughness:.35,metalness:.2,emissive:0x16a34a,emissiveIntensity:.65});
  const beaconMat=new THREE.MeshStandardMaterial({color:0xff1818,emissive:0xff2222,emissiveIntensity:1.2,roughness:.3});
  function add(parent,geometry,mat,x,y,z){
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function box(parent,mat,w,h,d,x,y,z){return add(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
  for(const site of landmarkSites){
    const p=geoPoint(site.lat,site.lon);Object.assign(site,p);
    if(typeof BuildingCollision!=='undefined'){const gy=ground(p.x,p.z);BuildingCollision.addCircle('tp:landmarks',p.x,p.z,site.radius*.55,gy+site.height,gy-2);}
    const group=new THREE.Group();group.name=site.name;group.position.set(p.x,ground(p.x,p.z),p.z);
    group.userData={height:site.height,source:'Original simplified landmark geometry; see TAIPEI-3D.txt'};landmarks.add(group);
    if(site.type==='101'){
      group.rotation.y=-.12;
      box(group,stone,150,24,120,-22,12,-22);
      box(group,glass,64,68,64,0,34,0);
      for(let tier=0;tier<8;tier++){
        const y=68+tier*44;
        const segment=add(group,new THREE.CylinderGeometry(38,30,44,4,1,false,Math.PI/4),glass,0,y+22,0);
        // Repeat windows by real section height rather than stretching one window.
        const uv=segment.geometry.attributes.uv;
        for(let n=0;n<uv.count;n++)uv.setXY(n,uv.getX(n)*20,uv.getY(n)*12);
        box(group,metal,56,1.2,56,0,y+43,0);
        for(const sx of [-1,1])for(const sz of [-1,1])box(group,metal,1.3,44,1.3,sx*25,y+22,sz*25);
      }
      box(group,glass,35,28,35,0,434,0);
      box(group,metal,22,12,22,0,454,0);
      add(group,new THREE.CylinderGeometry(1,4,48,12),metal,0,484,0);
      box(group,beaconMat,2.5,2.5,2.5,0,508,0);
    }else if(site.type==='tower'){
      box(group,stone,67,26,68,0,13,0);
      box(group,darkGlass,52,171,49,0,111.5,0);
      box(group,metal,45,22,43,0,208,0);
      add(group,new THREE.CylinderGeometry(12,28,26,4,1,false,Math.PI/4),metal,0,232,0);
      box(group,beaconMat,2,2,2,0,245,0);
    }else if(site.type==='dome'||site.type==='arena'){
      const big=site.type==='dome',w=big?260:177,d=big?208:136,h=big?74.5:42;
      box(group,stone,w,18,d,0,9,0);
      box(group,darkGlass,w+1,13,d+1,0,21,0);
      const dome=add(group,new THREE.SphereGeometry(1,48,20,0,Math.PI*2,0,Math.PI/2),metal,0,24,0);
      dome.scale.set(w*.52,h-24,d*.52);
      for(let x=-w*.43;x<w*.44;x+=12)box(group,stone,.8,23,d+2,x,12,0);
    }else if(site.type==='station'){
      box(group,stone,190,29,130,0,14.5,0);
      box(group,darkGlass,191,12,131,0,23,0);
      for(let level=0;level<3;level++){
        const g=add(group,new THREE.CylinderGeometry(60-level*8,78-level*8,8,4,1,false,Math.PI/4),red,0,32+level*7,0);
        g.scale.set(1.85,1,1.2);
      }
    }else if(site.type==='memorial'){
      box(group,stone,88,11,88,0,5.5,0);box(group,stone,50,39,50,0,30.5,0);
      for(let level=0;level<2;level++)add(group,new THREE.CylinderGeometry(13-level*5,38-level*6,12,8,1,false,Math.PI/8),darkGlass,0,54+level*10,0);
    }else if(site.type==='hotel'){
      box(group,stone,124,65,56,0,32.5,0);
      for(let floor=0;floor<12;floor++){
        box(group,red,129,1.3,61,0,6+floor*5,0);
        for(let col=-5;col<=5;col++)box(group,red,1.4,4.2,59,col*11,8+floor*5,0);
      }
      const top=add(group,new THREE.CylinderGeometry(42,77,18,4,1,false,Math.PI/4),red,0,76,0);
      top.scale.z=.57;box(group,gold,111,2,5,0,86,0);
    }else if(site.type==='nanshan'){
      group.rotation.y=-0.12;
      box(group,stone,76,38,64,0,19,-10);
      box(group,officeGlass,78,14,66,0,7,-10);
      box(group,officeGlass,32,26,30,22,13,26);
      add(group,new THREE.CylinderGeometry(14,22,26,6),officeGlass,22,13,26);
      box(group,officeGlass,54,82,42,0,79,-10);
      for(const sx of [-27,27])for(const sz of [-31,11])box(group,metal,1.5,82,1.5,sx,79,sz);
      box(group,darkGlass,52,6,40,0,123,-10);
      box(group,officeGlass,48,72,38,0,159,-10);
      for(const sx of [-24,24])for(const sz of [-29,9])box(group,metal,1.3,72,1.3,sx,159,sz);
      box(group,officeGlass,44,55,34,0,222.5,-10);
      box(group,metal,40,2,30,0,251,-10);
      const crown1=add(group,new THREE.CylinderGeometry(16,22,20,4,1,false,Math.PI/4),officeGlass,0,261,-10);
      crown1.scale.set(1.1,1,0.8);
      box(group,metal,14,10,12,0,266,-10);
      box(group,beaconMat,2.5,2.5,2.5,0,272,-10);
    }else if(site.type==='fubon'){
      group.rotation.y=-0.12;
      box(group,officeGlass,52,18,40,0,9,0);
      box(group,officeGlass,44,222,32,0,129,0);
      for(const sx of [-23,23])for(const sz of [-17,17]){
        box(group,whiteFrame,2.5,248,2.5,sx,124,sz);
      }
      for(let f=1;f<=5;f++){
        box(group,whiteFrame,47,2,35,0,f*44,0);
        box(group,whiteFrame,1.2,1.2,34,-23,f*44-22,0);
        box(group,whiteFrame,1.2,1.2,34,23,f*44-22,0);
      }
      box(group,whiteFrame,46,26,2,0,253,-17);
      box(group,whiteFrame,46,26,2,0,253,17);
      box(group,whiteFrame,2,26,34,-23,253,0);
      box(group,whiteFrame,2,26,34,23,253,0);
      box(group,darkGlass,28,18,20,0,249,0);
      box(group,beaconMat,2.5,2.5,2.5,0,266,0);
    }else if(site.type==='cathay'){
      group.rotation.y=-0.12;
      box(group,stone,78,38,62,0,19,0);
      box(group,officeGlass,80,14,64,0,7,0);
      box(group,officeGlass,52,72,38,0,74,0);
      for(const sx of [-26,26])box(group,metal,1.4,160,1.4,sx,118,0);
      box(group,officeGlass,48,55,34,0,137.5,0);
      box(group,metal,50,2,36,0,110,0);
      box(group,officeGlass,44,33,30,0,181.5,0);
      box(group,metal,46,2,32,0,165,0);
      box(group,darkGlass,46,12,32,0,204,0);
      box(group,metal,48,2,34,0,210,0);
      box(group,beaconMat,2.5,2.5,2.5,0,212,0);
    }else if(site.type==='taozhu'){
      group.rotation.y=-0.12;
      add(group,new THREE.CylinderGeometry(36,38,6,24),stone,0,3,0);
      add(group,new THREE.CylinderGeometry(9,9,96,16),darkGlass,0,51,0);
      for(let level=0;level<20;level++){
        const y=8+level*4.4;
        const angle=level*(Math.PI/40);
        const wing=add(group,new THREE.BoxGeometry(44,3.2,14),officeGlass,0,y,0);
        wing.rotation.y=angle;
        const cos=Math.cos(angle),sin=Math.sin(angle);
        const g1=add(group,new THREE.BoxGeometry(10,1.4,13.6),greenGarden,17*cos,y-0.6,-17*sin);
        g1.rotation.y=angle;
        const g2=add(group,new THREE.BoxGeometry(10,1.4,13.6),greenGarden,-17*cos,y-0.6,17*sin);
        g2.rotation.y=angle;
      }
      const pergola=add(group,new THREE.BoxGeometry(46,3,16),whiteFrame,0,98,0);
      pergola.rotation.y=Math.PI/2;
      box(group,beaconMat,2,2,2,0,100,0);
    }else if(site.type==='miramar'){
      box(group,stone,96,28,70,0,14,0);
      box(group,officeGlass,88,14,62,0,21,0);
      box(group,stone,90,2,64,0,29,0);
      box(group,whiteFrame,3,38,3,-18,48,0);
      box(group,whiteFrame,3,38,3,18,48,0);
      box(group,whiteFrame,38,3,3,0,46,0);
      box(group,ferrisGreen,8,8,10,0,65,0);
      const segments=16,rOuter=35,rInner=24;
      for(let i=0;i<segments;i++){
        const a1=i*(Math.PI*2/segments),a2=(i+1)*(Math.PI*2/segments);
        const x1=rOuter*Math.cos(a1),y1=65+rOuter*Math.sin(a1);
        const x2=rOuter*Math.cos(a2),y2=65+rOuter*Math.sin(a2);
        const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);
        const rim=add(group,new THREE.BoxGeometry(len,1.4,1.4),ferrisGreen,(x1+x2)/2,(y1+y2)/2,0);
        rim.rotation.z=ang;
        const ix1=rInner*Math.cos(a1),iy1=65+rInner*Math.sin(a1);
        const ix2=rInner*Math.cos(a2),iy2=65+rInner*Math.sin(a2);
        const idx=ix2-ix1,idy=iy2-iy1,ilen=Math.hypot(idx,idy),iang=Math.atan2(idy,idx);
        const irim=add(group,new THREE.BoxGeometry(ilen,1,1),whiteFrame,(ix1+ix2)/2,(iy1+iy2)/2,0);
        irim.rotation.z=iang;
        if(i%2===0){
          const spoke=add(group,new THREE.BoxGeometry(rOuter,1,1),whiteFrame,x1/2,65+rOuter*Math.sin(a1)/2,0);
          spoke.rotation.z=a1;
        }
        box(group,ferrisGreen,2.8,3,3.4,x1,y1,0);
      }
      box(group,beaconMat,2,2,2,0,101,0);
    }else if(site.type==='tmc'){
      box(group,stone,110,4,86,0,2,0);
      box(group,officeGlass,80,12,64,0,8,0);
      box(group,darkGlass,74,22,58,0,18,0);
      const canopy=add(group,new THREE.CylinderGeometry(22,46,20,6),metal,0,28,0);
      canopy.scale.set(1.2,1,0.9);
      add(group,new THREE.ConeGeometry(18,16,5),metal,-12,38,-6);
      add(group,new THREE.ConeGeometry(15,14,6),officeGlass,14,36,8);
    }else if(site.type==='megatower'){
      add(group,new THREE.CylinderGeometry(38,42,28,24),stone,0,14,0);
      box(group,officeGlass,72,14,56,0,8,0);
      const towerBody=add(group,new THREE.CylinderGeometry(28,32,162,24),officeGlass,0,109,0);
      towerBody.scale.set(1.15,1,0.9);
      for(let f=1;f<=6;f++){
        const ring=add(group,new THREE.CylinderGeometry(28.4,28.4,1.8,24),metal,0,28+f*24,0);
        ring.scale.set(1.15,1,0.9);
      }
      add(group,new THREE.CylinderGeometry(21,27,16,20),officeGlass,0,198,0);
      add(group,new THREE.CylinderGeometry(13,19,12,16),metal,0,212,0);
      add(group,new THREE.CylinderGeometry(1,3,10,8),metal,0,220,0);
      box(group,beaconMat,2.5,2.5,2.5,0,223,0);
    }
    // One draw per material instead of hundreds of hotel columns/tower details.
    group.updateMatrixWorld(true);
    const batches=new Map();
    for(const child of [...group.children]){
      const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      if(!batches.has(child.material))batches.set(child.material,[]);
      batches.get(child.material).push(geometry);group.remove(child);child.geometry.dispose();
    }
    for(const [mat,parts] of batches){
      const geometry=new THREE.BufferGeometry();
      for(const [attribute,width] of [['position',3],['normal',3],['uv',2]]){
        const array=new Float32Array(parts.reduce((sum,g)=>sum+g.attributes.position.count*width,0));
        let offset=0;
        for(const part of parts){if(part.attributes[attribute])array.set(part.attributes[attribute].array,offset);offset+=part.attributes.position.count*width;}
        geometry.setAttribute(attribute,new THREE.BufferAttribute(array,width));
      }
      group.add(new THREE.Mesh(geometry,mat));parts.forEach(g=>g.dispose());
    }
  }
  const skipBuilding=(x,z)=>landmarkSites.some(s=>Math.abs(x-s.x)<s.radius&&Math.abs(z-s.z)<s.radius)||airports.some(a=>{
    if(Math.hypot(x-a.x,z-a.z)>a.length/2+500)return false;
    const p=runwayCoordinates(x,z,a);
    if(typeof airportSurroundingsContains==='function'&&airportSurroundingsContains(a,p))return true;
    return Math.abs(p.along)<a.length/2+80&&Math.abs(p.cross)<110;
  });
  function buffers(){return {p:[],n:[],uv:[],c:[]};}
  function tri(out,a,b,c,color,normal,uvs){
    const cr=color.r,cg=color.g,cb=color.b,nx=normal[0],ny=normal[1],nz=normal[2];
    const p=out.p,n=out.n,uv=out.uv,cl=out.c;
    p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
    n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
    if(uvs) uv.push(uvs[0][0],uvs[0][1],uvs[1][0],uvs[1][1],uvs[2][0],uvs[2][1]);
    else uv.push(a[0]*.25,a[2]*.25,b[0]*.25,b[2]*.25,c[0]*.25,c[2]*.25);
    cl.push(cr,cg,cb,cr,cg,cb,cr,cg,cb);
  }
  function triFlat(out,ax,ay,az,bx,by,bz,cx,cy,cz,cr,cg,cb,nx,ny,nz,u0,v0,u1,v1,u2,v2){
    out.p.push(ax,ay,az,bx,by,bz,cx,cy,cz);
    out.n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
    out.uv.push(u0,v0,u1,v1,u2,v2);
    out.c.push(cr,cg,cb,cr,cg,cb,cr,cg,cb);
  }
  const white=new THREE.Color(0xffffff);
  function mesh(group,data,mat,name){
    if(!data.p.length)return;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(data.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(data.c,3));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;group.add(m);
  }
  function emitUpTri(out,p0,p1,p2,y,cr,cg,cb){
    if((p1[1]-p0[1])*(p2[0]-p0[0])-(p1[0]-p0[0])*(p2[1]-p0[1])>0){
      triFlat(out,p0[0],y,p0[1],p1[0],y,p1[1],p2[0],y,p2[1],cr,cg,cb,0,1,0,p0[0]*.25,p0[1]*.25,p1[0]*.25,p1[1]*.25,p2[0]*.25,p2[1]*.25);
    }else{
      triFlat(out,p0[0],y,p0[1],p2[0],y,p2[1],p1[0],y,p1[1],cr,cg,cb,0,1,0,p0[0]*.25,p0[1]*.25,p2[0]*.25,p2[1]*.25,p1[0]*.25,p1[1]*.25);
    }
  }
  function polygon(out,points,y,color){
    const n=points.length,cr=color.r,cg=color.g,cb=color.b;
    if(n===3){
      emitUpTri(out,points[0],points[1],points[2],y,cr,cg,cb);
      return;
    }
    if(n===4){
      const p0=points[0],p1=points[1],p2=points[2],p3=points[3];
      const c0=(p1[0]-p0[0])*(p2[1]-p1[1])-(p1[1]-p0[1])*(p2[0]-p1[0]);
      const c1=(p2[0]-p1[0])*(p3[1]-p2[1])-(p2[1]-p1[1])*(p3[0]-p2[0]);
      const c2=(p3[0]-p2[0])*(p0[1]-p3[1])-(p3[1]-p2[1])*(p0[0]-p3[0]);
      const c3=(p0[0]-p3[0])*(p1[1]-p0[1])-(p0[1]-p3[1])*(p1[0]-p0[0]);
      if((c0>=0&&c1>=0&&c2>=0&&c3>=0)||(c0<=0&&c1<=0&&c2<=0&&c3<=0)){
        emitUpTri(out,p0,p1,p2,y,cr,cg,cb);
        emitUpTri(out,p0,p2,p3,y,cr,cg,cb);
        return;
      }
    }
    const contour=points.map(p=>new THREE.Vector2(p[0],p[1]));
    for(const ids of THREE.ShapeUtils.triangulateShape(contour,[])){
      emitUpTri(out,points[ids[0]],points[ids[1]],points[ids[2]],y,cr,cg,cb);
    }
  }
  function* build(key,data){
    const group=new THREE.Group();group.name='Taipei tile '+key;
    group.userData.masks=[];
    const BC=typeof BuildingCollision!=='undefined'?BuildingCollision:null;
    if(BC)BC.clearGroup('tp:'+key);
    const walls=buffers(),glazed=buffers(),roofs=buffers(),roads=buffers(),curbs=buffers(),lines=buffers(),waters=buffers();
    let built=0;
    for(const [x,z,h,tone,kind,coords] of data.b){
      if(skipBuilding(x,z))continue;
      const points=[];
      let minX=1e9,minZ=1e9,maxX=-1e9,maxZ=-1e9;
      for(let i=0;i<coords.length;i+=2){
        const px=x+coords[i],pz=z+coords[i+1];
        points.push([px,pz]);
        if(px<minX)minX=px;if(px>maxX)maxX=px;
        if(pz<minZ)minZ=pz;if(pz>maxZ)maxZ=pz;
      }
      mask(group,minX-2,minZ-2,maxX+2,maxZ+2);
      const center=ground(x,z);
      let base=center;
      if(points.length<=4){
        const g0=ground(points[0][0],points[0][1]),g2=ground(points[2][0],points[2][1]);
        base=Math.min(center,g0,g2)-.45;
      }else{
        for(let i=0;i<points.length;i++){const gp=ground(points[i][0],points[i][1]);if(gp<base)base=gp;}
        base-=.25;
      }
      const top=center+h,color=palette[tone].clone().multiplyScalar(h>75?.76:1);
      if(BC){const sx=(maxX-minX)*.06,sz=(maxZ-minZ)*.06;BC.add('tp:'+key,minX+sx,minZ+sz,maxX-sx,maxZ-sz,top,base);}
      const cr=color.r,cg=color.g,cb=color.b;
      const isGlazed=h>50||kind===1&&h>25;
      const facadeTarget=isGlazed?glazed:walls;
      const vScale=isGlazed?12.8:3.2;
      polygon(roofs,points,top,roofPalette[tone]);
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
        if(length<.01)continue;
        const nx=dz/length,nz=-dx/length;
        const u=length/12.8,v=(top-base)/vScale;
        triFlat(facadeTarget,a[0],base,a[1],b[0],base,b[1],b[0],top,b[1],cr,cg,cb,nx,0,nz,0,0,u,0,u,v);
        triFlat(facadeTarget,a[0],base,a[1],b[0],top,b[1],a[0],top,a[1],cr,cg,cb,nx,0,nz,0,0,u,v,0,v);
      }
      built++;if(built%72===0)yield;
    }
    for(const coords of data.w){
      const points=[];for(let i=0;i<coords.length;i+=2)points.push([coords[i],coords[i+1]]);
      const y=Math.max(.1,Math.min(...points.map(p=>ground(...p))))+.16;
      polygon(waters,points,y,white);yield;
    }
    const bridgeColor=new THREE.Color(0xb8bec2),pierColor=new THREE.Color(0x959ba0);
    for(let r=0;r<data.r.length;r++){
      const [width,bridge,coords]=data.r[r];
      let cumDist=0;
      for(let i=2;i<coords.length;i+=2){
        const ax=coords[i-2],az=coords[i-1],bx=coords[i],bz=coords[i+1],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
        if(length<.1)continue;
        mask(group,Math.min(ax,bx)-width/2,Math.min(az,bz)-width/2,Math.max(ax,bx)+width/2,Math.max(az,bz)+width/2);
        const sections=Math.max(1,Math.ceil(length/32));
        const nx=-dz/length,nz=dx/length;
        for(let part=0;part<sections;part++){
          const t=part/sections,u=(part+1)/sections;
          const x=ax+dx*t,z=az+dz*t,x2=ax+dx*u,z2=az+dz*u;
          const segLen=length/sections,v0=cumDist/26,v1=(cumDist+segLen)/26;
          cumDist+=segLen;
          // Keep runway and taxiway surfaces owned by the airport layer.
          if(airports.some(a=>Math.hypot(x-a.x,z-a.z)<a.length/2+100&&Math.abs(runwayCoordinates(x,z,a).cross)<250))continue;
          const liftBridge=bridge?8:0,half=width/2;
          const lx1=x+nx*half,lz1=z+nz*half,rx1=x-nx*half,rz1=z-nz*half;
          const lx2=x2+nx*half,lz2=z2+nz*half,rx2=x2-nx*half,rz2=z2-nz*half;
          const yL1=ground(lx1,lz1)+.18+liftBridge,yR1=ground(rx1,rz1)+.18+liftBridge;
          const yR2=ground(rx2,rz2)+.18+liftBridge,yL2=ground(lx2,lz2)+.18+liftBridge;
          triFlat(roads,lx1,yL1,lz1,rx1,yR1,rz1,rx2,yR2,rz2,1,1,1,0,1,0,0,v0,1,v0,1,v1);
          triFlat(roads,lx1,yL1,lz1,rx2,yR2,rz2,lx2,yL2,lz2,1,1,1,0,1,0,0,v0,1,v1,0,v1);
          if(bridge||width>=11){
            const ch=bridge?1.05:.24,cw=bridge?.55:.42;
            for(const s of [-1,1]){
              const outOff=half+cw*.5,inOff=half-cw*.1;
              const pA=[x+nx*s*outOff,z+nz*s*outOff],pB=[x2+nx*s*outOff,z2+nz*s*outOff];
              const gA=ground(pA[0],pA[1])+liftBridge+.18,gB=ground(pB[0],pB[1])+liftBridge+.18;
              const iA=[x+nx*s*inOff,z+nz*s*inOff],iB=[x2+nx*s*inOff,z2+nz*s*inOff];
              triFlat(curbs,pA[0],gA+ch,pA[1],iA[0],gA+ch,iA[1],iB[0],gB+ch,iB[1],bridgeColor.r,bridgeColor.g,bridgeColor.b,0,1,0,0,0,1,0,1,1);
              triFlat(curbs,pA[0],gA+ch,pA[1],iB[0],gB+ch,iB[1],pB[0],gB+ch,pB[1],bridgeColor.r,bridgeColor.g,bridgeColor.b,0,1,0,0,0,1,1,0,1);
              triFlat(curbs,pA[0],gA-(bridge?.7:.15),pA[1],pB[0],gB-(bridge?.7:.15),pB[1],pB[0],gB+ch,pB[1],pierColor.r,pierColor.g,pierColor.b,nx*s,0,nz*s,0,0,1,0,1,1);
              triFlat(curbs,pA[0],gA-(bridge?.7:.15),pA[1],pB[0],gB+ch,pB[1],pA[0],gA+ch,pA[1],pierColor.r,pierColor.g,pierColor.b,nx*s,0,nz*s,0,0,1,1,0,1);
            }
            if(bridge&&part===0&&length>14){
              const mx=(x+x2)*.5,mz=(z+z2)*.5,gm=ground(mx,mz),pw=Math.min(2.4,width*.14);
              for(const [sx,sz] of [[-pw,-pw],[pw,-pw],[pw,pw],[-pw,pw]]){
                void sx;void sz;
              }
              triFlat(curbs,mx-pw,gm-.5,mz-pw,mx+pw,gm-.5,mz-pw,mx+pw,gm+liftBridge+.1,mz-pw,pierColor.r,pierColor.g,pierColor.b,0,0,-1,0,0,1,0,1,1);
              triFlat(curbs,mx-pw,gm-.5,mz-pw,mx+pw,gm+liftBridge+.1,mz-pw,mx-pw,gm+liftBridge+.1,mz-pw,pierColor.r,pierColor.g,pierColor.b,0,0,-1,0,0,1,1,0,1);
              triFlat(curbs,mx+pw,gm-.5,mz-pw,mx+pw,gm-.5,mz+pw,mx+pw,gm+liftBridge+.1,mz+pw,pierColor.r,pierColor.g,pierColor.b,1,0,0,0,0,1,0,1,1);
              triFlat(curbs,mx+pw,gm-.5,mz-pw,mx+pw,gm+liftBridge+.1,mz+pw,mx+pw,gm+liftBridge+.1,mz-pw,pierColor.r,pierColor.g,pierColor.b,1,0,0,0,0,1,1,0,1);
            }
          }
          // Pedestrian crosswalk zebra bars near major intersections
          if(i===2&&part===0&&!bridge&&width>=12&&length>=14){
            const cxA=ax+dx/length*1.5,czA=az+dz/length*1.5,cxB=ax+dx/length*4.5,czB=az+dz/length*4.5;
            for(let bar=-width*.4;bar<=width*.4;bar+=1.8){
              const a1=[cxA+nx*bar,czA+nz*bar],a2=[cxA+nx*(bar+.85),czA+nz*(bar+.85)];
              const b1=[cxB+nx*bar,czB+nz*bar],b2=[cxB+nx*(bar+.85),czB+nz*(bar+.85)];
              const yZ=ground(cxA,czA)+.22;
              tri(lines,[a1[0],yZ,a1[1]],[a2[0],yZ,a2[1]],[b2[0],yZ,b2[1]],white,[0,1,0]);
              tri(lines,[a1[0],yZ,a1[1]],[b2[0],yZ,b2[1]],[b1[0],yZ,b1[1]],white,[0,1,0]);
            }
          }
        }
      }
      if(r%12===0)yield;
    }
    // Winding may differ between OSM ways; use both sides for facades only.
    wall.side=THREE.DoubleSide;
    mesh(group,walls,wall,'OSM footprint facades');mesh(group,glazed,officeGlass,'Taipei glass curtain walls');mesh(group,roofs,roof,'Taipei rooftops');
    mesh(group,roads,asphalt,'Taipei streets and bridges');mesh(group,curbs,concreteCurb,'Taipei curbs and viaduct piers');mesh(group,lines,stripe,'Road markings');mesh(group,waters,water,'Taipei water');
    Object.assign(group.userData,{buildings:built,roads:data.r.length,routes:data.r.filter(r=>r[0]>=11&&r[2].length>=6)});root.add(group);loaded.set(key,group);
    stats.buildings+=built;stats.roads+=data.r.length;stats.tiles=loaded.size;
    stats.maskRevision++;
  }
  function dispose(key){
    const group=loaded.get(key);if(!group)return;
    stats.buildings-=group.userData.buildings;stats.roads-=group.userData.roads;
    for(const [key,rect] of group.userData.masks){const cell=masks.get(key);cell.delete(rect);if(!cell.size)masks.delete(key);}
    group.traverse(o=>o.geometry?.dispose());root.remove(group);loaded.delete(key);stats.tiles=loaded.size;
    if(typeof BuildingCollision!=='undefined')BuildingCollision.clearGroup('tp:'+key);
    stats.maskRevision++;
  }
  function request(tile){
    const key=tile[0];pending.add(key);stats.loading=pending.size;
    fetch('taipei-city/'+key+'.json?v=27').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
      .then(data=>jobs.push({key,iterator:build(key,data)}))
      .catch(()=>{failed.set(key,clock+15);pending.delete(key);stats.loading=pending.size;});
  }
  const vehicleMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.46,metalness:.12});
  const vehicles=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),vehicleMat,64);
  vehicles.name='Taipei moving traffic';
  const cabins=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),darkGlass,64);
  const headlamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffe5ad}),128);
  const tailLamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xef4736}),128);
  const tyre=new THREE.CylinderGeometry(.33,.33,.22,8);tyre.rotateZ(Math.PI/2);
  const tyres=new THREE.InstancedMesh(tyre,new THREE.MeshStandardMaterial({color:0x252b2e,roughness:.95}),256);
  root.add(vehicles,cabins,headlamps,tailLamps,tyres);
  const matrix=new THREE.Object3D(),cars=Array.from({length:64},(_,i)=>({route:null,t:i*.618%1}));
  for(let i=0;i<64;i++)vehicles.setColorAt(i,new THREE.Color(['#dedfdc','#c3b14a','#4a6573','#a8b2b2','#faf6e7','#ae4e43'][i%6]));
  let trafficTime=0;
  function traffic(dt,x,z,paused,mobile){
    trafficTime+=dt;if(trafficTime<.05)return;
    dt=trafficTime;trafficTime=0;
    const available=[...loaded.values()].filter(g=>g.visible).flatMap(g=>g.userData.routes);
    const count=Math.min(mobile?40:64,available.length);vehicles.count=cabins.count=count;
    stats.vehicles=count;
    headlamps.count=tailLamps.count=count*2;tyres.count=count*4;
    headlamps.visible=tailLamps.visible=day<.4;
    function instance(mesh,i,px,py,pz,w,h,d,angle){matrix.position.set(px,py,pz);matrix.scale.set(w,h,d);matrix.rotation.set(0,angle,0);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);}
    for(let i=0;i<count;i++){
      const car=cars[i],r=available[(i*17)%available.length];
      // Route remains selected while its tile is loaded: no per-frame jumps.
      if(!car.route||!available.includes(car.route))car.route=r;
      const [width,bridge,p]=car.route,points=[];let length=0;
      for(let n=2;n<p.length;n+=2){const segment=Math.hypot(p[n]-p[n-2],p[n+1]-p[n-1]);points.push(segment);length+=segment;}
      if(!paused)car.t=(car.t+(width>15?17:10)*dt/Math.max(1,length))%1;
      let distance=car.t*length,j=0;while(j<points.length-1&&distance>points[j])distance-=points[j++];
      const f=distance/Math.max(.01,points[j]),n=j*2,dx=p[n+2]-p[n],dz=p[n+3]-p[n+1],norm=Math.max(.01,points[j]);
      const px=p[n]+dx*f-dz/norm*width*.23,pz=p[n+1]+dz*f+dx/norm*width*.23;
      const y=ground(px,pz)+(bridge?8:0)+.5,angle=Math.atan2(dx,dz),bus=i%9===0,long=bus?10:4.5;
      instance(vehicles,i,px,y+(bus?1:.5),pz,bus?2.35:1.8,bus?2:1,long,angle);
      instance(cabins,i,px,y+(bus?2:1.12),pz,bus?2.15:1.58,bus?.65:.52,long*.64,angle);
      for(let side=0;side<2;side++){
        const offset=(side?1:-1)*.67,ox=dz/norm*offset,oz=-dx/norm*offset;
        instance(headlamps,i*2+side,px+dx/norm*long*.51+ox,y+.42,pz+dz/norm*long*.51+oz,.35,.18,.1,angle);
        instance(tailLamps,i*2+side,px-dx/norm*long*.51+ox,y+.42,pz-dz/norm*long*.51+oz,.3,.2,.1,angle);
      }
      for(let wheel=0;wheel<4;wheel++){
        const ox=(wheel%2?1:-1)*(bus?1.18:.91),oz=(wheel<2?-1:1)*long*.32;
        instance(tyres,i*4+wheel,px+dz/norm*ox+dx/norm*oz,y-.05,pz-dx/norm*ox+dz/norm*oz,1,1,1,angle);
      }
    }
    for(const mesh of [vehicles,cabins,tyres,headlamps,tailLamps]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  }
  function update(dt,x,z,quality,activeDay,wet,paused){
    clock+=Math.min(dt,.1);day=activeDay;
    const at=latLon(x,z),near=at.lat>24.90&&at.lat<25.22&&at.lon>121.35&&at.lon<121.74;
    root.visible=near;if(!near)return;
    const mobile=touchControls.mode.value==='mobile',range=mobile?4800:quality==='ultra'?11000:quality==='high'?9000:6500;
    wall.emissiveIntensity=(1-day)*.68;glass.emissiveIntensity=(1-day)*.95;
    officeGlass.emissiveIntensity=Math.pow(1-day,1.25)*1.28;officeGlass.envMapIntensity=.25+day*1.15;
    beaconMat.emissiveIntensity=(1-day)*(Math.sin(clock*4.5)>0?2.1:.15);
    ferrisGreen.emissiveIntensity=.45+(1-day)*1.25;
    asphalt.roughness=wet?.32:.86;asphalt.metalness=wet?.18:.02;
    asphalt.emissiveIntensity=Math.pow(1-day,1.25)*(wet?1.15:.92);
    stripe.emissiveIntensity=Math.pow(1-day,1.3)*.28;
    traffic(dt,x,z,paused,mobile);
    if(!index&&!indexRequest&&clock>=nextScan){
      indexRequest=true;fetch('taipei-city/index.json?v=27').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{index=data;root.userData.coverage=data;})
        .catch(()=>{indexRequest=false;nextScan=clock+10;});
    }
    if(index&&clock>=nextScan){
      nextScan=clock+.5;
      const distances=index.tiles.map(t=>[t,Math.hypot(t[1]-x,t[2]-z)]).sort((a,b)=>a[1]-b[1]);
      for(const [tile,distance] of distances){
        const mesh=loaded.get(tile[0]);if(mesh)mesh.visible=distance<range+1150;
        if(distance<range+800&&!mesh&&!pending.has(tile[0])&&(failed.get(tile[0])??0)<clock&&pending.size<2)request(tile);
        if(mesh&&distance>range+4200)dispose(tile[0]);
      }
    }
    const end=performance.now()+(mobile?1.8:2.8);
    while(jobs.length&&performance.now()<end){
      const job=jobs[0];
      try{
        if(job.iterator.next().done){jobs.shift();pending.delete(job.key);stats.loading=pending.size;nextScan=0;}
      }catch(error){jobs.shift();pending.delete(job.key);failed.set(job.key,clock+15);console.warn('Optional Taipei tile:',error);}
    }
  }
  return {root,stats,inside,update,landmarks,landmarkSites,blocked};
}
