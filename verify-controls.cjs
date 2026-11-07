'use strict';
const assert=require('node:assert/strict');
const {upgradeControls,manualAxes,gamepadAxis,smoothControls}=require('./dist/controls.js');
const standard=upgradeControls({sensitivity:1,invert:false,bindings:{KeyC:'KeyV'}});
assert.equal(standard.sensitivity,.55);
assert.equal(standard.bindings.KeyC,'KeyV');
const inverse=upgradeControls({...standard,invert:true,invertRoll:true,invertRudder:true});
for(const invert of [standard,inverse]){
  assert(manualAxes({roll:1,rudder:1,pitch:1},invert).roll>0);
  assert(manualAxes({roll:-1,rudder:-1,pitch:1},invert).roll<0);
  assert(manualAxes({roll:1,rudder:1,pitch:1},invert).rudder>0);
}
assert(manualAxes({pitch:1},standard).pitch>0);
assert(manualAxes({pitch:1},inverse).pitch<0);
assert.equal(gamepadAxis(.119,.12),0);
assert(gamepadAxis(.121,.12)<.001);
assert.equal(gamepadAxis(1,.12),1);
function held(fps,mass){
  const f={aircraft:{mass}};
  let first, end;
  for(let i=0;i<fps;i++){
    end=smoothControls(f,{pitch:.55,roll:.55,rudder:.55},1/fps);
    first??=end.pitch;
  }
  return {first,end:end.pitch,state:f};
}
assert(held(60,286000).first<.015);
assert(held(60,286000).end<held(60,1040).end);
assert(Math.abs(held(30,286000).end-held(144,286000).end)<1e-12);
const heavy=held(120,286000);
for(let i=0;i<120;i++) smoothControls(heavy.state,{pitch:0,roll:0,rudder:0},1/120);
assert(heavy.state.manualControls.pitch<.06);
console.log('PASS: normal left/right and rudder in both pitch modes, migration, deadzone continuity, heavy-aircraft smoothing, release, FPS independence.');

