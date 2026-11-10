'use strict';
const tacticalScenarios={
  radar:{name:'雷達與飛彈入門',brief:'鎖定無人靶機，命中後通過出口。',difficulty:'入門',minutes:3,base:1800,count:1},
  duel:{name:'一對一空戰',brief:'與會機動和反擊的對手交戰，可選擇返場或撤離。',difficulty:'中等',minutes:6,base:3600,count:1},
  intercept:{name:'雙機攔截',brief:'由臺中跑道起飛，攔截兩架靶機後返場。',difficulty:'中等',minutes:9,base:4600,count:2},
  sea:{name:'海上打擊',brief:'辨識移動靶船，避開中立船隻，命中後通過出口。',difficulty:'中等',minutes:5,base:3200,count:1},
  escort:{name:'護航與撤離',brief:'保護友機通過訓練航線，阻止兩架對手接近。',difficulty:'進階',minutes:7,base:4200,count:2}
};
const tacticalDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function tacticalPoint(origin,heading,forward,side=0,y=origin.y){
  return {x:origin.x+Math.sin(heading)*forward+Math.cos(heading)*side,y,
    z:origin.z-Math.cos(heading)*forward+Math.sin(heading)*side};
}
function tacticalRack(f,index){
  const side=(index%2?1:-1)*(2.15+Math.floor(index/2)*.96);
  const bank=f.bank||0,pitch=f.pitch||0;
  const x=side*Math.cos(bank)-.72*Math.sin(bank);
  const y=-side*Math.sin(bank)-.72*Math.cos(bank);
  const z=1.10+Math.floor(index/2)*.53;
  return tacticalPoint(f,f.heading,-z*Math.cos(pitch)-y*Math.sin(pitch),x,
    f.y+y*Math.cos(pitch)-z*Math.sin(pitch));
}
function tacticalRoute(airport,kind){
  const runway=kind==='intercept';
  const heading=runway?airport.heading:-Math.PI/2;
  const origin=tacticalPoint({...airport,y:runway?950:kind==='sea'?360:1400},heading,runway?6500:20000);
  const exit={...tacticalPoint(origin,heading,7100),name:'訓練區出口'};
  return [{...origin,name:'進入訓練區'},exit,...regionalRoute(airport,airport)];
}
function makeTacticalFlight(airport,aircraft,kind,wind,guided,advanced){
  const scenario=tacticalScenarios[kind], runway=kind==='intercept', sea=kind==='sea';
  const route=tacticalRoute(airport,kind);
  const f=makeRegionalFlight(airport,airport,aircraft,runway?'runway':'air',wind,route);
  if(!runway){
    const {x,y,z}=route[0];
    Object.assign(f,{x,y,z,heading:-Math.PI/2,vx:-155,vz:0,speed:155,power:.48,waypoint:1});
  }
  const heading=f.heading;
  const origin=route[0];
  const unit=(id,name,team,domain,forward,side,height)=>({id,name,team,domain,
    ...tacticalPoint(origin,heading,forward,side,height),heading,alive:true});
  const targets=Array.from({length:scenario.count},(_,i)=>unit(i+1,sea?'橙色靶船':'靶機 '+(i+1),'hostile',sea?'sea':'air',
    2200+i*1250,i===0?60:850,sea?8:origin.y+i*230));
  if(sea) targets.push(unit(3,'中立船隻','neutral','sea',2750,950,8));
  if(kind==='escort') targets.push(unit(3,'護航友機','friendly','air',1200,-230,origin.y));
  const exit=route[1];
  f.lesson='tactical';
  f.fuel=f.fuelStart=2700;
  f.tactical={id:crypto.randomUUID(),kind,targets,exit,heading,origin,guided,advanced,elapsed:0,
    radar:false,automatic:true,aimAssist:false,mode:sea?'sea':'air',selected:null,lock:0,armed:false,ammo:6,health:100,
    missiles:[],effects:[],events:[],frames:[],shots:0,hits:0,air:0,sea:0,neutral:0,
    gunBursts:0,gunHits:0,nextGun:0,
    enemyShot:guided&&!advanced?24:10,enemyWarning:0,returning:false,notice:'',nextFrame:0,result:null};
  return f;
}
function tacticalContacts(f){
  const s=f.tactical;
  return s.radar?s.targets.filter(t=>t.alive&&t.domain===s.mode&&tacticalDistance(f,t)<12500):[];
}
function selectTacticalTarget(s,id){
  if(s.selected===id) return;
  if(s.lock>=1) tacticalEvent(s,'鎖定中斷');
  s.selected=id;
  s.lock=0;
  if(id===null) s.aimAssist=false;
}
function tacticalTarget(f){
  return tacticalContacts(f).find(t=>t.id===f.tactical.selected);
}
function tacticalAim(f,target){
  const dx=target.x-f.x,dz=target.z-f.z;
  return {
    bearing:wrapAngle(Math.atan2(dx,-dz)-f.heading),
    elevation:Math.atan2(target.y-f.y,Math.hypot(dx,dz)),
    distance:tacticalDistance(f,target)
  };
}
function tacticalGunLead(f,target=tacticalTarget(f)){
  if(!target||target.domain!=='air'||target.team!=='hostile'||tacticalDistance(f,target)>2300) return null;
  const lead=tacticalDistance(f,target)/850;
  return {x:target.x+(target.vx||0)*lead,y:target.y+(target.vy||0)*lead,z:target.z+(target.vz||0)*lead};
}
function tacticalGun(f){
  const s=f.tactical;
  if(f.finished||f.ground||!s.armed||s.gunBursts>=18||s.elapsed<s.nextGun) return false;
  s.gunBursts++;s.nextGun=s.elapsed+.6;
  const target=tacticalTarget(f), point=tacticalGunLead(f,target);
  const aim=point&&tacticalAim(f,point);
  if(aim&&Math.abs(aim.bearing)<.028&&Math.abs(aim.elevation-f.pitch)<.028){
    target.alive=false;s.air++;s.gunHits++;
    s.effects.push({x:target.x,y:target.y,z:target.z,age:0,water:false});
    s.notice='機砲命中 · '+target.name;
  }else s.notice='機砲未命中 · 對準金色前置圈';
  tacticalEvent(s,s.notice);
  tacticalFrame(f);
  return true;
}
function tacticalFireBlock(f,target=tacticalTarget(f)){
  const s=f.tactical;
  if(f.ground) return '起飛後才能發射';
  if(!s.radar) return '先開啟雷達';
  if(!s.armed) return '先啟用武器';
  if(!s.ammo) return '彈藥用盡';
  if(s.lock<1||!target) return '尚未鎖定 · 對準目標框';
  return '';
}
function tacticalAssistControls(f){
  const target=tacticalTarget(f);
  if(!target||f.ground||f.finished) return null;
  const {bearing,elevation}=tacticalAim(f,target);
  const desiredPitch=limit(elevation,-.10,.22);
  return {
    roll:limit(bearing*1.25-f.bank*.24,-.67,.67),
    rudder:limit(bearing*.66,-.32,.32),
    pitch:limit((desiredPitch-.015-f.trim)/.50,-.25,.42)
  };
}
function tacticalEvent(s,label){
  s.events.push({time:s.elapsed,label});
}
function tacticalFire(f){
  const s=f.tactical;
  if(f.finished) return false;
  const target=tacticalTarget(f);
  const blocked=tacticalFireBlock(f,target);
  if(blocked){
    s.notice=blocked;
    return false;
  }
  s.ammo--;s.shots++;
  s.missiles.push({id:s.shots,owner:'player',target:target.id,age:0,
    ...tacticalRack(f,s.shots-1),heading:f.heading,pitch:f.pitch,trail:[]});
  s.notice='飛彈已離架';
  tacticalEvent(s,'飛彈離架 · '+target.name);
  tacticalFrame(f);
  return true;
}
function tacticalFrame(f){
  const s=f.tactical;
  s.frames.push({time:s.elapsed,plane:[f.x,f.y,f.z,f.heading,f.pitch,f.bank,s.ammo],
    targets:s.targets.map(t=>[t.id,t.x,t.y,t.z,t.heading,t.alive]),
    missiles:s.missiles.map(m=>[m.id,m.x,m.y,m.z,m.heading,m.owner]),
    effects:s.effects.map(e=>({...e}))});
  if(s.frames.length>4500) s.frames.shift();
}
function tacticalFinish(f,outcome,reason,returned=false){
  const s=f.tactical;
  if(s.result) return;
  tacticalEvent(s,returned?'返場 · '+reason:reason);
  for(const m of s.missiles) if(m.owner==='player') tacticalEvent(s,'未命中 · 任務結束');
  tacticalFrame(f);
  f.finished=true;
  const base=outcome==='成功'?tacticalScenarios[s.kind].base:0;
  const bonus=s.neutral?0:(s.air+s.sea)*700, landing=returned?650:0;
  const fuel=Math.round(Math.max(0,f.fuelStart-f.fuel)*.8), ammo=s.shots*110+s.gunBursts*12, repair=(100-s.health)*18;
  const receipt={base,bonus,landing,fuel,ammo,repair,net:Math.max(0,base+bonus+landing-fuel-ammo-repair)};
  const career=readCareer();
  let saved=Boolean(career.receipts[s.id]);
  if(saved) Object.assign(receipt,career.receipts[s.id]);
  else {
    career.money+=receipt.net;
    career.receipts[s.id]=receipt;
    try{localStorage.setItem(careerKey,JSON.stringify(career));saved=true;f.reward=receipt.net;
      recordFlight(f,tacticalScenarios[s.kind].name+' · '+outcome);}
    catch{}
  }
  s.result={outcome,reason,returned,receipt,saved};
}
function tacticalOutcome(s){
  const complete=s.air+s.sea>=tacticalScenarios[s.kind].count;
  if(s.neutral||!s.health) return '失敗';
  if(complete) return '成功';
  return s.air+s.sea?'部分完成':'失敗';
}
function stepTactical(f,dt){
  const s=f.tactical;
  s.elapsed+=dt;
  if(f.ended){tacticalFinish(f,'失敗','飛行事故');return;}
  if(s.returning||f.landed){
    updateRegionalFlight(f,()=>{
      tacticalFinish(f,tacticalOutcome(s),'返場停妥',true);
      return true;
    });
  }
  if(f.finished) return;
  if(!s.returning&&f.waypoint===0&&Math.hypot(f.x-s.origin.x,f.z-s.origin.z)<1500) f.waypoint=1;
  const combat=s.kind==='duel'||s.kind==='escort';
  const friendly=s.targets.find(t=>t.team==='friendly');
  for(const t of s.targets){
    if(!t.alive){
      if(t.domain==='air') t.y=Math.max(0,t.y-95*dt);
      continue;
    }
    if(f.ground&&s.kind==='intercept') continue;
    const phase=s.elapsed*(s.advanced?.45:.24)+t.id;
    const maneuver=t.domain==='air'&&t.team==='hostile'&&(combat||s.kind==='intercept');
    t.heading=s.heading+(maneuver?Math.sin(phase)*.6:t.domain==='sea'?Math.PI/2:0);
    const speed=t.domain==='sea'?12:combat&&t.team==='hostile'?105:85;
    t.vx=Math.sin(t.heading)*speed;
    t.vz=-Math.cos(t.heading)*speed;
    t.vy=maneuver?Math.cos(phase)*16:0;
    t.x+=t.vx*dt;t.y+=t.vy*dt;t.z+=t.vz*dt;
  }
  const contacts=tacticalContacts(f);
  if(!contacts.some(t=>t.id===s.selected)){
    selectTacticalTarget(s,null);
    if(s.automatic){
      const candidates=contacts.filter(t=>t.team==='hostile').sort((a,b)=>tacticalDistance(f,a)-tacticalDistance(f,b));
      if(candidates.length) selectTacticalTarget(s,candidates[0].id);
    }
  }
  const target=contacts.find(t=>t.id===s.selected);
  const aim=target&&tacticalAim(f,target);
  const training=s.guided&&!s.advanced;
  const lockable=!f.ground&&aim&&aim.distance<8200&&Math.abs(aim.bearing)<(training?.79:.66)&&
    Math.abs(aim.elevation-f.pitch)<(training?.52:.44);
  if(lockable){
    const wasLocked=s.lock>=1;
    s.lock=Math.min(1,s.lock+dt/1.1);
    if(!wasLocked&&s.lock>=1){s.notice='鎖定完成';tacticalEvent(s,'已鎖定 · '+target.name);}
  }else if(s.lock){
    s.notice='鎖定中斷 · 目標離開鎖定框';
    if(s.lock>=1) tacticalEvent(s,'鎖定中斷');
    s.lock=0;
  }
  if(combat&&!f.ground){
    const enemy=s.targets.find(t=>t.team==='hostile'&&t.alive&&tacticalDistance(t,friendly||f)<6500);
    if(enemy&&s.elapsed>s.enemyShot-2) s.enemyWarning=.3;
    if(enemy&&s.elapsed>=s.enemyShot){
      const aim=friendly||f;
      s.missiles.push({id:-s.elapsed,owner:'enemy',target:friendly?.id??'player',age:0,
        x:enemy.x,y:enemy.y,z:enemy.z,heading:Math.atan2(aim.x-enemy.x,enemy.z-aim.z),trail:[]});
      s.enemyShot=s.elapsed+(s.advanced?10:19);
      s.enemyWarning=3;
      tacticalEvent(s,'對手發射飛彈');
    }
  }
  s.enemyWarning=Math.max(0,s.enemyWarning-dt);
  for(let i=s.missiles.length-1;i>=0;i--){
    const m=s.missiles[i];
    const aim=m.target==='player'?f:s.targets.find(t=>t.id===m.target&&t.alive);
    m.age+=dt;
    const d=aim?tacticalDistance(m,aim):Infinity;
    const speed=m.owner==='player'?760:345;
    const impact=aim&&d<Math.max(18,speed*dt);
    if(impact){
      s.effects.push({x:aim.x,y:aim.y,z:aim.z,age:0,water:aim.domain==='sea'});
      if(m.owner==='player'){
        aim.alive=false;s.hits++;
        if(aim.team!=='hostile') s.neutral++;
        else if(aim.domain==='sea') s.sea++;else s.air++;
        s.notice='命中 · '+aim.name;
      }else if(aim===f){
        s.health=Math.max(0,s.health-34);
        s.notice='機體受損 · '+s.health+'%';
      }else aim.alive=false;
      tacticalEvent(s,m.owner==='player'?'命中 · '+aim.name:aim===f?'機體受損':'護航友機遭命中');
    }
    if(impact||!aim||m.age>15||m.y<0||tacticalDistance(m,s.origin)>32000){
      if(!impact&&m.owner==='player'){
        s.notice='未命中 · '+(!aim?'目標消失':m.y<0?'飛彈落海':m.age>15?'追蹤逾時':'飛離訓練區');
        tacticalEvent(s,s.notice);
      }
      s.missiles.splice(i,1);
      continue;
    }
    if(!m.trail.length||m.age-m.trail.at(-1).age>.095){
      m.trail.push({x:m.x,y:m.y,z:m.z,age:m.age});
      if(m.trail.length>17) m.trail.shift();
    }
    const desiredHeading=Math.atan2(aim.x-m.x,m.z-aim.z);
    const desiredPitch=Math.atan2(aim.y-m.y,Math.hypot(aim.x-m.x,aim.z-m.z));
    const turn=(m.owner==='enemy'?.52:2.4)*dt;
    m.heading+=limit(wrapAngle(desiredHeading-m.heading),-turn,turn);
    m.pitch=(m.pitch||0)+limit(desiredPitch-(m.pitch||0),-turn,turn);
    const horizontal=Math.cos(m.pitch)*speed*dt;
    m.x+=Math.sin(m.heading)*horizontal;
    m.z-=Math.cos(m.heading)*horizontal;
    m.y+=Math.sin(m.pitch)*speed*dt;
  }
  s.effects=s.effects.filter(e=>(e.age+=dt)<2.5);
  if(s.elapsed>=s.nextFrame){tacticalFrame(f);s.nextFrame=s.elapsed+.15;}
  const complete=s.air+s.sea>=tacticalScenarios[s.kind].count;
  if(s.neutral||!s.health||friendly&&!friendly.alive){
    tacticalFinish(f,'失敗',s.neutral?'誤擊非指定目標':!s.health?'機體嚴重受損':'護航友機失去飛行能力');
  }else if(s.kind==='escort'&&s.elapsed>=72){
    tacticalFinish(f,'成功','護航友機抵達出口');
  }else if(complete&&(s.kind==='sea'||s.kind==='radar')&&tacticalDistance(f,s.exit)<1100){
    tacticalFinish(f,'成功','通過訓練區出口');
  }else if(s.kind==='intercept'&&!complete&&s.targets.some(t=>t.alive&&tacticalDistance(t,s.origin)>23500)){
    tacticalFinish(f,tacticalOutcome(s),'目標飛出訓練區');
  }else if(s.elapsed>=660){
    tacticalFinish(f,tacticalOutcome(s),'訓練時間結束');
  }
}
