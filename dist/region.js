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
];
const internationalAirports=[
  airport('RJAA','成田',35+(45+31.88/60)/60,140+(22+46.255/60)/60,329.51,4000,60,41,'34L','16R',-205),
  airport('VHHH','香港赤鱲角',22+(18+29/60)/60,113+(55+6/60)/60,71.0,3800,60,9,'07L','25R',185),
  airport('ROAH','沖繩那霸',26+(11+45/60)/60,127+(38+45/60)/60,183.0,3000,45,3.5,'18R','36L',-170)
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
  if(to.code==='RJAA') return [
    {name:'東海航段',...geoPoint(27.55,126.30)},
    {name:'琉球東方航段',...geoPoint(29.68,131.37)},
    {name:'四國南方航段',...geoPoint(31.97,135.30)},
    {name:'房總外海下降點',...geoPoint(34.83,140.65)},
    ...finish
  ];
  if(to.code==='VHHH') return [
    {name:'海峽西南航段',...geoPoint(23.20,118.80)},
    {name:'東沙北航段',...geoPoint(22.60,116.20)},
    {name:'大嶼山進場點',...geoPoint(22.25,114.15)},
    ...finish
  ];
  if(to.code==='ROAH') return [
    {name:'宮古島北航段',...geoPoint(25.30,125.20)},
    {name:'慶良間諸島航段',...geoPoint(26.05,127.20)},
    ...finish
  ];
  if(from.code==='RJAA') return [
    {name:'房總外海航段',...geoPoint(34.83,140.65)},
    {name:'四國南方航段',...geoPoint(31.97,135.30)},
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
function regionalHeight(x,z){
  let height=0;
  if(x>=-18000&&x<=18000&&z>=-18000&&z<=18000){
    height=groundHeight(x,z);
  }else{
    const u=(x-regionalElevation.x)/regionalGridStep,v=(z-regionalElevation.z)/regionalGridStep;
    const i=Math.floor(u),j=Math.floor(v);
    const {columns,rows,heights}=regionalElevation;
    if(i>=0&&j>=0&&i<columns-1&&j<rows-1){
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
  if(typeof naritaHeight==='function'&&x>1500000) height=naritaHeight(x,z);
  if(centralMountainTiles&&height>350) height=detailedMountainHeight(x,z,height);
  const island=islandGridAt(x,z);
  if(island) height=islandHeight(x,z,island);
  for(const r of typeof naritaAirport==='undefined'?taiwanAirports:allAirports){
    const reach=r.length/2+550;
    if(Math.abs(x-r.x)>reach||Math.abs(z-r.z)>reach) continue;
    const {along,cross}=runwayCoordinates(x,z,r);
    const blend=r.shortField?shortFieldBlend(r,along,cross):
      Math.max(0,1-Math.max((Math.abs(along)-r.length/2-60)/270,(Math.abs(cross)-265)/165));
    if(blend>0) return height+(r.elevation-height)*Math.min(1,blend);
  }
  return height;
}
if(typeof module!=='undefined') Object.assign(globalThis,{geoPoint,latLon,taiwanAirports,internationalAirports,allAirports,airportPoint,parkingPoint,runwayCoordinates,regionalRoute,regionalHeight});


