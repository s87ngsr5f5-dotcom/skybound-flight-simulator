const touchControls=(()=>{
  const mode=document.getElementById('deviceMode');
  const panel=document.getElementById('touchFlight');
  const stick=document.getElementById('touchStick');
  const thumb=stick.querySelector('span');
  const input={roll:0,pitch:0,brake:false};
  const brakePointers=new Set();
  let stickPointer=null;

  function center(){
    stickPointer=null;
    input.roll=input.pitch=0;
    thumb.style.transform='';
  }
  function reset(){
    center();
    brakePointers.clear();
    input.brake=false;
  }
  function move(event){
    const bounds=stick.getBoundingClientRect();
    const radius=bounds.width*.36;
    const x=(event.clientX-bounds.left-bounds.width/2)/radius;
    const y=(event.clientY-bounds.top-bounds.height/2)/radius;
    const scale=Math.max(1,Math.hypot(x,y));
    input.roll=x/scale;
    input.pitch=-y/scale;
    thumb.style.transform=`translate(${input.roll*radius}px,${-input.pitch*radius}px)`;
  }
  stick.addEventListener('pointerdown',event=>{
    if(event.button!==0||stickPointer!==null) return;
    stickPointer=event.pointerId;
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

  try{mode.value=localStorage.getItem('skybound-device')||'';}catch{}
  if(document.documentElement.dataset.device==='mobile') mode.value='mobile';
  if(!mode.value) mode.value=matchMedia('(pointer: coarse)').matches?'mobile':'desktop';
  function applyMode(){
    reset();
    document.body.classList.toggle('mobile-mode',mode.value==='mobile');
  }
  mode.addEventListener('change',()=>{
    applyMode();
    try{localStorage.setItem('skybound-device',mode.value);}catch{}
  });
  addEventListener('blur',reset);
  addEventListener('pagehide',reset);
  document.addEventListener('visibilitychange',reset);
  applyMode();
  return {input,reset,mode,panel};
})();
