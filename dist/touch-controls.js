const touchControls=(()=>{
  const mode=document.getElementById('deviceMode');
  const panel=document.getElementById('touchFlight');
  const stick=document.getElementById('touchStick');
  const thumb=stick.querySelector('span');
  const input={roll:0,pitch:0,throttle:0,brake:false};
  const held=new Map();
  let stickPointer=null;

  function center(){
    stickPointer=null;
    input.roll=input.pitch=0;
    thumb.style.transform='';
  }
  function updateButtons(){
    const active=[...held.values()];
    input.throttle=(Number(active.includes('more'))-Number(active.includes('less')))*.48;
    input.brake=active.includes('brake');
  }
  function reset(){
    center();
    held.clear();
    updateButtons();
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
    stick.setPointerCapture(event.pointerId);
    move(event);
  });
  stick.addEventListener('pointermove',event=>{
    if(event.pointerId===stickPointer) move(event);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture']){
    stick.addEventListener(name,event=>{
      if(event.pointerId===stickPointer) center();
    });
    panel.addEventListener(name,event=>{
      if(held.delete(event.pointerId)) updateButtons();
    });
  }
  panel.addEventListener('pointerdown',event=>{
    const button=event.target.closest('[data-hold]');
    if(!button||event.button!==0) return;
    button.setPointerCapture(event.pointerId);
    held.set(event.pointerId,button.dataset.hold);
    updateButtons();
  });

  try{mode.value=localStorage.getItem('skybound-device')||'';}catch{}
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
  document.addEventListener('visibilitychange',reset);
  applyMode();
  return {input,reset,mode,panel};
})();
