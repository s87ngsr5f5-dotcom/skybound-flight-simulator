const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const name of ['elevation','physics','regional-elevation','region','fleet','benchmarks','operations','narita-elevation','cargo-voyage']){
  vm.runInThisContext(fs.readFileSync('dist/'+name+'.js','utf8'),{filename:name+'.js'});
}
const frame=(time,bank)=>[time,...replayFields.map(k=>k==='bank'?bank:k==='heading'?bank:0)];
for(const sign of [-1,1]){
  const f={};applyVoyageFrame(f,[frame(0,sign*179*Math.PI/180),frame(1,-sign*179*Math.PI/180)],.5);
  assert.ok(Math.abs(Math.abs(f.bank)-Math.PI)<1e-9,'roll replay crosses 180 without spinning backward');
  assert.ok(Math.abs(Math.abs(f.heading)-Math.PI)<1e-9);
}
console.log('Replay roll and heading continuity at ±180 degrees passed.');
