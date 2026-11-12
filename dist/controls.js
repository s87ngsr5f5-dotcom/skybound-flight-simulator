'use strict';
const defaultControls=Object.freeze({
  version:3,deadzone:.12,sensitivity:.55,invert:false,
  mouse:false,keepBank:false,throttleKeys:'KeyW,KeyS'
});
function upgradeControls(saved){
  const controls={...defaultControls,...saved,version:3};
  const gain=Number(controls.sensitivity);
  controls.sensitivity=Number.isFinite(gain)?Math.max(.2,Math.min(1,gain)):.55;
  if(!saved?.version||saved.version<3) controls.sensitivity=Math.min(.55,controls.sensitivity);
  const deadzone=Number(controls.deadzone);
  controls.deadzone=Number.isFinite(deadzone)?Math.max(0,Math.min(.35,deadzone)):.12;
  return controls;
}
function gamepadAxis(value,deadzone){
  if(!Number.isFinite(value)) return 0;
  const magnitude=Math.max(0,Math.min(1,(Math.abs(value)-deadzone)/(1-deadzone)));
  return Math.sign(value)*(.35*magnitude+.65*magnitude*magnitude);
}
function manualAxes(raw,controls){
  const bounded=value=>Math.max(-1,Math.min(1,value||0));
  return {
    pitch:bounded(raw.pitch)*(controls.invert?-1:1),
    roll:bounded(raw.roll),
    rudder:bounded(raw.rudder)
  };
}
function smoothControls(f,input,dt){
  const previous=f.manualControls??={pitch:0,roll:0,rudder:0};
  const heavy=(f.aircraft?.mass||1040)>20000;
  const fighter=f.aircraft?.role==='fighter'&&!f.ground&&!f.hold&&!f.gear&&!f.flaps;
  const ramp=(fighter?.18:heavy?.38:.20)/Math.max(.2,input.response||.55);
  const filtered={...input};
  for(const name of ['pitch','roll','rudder']){
    const target=input[name]||0;
    const returning=Math.abs(target)<Math.abs(previous[name])&&Math.sign(target)===Math.sign(previous[name])||target===0;
    const time=returning?ramp*.18:ramp;
    previous[name]+=(target-previous[name])*(1-Math.exp(-dt/time));
    if(Math.abs(previous[name])<.00001) previous[name]=0;
    filtered[name]=previous[name];
  }
  return filtered;
}
if(typeof module!=='undefined') module.exports={defaultControls,upgradeControls,gamepadAxis,manualAxes,smoothControls};



