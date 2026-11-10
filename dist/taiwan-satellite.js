'use strict';

let taiwanAtlas;
function loadTaiwanAtlas(){
  return taiwanAtlas??=new THREE.TextureLoader().loadAsync('satellite/overview.webp').then(texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    document.getElementById('satelliteCredit').hidden=false;
    return texture;
  });
}
function satelliteTileURL(tile,variant){
  if(taiwanSatelliteData.baked.includes(tile.key)){
    return 'satellite/'+tile.key+(variant==='low'?'-low':'')+'.webp';
  }
  const {x,y:z}=tile.origin.value;
  const northwest=latLon(x,z), southeast=latLon(x+11520,z+11520);
  const size=variant==='high'?1152:288;
  const query=new URLSearchParams({
    service:'WMS',request:'GetMap',version:'1.3.0',
    layers:'esa-worldcover-s2rgbnir-10m-2021-v2_tcc',styles:'default',format:'image/jpeg',
    crs:'EPSG:4326',time:'2021-01-01',width:size,height:size,
    bbox:[southeast.lat,northwest.lon,northwest.lat,southeast.lon].map(value=>value.toFixed(9)).join(',')
  });
  return 'https://titiler.terrascope.be/wms?'+query;
}
function createTaiwanSatellite(makeMaterial,renderer,onLoaded){
  const span=11520, catalog=new Set(taiwanSatelliteData.tiles);
  const tiles=new Map(), loader=new THREE.TextureLoader();
  let location='',queue=[],loading=0;
  function process(){
    while(loading<4&&queue.length){
      const [tile,variant]=queue.shift();
      if(tile.variant!==variant||tile.loading) continue;
      loading++;
      tile.loading=true;
      loader.load(satelliteTileURL(tile,variant),texture=>{
        if(tiles.get(tile.key)===tile&&tile.variant===variant){
          texture.colorSpace=THREE.SRGBColorSpace;
          texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
          tile.texture?.dispose();
          tile.texture=tile.image.value=texture;
          tile.ready.value=1;
          onLoaded();
        }else texture.dispose();
        finish(tile,variant);
      },undefined,()=>finish(tile,variant));
    }
  }
  function finish(tile,variant){
    loading--;
    tile.loading=false;
    if(tiles.get(tile.key)===tile&&tile.variant&&tile.variant!==variant) queue.unshift([tile,tile.variant]);
    process();
  }
  function update(col,row,quality){
    const id=col+':'+row+':'+quality;
    if(id===location) return;
    location=id;
    queue=[];
    const active=new Set(), candidates=[];
    for(let z=row-3;z<=row+3;z++){
      for(let x=col-3;x<=col+3;x++){
        const key=x+'_'+z;
        if(!catalog.has(key)) continue;
        active.add(key);
        candidates.push({key,x,z,distance:(x-col)**2+(z-row)**2});
      }
    }
    for(const [key,tile] of tiles){
      if(active.has(key)) continue;
      tile.texture?.dispose();
      tile.material.dispose();
      tiles.delete(key);
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    const highTiles=quality==='ultra'?4:quality==='high'||quality==='satellite'?2:quality==='balanced'?1:0;
    candidates.forEach(({key,x,z,distance},index)=>{
      let tile=tiles.get(key);
      if(!tile){
        tile={key,image:{value:null},ready:{value:0},origin:{value:new THREE.Vector2(x*span,z*span)}};
        tile.material=makeMaterial(tile);
        tiles.set(key,tile);
      }
      const variant=distance>2?null:index<highTiles&&renderer.capabilities.maxTextureSize>=1152?'high':'low';
      if(tile.variant!==variant){
        tile.variant=variant;
        if(variant) queue.push([tile,variant]);
        else{
          tile.ready.value=0;
          tile.texture?.dispose();
          tile.texture=null;
          tile.image.value=null;
        }
      }else if(variant&&!tile.texture&&!tile.loading) queue.push([tile,variant]);
    });
    process();
  }
  return {update,material:(col,row)=>tiles.get(col+'_'+row)?.material};
}
