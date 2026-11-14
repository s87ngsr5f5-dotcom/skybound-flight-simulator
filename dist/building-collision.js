'use strict';
// Lightweight spatial-hash building collision registry (v0.63).
// City modules register building footprints (AABB + roof height); the flight loop queries it
// so that flying into a house, tower or landmark triggers a crash explosion.
(function(globalScope){
  const CELL=64;
  const cells=new Map();
  const groups=new Map();
  let total=0;
  const cellKey=(ix,iz)=>ix*131071+iz;
  function add(groupKey,minX,minZ,maxX,maxZ,top,base){
    if(!(maxX>minX)||!(maxZ>minZ)||!Number.isFinite(top))return;
    const entry=[minX,minZ,maxX,maxZ,top,Number.isFinite(base)?base:-1e9];
    let list=groups.get(groupKey);
    if(!list){list=[];groups.set(groupKey,list);}
    const x0=Math.floor(minX/CELL),x1=Math.floor(maxX/CELL),z0=Math.floor(minZ/CELL),z1=Math.floor(maxZ/CELL);
    for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){
      const k=cellKey(ix,iz);
      let cell=cells.get(k);
      if(!cell){cell=[];cells.set(k,cell);}
      cell.push(entry);
      list.push(k,entry);
    }
    total++;
  }
  function addCircle(groupKey,x,z,radius,top,base){add(groupKey,x-radius,z-radius,x+radius,z+radius,top,base);}
  function clearGroup(groupKey){
    const list=groups.get(groupKey);
    if(!list)return;
    const seen=new Set();
    for(let i=0;i<list.length;i+=2){
      const cell=cells.get(list[i]);
      seen.add(list[i+1]);
      if(!cell)continue;
      const idx=cell.indexOf(list[i+1]);
      if(idx>=0){cell[idx]=cell[cell.length-1];cell.pop();}
      if(!cell.length)cells.delete(list[i]);
    }
    total-=seen.size;
    groups.delete(groupKey);
  }
  // Returns the building hit by a sphere (x,y,z,radius) or null.
  function test(x,y,z,radius=0){
    const r=Math.max(0,radius);
    const x0=Math.floor((x-r)/CELL),x1=Math.floor((x+r)/CELL),z0=Math.floor((z-r)/CELL),z1=Math.floor((z+r)/CELL);
    for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){
      const cell=cells.get(cellKey(ix,iz));
      if(!cell)continue;
      for(let i=0;i<cell.length;i++){
        const e=cell[i];
        if(x+r<e[0]||x-r>e[2]||z+r<e[1]||z-r>e[3])continue;
        if(y-r>e[4]||y+r<e[5])continue;
        return {minX:e[0],minZ:e[1],maxX:e[2],maxZ:e[3],top:e[4],base:e[5]};
      }
    }
    return null;
  }
  function reset(){cells.clear();groups.clear();total=0;}
  globalScope.BuildingCollision={add,addCircle,clearGroup,test,reset,get count(){return total;},get groups(){return groups.size;}};
})(typeof window!=='undefined'?window:globalThis);
