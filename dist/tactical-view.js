'use strict';
function createTacticalView(scene,camera,callbacks){
  const byId=id=>document.getElementById(id);
  const panel=byId('tacticalPanel'), guide=byId('tacticalGuide'), report=byId('tacticalReport');
  const canvas=byId('tacticalRadar'), ink=canvas.getContext('2d');
  const marker=byId('tacticalMarker'), scope=byId('tacticalInstruments');
  const root=new THREE.Group();
  scene.add(root);
  const material=color=>new THREE.MeshStandardMaterial({color,roughness:.68});
  const orange=material('#f38737'), silver=material('#b4c3cc'), blue=material('#54b7ec'), dark=material('#394b5a');
  const flame=new THREE.MeshBasicMaterial({color:0xffb047});
  const flash=new THREE.PointLight(0xffaa57,0,36,2);
  const smokeShape=new THREE.IcosahedronGeometry(1,1);
  const vector=new THREE.Vector3(), lookup=[];
  root.add(flash);
  const unitPool=[], missilePool=[], effectPool=[], racks=[];
  let active=null, replay=null, follow=false, lastDraw=0, reportId=null;
  function mesh(parent,geometry,mat,x=0,y=0,z=0){
    const item=new THREE.Mesh(geometry,mat);
    item.position.set(x,y,z);parent.add(item);return item;
  }
  function box(parent,mat,w,h,d,x,y,z){
    return mesh(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  }
  function makeUnit(t){
    const group=new THREE.Group(), paint=t.team==='hostile'?orange:t.team==='friendly'?blue:silver;
    if(t.domain==='sea'){
      const hull=mesh(group,new THREE.CylinderGeometry(1,.72,7,6),paint,0,-3);
      hull.scale.set(8,1,24);hull.rotation.y=Math.PI/6;
      box(group,dark,10,5,15,0,2,4);
      box(group,paint,7,4,8,0,6,4);
      box(group,dark,.7,6,.7,0,10,5);
    }else{
      const body=mesh(group,new THREE.CapsuleGeometry(1.12,10,4,12),paint);
      body.rotation.x=Math.PI/2;
      const wing=new THREE.Shape();
      wing.moveTo(0,-2);wing.lineTo(7,3);wing.lineTo(6,4.1);wing.lineTo(-6,4.1);wing.lineTo(-7,3);wing.closePath();
      const surface=mesh(group,new THREE.ExtrudeGeometry(wing,{depth:.25,bevelEnabled:false}),paint);
      surface.rotation.x=Math.PI/2;
      box(group,dark,.35,2.5,2.5,0,1.25,4.1);
      mesh(group,new THREE.SphereGeometry(1,12,8),dark,0,.65,-2.7).scale.set(.72,.62,1.85);
    }
    root.add(group);return group;
  }
  function makeMissile(){
    const group=new THREE.Group();
    const body=mesh(group,new THREE.CapsuleGeometry(.2,2.9,3,8),silver);
    body.rotation.x=Math.PI/2;
    box(group,silver,.95,.09,.58,0,0,1.05);
    box(group,silver,.09,.95,.58,0,0,1.05);
    root.add(group);return group;
  }
  function flyingMissile(){
    const group=makeMissile();
    const plume=mesh(group,new THREE.ConeGeometry(.29,4.8,9),flame,0,0,3.9);
    plume.rotation.x=Math.PI/2;
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(54),3));
    const trail=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xf4e5d0,transparent:true,opacity:.62}));
    trail.frustumCulled=false;
    root.add(trail);
    const smoke=Array.from({length:6},()=>mesh(root,smokeShape,new THREE.MeshBasicMaterial({
      color:0xd9dce0,transparent:true,depthWrite:false
    })));
    return {group,trail,plume,smoke};
  }
  function explosion(){
    const mat=new THREE.MeshBasicMaterial({color:0xffae54,transparent:true,depthWrite:false});
    return mesh(root,new THREE.IcosahedronGeometry(1,1),mat);
  }
  function clear(){
    root.visible=false;panel.hidden=guide.hidden=report.hidden=marker.hidden=scope.hidden=true;
    active=null;replay=null;follow=false;
  }
  function start(f){
    clear();
    if(!f.tactical) return;
    root.visible=true;active=f;panel.hidden=guide.hidden=scope.hidden=false;
    for(const group of unitPool){
      group.traverse(part=>{if(part.isMesh)part.geometry.dispose();});
      root.remove(group);
    }
    unitPool.length=0;
    f.tactical.targets.forEach(t=>unitPool.push(makeUnit(t)));
    reportId=null;lastDraw=0;
  }
  function select(id){
    if(active?.finished) return;
    selectTacticalTarget(active.tactical,id);
  }
  function command(name){
    const f=active,s=f?.tactical;
    if(!s) return;
    if(name==='follow'){follow=!follow;return;}
    if(f.finished) return;
    if(name==='radar'){
      s.radar=!s.radar;if(!s.radar) selectTacticalTarget(s,null);
    }else if(name==='mode'){
      s.mode=s.mode==='sea'?'air':'sea';selectTacticalTarget(s,null);
    }else if(name==='auto') s.automatic=!s.automatic;
    else if(name==='next'){
      const contacts=tacticalContacts(f);
      if(contacts.length) select(contacts[(contacts.findIndex(t=>t.id===s.selected)+1)%contacts.length].id);
    }else if(name==='arm') s.armed=!s.armed;
    else if(name==='fire'){if(!callbacks.paused()&&tacticalFire(f)) callbacks.sound(145);}
    else if(name==='return'){
      s.returning=true;
      f.route=regionalRoute(f.departure,f.destination);
      f.waypoint=0;
      s.notice='已設定返場航線';
    }else if(name==='leave'){
      const outcome=tacticalOutcome(s);
      tacticalFinish(f,outcome==='成功'&&s.kind!=='duel'?'部分完成':outcome,'主動撤離');
    }
  }
  for(const element of [panel,guide]) element.addEventListener('click',event=>{
    const button=event.target.closest('[data-tactical]');
    if(button) command(button.dataset.tactical);
  });
  canvas.addEventListener('click',event=>{
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height;
    const item=lookup.find(t=>Math.hypot(x-t.x,y-t.y)<12);
    if(item) select(item.id);
  });
  byId('tacticalRetry').onclick=()=>callbacks.retry();
  byId('tacticalMenu').onclick=()=>callbacks.menu();
  const seek=byId('tacticalSeek');
  seek.oninput=()=>{if(replay) replay.time=Number(seek.value);};
  byId('tacticalReplay').onclick=()=>{
    if(replay){replay=null;report.classList.remove('tactical-replaying');return;}
    replay={time:active.tactical.frames[0]?.time||0};
    seek.min=replay.time;seek.max=active.tactical.elapsed;
    report.classList.add('tactical-replaying');
  };
  function drawRadar(f,s){
    ink.fillStyle='#0a202e';ink.fillRect(0,0,180,118);
    ink.strokeStyle='#4e817e';
    for(const radius of [25,49]){
      ink.beginPath();ink.arc(90,59,radius,0,Math.PI*2);ink.stroke();
    }
    ink.beginPath();ink.moveTo(90,7);ink.lineTo(90,111);ink.moveTo(38,59);ink.lineTo(142,59);ink.stroke();
    ink.fillStyle='#cefad4';ink.fillText(s.radar?'12.5 km':'雷達關閉',6,13);
    lookup.length=0;
    const sn=Math.sin(f.heading), cs=Math.cos(f.heading);
    for(const t of tacticalContacts(f)){
      const dx=t.x-f.x,dz=t.z-f.z;
      const x=90+(dx*cs+dz*sn)*.004,y=59+(dz*cs-dx*sn)*.004;
      ink.fillStyle=t.team==='hostile'?'#ffad68':t.team==='friendly'?'#63d6ff':'#d5e4e7';
      ink.fillRect(x-3,y-3,6,6);
      if(s.selected===t.id){ink.strokeStyle='#fff1a0';ink.strokeRect(x-7,y-7,14,14);}
      lookup.push({x,y,id:t.id});
    }
  }
  function showReport(f,s){
    report.hidden=false;panel.hidden=guide.hidden=marker.hidden=true;
    if(reportId===s.id) return;
    reportId=s.id;
    report.classList.remove('tactical-replaying');
    const r=s.result, p=r.receipt;
    byId('tacticalResultTitle').textContent=tacticalScenarios[s.kind].name+' · '+r.outcome;
    byId('tacticalResultBody').textContent=r.reason+' · '+(r.returned?'已返場':'未返場')+' · '+Math.round(s.elapsed)+' 秒 · 機況 '+s.health+'%';
    const completed=s.targets.filter(t=>t.team==='hostile'&&!t.alive).map(t=>t.name).join('、')||'—';
    const remaining=s.targets.filter(t=>t.team==='hostile'&&t.alive).map(t=>t.name).join('、')||'—';
    byId('tacticalScore').textContent='空中擊落 '+s.air+' · 海上命中 '+s.sea+' · 發射 '+s.shots+
      ' · 命中 '+s.hits+' · 未命中 '+(s.shots-s.hits)+' · 命中率 '+(s.shots?Math.round(100*s.hits/s.shots)+'%':'—')+
      ' · 剩餘 '+s.ammo+' 枚／'+Math.round(f.fuel)+' kg · 已命中 '+completed+' · 未達成 '+remaining;
    byId('tacticalCoins').textContent='基本 '+p.base+' ＋目標 '+p.bonus+' ＋返場 '+p.landing+' −燃油 '+p.fuel+
      ' −彈藥 '+p.ammo+' −維修 '+p.repair+' · '+(r.saved?'入帳 '+p.net+' 金幣':'存檔失敗');
    byId('tacticalEvents').replaceChildren(...s.events.map(e=>{
      const button=document.createElement('button');
      button.textContent=e.time.toFixed(1)+' s · '+e.label;
      button.onclick=()=>{if(!replay) byId('tacticalReplay').click();replay.time=e.time;seek.value=e.time;};
      return button;
    }));
  }
  function drawUI(f,s,now){
    if(s.result){showReport(f,s);return;}
    const target=tacticalContacts(f).find(t=>t.id===s.selected);
    marker.hidden=!target;
    if(target){
      vector.set(target.x,target.y,target.z).project(camera);
      const inside=vector.z<1&&Math.abs(vector.x)<.92&&Math.abs(vector.y)<.83;
      const behind=vector.z>1?-1:1;
      marker.style.left=(50+clamp(vector.x*behind,-.9,.9)*48)+'%';
      marker.style.top=(50-clamp(vector.y*behind,-.78,.78)*50)+'%';
      marker.textContent=inside?(s.lock>=1?'◇ 已鎖定':'□'):(vector.x*behind>0?'→':'←');
    }
    if(now-lastDraw<100) return;
    lastDraw=now;
    const speed=flightSpeeds(f);
    byId('tacticalIAS').textContent=Math.round(speed.ias*1.94384)+' kt IAS';
    byId('tacticalHDG').textContent=String(Math.round((f.heading*180/Math.PI+360)%360)%360).padStart(3,'0')+'° HDG';
    byId('tacticalALT').textContent=Math.round(f.y*3.28084)+' ft · '+Math.round(f.vy*196.85)+' ft/min';
    drawRadar(f,s);
    const state=s.radar?(s.lock>=1?'已鎖定':s.lock>0?'鎖定中 '+Math.floor(s.lock*100)+'%':target?'已追蹤':'搜尋中'):'雷達關閉';
    const bearing=target?Math.round((Math.atan2(target.x-f.x,f.z-target.z)*180/Math.PI+360)%360)%360:0;
    byId('tacticalContact').textContent=state+(target?' · '+target.name+' · '+bearing+'° · '+(tacticalDistance(f,target)/1000).toFixed(1)+
      ' km · 高差 '+Math.round((target.y-f.y)*3.28084)+' ft':'');
    byId('tacticalCount').textContent='飛彈 '+s.ammo+' 枚 · 機況 '+s.health+'%';
    const complete=s.air+s.sea>=tacticalScenarios[s.kind].count;
    const hostile=s.targets.find(t=>t.alive&&t.team==='hostile');
    const threat=s.missiles.find(m=>m.owner==='enemy')||hostile;
    const direction=threat?wrapAngle(Math.atan2(threat.x-f.x,f.z-threat.z)-f.heading):0;
    const warning=s.enemyWarning>0||s.missiles.some(m=>m.owner==='enemy');
    if(warning&&!panel.classList.contains('tactical-warning')) callbacks.sound(390);
    panel.classList.toggle('tactical-warning',warning);
    const next=s.returning?activeTarget(f):s.exit;
    const nav=next?' · '+Math.round((Math.atan2(next.x-f.x,f.z-next.z)*180/Math.PI+360)%360)%360+'°／'+
      (Math.hypot(next.x-f.x,next.z-f.z)/1000).toFixed(1)+' km':'';
    const prompt=warning?'警告 · '+(direction<-.18?'左側':direction>.18?'右側':'前方')+'有敵方雷達或飛彈':
      s.returning?'依導航返場並停妥'+nav:complete?(s.kind==='radar'||s.kind==='sea'?'飛過訓練區出口'+nav:'目標完成，可返場或撤離'):
      s.guided?(f.ground?'從跑道起飛':!s.radar?'開啟雷達':'已鎖定'===state?s.armed?'按發射或 M':'啟用武器':'轉向目標框，保持穩定'):'依簡報完成任務';
    byId('tacticalCaption').textContent=prompt+(s.notice?' · '+s.notice:'');
    byId('tacticalFollow').hidden=!s.missiles.some(m=>m.owner==='player');
    for(const [commandName,on] of [['radar',s.radar],['auto',s.automatic],['arm',s.armed]]){
      panel.querySelector('[data-tactical="'+commandName+'"]').setAttribute('aria-pressed',String(on));
    }
    byId('tacticalMode').textContent=s.mode==='air'?'空對空':'海面';
  }
  function interpolate(a,b,k){
    return a+(b-a)*k;
  }
  function render(f,dt,now,low){
    if(!f?.tactical) return;
    const s=f.tactical;
    drawUI(f,s,now);
    let frame=null, next=null, blend=0;
    if(replay){
      replay.time=Math.min(s.elapsed,replay.time+dt);
      seek.value=replay.time;
      const index=s.frames.findIndex(item=>item.time>replay.time);
      next=index>0?s.frames[index]:null;
      frame=index>0?s.frames[index-1]:s.frames.at(-1);
      blend=next?clamp((replay.time-frame.time)/(next.time-frame.time),0,1):0;
    }
    const plane=frame?.plane||[f.x,f.y,f.z,f.heading,f.pitch,f.bank,s.ammo];
    const shots=6-plane[6];
    flash.intensity=0;
    for(let i=0;i<6;i++){
      const rack=racks[i]??(racks[i]=makeMissile());
      rack.visible=i>=shots;
      const point=tacticalRack({x:plane[0],y:plane[1],z:plane[2],heading:plane[3]},i);
      rack.position.set(point.x,point.y,point.z);
      rack.rotation.set(plane[4],-plane[3],-plane[5],'YXZ');
    }
    unitPool.forEach((group,i)=>{
      const t=s.targets[i], prior=frame?.targets[i], following=next?.targets[i]||prior;
      const x=prior?interpolate(prior[1],following[1],blend):t.x;
      const y=prior?interpolate(prior[2],following[2],blend):t.y;
      const z=prior?interpolate(prior[3],following[3],blend):t.z;
      const alive=prior?prior[5]:t.alive;
      group.visible=alive||t.domain==='sea'||y>1;
      group.position.set(x,y,z);group.rotation.set(alive?0:.36,-(prior?prior[4]:t.heading),alive?0:.45,'YXZ');
    });
    const missiles=frame?frame.missiles.map(m=>{
      const n=next?.missiles.find(candidate=>candidate[0]===m[0])||m;
      return {id:m[0],x:interpolate(m[1],n[1],blend),y:interpolate(m[2],n[2],blend),z:interpolate(m[3],n[3],blend),
        heading:m[4],owner:m[5],trail:s.frames.filter(item=>item.time<=replay.time&&item.time>replay.time-2).flatMap(item=>
          item.missiles.filter(shot=>shot[0]===m[0]).map(shot=>({x:shot[1],y:shot[2],z:shot[3]}))).slice(-17)};
    }):s.missiles;
    missiles.forEach((m,i)=>{
      const visual=missilePool[i]??(missilePool[i]=flyingMissile());
      visual.group.visible=true;visual.group.position.set(m.x,m.y,m.z);
      visual.group.rotation.set(m.pitch||0,-m.heading,0,'YXZ');
      visual.plume.scale.y=.85+.15*Math.sin(now*.06+i);
      const trail=visual.trail.geometry, positions=trail.attributes.position;
      const points=low?m.trail.filter((_,j)=>j%2===0):m.trail;
      points.forEach((p,j)=>positions.setXYZ(j,p.x,p.y,p.z));
      positions.setXYZ(points.length,m.x,m.y,m.z);
      positions.needsUpdate=true;trail.setDrawRange(0,points.length+1);
      visual.trail.visible=true;
      visual.smoke.forEach((puff,j)=>{
        const point=m.trail.at(-1-j*2);
        puff.visible=Boolean(point)&&(!low||j<3);
        if(!puff.visible) return;
        puff.position.set(point.x,point.y+j*.28,point.z);
        puff.scale.setScalar(1.2+j*1.3);
        puff.material.opacity=.46-j*.065;
      });
      if(!low&&m.owner==='player'&&m.age<.16){
        flash.position.copy(visual.group.position);flash.intensity=90*(1-m.age/.16);
      }
    });
    missilePool.slice(missiles.length).forEach(item=>{
      item.group.visible=item.trail.visible=false;
      item.smoke.forEach(puff=>puff.visible=false);
    });
    const effects=frame?.effects||s.effects;
    effects.forEach((e,i)=>{
      const item=effectPool[i]??(effectPool[i]=explosion());
      item.visible=true;item.position.set(e.x,e.y+e.age*7,e.z);
      const size=3+e.age*(e.water?18:12);
      item.scale.set(size,e.water?size*1.35:size,size);
      item.material.color.set(e.age<.24?'#fff2b4':e.water?'#dfedf3':'#62707b');
      item.material.opacity=Math.max(.03,.85-e.age*.32);
    });
    effectPool.slice(effects.length).forEach(item=>item.visible=false);
    const tracked=missiles.find(m=>m.owner==='player');
    if(!tracked) follow=false;
    const view=replay?byId('tacticalReplayView').value:follow?'missile':null;
    if(view==='missile'&&tracked){
      const point=tacticalPoint(tracked,tracked.heading,-22,8,tracked.y+5);
      camera.position.set(point.x,point.y,point.z);camera.lookAt(tracked.x,tracked.y,tracked.z);
    }else if(view==='target'&&unitPool.length){
      const target=unitPool[0].position;
      camera.position.set(target.x+48,target.y+24,target.z+55);camera.lookAt(target);
    }else if(replay){
      const state=plane.map((value,i)=>i<3&&next?interpolate(value,next.plane[i],blend):value);
      const [x,y,z,heading,pitch,bank]=state;
      const point=tacticalPoint({x,y,z},heading,view==='cockpit'?4:-75,0,y+(view==='cockpit'?1.3:17));
      camera.position.set(point.x,point.y,point.z);
      const aim=tacticalPoint({x,y,z},heading,view==='cockpit'?70:12,0,y+(view==='cockpit'?pitch*60:0));
      camera.lookAt(aim.x,aim.y,aim.z);
      callbacks.replayPlane(state,view==='cockpit');
    }
  }
  clear();
  return {start,clear,command,render};
}
