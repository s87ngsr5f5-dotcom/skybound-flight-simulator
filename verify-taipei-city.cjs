// Integrity checks for offline city data; catches missing publish assets and bad coordinates.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'dist/taipei-city');
const index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
assert.equal(index.license,'ODbL-1.0');
assert.equal(new Set(index.tiles.map(t=>t[0])).size,index.tiles.length);
let buildings=0,roads=0,water=0;
for(const [key,x,z,count] of index.tiles){
  assert.match(key,/^-?\d+_-?\d+$/);
  const data=JSON.parse(fs.readFileSync(path.join(dir,key+'.json'),'utf8'));
  assert.equal(data.b.length,count);
  for(const [cx,cz,h,tone,kind,coords] of data.b){
    assert.ok([cx,cz,h,tone,kind,...coords].every(Number.isFinite));
    assert.ok(h>=2&&h<=510);assert.ok(coords.length>=6&&coords.length%2===0);
    assert.ok(Math.abs(cx-x)<=index.tileSize/2+.1&&Math.abs(cz-z)<=index.tileSize/2+.1);
  }
  for(const [width,bridge,coords] of data.r){assert.ok(width>0&&width<=38);assert.ok(coords.length>=4&&coords.length%2===0);assert.ok(coords.every(Number.isFinite));assert.ok(bridge===0||bridge===1);}
  buildings+=data.b.length;roads+=data.r.length;water+=data.w.length;
}
assert.equal(buildings,index.counts.buildings);assert.equal(roads,index.counts.roads);assert.equal(water,index.counts.waterPolygons);
assert.equal(index.counts.taggedHeight+index.counts.estimatedHeight,buildings);
assert.ok(buildings>90000);assert.ok(roads>19000);
for(const name of ['index.html','iphone.html'])assert.ok(fs.readFileSync(path.join(__dirname,'dist',name),'utf8').includes('taipei-city.js?v=27'));
console.log({tiles:index.tiles.length,buildings,roads,water,estimatedHeight:index.counts.estimatedHeight});
