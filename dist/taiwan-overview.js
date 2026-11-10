'use strict';

function createTaiwanOverview(){
  const center=geoPoint(23.66,120.94);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x205774);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,1,750000);
  camera.position.set(center.x,550000,center.z);
  camera.up.set(0,0,-1);
  camera.lookAt(center.x,0,center.z);

  // Both horizontal axes are in the simulation's projected metres.
  const left=-247200,top=-36000,width=307200,height=398400,step=2400;
  const geometry=new THREE.PlaneGeometry(width,height,width/step,height/step);
  geometry.rotateX(-Math.PI/2);
  geometry.translate(left+width/2,0,top+height/2);
  const points=geometry.attributes.position;
  const colors=new Float32Array(points.count*3);
  const color=new THREE.Color(),sea=new THREE.Color(0x205774),coast=new THREE.Color(0x4d7658);
  const forest=new THREE.Color(0x325b47),ridge=new THREE.Color(0xbbb7a1);
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),z=points.getZ(i),h=regionalHeight(x,z);
    points.setY(i,h);
    if(h<1.5) color.copy(sea);
    else{
      color.copy(coast).lerp(forest,Math.min(1,h/850));
      if(h>1400) color.lerp(ridge,Math.min(1,(h-1400)/2350));
      const shade=(h-regionalHeight(x-step,z-step))/step;
      color.multiplyScalar(Math.max(.72,Math.min(1.24,.96+shade*1.35)));
    }
    color.toArray(colors,i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const material=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});
  const overviewTerrain=new THREE.Mesh(geometry,material);
  scene.add(overviewTerrain);
  const distantTerrain=overviewTerrain.clone();
  distantTerrain.position.y=-40;
  const marker=new THREE.Mesh(new THREE.CircleGeometry(1,24),
    new THREE.MeshBasicMaterial({color:0xffdb71,toneMapped:false}));
  marker.rotation.x=-Math.PI/2;
  scene.add(marker);
  function resize(w,h){
    const aspect=w/h,halfHeight=Math.max(223000,151000/aspect);
    camera.left=-halfHeight*aspect;
    camera.right=halfHeight*aspect;
    camera.top=halfHeight;
    camera.bottom=-halfHeight;
    camera.updateProjectionMatrix();
    marker.scale.setScalar(7*2*halfHeight/h);
    return 50000*w/(camera.right-camera.left);
  }
  function draw(renderer,f){
    marker.position.set(f.x,9000,f.z);
    renderer.render(scene,camera);
  }
  return {distantTerrain,resize,draw};
}
