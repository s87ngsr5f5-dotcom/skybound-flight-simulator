const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const memory=new Map();global.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
for(const f of ['elevation','physics','fleet','benchmarks','helicopter','fleet-expansion']) vm.runInThisContext(fs.readFileSync('dist/'+f+'.js','utf8'),{filename:f});
assert.equal(fleet.length,100);assert.equal(new Set(fleet.map(p=>p.id)).size,100);
for(const p of fleet){assert(p.geometry.every(Number.isFinite),p.id);assert(p.inertia.every(n=>n>0),p.id);assert(p.mass>0&&p.wingArea>0,p.id);assert(Object.hasOwn(fleetCategories,p.category),p.id);}
const locked=fleet.filter(p=>!aircraftUnlocked(p));assert.equal(locked.length,6);
assert(!aircraftUnlocked(fleet.find(p=>p.id==='f14b')));
memory.set('skybound.campaignProgress.v1','{"4":{"stars":1}}');assert(aircraftUnlocked(fleet.find(p=>p.id==='f14b')));
assert(!aircraftUnlocked(fleet.find(p=>p.id==='f22a')));
memory.set('skybound.campaignProgress.v1','{bad');assert(!aircraftUnlocked(fleet.find(p=>p.id==='f14b')));
assert(fleetMatches(fleet.find(p=>p.id==='cj4'),'business'));assert.equal(fleet.filter(p=>fleetMatches(p,'special')).length,6);
console.log(JSON.stringify({total:fleet.length,categories:Object.fromEntries(Object.keys(fleetCategories).filter(k=>!['all','special'].includes(k)).map(k=>[k,fleet.filter(p=>p.category===k).length])),locked:locked.map(p=>p.id),saveMigration:'existing campaign star records, no reset'},null,2));

fs.mkdirSync('work-qa-fleet100',{recursive:true});
fs.writeFileSync('work-qa-fleet100/fleet-status.json',JSON.stringify(fleet.map(p=>({id:p.id,name:p.name,category:p.category,length:p.geometry[0]*2,span:p.geometry[2]*2,engines:p.geometry[4],model:p.modelStatus,performance:p.performanceStatus,unlock:p.unlock})),null,2));
