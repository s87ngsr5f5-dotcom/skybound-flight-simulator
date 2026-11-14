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
    tex.anisotropy=8;
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

  // Procedural Taiwan PBR multi-lane asphalt + highway markings + night streetlamp & traffic glow
  const twRoadDay=texture(c=>{
    c.fillStyle='#8d9092';c.fillRect(0,0,256,256);
    c.fillStyle='#31363b';c.fillRect(10,0,236,256);
    for(let i=0;i<2400;i++){
      c.fillStyle=i%2?'#292d31':'#3a3f45';
      c.fillRect(10+((i*73)%236),(i*139)%256,2,2);
    }
    for(const lx of [52,96,160,204]){
      const wg=c.createLinearGradient(lx-14,0,lx+14,0);
      wg.addColorStop(0,'rgba(20,22,25,0)');wg.addColorStop(.5,'rgba(18,20,23,0.42)');wg.addColorStop(1,'rgba(20,22,25,0)');
      c.fillStyle=wg;c.fillRect(lx-14,0,28,256);
    }
    c.fillStyle='#eae8d9';c.fillRect(16,0,3,256);c.fillRect(237,0,3,256);
    c.fillStyle='#ebba3b';c.fillRect(124,0,3,256);c.fillRect(129,0,3,256);
    c.fillStyle='#f0f0e8';
    for(let y=8;y<256;y+=64){c.fillRect(72,y,3,34);c.fillRect(181,y,3,34);}
  },true);
  const twRoadNight=texture(c=>{
    c.fillStyle='#000';c.fillRect(0,0,256,256);
    for(const sy of [64,192]){
      for(const sx of [26,230]){
        const g=c.createRadialGradient(sx,sy,2,sx,sy,78);
        g.addColorStop(0,'rgba(255,220,165,0.92)');
        g.addColorStop(0.32,'rgba(255,175,90,0.48)');
        g.addColorStop(0.75,'rgba(215,120,48,0.14)');
        g.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=g;c.fillRect(0,sy-80,256,160);
      }
    }
    c.fillStyle='rgba(255,204,88,0.38)';c.fillRect(124,0,8,256);
    for(let y=16;y<256;y+=64){
      c.fillStyle='rgba(255,244,210,0.88)';c.fillRect(46,y,3,5);c.fillRect(58,y,3,5);
      c.fillStyle='rgba(255,58,42,0.88)';c.fillRect(194,y+24,3,5);c.fillRect(206,y+24,3,5);
    }
  },true);
  twRoadDay.wrapS=twRoadNight.wrapS=THREE.ClampToEdgeWrapping??THREE.RepeatWrapping;
  const roadMat=new THREE.MeshStandardMaterial({color:0xffffff,map:twRoadDay,roughness:.84,emissive:0xffd596,emissiveMap:twRoadNight,emissiveIntensity:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  const roadCurbMat=new THREE.MeshStandardMaterial({color:0xb8bec2,roughness:.85,vertexColors:true});

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
    {name:'澎湖西瀛虹橋',lat:23.56880,lon:119.56080,radius:95,type:'rainbowbridge'},
    // International Landmarks & Taiwan-Grade 3D City Clusters
    {name:'東京晴空塔 Tokyo Skytree',lat:35.71006,lon:139.81070,radius:95,type:'tokyo_skytree'},
    {name:'東京鐵塔 Tokyo Tower',lat:35.65858,lon:139.74543,radius:85,type:'tokyo_tower'},
    {name:'東京灣彩虹大橋 Rainbow Bridge',lat:35.63660,lon:139.76330,radius:220,type:'suspension_bridge'},
    {name:'東京丸之內與羽田灣岸摩天樓群',lat:35.61800,lon:139.75800,radius:180,type:'intl_city_cluster',seed:101,count:96,span:2600,maxH:245},
    {name:'東京羽田空港城區與京濱工業帶',lat:35.55800,lon:139.74200,radius:150,type:'intl_city_cluster',seed:102,count:84,span:2200,maxH:140},
    {name:'成田山新勝寺大塔與表參道城區',lat:35.78580,lon:140.31830,radius:140,type:'intl_city_cluster',seed:103,count:76,span:2100,maxH:125,pagoda:true},
    {name:'香港國際金融中心 IFC & 中銀大廈',lat:22.28520,lon:114.15810,radius:180,type:'hk_central'},
    {name:'香港環球貿易廣場 ICC & 九龍站天際線',lat:22.30340,lon:114.16020,radius:180,type:'hk_icc'},
    {name:'香港青馬大橋 Tsing Ma Bridge',lat:22.35140,lon:114.07360,radius:240,type:'suspension_bridge'},
    {name:'香港東涌與赤鱲角灣岸城區',lat:22.28900,lon:113.94100,radius:160,type:'intl_city_cluster',seed:201,count:82,span:2100,maxH:185},
    {name:'沖繩那霸首里城與國際通都會群',lat:26.21450,lon:127.68400,radius:160,type:'okinawa_naha'},
    {name:'首爾樂天世界塔 Lotte World Tower',lat:37.51250,lon:127.10250,radius:120,type:'seoul_lotte'},
    {name:'N首爾塔與南山天際線',lat:37.55120,lon:126.98820,radius:140,type:'seoul_ntower'},
    {name:'仁川跨海大橋 Incheon Bridge',lat:37.41380,lon:126.56550,radius:260,type:'suspension_bridge'},
    {name:'仁川松島國際都市摩天樓群',lat:37.44200,lon:126.48600,radius:170,type:'intl_city_cluster',seed:301,count:88,span:2400,maxH:230},
    {name:'新加坡濱海灣金沙酒店 Marina Bay Sands',lat:1.28340,lon:103.86070,radius:180,type:'sg_mbs'},
    {name:'新加坡樟宜星耀與金融區摩天樓群',lat:1.34500,lon:103.96200,radius:165,type:'intl_city_cluster',seed:401,count:86,span:2300,maxH:210},
    {name:'馬尼拉灣摩天輪與 BGC 金融摩天樓群',lat:14.53500,lon:121.00200,radius:175,type:'manila_skyline'},
    {name:'Formosa Aero Secret Sanctum',lat:25.05850,lon:121.58200,radius:40,type:'secret_monolith'}
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
    }else if(site.type==='tokyo_skytree'){
      box(g,stone,88,28,88,0,14,0);
      cyl(g,whiteFrame,18,34,350,6,0,175,0);
      cyl(g,officeGlass,24,22,22,18,0,350,0);
      cyl(g,whiteFrame,10,16,100,12,0,400,0);
      cyl(g,officeGlass,16,15,16,18,0,450,0);
      cyl(g,metal,2.2,9,184,12,0,542,0);
      box(g,beaconMat,3,3,3,0,635,0);
    }else if(site.type==='tokyo_tower'){
      for(const sx of [-28,28])for(const sz of [-28,28]){
        const leg=box(g,pagodaRed,7,125,7,sx*.6,62,sz*.6);
        leg.rotation.z=sx>0?.18:-.18;leg.rotation.x=sz>0?-.18:.18;
      }
      box(g,whiteFrame,42,16,42,0,122,0);
      cyl(g,pagodaRed,5,14,130,4,0,192,0).rotation.y=Math.PI/4;
      box(g,whiteFrame,22,12,22,0,252,0);
      cyl(g,pagodaRed,1.4,4.8,76,8,0,295,0);
      box(g,beaconMat,2.5,2.5,2.5,0,334,0);
    }else if(site.type==='suspension_bridge'){
      for(const sx of [-190,190]){
        box(g,whiteFrame,14,148,26,sx,74,0);
        box(g,whiteFrame,16,6,28,sx,115,0);
        box(g,beaconMat,2.2,2.2,2.2,sx,150,0);
      }
      box(g,roadMat,680,4.5,24,0,46,0);
      for(let i=-12;i<=12;i++){
        const t=(Math.abs(i)%6)/6,cy=48+88*t*t;
        box(g,whiteFrame,2.2,cy-46,2.2,i*26,46+(cy-46)/2,11);
        box(g,whiteFrame,2.2,cy-46,2.2,i*26,46+(cy-46)/2,-11);
      }
    }else if(site.type==='hk_central'){
      // IFC 2 (415m) + Bank of China prism (367m) + Central Harbourfront towers
      box(g,stone,74,26,74,0,13,0);
      box(g,officeGlass,52,375,52,0,200,0);
      for(const s of [-25,25])box(g,whiteFrame,4.5,398,14,s,206,0);
      cyl(g,metal,12,26,24,8,0,400,0);
      box(g,beaconMat,2.8,2.8,2.8,0,415,0);
      // Bank of China Tower nearby
      box(g,darkGlass,44,295,44,125,148,45);
      cyl(g,whiteFrame,2,28,72,4,125,331,45).rotation.y=Math.PI/4;
      cyl(g,metal,.8,1.6,38,6,125,368,45);
      for(let i=0;i<36;i++){
        const a=i*2.39996,r=140+((i*53)%780);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r;
        const bh=65+((i*41)%195),bw=24+((i*17)%22);
        box(g,i%2?officeGlass:darkGlass,bw,bh,bw,bx,bh/2,bz);
        if(bh>140)box(g,beaconMat,1.8,1.8,1.8,bx,bh+1.5,bz);
      }
    }else if(site.type==='hk_icc'){
      box(g,stone,82,32,82,0,16,0);
      box(g,officeGlass,58,438,58,0,235,0);
      box(g,whiteFrame,60,18,60,0,462,0);
      box(g,beaconMat,3,3,3,0,484,0);
      for(let i=0;i<32;i++){
        const a=i*2.39996,r=135+((i*61)%680);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=58+((i*37)%165);
        box(g,i%3?officeGlass:wall,26,bh,24,bx,bh/2,bz);
      }
    }else if(site.type==='okinawa_naha'){
      // Shuri Castle vermilion hall + Naha Kokusai-dori city blocks
      box(g,stone,74,12,56,0,6,0);
      box(g,pagodaRed,48,18,32,0,21,0);
      cyl(g,pagodaRed,16,32,10,4,0,35,0).rotation.y=Math.PI/4;
      cyl(g,gold,1.2,2.5,6,6,0,42,0);
      for(let i=0;i<54;i++){
        const a=i*2.39996,r=120+((i*73)%1350);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=24+((i*29)%88),bw=22+((i*13)%18);
        box(g,i%3===0?officeGlass:wall,bw,bh,bw,bx,bh/2,bz);
      }
      box(g,roadMat,1800,1.2,18,0,1.2,90);
    }else if(site.type==='seoul_lotte'){
      cyl(g,officeGlass,11,36,515,16,0,258,0);
      cyl(g,whiteFrame,10,13,40,12,0,535,0);
      box(g,beaconMat,3,3,3,0,556,0);
      for(let i=0;i<38;i++){
        const a=i*2.39996,r=140+((i*67)%860);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=55+((i*43)%155);
        box(g,i%2?officeGlass:darkGlass,26,bh,26,bx,bh/2,bz);
      }
    }else if(site.type==='seoul_ntower'){
      box(g,stone,44,18,44,0,9,0);
      cyl(g,whiteFrame,7.5,9.5,145,16,0,82,0);
      cyl(g,officeGlass,18,16,18,20,0,162,0);
      cyl(g,metal,1.2,3.2,68,10,0,204,0);
      box(g,beaconMat,2.4,2.4,2.4,0,239,0);
    }else if(site.type==='sg_mbs'){
      // Marina Bay Sands 3 iconic towers + SkyPark ship deck + Supertrees + CBD
      for(const sx of [-68,0,68]){
        box(g,officeGlass,28,194,46,sx,97,0);
        box(g,whiteFrame,30,194,4,sx,97,22);
      }
      box(g,whiteFrame,210,9,54,18,198,0);
      cyl(g,officeGlass,24,14,16,16,95,8,65);
      // Supertrees
      for(const [tx,tz,th] of [[-85,-95,48],[-35,-115,52],[25,-105,45]]){
        cyl(g,pagodaRed,2.5,5.5,th,10,tx,th/2,tz);
        cyl(g,gold,16,4,5,12,tx,th,tz);
      }
      for(let i=0;i<44;i++){
        const a=i*2.39996,r=160+((i*71)%980);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=75+((i*47)%185);
        box(g,i%2?officeGlass:darkGlass,28,bh,26,bx,bh/2,bz);
      }
    }else if(site.type==='manila_skyline'){
      // MOA Eye Ferris Wheel + Makati/BGC high-rises
      cyl(g,whiteFrame,55,55,4,24,-120,62,80).rotation.x=Math.PI/2;
      box(g,metal,6,65,12,-120,32,80);
      for(let i=0;i<68;i++){
        const a=i*2.39996,r=85+((i*79)%1450);
        const bx=Math.cos(a)*r,bz=Math.sin(a)*r,bh=42+((i*53)%195),bw=24+((i*19)%22);
        box(g,i%3===0?darkGlass:i%2?officeGlass:wall,bw,bh,bw,bx,bh/2,bz);
        if(bh>150)box(g,beaconMat,1.8,1.8,1.8,bx,bh+1.5,bz);
      }
      box(g,roadMat,2100,1.2,20,0,1.2,0);
    }else if(site.type==='intl_city_cluster'){
      const cnt=site.count||80,span=site.span||2200,maxH=site.maxH||180,sd=site.seed||101;
      if(site.pagoda){
        for(let t=0;t<5;t++){
          const y=4+t*8.5,r=14-t*1.6;
          box(g,pagodaRed,r*1.5,5.5,r*1.5,0,y+2.5,0);
          cyl(g,pagodaGreen,r*.5,r*1.4,3,4,0,y+6.8,0).rotation.y=Math.PI/4;
        }
        cyl(g,gold,.5,1.8,12,8,0,52,0);
      }
      box(g,roadMat,span*.85,1.2,18,0,1.0,0);
      box(g,roadMat,18,1.2,span*.85,0,1.0,0);
      for(let i=1;i<=cnt;i++){
        const h1=Math.sin(i*12.9898+sd)*43758.5453,u1=h1-Math.floor(h1);
        const h2=Math.sin(i*78.233+sd*1.7)*43758.5453,u2=h2-Math.floor(h2);
        const h3=Math.sin(i*37.719+sd*2.3)*43758.5453,u3=h3-Math.floor(h3);
        const r=95+Math.pow(u1,.72)*(span*.5);
        const ang=u2*Math.PI*2;
        const bx=Math.cos(ang)*r,bz=Math.sin(ang)*r;
        const distRatio=1-Math.min(1,r/(span*.55));
        const bh=Math.round(22+(maxH-22)*Math.pow(u3,1.35)*(0.45+0.55*distRatio));
        const bw=18+Math.round((u1*22)%18),bd=18+Math.round((u2*22)%18);
        const matPick=bh>95?(i%2?officeGlass:darkGlass):(i%3===0?officeGlass:wall);
        box(g,matPick,bw,bh,bd,bx,bh/2,bz);
        if(bh>115){
          box(g,whiteFrame,bw+1.5,3,bd+1.5,bx,bh+1.5,bz);
          box(g,beaconMat,1.8,1.8,1.8,bx,bh+4,bz);
        }
        if(typeof BuildingCollision!=='undefined'&&bh>28){
          const wx=site.x+bx,wz=site.z+bz,gy=ground(wx,wz);
          BuildingCollision.addBox('intl:'+site.seed,wx-bw*.45,wz-bd*.45,wx+bw*.45,wz+bd*.45,gy+bh,gy-2);
        }
      }
    }else if(site.type==='secret_monolith'){
      cyl(g,gold,18,18,3,24,0,145,0).rotation.x=Math.PI/2;
      box(g,darkBasalt,8,38,3,0,145,0);
      box(g,beaconMat,2.4,2.4,2.4,0,168,0);
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
  if(typeof BuildingCollision!=='undefined'&&typeof THREE.Box3==='function'){
    landmarkSites.forEach((site,i)=>{
      try{
        const g=landmarkGroups[i];if(!g)return;
        const box=new THREE.Box3().setFromObject(g);
        const h=box.max.y-g.position.y;
        if(Number.isFinite(h)&&h>8){const gy=ground(site.x,site.z);BuildingCollision.addCircle('tw:landmarks',site.x,site.z,site.radius*.5,gy+h,gy-2);}
      }catch(e){}
    });
  }

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
    const cr=col.r,cg=col.g,cb=col.b,nx=normal[0],ny=normal[1],nz=normal[2];
    out.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
    out.n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
    if(uvs) out.uv.push(uvs[0][0],uvs[0][1],uvs[1][0],uvs[1][1],uvs[2][0],uvs[2][1]);
    else out.uv.push(a[0]*.25,a[2]*.25,b[0]*.25,b[2]*.25,c[0]*.25,c[2]*.25);
    out.c.push(cr,cg,cb,cr,cg,cb,cr,cg,cb);
  }
  function triFlat(out,ax,ay,az,bx,by,bz,cx,cy,cz,cr,cg,cb,nx,ny,nz,u0,v0,u1,v1,u2,v2){
    out.p.push(ax,ay,az,bx,by,bz,cx,cy,cz);
    out.n.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
    out.uv.push(u0,v0,u1,v1,u2,v2);
    out.c.push(cr,cg,cb,cr,cg,cb,cr,cg,cb);
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
  function emitUpTri(out,p0,p1,p2,y,cr,cg,cb){
    if((p1[1]-p0[1])*(p2[0]-p0[0])-(p1[0]-p0[0])*(p2[1]-p0[1])>0){
      triFlat(out,p0[0],y,p0[1],p1[0],y,p1[1],p2[0],y,p2[1],cr,cg,cb,0,1,0,p0[0]*.25,p0[1]*.25,p1[0]*.25,p1[1]*.25,p2[0]*.25,p2[1]*.25);
    }else{
      triFlat(out,p0[0],y,p0[1],p2[0],y,p2[1],p1[0],y,p1[1],cr,cg,cb,0,1,0,p0[0]*.25,p0[1]*.25,p2[0]*.25,p2[1]*.25,p1[0]*.25,p1[1]*.25);
    }
  }
  function polygon(out,points,y,col){
    const n=points.length,cr=col.r,cg=col.g,cb=col.b;
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

  function* buildTile(key,data){
    const group=new THREE.Group();group.name='Taiwan city tile '+key;
    group.userData.masks=[];
    const BC=typeof BuildingCollision!=='undefined'?BuildingCollision:null;
    if(BC)BC.clearGroup('tw:'+key);
    const walls=buffers(),glazed=buffers(),techs=buffers(),roofs=buffers();
    let built=0;
    for(const [x,z,h,tone,kind,coords] of data.b){
      if(skipBuilding(x,z))continue;
      const center=ground(x,z);
      if(center<0.35)continue;
      const points=[];
      let minX=1e9,minZ=1e9,maxX=-1e9,maxZ=-1e9;
      for(let i=0;i<coords.length;i+=2){
        const px=x+coords[i],pz=z+coords[i+1];
        points.push([px,pz]);
        if(px<minX)minX=px;if(px>maxX)maxX=px;
        if(pz<minZ)minZ=pz;if(pz>maxZ)maxZ=pz;
      }
      mask(group,minX-2,minZ-2,maxX+2,maxZ+2);
      let base=center;
      if(points.length<=4){
        const g0=ground(points[0][0],points[0][1]),g2=ground(points[2][0],points[2][1]);
        base=Math.min(center,g0,g2)-.55;
      }else{
        for(let i=0;i<points.length;i++){const gp=ground(points[i][0],points[i][1]);if(gp<base)base=gp;}
        base-=.45;
      }
      const top=center+h;
      if(BC){const sx=(maxX-minX)*.06,sz=(maxZ-minZ)*.06;BC.add('tw:'+key,minX+sx,minZ+sz,maxX-sx,maxZ-sz,top,base);}
      const col=palette[tone%palette.length].clone().multiplyScalar(h>70?.80:1);
      const cr=col.r,cg=col.g,cb=col.b;
      const isGlazed=(kind===1||h>=36);
      const isTech=(kind===2&&!isGlazed);
      const target=isGlazed?glazed:(isTech?techs:walls);
      const vScale=isGlazed?12.8:3.2;
      polygon(roofs,points,top,roofPalette[tone%roofPalette.length]);
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
        if(len<.05)continue;
        const nx=dz/len,nz=-dx/len;
        const u=len/12.8,v=(top-base)/vScale;
        triFlat(target,a[0],base,a[1],b[0],base,b[1],b[0],top,b[1],cr,cg,cb,nx,0,nz,0,0,u,0,u,v);
        triFlat(target,a[0],base,a[1],b[0],top,b[1],a[0],top,a[1],cr,cg,cb,nx,0,nz,0,0,u,v,0,v);
      }
      built++;if(built%260===0)yield;
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
    if(typeof BuildingCollision!=='undefined')BuildingCollision.clearGroup('tw:'+key);
    root.remove(group);loaded.delete(key);stats.tiles=loaded.size;stats.maskRevision++;
  }

  function requestTile(tile){
    const key=tile[0];pending.add(key);stats.loading=pending.size;
    fetch('taiwan-city/'+key+'.json?v=61').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
      .then(data=>jobs.push({key,iterator:buildTile(key,data)}))
      .catch(()=>{failed.set(key,clock+15);pending.delete(key);stats.loading=pending.size;});
  }

  // GPU-instanced multi-million settlement blocks (bottomless 2-group unit box = sides + roof = only 6 draw calls total)
  let settlementsMeta=null,settlementRequest=false;
  const loadedChunks=new Map(),pendingChunks=new Set();
  let lastInfillX=1e9,lastInfillZ=1e9,lastInfillRev=-1,lastInfillRange=0,chunkRevision=0,lastChunkRev=-1;
  function createInfillBoxGeometry(){
    const g=new THREE.BufferGeometry();
    // 4 walls (+x, -x, +z, -z) [0..23] + 1 roof (+y) [24..29]
    const pos=new Float32Array([
      0.5,0,-0.5, 0.5,0,0.5, 0.5,1,0.5,   0.5,0,-0.5, 0.5,1,0.5, 0.5,1,-0.5,
      -0.5,0,0.5, -0.5,0,-0.5, -0.5,1,-0.5, -0.5,0,0.5, -0.5,1,-0.5, -0.5,1,0.5,
      -0.5,0,0.5, 0.5,0,0.5, 0.5,1,0.5,   -0.5,0,0.5, 0.5,1,0.5, -0.5,1,0.5,
      0.5,0,-0.5, -0.5,0,-0.5, -0.5,1,-0.5, 0.5,0,-0.5, -0.5,1,-0.5, 0.5,1,-0.5,
      -0.5,1,0.5, 0.5,1,0.5, 0.5,1,-0.5,  -0.5,1,0.5, 0.5,1,-0.5, -0.5,1,-0.5
    ]);
    const norm=new Float32Array([
      1,0,0, 1,0,0, 1,0,0,   1,0,0, 1,0,0, 1,0,0,
      -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0,
      0,0,1, 0,0,1, 0,0,1,   0,0,1, 0,0,1, 0,0,1,
      0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
      0,1,0, 0,1,0, 0,1,0,   0,1,0, 0,1,0, 0,1,0
    ]);
    const uv=new Float32Array([
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1
    ]);
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('normal',new THREE.BufferAttribute(norm,3));
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    g.addGroup(0,24,0);
    g.addGroup(24,6,1);
    g.computeBoundingSphere();
    return g;
  }
  const infillGeo=createInfillBoxGeometry();
  const infillWallMat=new THREE.MeshStandardMaterial({color:0xffffff,map:facadeTex,roughness:.88,emissive:0xffe0ac,emissiveMap:facadeNight,emissiveIntensity:0});
  const infillRoofMat=new THREE.MeshStandardMaterial({color:0xc9d0cb,map:roofTex,roughness:.86});
  const infillOfficeMat=new THREE.MeshPhysicalMaterial({color:0xffffff,map:officeTex,roughnessMap:officeRough,roughness:.24,metalness:.66,clearcoat:.75,clearcoatRoughness:.20,envMap:reflectedMap,envMapIntensity:1.05,emissive:0xffe2aa,emissiveMap:officeNight,emissiveIntensity:0});
  const infillTechMat=new THREE.MeshStandardMaterial({color:0xffffff,map:techTex,roughness:.62,metalness:.22});
  const MAX_RES_INST=5600,MAX_OFF_INST=1600,MAX_TECH_INST=1600;
  const infillRes=new THREE.InstancedMesh(infillGeo,[infillWallMat,infillRoofMat],MAX_RES_INST);
  const infillOffice=new THREE.InstancedMesh(infillGeo,[infillOfficeMat,infillRoofMat],MAX_OFF_INST);
  const infillTech=new THREE.InstancedMesh(infillGeo,[infillTechMat,infillRoofMat],MAX_TECH_INST);
  for(const im of [infillRes,infillOffice,infillTech]){
    im.count=0;im.frustumCulled=false;im.receiveShadow=true;im.name='Taiwan multi-million infill';
    root.add(im);
  }
  const dummyObj=new THREE.Object3D();
  function ensureSettlementChunks(x,z,range){
    if(!settlementsMeta?.chunks)return;
    const chunkSz=settlementsMeta.chunkSize||24000;
    for(const [ck,cx,cz] of settlementsMeta.chunks){
      const d=Math.hypot(cx-x,cz-z);
      if(d<range+chunkSz*0.78&&!loadedChunks.has(ck)&&!pendingChunks.has(ck)&&pendingChunks.size<4){
        pendingChunks.add(ck);
        fetch('taiwan-city/settlements/'+ck+'.json?v=61').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
          .then(data=>{loadedChunks.set(ck,data.tiles||{});pendingChunks.delete(ck);chunkRevision++;})
          .catch(()=>{pendingChunks.delete(ck);});
      }else if(loadedChunks.has(ck)&&d>chunkSz*1.65){
        loadedChunks.delete(ck);chunkRevision++;
      }
    }
  }
  function refreshInfill(x,z,range){
    if(!settlementsMeta)return;
    const cellSz=settlementsMeta.cellSize||120,tileSz=settlementsMeta.tileSize||4800,chunkSz=settlementsMeta.chunkSize||24000;
    const maxR=Math.min(range,9000),maxR2=maxR*maxR;
    const tx0=Math.floor((x-maxR)/tileSz),tx1=Math.floor((x+maxR)/tileSz);
    const tz0=Math.floor((z-maxR)/tileSz),tz1=Math.floor((z+maxR)/tileSz);
    let nRes=0,nOff=0,nTech=0;
    const BC=typeof BuildingCollision!=='undefined'?BuildingCollision:null;
    if(BC)BC.clearGroup('tw:infill');
    for(let tx=tx0;tx<=tx1;tx++){
      for(let tz=tz0;tz<=tz1;tz++){
        const k=tx+'_'+tz;
        const sx=Math.floor(((tx+0.5)*tileSz)/chunkSz),sz=Math.floor(((tz+0.5)*tileSz)/chunkSz);
        const chunk=loadedChunks.get(sx+'_'+sz)||settlementsMeta.tiles;
        const rows=chunk?.[k];
        if(!rows)continue;
        for(let i=0;i<rows.length;i+=3){
          const gx=rows[i],gz=rows[i+1],flags=rows[i+2];
          const cellCx=(gx+0.5)*cellSz,cellCz=(gz+0.5)*cellSz;
          const ddx=cellCx-x,ddz=cellCz-z;
          const d2=ddx*ddx+ddz*ddz;
          if(d2>maxR2)continue;
          const kind=flags&3,dens=(flags>>2)&3,angIdx=(flags>>4)&31,hTier=(flags>>9)&7,slots=(flags>>12)&31;
          const ang=(angIdx/31)*Math.PI;
          const cosA=Math.cos(ang),sinA=Math.sin(ang);
          const count=d2<(3600*3600)?slots:Math.min(slots,dens>=2?8:4);
          let seed=(Math.imul(gx,73856093)^Math.imul(gz,19349663))>>>0;
          for(let s=0;s<count;s++){
            seed=(Math.imul(seed,1664525)+1013904223)>>>0;
            const u=((seed&0xffff)/65536-0.5)*(cellSz*0.84);
            const v=(((seed>>>16)&0xffff)/65536-0.5)*(cellSz*0.84);
            const bx=cellCx+u*cosA-v*sinA,bz=cellCz+u*sinA+v*cosA;
            if(blocked(bx,bz)||skipBuilding(bx,bz))continue;
            const gy=ground(bx,bz);
            if(gy<0.9)continue;
            if(Math.abs(ground(bx+8,bz)-gy)>4.2||Math.abs(ground(bx,bz+8)-gy)>4.2)continue;
            seed=(Math.imul(seed,1664525)+1013904223)>>>0;
            const r1=(seed&255)/255,r2=((seed>>>8)&255)/255,r3=((seed>>>16)&255)/255;
            const bh=(kind===2?(8.5+r1*8.5):(hTier>=5?(18+r1*26):(dens>=2?(11+r1*13):(8.5+r1*6.5))));
            const bw=kind===2?(16+r2*18):(dens>=3?(12+r2*12):(8.5+r2*7.5));
            const bd=kind===2?(14+r3*14):(dens>=3?(11+r3*10):(8.0+r3*6.5));
            const col=palette[(seed>>>24)%palette.length];
            dummyObj.position.set(bx,gy-0.55,bz);
            dummyObj.rotation.set(0,-ang+((seed&1)?0:Math.PI*0.5),0);
            dummyObj.scale.set(bw,bh,bd);
            dummyObj.updateMatrix();
            if(BC&&d2<2500*2500){const hr=Math.max(bw,bd)*.42;BC.add('tw:infill',bx-hr,bz-hr,bx+hr,bz+hr,gy-0.55+bh,gy-2);}
            if(kind===2&&nTech<MAX_TECH_INST){
              infillTech.setMatrixAt(nTech,dummyObj.matrix);infillTech.setColorAt(nTech,col);nTech++;
            }else if((kind===1||bh>=28)&&nOff<MAX_OFF_INST){
              infillOffice.setMatrixAt(nOff,dummyObj.matrix);infillOffice.setColorAt(nOff,col);nOff++;
            }else if(nRes<MAX_RES_INST){
              infillRes.setMatrixAt(nRes,dummyObj.matrix);infillRes.setColorAt(nRes,col);nRes++;
            }
          }
        }
      }
    }
    infillRes.count=nRes;infillRes.instanceMatrix.needsUpdate=true;if(infillRes.instanceColor)infillRes.instanceColor.needsUpdate=true;
    infillOffice.count=nOff;infillOffice.instanceMatrix.needsUpdate=true;if(infillOffice.instanceColor)infillOffice.instanceColor.needsUpdate=true;
    infillTech.count=nTech;infillTech.instanceMatrix.needsUpdate=true;if(infillTech.instanceColor)infillTech.instanceColor.needsUpdate=true;
    stats.activeInfill=nRes+nOff+nTech;
  }

  let roadsMeta=null,roadIndexReq=false;
  const loadedRoadChunks=new Map(),pendingRoadChunks=new Set();
  function* buildRoadChunk(ck,data){
    const group=new THREE.Group();group.name='Taiwan highway chunk '+ck;
    const roads=buffers(),curbs=buffers(),bridgeColor={r:.72,g:.74,b:.76},pierColor={r:.58,g:.61,b:.63};
    const arr=data.r||[];
    for(let r=0;r<arr.length;r++){
      const [width,bridge,coords]=arr[r];
      let cumDist=0;
      const half=width*.5,liftBridge=bridge?8:0;
      for(let i=2;i<coords.length;i+=2){
        const ax=coords[i-2],az=coords[i-1],bx=coords[i],bz=coords[i+1],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
        if(length<.2)continue;
        const nx=-dz/length,nz=dx/length;
        const sections=Math.max(1,Math.ceil(length/55));
        for(let part=0;part<sections;part++){
          const t=part/sections,u=(part+1)/sections;
          const x=ax+dx*t,z=az+dz*t,x2=ax+dx*u,z2=az+dz*u;
          const segLen=length/sections,v0=cumDist/32,v1=(cumDist+segLen)/32;
          cumDist+=segLen;
          if(airports.some(a=>Math.hypot(x-a.x,z-a.z)<a.length/2+110&&Math.abs(runwayCoordinates(x,z,a).cross)<260))continue;
          const g1=ground(x,z),g2=ground(x2,z2);
          if(!bridge&&g1<.2&&g2<.2)continue;
          const y1=Math.max(.35,g1)+.24+liftBridge,y2=Math.max(.35,g2)+.24+liftBridge;
          const lx1=x+nx*half,lz1=z+nz*half,rx1=x-nx*half,rz1=z-nz*half;
          const lx2=x2+nx*half,lz2=z2+nz*half,rx2=x2-nx*half,rz2=z2-nz*half;
          triFlat(roads,lx1,y1,lz1,rx1,y1,rz1,rx2,y2,rz2,1,1,1,0,1,0,0,v0,1,v0,1,v1);
          triFlat(roads,lx1,y1,lz1,rx2,y2,rz2,lx2,y2,lz2,1,1,1,0,1,0,0,v0,1,v1,0,v1);
          if(bridge){
            for(const s of [-1,1]){
              const outOff=half+.5,inOff=half-.1;
              triFlat(curbs,x+nx*s*outOff,y1+1.0,z+nz*s*outOff,x+nx*s*inOff,y1+1.0,z+nz*s*inOff,x2+nx*s*inOff,y2+1.0,z2+nz*s*inOff,bridgeColor.r,bridgeColor.g,bridgeColor.b,0,1,0,0,0,1,0,1,1);
              triFlat(curbs,x+nx*s*outOff,y1+1.0,z+nz*s*outOff,x2+nx*s*inOff,y2+1.0,z2+nz*s*inOff,x2+nx*s*outOff,y2+1.0,z2+nz*s*outOff,bridgeColor.r,bridgeColor.g,bridgeColor.b,0,1,0,0,0,1,1,0,1);
            }
            if(part===0&&length>20){
              const mx=(x+x2)*.5,mz=(z+z2)*.5,gm=ground(mx,mz),pw=1.6;
              triFlat(curbs,mx-pw,gm-.5,mz-pw,mx+pw,gm-.5,mz-pw,mx+pw,y1,mz-pw,pierColor.r,pierColor.g,pierColor.b,0,0,-1,0,0,1,0,1,1);
              triFlat(curbs,mx-pw,gm-.5,mz-pw,mx+pw,y1,mz-pw,mx-pw,y1,mz-pw,pierColor.r,pierColor.g,pierColor.b,0,0,-1,0,0,1,1,0,1);
            }
          }
        }
      }
      if(r%90===0)yield;
    }
    addLayerMesh(group,roads,roadMat,'Taiwan highways and streets');
    addLayerMesh(group,curbs,roadCurbMat,'Taiwan highway bridge parapets');
    root.add(group);loadedRoadChunks.set(ck,group);
  }
  function ensureRoadChunks(x,z,range){
    if(!roadsMeta?.chunks)return;
    const maxD=Math.max(14000,range*1.85);
    for(const [ck,cx,cz] of roadsMeta.chunks){
      const d=Math.hypot(cx-x,cz-z);
      const existing=loadedRoadChunks.get(ck);
      if(existing)existing.visible=d<maxD+8000;
      if(d<maxD&&!existing&&!pendingRoadChunks.has(ck)&&pendingRoadChunks.size<3){
        pendingRoadChunks.add(ck);
        fetch('taiwan-city/roads/'+ck+'.json?v=62').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
          .then(data=>jobs.push({key:'r_'+ck,iterator:buildRoadChunk(ck,data),isRoad:ck}))
          .catch(()=>{pendingRoadChunks.delete(ck);});
      }else if(existing&&d>maxD+18000){
        existing.traverse(o=>o.geometry?.dispose());
        root.remove(existing);loadedRoadChunks.delete(ck);
      }
    }
  }

  function update(dt,x,z,quality,activeDay,wet){
    clock+=Math.min(dt,.1);day=activeDay;
    const at=latLon(x,z);
    const inTaiwan=at.lat>21.6&&at.lat<26.6&&at.lon>117.9&&at.lon<122.4;
    const near=inTaiwan||landmarkSites.some(s=>Math.hypot(s.x-x,s.z-z)<65000);
    root.visible=near;if(!near)return;
    const mobile=touchControls.mode.value==='mobile';
    const range=mobile?5000:quality==='ultra'?12000:quality==='high'?9600:7400;
    const nightWall=(1-day)*.78,nightOff=Math.pow(1-day,1.25)*1.28,envInt=.28+day*1.15;
    wall.emissiveIntensity=nightWall;
    infillWallMat.emissiveIntensity=nightWall;
    darkGlass.emissiveIntensity=(1-day)*.92;
    officeGlass.emissiveIntensity=nightOff;
    infillOfficeMat.emissiveIntensity=nightOff;
    officeGlass.envMapIntensity=infillOfficeMat.envMapIntensity=envInt;
    roadMat.roughness=wet?.28:.84;roadMat.metalness=wet?.22:.02;
    roadMat.emissiveIntensity=Math.pow(1-day,1.25)*(wet?1.25:1.05);
    beaconMat.emissiveIntensity=(Math.sin(clock*4.5)>0?2.1:.15)*(0.45+(1-day)*1.4);
    for(let i=0;i<landmarkGroups.length;i++){
      const g=landmarkGroups[i];
      const d=Math.hypot(g.position.x-x,g.position.z-z);
      const show=d<Math.max(28000,range*2.4);
      g.visible=show;
      if(show&&!g.userData.grounded){
        g.position.y=ground(g.position.x,g.position.z);
        g.userData.grounded=true;
      }
    }
    if(!index&&!indexRequest&&clock>=nextScan){
      indexRequest=true;
      fetch('taiwan-city/index.json?v=61').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{
          index=data;stats.ready=true;root.userData.coverage=data;
          stats.infillCapacity=data.counts?.infillBuildings||0;
          stats.taiwanTotalBuildings=data.counts?.taiwanTotalBuildings||data.counts?.buildings||0;
        })
        .catch(()=>{indexRequest=false;nextScan=clock+12;});
    }
    if(!roadIndexReq){
      roadIndexReq=true;
      fetch('taiwan-city/roads/index.json?v=62').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{roadsMeta=data;stats.roads=data.roads||0;ensureRoadChunks(x,z,range);})
        .catch(()=>{roadIndexReq=false;});
    }
    if(!settlementsMeta&&!settlementRequest){
      settlementRequest=true;
      fetch('taiwan-city/settlements.json?v=61').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
        .then(data=>{settlementsMeta=data;chunkRevision++;ensureSettlementChunks(x,z,range);})
        .catch(()=>{settlementRequest=false;});
    }
    if(index&&clock>=nextScan){
      nextScan=clock+.45;
      const distances=index.tiles.map(t=>[t,Math.hypot(t[1]-x,t[2]-z)]).sort((a,b)=>a[1]-b[1]);
      for(const [tile,distance] of distances){
        const mesh=loaded.get(tile[0]);if(mesh)mesh.visible=distance<range+4200;
        if(distance<range+3600&&!mesh&&!pending.has(tile[0])&&(failed.get(tile[0])??0)<clock&&pending.size<4)requestTile(tile);
        if(mesh&&distance>range+7500)disposeTile(tile[0]);
      }
      ensureSettlementChunks(x,z,range);
      ensureRoadChunks(x,z,range);
    }
    if(settlementsMeta&&(Math.hypot(x-lastInfillX,z-lastInfillZ)>280||stats.maskRevision!==lastInfillRev||chunkRevision!==lastChunkRev||range!==lastInfillRange)){
      lastInfillX=x;lastInfillZ=z;lastInfillRev=stats.maskRevision;lastChunkRev=chunkRevision;lastInfillRange=range;
      refreshInfill(x,z,range);
    }
    const end=performance.now()+(mobile?4.0:8.0);
    while(jobs.length&&performance.now()<end){
      const job=jobs[0];
      try{
        if(job.iterator.next().done){
          jobs.shift();
          if(job.isRoad)pendingRoadChunks.delete(job.isRoad);
          else{pending.delete(job.key);stats.loading=pending.size;}
          nextScan=0;
        }
      }catch(error){
        jobs.shift();
        if(job.isRoad)pendingRoadChunks.delete(job.isRoad);
        else{pending.delete(job.key);failed.set(job.key,clock+15);}
        console.warn('Taiwan tile:',error);
      }
    }
  }
  return {root,stats,inside,update,landmarks,landmarkSites,blocked};
}
if(typeof module!=='undefined')module.exports={createTaiwanCity};
