'use strict';
const regionalOrigin={lat:25+(4+10.535/60)/60,lon:121+(33+9.085/60)/60};
const eastScale=111319.49*Math.cos(regionalOrigin.lat*Math.PI/180);
function geoPoint(lat,lon){return {x:(lon-regionalOrigin.lon)*eastScale,z:(regionalOrigin.lat-lat)*110772};}
function latLon(x,z){return {lat:regionalOrigin.lat-z/110772,lon:regionalOrigin.lon+x/eastScale};}
function airport(code,name,lat,lon,degrees,length,width,elevation,designator,reciprocal,apron=175){
  return {code,name,lat,lon,...geoPoint(lat,lon),heading:degrees*Math.PI/180,length,width,elevation,designator,reciprocal,apron};
}
const taiwanAirports=[
  airport('RCSS','松山',regionalOrigin.lat,regionalOrigin.lon,92.22,2605,60,4.11,'10','28'),
  airport('RCYU','花蓮',24+(1+25.335/60)/60,121+(37+.955/60)/60,206.29,2751,45,14.48,'21','03',-170),
  airport('RCTP','桃園',25+5.02175/60,121+13.78283/60,49.08,3660,60,20.88,'05L','23R'),
  airport('RCMQ','臺中',24+15.90367/60,120+37.24308/60,176.69,3659,61,200.56,'18','36'),
  airport('RCKH','高雄',22+34.62258/60,120+21.05717/60,91.90,3150,60,7.93,'09','27'),
  airport('RCFN','臺東',22+45.29233/60,121+6.099/60,38.64,2438,45,41.61,'04','22'),
  airport('RCBS','金門',24+25.675833/60,118+21.534167/60,63.39,3004,45,17.07,'06','24'),
  airport('RCQC','澎湖',23+34.11742/60,119+37.69433/60,18.22,3000,45,22.71,'02','20'),
  {...airport('RCGI','綠島',22+(40+23.625/60)/60,121+(27+58.30/60)/60,164.18,917,23,8.38,'17','35',-47),
    shortField:true,parkingAlong:-9},
  {...airport('RCLY','蘭嶼',22+(1+43/60)/60,121+(32+1.85/60)/60,309.96,1132,30,12.95,'31','13',51),
    shortField:true,parkingAlong:-261},
  {...airport('CVN78','福特號航空母艦',24+(21/60),122+(9/60),0,333,78,18.5,'01','19',-40),
    carrier:true,shortField:true,catapult:true,arrestor:true,parkingAlong:20},
];
const internationalAirports=[
  airport('RJAA','東京成田',35+(45+31.88/60)/60,140+(22+46.255/60)/60,329.51,4000,60,41,'34L','16R',-205),
  airport('RJTT','東京羽田',35.5494,139.7798,337.0,3360,60,6.4,'34R','16L',-195),
  airport('VHHH','香港赤鱲角',22+(18+29/60)/60,113+(55+6/60)/60,71.0,3800,60,9,'07L','25R',185),
  airport('ROAH','沖繩那霸',26+(11+45/60)/60,127+(38+45/60)/60,183.0,3000,45,3.5,'18R','36L',-170),
  airport('RKSI','首爾仁川',37.4602,126.4407,333.0,4000,60,7.0,'33L','15R',-200),
  airport('WSSS','新加坡樟宜',1.3592,103.9893,23.0,4000,60,6.7,'02L','20R',190),
  airport('RPLL','馬尼拉尼諾伊',14.5086,121.0194,61.0,3737,60,22.9,'06','24',-185)
];
var allAirports=[...taiwanAirports,...internationalAirports];
function runwayCoordinates(x,z,r){
  const dx=x-r.x,dz=z-r.z,s=Math.sin(r.heading),c=Math.cos(r.heading);
  return {along:dx*s-dz*c,cross:dx*c+dz*s};
}
function airportPoint(r,along,cross){
  const s=Math.sin(r.heading),c=Math.cos(r.heading);
  return {x:r.x+along*s+cross*c,z:r.z-along*c+cross*s};
}
const parkingPoint=r=>airportPoint(r,r.parkingAlong??65,r.apron);
const regionalWaypoints=[
  {name:'東北角外海',...geoPoint(25.023,122.035)},
  {name:'宜蘭外海',...geoPoint(24.759,122.027)},
  {name:'南澳外海',...geoPoint(24.425,121.858)}
];
function regionalRoute(from,to){
  const finish=[{name:'進場定位點',...airportPoint(to,-6600,0)},
    {name:to.name+' '+to.designator+' 跑道',...airportPoint(to,-to.length/2+200,0)}];
  if(from.code==='RCSS'&&to.code==='RCYU') return [...regionalWaypoints,...finish];
  if(to.code==='RJAA'||to.code==='RJTT') return [
    {name:'東海航段',...geoPoint(27.55,126.30)},
    {name:'琉球東方航段',...geoPoint(29.68,131.37)},
    {name:'駿河灣富士山觀景航點',...geoPoint(35.12,138.82)},
    {name:to.code==='RJTT'?'東京灣彩虹大橋進場點':'房總外海下降點',...geoPoint(to.code==='RJTT'?35.48:34.83,to.code==='RJTT'?139.84:140.65)},
    ...finish
  ];
  if(to.code==='VHHH') return [
    {name:'海峽西南航段',...geoPoint(23.20,118.80)},
    {name:'東沙北航段',...geoPoint(22.60,116.20)},
    {name:'維多利亞港進場走廊',...geoPoint(22.29,114.16)},
    ...finish
  ];
  if(to.code==='ROAH') return [
    {name:'宮古島北航段',...geoPoint(25.30,125.20)},
    {name:'慶良間諸島航段',...geoPoint(26.05,127.20)},
    ...finish
  ];
  if(to.code==='RKSI') return [
    {name:'東海北方航段',...geoPoint(28.80,123.50)},
    {name:'濟州島西側航段',...geoPoint(33.40,126.10)},
    {name:'黃海仁川進場點',...geoPoint(36.90,126.30)},
    ...finish
  ];
  if(to.code==='WSSS') return [
    {name:'南海北段航點',...geoPoint(18.50,116.50)},
    {name:'南沙西側航段',...geoPoint(9.20,109.80)},
    {name:'馬六甲海峽進場點',...geoPoint(1.80,104.20)},
    ...finish
  ];
  if(to.code==='RPLL') return [
    {name:'巴士海峽航段',...geoPoint(20.20,121.10)},
    {name:'呂宋北岸航段',...geoPoint(17.40,120.60)},
    {name:'馬尼拉灣進場點',...geoPoint(14.48,120.85)},
    ...finish
  ];
  if(from.code==='RJAA'||from.code==='RJTT') return [
    {name:'東京灣離場航點',...geoPoint(35.35,139.65)},
    {name:'富士山南麓航段',...geoPoint(35.15,138.75)},
    {name:'琉球東方航段',...geoPoint(29.68,131.37)},
    {name:'彭佳嶼東北下降點',...geoPoint(26.00,122.50)},
    ...finish
  ];
  if(from.code==='VHHH') return [
    {name:'大嶼山出發航段',...geoPoint(22.25,114.15)},
    {name:'東沙北航段',...geoPoint(22.60,116.20)},
    {name:'海峽西南航段',...geoPoint(23.20,118.80)},
    ...finish
  ];
  if(from.code==='ROAH') return [
    {name:'慶良間諸島航段',...geoPoint(26.05,127.20)},
    {name:'宮古島北航段',...geoPoint(25.30,125.20)},
    {name:'宜蘭外海下降點',...geoPoint(24.85,122.30)},
    ...finish
  ];
  if(from.code==='RKSI') return [
    {name:'仁川大橋離場點',...geoPoint(37.10,126.35)},
    {name:'濟州海峽航段',...geoPoint(33.40,126.10)},
    {name:'彭佳嶼北方下降點',...geoPoint(26.10,122.10)},
    ...finish
  ];
  if(from.code==='WSSS') return [
    {name:'濱海灣離場點',...geoPoint(1.55,104.10)},
    {name:'南海中段航點',...geoPoint(11.00,112.00)},
    {name:'高雄西南下降點',...geoPoint(21.80,119.80)},
    ...finish
  ];
  if(from.code==='RPLL') return [
    {name:'馬尼拉灣離場點',...geoPoint(14.75,120.80)},
    {name:'呂宋海峽航段',...geoPoint(19.50,120.90)},
    ...finish
  ];
  return finish;
}
const regionalGridStep=240;
function islandGridAt(x,z){
  if(typeof islandElevationData==='undefined') return;
  return islandElevationData.find(([left,top,columns,rows])=>
    x>=left&&z>=top&&x<left+(columns-1)*40&&z<top+(rows-1)*40);
}
function islandHeight(x,z,grid){
  const [left,top,columns]=grid;
  if(typeof grid[4]==='string'){
    const raw=atob(grid[4]),samples=new Uint16Array(raw.length/2);
    for(let i=0;i<samples.length;i++) samples[i]=raw.charCodeAt(i*2)|raw.charCodeAt(i*2+1)<<8;
    grid[4]=samples;
  }
  const u=(x-left)/40,v=(z-top)/40;
  const col=Math.floor(u),row=Math.floor(v),a=u-col,b=v-row,k=row*columns+col,h=grid[4];
  return (h[k]*(1-a)+h[k+1]*a)*(1-b)+(h[k+columns]*(1-a)+h[k+columns+1]*a)*b;
}
function shortFieldBlend(r,along,cross,padding=0){
  const runwayEdge=Math.max(Math.abs(along)-r.length/2-18,Math.abs(cross)-r.width/2-14);
  const apronEdge=Math.max(Math.abs(along-r.parkingAlong)-48,Math.abs(cross-r.apron/2)-Math.abs(r.apron)/2-20);
  return 1-Math.max(0,Math.min(1,(Math.min(runwayEdge,apronEdge)-padding)/66));
}
let centralMountainTiles;
function registerCentralMountains(tiles){centralMountainTiles=tiles;}
function centralMountainTile(col,row){return centralMountainTiles?.[col+':'+row];}
function detailedMountainHeight(x,z,base){
  const span=11520,step=120,side=span/step+1;
  const col=Math.floor(x/span),row=Math.floor(z/span),key=col+':'+row;
  let samples=centralMountainTile(col,row);
  if(!samples||base<350) return base;
  if(typeof samples==='string'){
    const raw=atob(samples);
    samples=new Uint16Array(side*side);
    for(let i=0;i<samples.length;i++) samples[i]=raw.charCodeAt(2*i)|raw.charCodeAt(2*i+1)<<8;
    centralMountainTiles[key]=samples;
  }
  const u=x/step-col*(side-1),v=z/step-row*(side-1);
  const i=Math.min(side-2,Math.floor(u)),j=Math.min(side-2,Math.floor(v)),a=u-i,b=v-j,k=j*side+i;
  const detail=(samples[k]*(1-a)+samples[k+1]*a)*(1-b)+(samples[k+side]*(1-a)+samples[k+side+1]*a)*b;
  const edge=Math.min(u,v,side-1-u,side-1-v);
  const blend=Math.min(1,edge/4,(base-350)/250);
  return base+(detail-base)*blend;
}
function internationalTerrainHeight(x,z){
  if(Math.abs(x)<360000&&Math.abs(z)<360000) return 0;
  const {lat,lon}=latLon(x,z);
  const noise=(Math.sin(x*.00043)+Math.cos(z*.00039)+Math.sin((x+z)*.00021))*.33;
  // 1. Japan Kanto / Tokyo Bay / Haneda / Narita / Mt. Fuji
  if(lat>=34.6&&lat<=36.5&&lon>=138.3&&lon<=141.0){
    const fujiKm=Math.hypot((lat-35.3606)*111,(lon-138.7274)*90.5);
    if(fujiKm<32){
      const cone=3776*Math.exp(-Math.pow(fujiKm/9.2,1.62));
      const crater=fujiKm<0.9?(0.9-fujiKm)*220:0;
      return Math.max(45,cone-crater+noise*28);
    }
    const hakoneKm=Math.hypot((lat-35.23)*111,(lon-139.02)*90.5);
    const tanzawaKm=Math.hypot((lat-35.47)*111,(lon-139.16)*90.5);
    const inTokyoBay=lat>=35.22&&lat<=35.63&&lon>=139.77&&lon<=140.04&&Math.hypot((lat-35.5494)*111,(lon-139.7798)*90.5)>3.2;
    if(inTokyoBay) return 0;
    let h=14+noise*9;
    if(hakoneKm<18) h+=1150*Math.exp(-Math.pow(hakoneKm/8.5,1.8));
    if(tanzawaKm<22) h+=1420*Math.exp(-Math.pow(tanzawaKm/10,1.8));
    if(lon>140.0&&lat<35.35) h+=190*Math.max(0,1-Math.hypot((lat-35.15)*111,(lon-140.12)*90.5)/24);
    return Math.max(4,h);
  }
  // 2. Okinawa Main Island (ROAH)
  if(lat>=26.04&&lat<=26.88&&lon>=127.60&&lon<=128.35){
    const spineLon=127.67+(lat-26.15)*0.76;
    const crossKm=Math.abs(lon-spineLon)*99.5;
    if(crossKm>9.5) return 0;
    const northHill=Math.max(0,(lat-26.32)*620);
    const shuriHill=135*Math.exp(-Math.pow(Math.hypot((lat-26.217)*111,(lon-127.719)*99.5)/3.8,1.8));
    return Math.max(4,(1-Math.pow(crossKm/9.5,1.8))*(22+northHill+noise*12)+shuriHill);
  }
  // 3. Hong Kong (VHHH / Lantau / Victoria Harbour / Victoria Peak / Kowloon)
  if(lat>=22.15&&lat<=22.56&&lon>=113.84&&lon<=114.36){
    const clkKm=Math.hypot((lat-22.308)*111,(lon-113.9185)*102.5);
    if(clkKm<3.4) return 8.5;
    const lantauPeak=934*Math.exp(-Math.pow(Math.hypot((lat-22.246)*111,(lon-113.922)*102.5)/4.4,1.75));
    const sunsetPeak=869*Math.exp(-Math.pow(Math.hypot((lat-22.261)*111,(lon-113.957)*102.5)/4.5,1.75));
    const vicPeak=552*Math.exp(-Math.pow(Math.hypot((lat-22.2759)*111,(lon-114.1455)*102.5)/3.2,1.7));
    const taiMoShan=957*Math.exp(-Math.pow(Math.hypot((lat-22.411)*111,(lon-114.123)*102.5)/6.8,1.75));
    const lionRock=495*Math.exp(-Math.pow(Math.hypot((lat-22.352)*111,(lon-114.187)*102.5)/3.4,1.8));
    const inHarbour=lat>=22.286&&lat<=22.301&&lon>=114.13&&lon<=114.23;
    if(inHarbour) return 0;
    const kowloonFlat=(lat>=22.26&&lat<=22.39&&lon>=114.13&&lon<=114.25)?14+noise*5:0;
    const h=Math.max(lantauPeak,sunsetPeak,vicPeak,taiMoShan,lionRock,kowloonFlat);
    return h>4?h:0;
  }
  // 4. Seoul / Incheon (RKSI / Songdo / Han River / Namsan / Bukhansan)
  if(lat>=37.25&&lat<=37.78&&lon>=126.35&&lon<=127.22){
    const yeongjongKm=Math.hypot((lat-37.465)*111,(lon-126.465)*88.2);
    if(yeongjongKm<8.2){
      const baegun=142*Math.exp(-Math.pow(Math.hypot((lat-37.488)*111,(lon-126.512)*88.2)/2.4,1.8));
      return Math.max(6.5,8+baegun);
    }
    if(lon<126.60) return 0;
    const namsan=262*Math.exp(-Math.pow(Math.hypot((lat-37.5512)*111,(lon-126.9882)*88.2)/2.3,1.75));
    const bukhansan=836*Math.exp(-Math.pow(Math.hypot((lat-37.6587)*111,(lon-126.9770)*88.2)/5.2,1.75));
    const gwanaksan=632*Math.exp(-Math.pow(Math.hypot((lat-37.444)*111,(lon-126.963)*88.2)/4.5,1.75));
    return Math.max(12,18+noise*8+namsan+bukhansan+gwanaksan);
  }
  // 5. Singapore (WSSS / Marina Bay / Bukit Timah)
  if(lat>=1.20&&lat<=1.49&&lon>=103.60&&lon<=104.06){
    const rx=(lon-103.83)*111.3/23.5,ry=(lat-1.355)*110.6/13.2;
    if(rx*rx+ry*ry>1.08) return 0;
    const bukitTimah=163*Math.exp(-Math.pow(Math.hypot((lat-1.3547)*110.6,(lon-103.7764)*111.3)/3.2,1.8));
    return Math.max(5.5,11+noise*4+bukitTimah);
  }
  // 6. Manila (RPLL / Manila Bay / Makati / Bataan / Sierra Madre)
  if(lat>=14.25&&lat<=14.88&&lon>=120.40&&lon<=121.35){
    const bataan=1388*Math.exp(-Math.pow(Math.hypot((lat-14.52)*111,(lon-120.48)*107.5)/8.5,1.75));
    if(bataan>8) return bataan;
    if(lon<120.975) return 0;
    const sierra=lon>121.12?(lon-121.12)*2400+noise*35:0;
    return Math.max(8,16+noise*6+sierra);
  }
  return 0;
}
function regionalHeight(x,z){
  let height=0;
  if(x>=-18000&&x<=18000&&z>=-18000&&z<=18000){
    height=groundHeight(x,z);
  }else{
    const u=(x-regionalElevation.x)/regionalGridStep,v=(z-regionalElevation.z)/regionalGridStep;
    const i=Math.floor(u),j=Math.floor(v);
    const {columns,rows,heights}=regionalElevation;
    if(i>=0&&j>=0&&i<columns-1&&i>=0&&j<rows-1){
      const a=u-i,b=v-j,k=j*columns+i;
      height=(heights[k]*(1-a)+heights[k+1]*a)*(1-b)+(heights[k+columns]*(1-a)+heights[k+columns+1]*a)*b;
    }
  }
  if(typeof kinmenElevation!=='undefined'&&x< -270000){
    const {lat,lon}=latLon(x,z);
    const grid=kinmenElevation;
    const u=(lon-grid.west)/grid.step,v=(grid.north-lat)/grid.step;
    const i=Math.floor(u),j=Math.floor(v),n=grid.columns;
    if(i>=0&&j>=0&&i<n-1&&j<grid.rows-1){
      const a=u-i,b=v-j,k=j*n+i,h=grid.heights;
      height=(h[k]*(1-a)+h[k+1]*a)*(1-b)+(h[k+n]*(1-a)+h[k+n+1]*a)*b;
    }
  }
  const intlH=internationalTerrainHeight(x,z);
  if(intlH>height) height=intlH;
  if(typeof naritaHeight==='function'&&x>1500000){
    const nh=naritaHeight(x,z);
    if(nh>0) height=nh;
  }
  if(centralMountainTiles&&height>350) height=detailedMountainHeight(x,z,height);
  const island=islandGridAt(x,z);
  if(island) height=islandHeight(x,z,island);
  for(const r of allAirports){
    const reach=r.length/2+550;
    if(Math.abs(x-r.x)>reach||Math.abs(z-r.z)>reach) continue;
    const {along,cross}=runwayCoordinates(x,z,r);
    if(r.carrier){
      if(Math.abs(along)<=r.length/2+8&&Math.abs(cross)<=r.width/2+6){
        return r.elevation;
      }
      continue;
    }
    const blend=r.shortField?shortFieldBlend(r,along,cross):
      Math.max(0,1-Math.max((Math.abs(along)-r.length/2-60)/270,(Math.abs(cross)-265)/165));
    if(blend>0) return height+(r.elevation-height)*Math.min(1,blend);
  }
  return height;
}
if(typeof module!=='undefined') Object.assign(globalThis,{geoPoint,latLon,taiwanAirports,internationalAirports,allAirports,airportPoint,parkingPoint,runwayCoordinates,regionalRoute,regionalHeight});


