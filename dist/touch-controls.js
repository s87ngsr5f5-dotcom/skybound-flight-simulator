const touchControls=(()=>{
  const mode=document.getElementById('deviceMode');
  const panel=document.getElementById('touchFlight');
  const stick=document.getElementById('touchStick');
  const thumb=stick.querySelector('span');
  const rudder=document.getElementById('touchRudder');
  const throttle=document.getElementById('touchThrottle');
  const motionButton=document.getElementById('touchMotion');
  const motionStatus=document.getElementById('motionStatus');
  const input={roll:0,pitch:0,rudder:0,brake:false};
  const motion={enabled:false,neutral:null,roll:0,pitch:0};
  const brakePointers=new Set();
  const cancelRanges=[];
  let stickPointer=null,originX=0,originY=0,permissionRequest=0,motionTimer;
  const bounded=(value,min,max)=>Math.max(min,Math.min(max,value));

  function center(){
    stickPointer=null;
    input.roll=input.pitch=0;
    thumb.style.transform='';
  }
  function reset(){
    if(stickPointer!==null){try{stick.releasePointerCapture(stickPointer);}catch{}}
    center();
    for(const cancel of cancelRanges)cancel();
    rudder.value='0';
    input.rudder=0;
    motion.neutral=null;
    motion.roll=motion.pitch=0;
    brakePointers.clear();
    input.brake=false;
  }
  function move(event){
    const bounds=stick.getBoundingClientRect();
    const radius=bounds.width*.36;
    const x=(event.clientX-originX)/radius;
    const y=(event.clientY-originY)/radius;
    const scale=Math.max(1,Math.hypot(x,y));
    input.roll=x/scale;
    input.pitch=-y/scale;
    thumb.style.transform=`translate(${input.roll*radius}px,${-input.pitch*radius}px)`;
  }
  stick.addEventListener('pointerdown',event=>{
    if(event.button!==0||stickPointer!==null) return;
    event.preventDefault();
    stickPointer=event.pointerId;
    originX=event.clientX;originY=event.clientY;
    try{stick.setPointerCapture(event.pointerId);}catch{}
    move(event);
  });
  addEventListener('pointermove',event=>{
    if(event.pointerId===stickPointer) move(event);
  });
  function release(event){
    if(event.pointerId===stickPointer) center();
    if(brakePointers.delete(event.pointerId)) input.brake=brakePointers.size>0;
  }
  for(const name of ['pointerup','pointercancel']) addEventListener(name,release,true);
  panel.addEventListener('lostpointercapture',release);
  panel.addEventListener('contextmenu',event=>event.preventDefault());
  panel.addEventListener('pointerdown',event=>{
    const button=event.target.closest('[data-hold="brake"]');
    if(!button||event.button!==0) return;
    try{button.setPointerCapture(event.pointerId);}catch{}
    brakePointers.add(event.pointerId);
    input.brake=true;
  });
  function dragRange(range,vertical,spring){
    let pointer=null;
    cancelRanges.push(()=>{
      const id=pointer;pointer=null;
      if(id!==null){try{range.releasePointerCapture(id);}catch{}}
    });
    function update(event){
      const box=range.getBoundingClientRect();
      const position=vertical?1-(event.clientY-box.top)/box.height:(event.clientX-box.left)/box.width;
      const min=Number(range.min),max=Number(range.max);
      range.value=String(Math.round(min+(max-min)*bounded(position,0,1)));
      range.dispatchEvent(new Event('input',{bubbles:true}));
    }
    range.addEventListener('pointerdown',event=>{
      if(event.button!==0||range.disabled||pointer!==null) return;
      event.preventDefault();
      pointer=event.pointerId;
      try{range.setPointerCapture(pointer);}catch{}
      update(event);
    });
    addEventListener('pointermove',event=>{
      if(event.pointerId===pointer&&!range.disabled) update(event);
    });
    function finish(event){
      if(event.pointerId!==pointer) return;
      pointer=null;
      if(spring){
        range.value='0';
        range.dispatchEvent(new Event('input',{bubbles:true}));
      }
    }
    for(const event of ['pointerup','pointercancel','lostpointercapture']) addEventListener(event,finish,true);
    addEventListener('blur',()=>{pointer=null;});
  }
  dragRange(throttle,true,false);
  dragRange(rudder,false,true);
  rudder.oninput=()=>{input.rudder=Number(rudder.value)/100;};
  rudder.onblur=rudder.onkeyup=()=>{
    rudder.value='0';
    input.rudder=0;
  };
  function showMotion(text,message=''){
    motionButton.textContent=text;
    motionButton.setAttribute('aria-pressed',String(motion.enabled));
    motionStatus.hidden=!message;
    motionStatus.textContent=message;
  }
  function stopMotion(){
    permissionRequest++;
    clearTimeout(motionTimer);
    motion.enabled=false;
    motion.neutral=null;
    motion.roll=motion.pitch=0;
    showMotion('體感');
  }
  motionButton.onclick=async()=>{
    if(motion.enabled){stopMotion();return;}
    const sensor=window.DeviceOrientationEvent;
    if(!sensor){showMotion('體感不可用','這個瀏覽器未提供方向感測器。');return;}
    const request=++permissionRequest;
    try{
      if(sensor.requestPermission&&await sensor.requestPermission()!=='granted'){
        if(request===permissionRequest) showMotion('體感未授權','可在瀏覽器允許感測器，或直接使用搖桿。');
        return;
      }
    }catch{
      if(request===permissionRequest) showMotion('體感不可用','無法開啟方向感測器。');
      return;
    }
    if(request!==permissionRequest||mode.value!=='mobile') return;
    motion.enabled=true;
    showMotion('體感校準','保持手機在自然姿勢，等候校準。');
    motionTimer=setTimeout(()=>{
      if(!motion.neutral){stopMotion();showMotion('體感無訊號','沒有收到感測器資料。');}
    },2200);
  };
  addEventListener('deviceorientation',event=>{
    if(!motion.enabled||document.hidden||!Number.isFinite(event.beta)||!Number.isFinite(event.gamma)) return;
    const radians=Math.PI/180,beta=event.beta*radians,gamma=event.gamma*radians;
    const angle=(screen.orientation?.angle??window.orientation??0)*radians;
    const x=Math.sin(gamma)*Math.cos(beta),y=Math.sin(beta);
    const roll=x*Math.cos(angle)+y*Math.sin(angle);
    const pitch=x*Math.sin(angle)-y*Math.cos(angle);
    if(!motion.neutral||motion.neutral.angle!==angle){
      motion.neutral={roll,pitch,angle};
      showMotion('體感開','體感已校準。觸碰搖桿時，搖桿優先。');
    }
    motion.roll=bounded((roll-motion.neutral.roll)*2.2,-1,1);
    motion.pitch=bounded((pitch-motion.neutral.pitch)*2.2,-1,1);
  });
  function axes(){
    return motion.enabled&&stickPointer===null?motion:input;
  }

  try{mode.value=localStorage.getItem('skybound-device')||'';}catch{}
  if(document.documentElement.dataset.device==='mobile') mode.value='mobile';
  if(!mode.value) mode.value=matchMedia('(pointer: coarse)').matches?'mobile':'desktop';
  function applyMode(){
    reset();
    stopMotion();
    document.body.classList.toggle('mobile-mode',mode.value==='mobile');
  }
  mode.addEventListener('change',()=>{
    applyMode();
    try{localStorage.setItem('skybound-device',mode.value);}catch{}
  });
  // Global anti-zoom & anti-long-press callout guards for mobile flight
  let lastTouchEndTime=0;
  function isEditableTarget(target){
    return Boolean(target&&target.closest&&target.closest('input:not([type="range"]),textarea,select,a'));
  }
  document.addEventListener('contextmenu',event=>{
    if(!isEditableTarget(event.target)&&(mode.value==='mobile'||document.body.classList.contains('flight-ui'))){
      event.preventDefault();
    }
  },{capture:true});
  document.addEventListener('selectstart',event=>{
    if(!isEditableTarget(event.target)) event.preventDefault();
  },{capture:true});
  for(const gEvent of ['gesturestart','gesturechange','gestureend']){
    document.addEventListener(gEvent,event=>event.preventDefault(),{passive:false});
  }
  document.addEventListener('touchstart',event=>{
    if(event.touches&&event.touches.length>1&&!isEditableTarget(event.target)){
      if(document.body.classList.contains('flight-ui')||mode.value==='mobile') event.preventDefault();
    }
  },{passive:false});
  document.addEventListener('touchend',event=>{
    const now=Date.now();
    if(now-lastTouchEndTime<=280&&!isEditableTarget(event.target)){
      if(event.target.closest('#touchFlight,.hud,header,button')) event.preventDefault();
    }
    lastTouchEndTime=now;
  },{passive:false});

  addEventListener('orientationchange',()=>{
    reset();
    motion.neutral=null;
  });
  addEventListener('blur',reset);
  addEventListener('pagehide',reset);
  document.addEventListener('visibilitychange',reset);
  applyMode();
  return {input,axes,reset,stopMotion,mode,panel};
})();
