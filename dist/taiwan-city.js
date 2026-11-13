'use strict';
function createTaiwanCity(scene,ground,airports){
  const root=new THREE.Group();root.name='Taiwan all-island 3D cities';scene.add(root);
  const taipeiBox={s:24.97,w:121.43,n:25.14,e:121.65};
  const insideTaipei=(lat,lon)=>lat>=taipeiBox.s&&lat<=taipeiBox.n&&lon>=taipeiBox.w&&lon<=taipeiBox.e;
  const inside=(lat,lon)=>!insideTaipei(lat,lon)&&lat>=21.8&&lat<=26.4&&lon>=118.1&&lon<=122.2;

  let index=null,indexRequest=false,clock=0,day=1,nextScan=0;
  const loaded=new Map(),pending=new Set(),failed=new Map(),jobs=[],masks=new Map();
  const stats={buildings:0,tiles:0,loading:0,landmarks:0,maskRevision:0,ready:false};
  const mask=(g,x1,z1,x2,z2)=>{
    const r=[x1,z1,x2,z2],c1=Math.floor(x1/320),c2=Math.floor(x2/320),r1=Math.floor(z1/320),r2=Math.floor(z2/320);
    for(let rz=r1;rz<=r2;rz++)for(let cx=c1;cx<=c2;cx++){
      const k=cx+':'+rz;if(!masks.has(k))masks.set(k,new Set());masks.get(k).add(r);g.userData.masks.push([k,r]);
    }
  };
  const blocked=(x,z)=>{
    const cell=masks.get(Math.floor(x/320)+':'+Math.floor(z/320));
    if(!cell)return false;
    for(const [x1,z1,x2,z2] of cell)if(x>=x1&&x<=x2&&z>=z1&&z<=z2)return true;
    return false;
  };

  function texture(draw,srgb){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    draw(canvas.getContext('2d'),256);
    const tex=new THREE.CanvasTexture(canvas);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    if(srgb)tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }

  // Taipei-grade sky & horizon equirectangular environment reflection for glass skyscrapers
  const reflCanvas=document.createElement('canvas');reflCanvas.width=256;reflCanvas.height=128;
  const rx=reflCanvas.getContext('2d');
  const rg=rx.createLinearGradient(0,0,0,128);
  rg.addColorStop(0,'#4688c2');rg.addColorStop(0.45,'#9bc9ea');rg.addColorStop(0.51,'#eef6fd');
  rg.addColorStop(0.55,'#556775');rg.addColorStop(1,'#27343e');
  rx.fillStyle=rg;rx.fillRect(0,0,256,128);
  rx.fillStyle='rgba(255,250,235,0.7)';rx.beginPath();rx.arc(192,38,16,0,Math.PI*2);rx.fill();
  const reflectedMap=new THREE.CanvasTexture(reflCanvas);
  reflectedMap.mapping=THREE.EquirectangularReflectionMapping;
  reflectedMap.colorSpace=THREE.SRGBColorSpace;

  // Residential/mixed facade (warm concrete tile & Taiwanese recessed windows/AC units)
  const facadeTex=texture(c=>{
    c.fillStyle='#ede8de';c.fillRect(0,0,256,256);
    c.fillStyle='#ded7ca';
    for(let y=0;y<256;y+=8)c.fillRect(0,y,256,1);
    for(let y=0;y<256;y+=8){
      const shift=(y%16===0)?0:12;
      for(let x=shift;x<256;x+=24)c.fillRect(x,y,1,8);
    }
    for(let row=0;row<8;row++){
      const y=8+row*31;
      c.fillStyle='#bcb6aa';c.fillRect(0,y+24,256,3);
      for(let col=0;col<6;col++){
        const x=6+col*41;
        c.fillStyle='#2a3035';c.fillRect(x,y,30,22);
        c.fillStyle=(row*3+col*5)%4===0?'#6e8999':'#4d6675';
        c.fillRect(x+2,y+2,12,18);c.fillRect(x+16,y+2,12,18);
        c.fillStyle='#202529';c.fillRect(x+14,y+2,2,18);
        c.fillStyle='#67757f';c.fillRect(x+1,y+13,28,1);c.fillRect(x+1,y+18,28,1);
        if((row*7+col*11)%3!==0){
          c.fillStyle='#f0f2f4';c.fillRect(x+17,y+15,11,8);
          c.fillStyle='#353c41';c.fillRect(x+23,y+17,4,4);
        }
      }
    }
  },true);

  const facadeNight=texture(c=>{
    c.fillStyle='#000';c.fillRect(0,0,256,256);
    for(let row=0;row<8;row++){
      const y=8+row*31;
      for(let col=0;col<6;col++){
        if((row*3+col*7)%5<2)continue;
        const x=6+col*41;
        c.fillStyle=(row+col)%3===0?'#ffd98b':(row+col)%2===0?'#f6e7bd':'#90a9bc';
        c.fillRect(x+2,y+2,12,18);c.fillRect(x+16,y+2,12,18);
      }
    }
  },true);

  // Commercial / skyscraper glass curtain wall
  const officeTex=texture(c=>{
    c.fillStyle='#264354';c.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=32){
      c.fillStyle='#192c38';c.fillRect(0,y,256,6);
      c.fillStyle='#345a70';c.fillRect(0,y+6,256,26);
      for(let x=0;x<256;x+=16){
        c.fillStyle=(x/16+y/32)%5===0?'#4c7b94':'#2f5368';
        c.fillRect(x+2,y+7,12,24);
        c.fillStyle='#14232d';c.fillRect(x,y+6,2,26);
      }
    }
  },true);

  const officeRough=texture(c=>{
    c.fillStyle='#404040';c.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=32){c.fillStyle='#c0c0c0';c.fillRect(0,y,256,6);}
  },false);

  const officeNight=texture(c=>{
    c.fillStyle='#000';c.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=32){
      for(let x=0;x<256;x+=16){
        if(((x*7+y*13)%11)<4)continue;
        c.fillStyle=(x+y)%48===0?'#ffe59c':(x*3+y)%32===0?'#cbe6ff':'#ffd898';
        c.fillRect(x+2,y+7,12,24);
      }
    }
  },true);

  // Cleanroom / industrial tech park facade (Hsinchu/Tainan/Kaohsiung science parks)
  const techTex=texture(c=>{
    c.fillStyle='#dce2e7';c.fillRect(0,0,256,256);
    c.fillStyle='#c5cfd6';
    for(let x=0;x<256;x+=16)c.fillRect(x,0,2,256);
    for(let y=20;y<256;y+=64){
      c.fillStyle='#3d596b';c.fillRect(0,y,256,16);
      c.fillStyle='#243642';for(let x=0;x<256;x+=32)c.fillRect(x,y,3,16);
    }
  },true);

  // Taiwanese waterproofing green roof + stairwell + stainless water tanks
  const roofTex=texture(c=>{
    c.fillStyle='#417557';c.fillRect(0,0,256,256);
    c.fillStyle='#366449';for(let i=0;i<10;i++)c.fillRect((i*53)%210,(i*71)%210,36,36);
    c.fillStyle='#5c5952';c.fillRect(0,0,256,12);c.fillRect(0,244,256,12);c.fillRect(0,0,12,256);c.fillRect(244,0,12,256);
    c.fillStyle='#cbc6be';c.fillRect(156,28,74,56);
    const drawTank=(cx,cy,r)=>{
      c.fillStyle='rgba(0,0,0,0.34)';c.beginPath();c.ellipse(cx+r*0.2,cy+r*0.24,r*1.04,r*0.88,0,0,Math.PI*2);c.fill();
      const g=c.createRadialGradient(cx-r*0.32,cy-r*0.32,r*0.1,cx,cy,r);
      g.addColorStop(0,'#ffffff');g.addColorStop(0.35,'#dde2e8');g.addColorStop(0.75,'#9aa4ae');g.addColorStop(1,'#626c76');
      c.fillStyle=g;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();
    };
    drawTank(62,72,24);drawTank(114,68,20);drawTank(76,128,18);
  },true);

  const wall=new THREE.MeshStandardMaterial({vertexColors:true,map:facadeTex,roughness:.88,emissive:0xffe0ac,emissiveMap:facadeNight,emissiveIntensity:0,side:THREE.DoubleSide});
  const techWall=new THREE.MeshStandardMaterial({vertexColors:true,map:techTex,roughness:.62,metalness:.24,side:THREE.DoubleSide});
  const roof=new THREE.MeshStandardMaterial({vertexColors:true,map:roofTex,roughness:.84});
  const officeGlass=new THREE.MeshPhysicalMaterial({
    map:officeTex,roughnessMap:officeRough,color:0x3f657a,metalness:.80,roughness:.22,
    clearcoat:1.0,clearcoatRoughness:.09,envMap:reflectedMap,envMapIntensity:1.15,
    emissiveMap:officeNight,emissive:0xffdfab,emissiveIntensity:0,side:THREE.DoubleSide
  });

  // Landmark shared materials
  const stone=new THREE.MeshStandardMaterial({color:0xd8d2c6,roughness:.76});
  const graniteRed=new THREE.MeshStandardMaterial({color:0xa84638,roughness:.74});
  const darkGlass=new THREE.MeshPhysicalMaterial({color:0x1a303d,metalness:.85,roughness:.18,clearcoat:1,envMap:reflectedMap,envMapIntensity:1.1,emissive:0xffdfa6,emissiveIntensity:0});
  const metal=new THREE.MeshStandardMaterial({color:0xb8c2c9,roughness:.34,metalness:.68});
  const darkBasalt=new THREE.MeshStandardMaterial({color:0x2e343a,roughness:.78});
  const pagodaRed=new THREE.MeshStandardMaterial({color:0xa62620,roughness:.68});
  const pagodaGreen=new THREE.MeshStandardMaterial({color:0x2e6f56,roughness:.62});
  const gold=new THREE.MeshStandardMaterial({color:0xddb24d,roughness:.35,metalness:.72});
  const whiteFrame=new THREE.MeshStandardMaterial({color:0xf2f5f7,roughness:.45});
  const beaconMat=new THREE.MeshStandardMaterial({color:0xff2820,emissive:0xff2218,emissiveIntensity:0,roughness:.25});

  const palette=['#c6bfae','#b9bec2','#a89b8d','#c9c3b6','#98a7ad','#c4b7a4','#b0b6ba','#d2cab9'].map(h=>new THREE.Color(h));
  const roofPalette=['#5f7167','#6c7375','#726b62','#5d6d71','#7c766d','#636f65','#6e7178','#767067'].map(h=>new THREE.Color(h));

  // Build iconic Taiwan Landmarks outside Taipei at true Google Maps/OSM coordinates & 1:1 heights
  const landmarks=new THREE.Group();landmarks.name='Taiwan regional landmarks';root.add(landmarks);
  const landmarkSites=[
    {name:'高雄85大樓',lat:22.61106,lon:120.30350,radius:72,type:'k85'},
    {name:'高雄遠雄THE ONE',lat:22.60855,lon:120.30345,radius:55,type:'theone'},
    {name:'高雄長谷世貿50層大樓',lat:22.64302,lon:120.31483,radius:45,type:'changgu'},
    {name:'高雄流行音樂中心海音館',lat:22.61770,lon:120.28770,radius:110,type:'kmc'},
    {name:'高雄漢來大飯店',lat:22.61960,lon:120.29660,radius:58,type:'hilai'},
    {name:'高雄展覽館',lat:22.60950,lon:120.29830,radius:125,type:'kec'},
    {name:'左營蓮池潭龍虎塔',lat:22.68150,lon:120.29290,radius:65,type:'dragontiger'},
    {name:'臺中商業銀行總部(台中之鑽)',lat:24.16040,lon:120.64220,radius:52,type:'taichungdiamond'},
    {name:'台中聯聚中雍大廈',lat:24.16230,lon:120.64580,radius:48,type:'lanchu'},
    {name:'台中大安國王大樓',lat:24.15060,lon:120.66440,radius:48,type:'daanking'},
    {name:'臺中國家歌劇院',lat:24.16280,lon:120.64040,radius:95,type:'ntt'},
    {name:'台南香格里拉遠東飯店',lat:22.99670,lon:120.21430,radius:52,type:'shangrila'},
    {name:'台南奇美博物館',lat:22.93460,lon:120.22610,radius:120,type:'chimei'},
    {name:'嘉義故宮南院',lat:23.47240,lon:120.29230,radius:130,type:'npm_south'},
    {name:'竹北高鐵豐邑雲智匯大樓',lat:24.81950,lon:121.02800,radius:55,type:'hsinchu_tower'},
    {name:'桃園藝文特區中悅世界與總圖生命樹',lat:25.01680,lon:121.30050,radius:75,type:'taoyuan_hub'},
    {name:'宜蘭蘭陽博物館',lat:24.86860,lon:121.83230,radius:65,type:'lanyang'},
    {name:'金門莒光樓',lat:24.42490,lon:118.31830,radius:45,type:'juguang'},
    {name:'澎湖西瀛虹橋',lat:23.56880,lon:119.56080,radius:95,type:'rainbowbridge'}
  ];

  const landmarkGroups=[];
  function addMesh(parent,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
  function box(parent,mat,w,h,d,x,y,z){return addMesh(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
  function cyl(parent,mat,rt,rb,h,seg,x,y,z){return addMesh(parent,new THREE.CylinderGeometry(rt,rb,h,seg),mat,x,y,z);}

  for(const site of landmarkSites){
    const p=geoPoint(site.lat,site.lon);site.x=p.x;site.z=p.z;
    const g=new THREE.Group();g.name=site.name;g.position.set(p.x,ground(p.x,p.z),p.z);
    landmarks.add(g);landmarkGroups.push(g);
    if(site.type==='k85'){
      box(g,stone,98,34,64,0,17,0);
      for(const s of [-1,1]){
        box(g,officeGlass,32,122,54,s*27,95,0);
        for(const cz of [-26,26])box(g,stone,3.5,122,3.5,s*27,95,cz);
        box(g,beaconMat,1.8,1.8,1.8,s*27,157,0);
      }
      box(g,stone,86,14,56,0,163,0);
      box(g,officeGlass,48,142,48,0,234,0);
      box(g,darkGlass,52,126,44,0,234,0);
      box(g,stone,40,16,40,0,313,0);
      box(g,officeGlass,32,14,32,0,328,0);
      cyl(g,stone,6,28,16,4,0,343,0).rotation.y=Math.PI/4;
      cyl(g,metal,.9,2.8,34,8,0,366,0);
      box(g,beaconMat,2.5,2.5,2.5,0,384,0);
    }else if(site.type==='theone'){
      box(g,stone,58,24,48,0,12,0);
      box(g,officeGlass,44,175,38,0,111,0);
      for(const s of [-22.5,22.5])for(const sz of [-19.5,19.5])box(g,whiteFrame,2.4,230,2.4,s,115,sz);
      box(g,darkGlass,38,52,32,0,224,0);
      box(g,whiteFrame,40,8,34,0,254,0);
      cyl(g,metal,1,3,14,8,0,264,0);
      box(g,beaconMat,2,2,2,0,271,0);
    }else if(site.type==='changgu'){
      cyl(g,graniteRed,24,26,42,8,0,21,0);
      cyl(g,officeGlass,20,24,140,8,0,112,0);
      cyl(g,graniteRed,14,20,32,8,0,198,0);
      cyl(g,officeGlass,6,14,14,8,0,221,0);
      cyl(g,metal,.6,1.8,16,8,0,236,0);
      box(g,beaconMat,1.8,1.8,1.8,0,245,0);
    }else if(site.type==='kmc'){
      for(const [ox,oz,h,r] of [[-48,8,58,15],[-24,-10,36,18],[46,-6,42,14]]){
        cyl(g,whiteFrame,r,r*1.12,h,6,ox,h/2,oz);
        cyl(g,officeGlass,r*.88,r*.98,h-4,6,ox,h/2,oz);
      }
      const hall=cyl(g,whiteFrame,44,58,24,6,8,12,18);hall.scale.set(1.3,1,.9);
      const cap=cyl(g,officeGlass,30,42,8,6,8,26,18);cap.scale.set(1.25,1,.85);
      box(g,beaconMat,1.6,1.6,1.6,-48,60,8);
    }else if(site.type==='hilai'){
      box(g,stone,72,38,52,0,19,0);
      box(g,graniteRed,52,110,38,0,93,0);
      box(g,officeGlass,44,110,42,0,93,0);
      box(g,stone,36,28,28,0,162,0);
      cyl(g,gold,4,14,14,8,0,183,0);
      box(g,beaconMat,1.8,1.8,1.8,0,191,0);
    }else if(site.type==='kec'){
      for(let i=-3;i<=3;i++){
        const h=14+6*Math.cos(i*.55);
        const seg=box(g,metal,24,h,92,i*24,h/2,0);
        seg.rotation.z=Math.sin(i*.6)*.12;
      }
      box(g,officeGlass,156,11,76,0,6,0);
    }else if(site.type==='dragontiger'){
      for(const s of [-1,1]){
        const px=s*18;
        cyl(g,stone,9,10,4,12,px,2,0);
        for(let t=0;t<7;t++){
          const y=4+t*4.5,r=7.2-t*.48;
          cyl(g,pagodaRed,r*.85,r*.9,3.2,8,px,y+1.6,0);
          cyl(g,pagodaGreen,r*.45,r*1.12,1.6,8,px,y+3.8,0);
        }
        cyl(g,gold,.2,1.2,5,8,px,38,0);
      }
      box(g,pagodaRed,36,2.2,4,0,3,6);
    }else if(site.type==='taichungdiamond'){
      box(g,stone,62,22,48,0,11,0);
      for(const s of [-14,14]){
        box(g,officeGlass,22,188,36,s,116,0);
        box(g,metal,24,4,38,s,132,0);
        box(g,metal,24,4,38,s,186,0);
      }
      box(g,darkGlass,26,22,30,0,164,0);
      box(g,officeGlass,44,18,32,0,214,0);
      box(g,beaconMat,2,2,2,0,226,0);
    }else if(site.type==='lanchu'){
      box(g,stone,54,24,44,0,12,0);
      box(g,officeGlass,42,148,36,0,98,0);
      for(const sx of [-20,20])for(const sz of [-17,17])box(g,stone,4,162,4,sx,94,sz);
      box(g,stone,36,16,30,0,180,0);
      box(g,beaconMat,1.8,1.8,1.8,0,192,0);
    }else if(site.type==='daanking'){
      box(g,stone,52,20,46,0,10,0);
      box(g,officeGlass,38,128,34,0,84,0);
      for(const s of [-18,18])box(g,whiteFrame,6,144,24,s,92,0);
      cyl(g,metal,1,12,24,4,0,164,0).rotation.y=Math.PI/4;
      box(g,beaconMat,1.8,1.8,1.8,0,178,0);
    }else if(site.type==='ntt'){
      box(g,whiteFrame,108,26,64,0,13,0);
      for(const sx of [-32,0,32]){
        const arch=cyl(g,whiteFrame,18,22,28,16,sx,14,0);
        arch.scale.set(1,1,1.3);
        box(g,officeGlass,16,20,66,sx,12,0);
      }
      box(g,pagodaGreen,96,1.6,52,0,26.8,0);
    }else if(site.type==='shangrila'){
      box(g,stone,66,22,58,0,11,0);
      cyl(g,stone,23,25,36,24,0,40,0);
      cyl(g,officeGlass,19,22,74,24,0,95,0);
      cyl(g,metal,14,18,16,24,0,140,0);
      box(g,beaconMat,1.8,1.8,1.8,0,152,0);
    }else if(site.type==='chimei'){
      box(g,whiteFrame,150,22,68,0,11,0);
      box(g,whiteFrame,54,28,74,0,14,0);
      box(g,officeGlass,42,16,76,0,12,0);
      for(let i=-3;i<=3;i++)cyl(g,whiteFrame,1.6,1.8,22,12,i*7,11,36);
      cyl(g,gold,18,20,16,24,0,34,0);
      addMesh(g,new THREE.SphereGeometry(18,24,14,0,Math.PI*2,0,Math.PI/2),gold,0,42,0);
      cyl(g,gold,.5,1.5,12,8,0,64,0);
    }else if(site.type==='npm_south'){
      const leftW=box(g,darkGlass,86,20,44,-34,12,-8);leftW.rotation.y=.22;
      const rightW=box(g,metal,86,24,44,34,14,10);rightW.rotation.y=-.18;
      const bridge=box(g,whiteFrame,92,4,8,0,6,34);bridge.rotation.y=-.35;
    }else if(site.type==='hsinchu_tower'){
      box(g,stone,56,16,44,0,8,0);
      cyl(g,officeGlass,21,24,116,18,0,74,0).scale.set(1.25,1,.85);
      cyl(g,metal,19,21,8,18,0,136,0).scale.set(1.25,1,.85);
      box(g,beaconMat,1.6,1.6,1.6,0,143,0);
    }else if(site.type==='taoyuan_hub'){
      for(const s of [-28,28]){
        box(g,stone,30,134,30,s,67,0);
        box(g,officeGlass,26,126,32,s,67,0);
        cyl(g,gold,3,13,18,8,s,143,0);
        box(g,beaconMat,1.6,1.6,1.6,s,154,0);
      }
      cyl(g,officeGlass,26,16,32,16,0,16,24);
      cyl(g,metal,30,28,3,16,0,33,24);
    }else if(site.type==='lanyang'){
      const wedge=box(g,darkBasalt,72,32,34,0,10,0);
      wedge.rotation.z=-.35;
      const stripeG=box(g,officeGlass,68,6,35,0,13,0);
      stripeG.rotation.z=-.35;
    }else if(site.type==='juguang'){
      box(g,stone,36,5,36,0,2.5,0);
      box(g,pagodaRed,22,12,18,0,11,0);
      cyl(g,pagodaGreen,6,18,8,4,0,21,0).rotation.y=Math.PI/4;
      box(g,pagodaRed,12,8,12,0,27,0);
      cyl(g,pagodaGreen,2,12,7,4,0,34,0).rotation.y=Math.PI/4;
    }else if(site.type==='rainbowbridge'){
      for(let i=-8;i<=8;i++){
        const t=i/8,y=18*(1-t*t),a=Math.atan2(-36*t/8,18);
        const seg=box(g,pagodaRed,16,1.8,2.6,i*12,y+3,0);
        seg.rotation.z=a*.42;
      }
      box(g,stone,196,2.2,6,0,2,0);
    }
    g.updateMatrixWorld(true);
    const batches=new Map();
    for(const child of [...g.children]){
      const geom=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
      geom.applyMatrix4(child.matrix);
      if(!batches.has(child.material))batches.set(child.material,[]);
      batches.get(child.material).push(geom);
      g.remove(child);child.geometry.dispose();
    }
    for(const [mat,parts] of batches){
      const geom=new THREE.BufferGeometry();
      for(const [attr,w] of [['position',3],['normal',3],['uv',2]]){
        const arr=new Float32Array(parts.reduce((s,pt)=>s+pt.attributes.position.count*w,0));
        let off=0;
        for(const pt of parts){if(pt.attributes[attr])arr.set(pt.attributes[attr].array,off);off+=pt.attributes.position.count*w;}
        geom.setAttribute(attr,new THREE.BufferAttribute(arr,w));
      }
      const mesh=new THREE.Mesh(geom,mat);mesh.receiveShadow=true;
      g.add(mesh);parts.forEach(pt=>pt.dispose());
    }
  }
  stats.landmarks=landmarkSites.length;

  const skipBuilding=(x,z)=>{
    const ll=latLon(x,z);
    if(ll.lat>=taipeiBox.s&&ll.lat<=taipeiBox.n&&ll.lon>=taipeiBox.w&&ll.lon<=taipeiBox.e)return true;
    if(landmarkSites.some(s=>Math.abs(x-s.x)<s.radius&&Math.abs(z-s.z)<s.radius))return true;
    return airports.some(a=>{
      if(Math.hypot(x-a.x,z-a.z)>a.length/2+500)return false;
      const p=runwayCoordinates(x,z,a);
      if(typeof airportSurroundingsContains==='function'&&airportSurroundingsContains(a,p))return true;
      return Math.abs(p.along)<a.length/2+85&&Math.abs(p.cross)<Math.abs(a.apron)+160;
    });
  };

  function buffers(){return {p:[],n:[],uv:[],c:[]};}
  function tri(out,a,b,c,col,normal,uvs){
    for(let i=0;i<3;i++){
      const v=[a,b,c][i];out.p.push(...v);out.n.push(...normal);
      out.uv.push(...(uvs?.[i]??[v[0]/4,v[2]/4]));
      out.c.push(col.r,col.g,col.b);
    }
  }
  function addLayerMesh(group,data,mat,name){
    if(!data.p.length)return;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(data.n,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(data.c,3));
    g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;group.add(m);
  }
  function polygon(out,points,y,col){
    const contour=points.map(p=>new THREE.Vector2(p[0],p[1]));
    for(const ids of THREE.ShapeUtils.triangulateShape(contour,[])){
      const [a,b,c]=ids.map(i=>[points[i][0],y,points[i][1]]);
      if((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])>0)tri(out,a,b,c,col,[0,1,0]);
      else tri(out,a,c,b,col,[0,1,0]);
    }
  }

  function* buildTile(key,data){
    const group=new THREE.Group();group.name='Taiwan city tile '+key;
    group.userData.masks=[];
    const walls=buffers(),glazed=buffers(),techs=buffers(),roofs=buffers();
    let built=0;
    for(const [x,z,h,tone,kind,coords] of data.b){
      if(skipBuilding(x,z))continue;
      const center=ground(x,z);
      if(center<0.35)continue;
      const points=[];
      for(let i=0;i<coords.length;i+=2)points.push([x+coords[i],z+coords[i+1]]);
      mask(group,Math.min(...points.map(p=>p[0]))-2,Math.min(...points.map(p=>p[1]))-2,Math.max(...points.map(p=>p[0]))+2,Math.max(...points.map(p=>p[1]))+2);
      const base=Math.min(center,...points.map(p=>ground(...p)))-.45;
      const top=center+h;
      const col=palette[tone%palette.length].clone().multiplyScalar(h>70?.80:1);
      const isGlazed=(kind===1||h>=36);
      const isTech=(kind===2&&!isGlazed);
      const target=isGlazed?glazed:(isTech?techs:walls);
      polygon(roofs,points,top,roofPalette[tone%roofPalette.length]);
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
        if(len<.05)continue;
        const normal=[dz/len,0,-dx/len];
        const u=len/12.8,v=(top-base)/(isGlazed?12.8:3.2);
        tri(target,[a[0],base,a[1]],[b[0],base,b[1]],[b[0],top,b[1]],col,normal,[[0,0],[u,0],[u,v]]);
        tri(target,[a[0],base,a[1]],[b[0],top,b[1]],[a[0],top,a[1]],col,normal,[[0,0],[u,v],[0,v]]);
      }
      built++;if(built%180===0)yield;
    }
    addLayerMesh(group,walls,wall,'Taiwan city facades');
    addLayerMesh(group,glazed,officeGlass,'Taiwan glass skyscrapers');
    addLayerMesh(group,techs,techWall,'Taiwan tech & industrial');
    addLayerMesh(group,roofs,roof,'Taiwan rooftops');
    group.userData.buildings=built;
    root.add(group);loaded.set(key,group);
    stats.buildings+=built;stats.tiles=loaded.size;stats.maskRevision++;
  }

  function disposeTile(key){
    const group=loaded.get(key);if(!group)return;
    stats.buildings-=group.userData.buildings||0;
    for(const [k,rect] of group.userData.masks){const cell=masks.get(k);if(cell){cell.delete(rect);if(!cell.size)masks.delete(k);}}
    group.traverse(o=>o.geometry?.dispose());
    root.remove(group);loaded.delete(key);stats.tiles=loaded.size;stats.maskRevision++;
  }

  function requestTile(tile){
    const key=tile[0];pending.add(key);stats.loading=pending.size;
    fetch('taiwan-city/'+key+'.json?v=60').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
      .then(data=>jobs.push({key,iterator:buildTile(key,data)}))
      .catch(()=>{failed.set(key,clock+15);pending.delete(key);stats.loading=pending.size;});
  }

  function update(dt,x,z,quality,activeDay,wet){
    clock+=Math.min(dt,.1);day=activeDay;
    const at=latLon(x,z),near=at.lat>21.6&&at.lat<26.6&&at.lon>117.9&&at.lon<122.4;
    root.visible=near;if(!near)return;
    const mobile=touchControls.mode.value==='mobile';
    const range=mobile?5000:quality==='ultra'?12000:quality==='high'?9600:7200;
    wall.emissiveIntensity=(1-day)*.42;
    darkGlass.emissiveIntensity=(1-day)*.62;
    officeGlass.emissiveIntensity=Math.pow(1-day,1.35)*.95;
    officeGlass.envMapIntensity=.28+day*1.15;
    beaconMat.emissiveIntensity=(Math.sin(clock*4.5)>0?1.8:.15)*(0.45+(1-day)*1.2);
    for(let i=0;i<landmarkGroups.length;i++){
      const g=landmarkGroups[i];
      const d=Math.hypot(g.position.x-x,g.position.z-z);
      g.visible=d<Math.max(18000,range*1.9);
      if(g.visible&&Math.abs(g.position.y-ground(g.position.x,g.position.z))>1.5){
        g.position.y=ground(g.position.x,g.position.z);
      }
    }
    if(!index&&!indexRequest&&clock>=nextScan){
      indexRequest=true;
      fetch('taiwan-city/index.json?v=60').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{index=data;stats.ready=true;root.userData.coverage=data;})
        .catch(()=>{indexRequest=false;nextScan=clock+12;});
    }
    if(index&&clock>=nextScan){
      nextScan=clock+.45;
      const distances=index.tiles.map(t=>[t,Math.hypot(t[1]-x,t[2]-z)]).sort((a,b)=>a[1]-b[1]);
      for(const [tile,distance] of distances){
        const mesh=loaded.get(tile[0]);if(mesh)mesh.visible=distance<range+4200;
        if(distance<range+3600&&!mesh&&!pending.has(tile[0])&&(failed.get(tile[0])??0)<clock&&pending.size<4)requestTile(tile);
        if(mesh&&distance>range+7500)disposeTile(tile[0]);
      }
    }
    const end=performance.now()+(mobile?4.0:8.0);
    while(jobs.length&&performance.now()<end){
      const job=jobs[0];
      try{
        if(job.iterator.next().done){jobs.shift();pending.delete(job.key);stats.loading=pending.size;nextScan=0;}
      }catch(error){
        jobs.shift();pending.delete(job.key);failed.set(job.key,clock+15);console.warn('Taiwan tile:',error);
      }
    }
  }
  return {root,stats,inside,update,landmarks,landmarkSites,blocked};
}
if(typeof module!=='undefined')module.exports={createTaiwanCity};
