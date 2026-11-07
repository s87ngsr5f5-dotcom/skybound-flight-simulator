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
  airport('RCQC','澎湖',23+34.11742/60,119+37.69433/60,18.22,3000,45,22.71,'02','20'),
];
function runwayCoordinates(x,z,r){
  const dx=x-r.x,dz=z-r.z,s=Math.sin(r.heading),c=Math.cos(r.heading);
  return {along:dx*s-dz*c,cross:dx*c+dz*s};
}
function airportPoint(r,along,cross){
  const s=Math.sin(r.heading),c=Math.cos(r.heading);
  return {x:r.x+along*s+cross*c,z:r.z-along*c+cross*s};
}
const parkingPoint=r=>airportPoint(r,65,r.apron);
const regionalWaypoints=[
  {name:'東北角外海',...geoPoint(25.023,122.035)},
  {name:'宜蘭外海',...geoPoint(24.759,122.027)},
  {name:'南澳外海',...geoPoint(24.425,121.858)}
];
function regionalRoute(from,to){
  const finish=[{name:'進場定位點',...airportPoint(to,-6600,0)},
    {name:to.name+' '+to.designator+' 跑道',...airportPoint(to,-to.length/2+200,0)}];
  if(from.code==='RCSS'&&to.code==='RCYU') return [...regionalWaypoints,...finish];
  return finish;
}
const regionalGridStep=240;
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
  if(typeof naritaHeight==='function'&&x>1500000) height=naritaHeight(x,z);
  for(const r of typeof naritaAirport==='undefined'?taiwanAirports:allAirports){
    const reach=r.length/2+550;
    if(Math.abs(x-r.x)>reach||Math.abs(z-r.z)>reach) continue;
    const {along,cross}=runwayCoordinates(x,z,r);
    const blend=Math.max(0,1-Math.max((Math.abs(along)-r.length/2-60)/270,(Math.abs(cross)-265)/165));
    if(blend>0) return height+(r.elevation-height)*Math.min(1,blend);
  }
  return height;
}
if(typeof module!=='undefined') Object.assign(globalThis,{geoPoint,latLon,taiwanAirports,airportPoint,parkingPoint,runwayCoordinates,regionalRoute,regionalHeight});


