const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
vm.runInThisContext(fs.readFileSync('dist/elevation.js','utf8'));
const {createTrainer,stepTrainer,simTick,localRunway,worldRunway,runway10,wrapAngle}=require('./dist/physics.js');
function run(wind, approach=false){
 const f=createTrainer(approach,wind);
 const route=[[2400,0],[2700,2100],[-3600,2100],[-4000,0],[-900,0]];
 let leg=approach?4:0, liftoff, stop, maxAlt=0, maxCross=0;
 for(let i=0;i<120*900;i++){
   const {along,cross}=localRunway(f.x,f.z);
   const [a,c]=route[leg];
   const wp=worldRunway(a,c);
   const dist=Math.hypot(wp.x-f.x,wp.z-f.z);
   if(!f.ground && leg<4 && dist<(leg===3?330:420)) leg++;
   const landing=leg===4 && !f.ground;
   const height=landing? Math.max(1.5,4+(-920-along)*.051):315;
   const speed=landing?31:39;
   const targetVS=Math.max(-3.3,Math.min(3.1,(height-f.y)*.25));
   const q=.5*1.225*Math.exp(-f.y/8500)*Math.max(22,f.speed)**2; const cl=1040*(9.81+Math.max(-4,Math.min(4,(targetVS-f.vy)*1.6)))/(q*16.2*Math.cos(f.bank)); const pitch=Math.atan2(f.vy,Math.hypot(f.vx,f.vz))+(cl-.27-[0,.17,.33][f.flaps])/5.05-.036;
   const track=landing?runway10.heading+Math.atan2(-cross,280):Math.atan2(wp.x-f.x,f.z-wp.z);
   const heading=track-Math.asin(Math.max(-.4,Math.min(.4,wind/Math.max(23,f.speed))))*Math.cos(track-runway10.heading);
   const error=wrapAngle(heading-f.heading);
   const power=Math.max(0,Math.min(1,(landing?.20:.49)+(speed-f.speed)*.105));
   const input={pitch: f.ground?(f.speed>26&&!f.landed?.82:0):Math.max(-1,Math.min(1,(pitch-.015-f.flaps*.008)/.24)),
      roll:Math.max(-1,Math.min(1,error*2.7)), rudder:f.ground?Math.max(-1,Math.min(1,wrapAngle(runway10.heading-f.heading)*3)):0,
      trim:0,brake:f.landed,throttle:f.landed?-1:f.ground?1:Math.abs(f.power-power)<.006?0:Math.sign(power-f.power)};
   if(landing && along<-1350) f.flaps=2;
   
   stepTrainer(f,input);
   if(!f.ground && liftoff===undefined) liftoff=along;
   maxAlt=Math.max(maxAlt,f.y);
   if(leg===0) maxCross=Math.max(maxCross,Math.abs(cross));
   if(f.ended || (f.landed&&Math.hypot(f.vx,f.vz)<.15)){stop=true;break;}
 }
 console.log(JSON.stringify({wind,approach,leg,liftoff,maxAlt,maxCross,stop,landed:f.landed,touchdown:f.touchdown,elapsed:f.elapsed,final:localRunway(f.x,f.z),height:f.y,speed:f.speed}));
 return f;
}
run(0); run(5.144); run(0,true); run(5.144,true);




function replay(fps){
  const f=createTrainer(false,5.144);
  let accumulator=0, ticks=0;
  for(let frame=0;frame<fps*24;frame++){
    accumulator+=1/fps;
    while(accumulator+1e-10>=simTick){
      stepTrainer(f,{pitch:ticks>1800?.8:0,roll:0,rudder:0,trim:0,brake:false,throttle:1});
      ticks++;
      accumulator-=simTick;
    }
  }
  return {ticks,x:f.x,y:f.y,z:f.z,speed:f.speed};
}
assert.deepEqual(replay(30),replay(60));
assert.deepEqual(replay(60),replay(144));
console.log('30/60/144 FPS fixed-step replay: identical position and airspeed at 24 simulated seconds.');

