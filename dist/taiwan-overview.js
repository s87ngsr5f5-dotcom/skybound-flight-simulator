'use strict';

function createTaiwanOverview(){
  const center=geoPoint(24.1,120.10);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x205774);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,1,750000);
  camera.position.set(center.x,550000,center.z);
  camera.up.set(0,0,-1);
  camera.lookAt(center.x,0,center.z);

  // Both horizontal axes are in the simulation's projected metres.
  const [left,top,width,height]=taiwanSatelliteData.overview,step=1920;
  const geometry=new THREE.PlaneGeometry(width,height,Math.ceil(width/step),Math.ceil(height/step));
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
  const overviewImage={value:null},imageReady={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.overviewImage=overviewImage;
    shader.uniforms.imageReady=imageReady;
    shader.vertexShader='varying vec2 overviewUV;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\n overviewUV=uv;');
    shader.fragmentShader='varying vec2 overviewUV;\nuniform sampler2D overviewImage;\nuniform float imageReady;\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        if(imageReady>0.5){
          vec4 image=texture2D(overviewImage,overviewUV);
          diffuseColor.rgb=mix(diffuseColor.rgb,image.rgb,image.a);
        }
      `);
  };
  loadTaiwanAtlas().then(texture=>{
    overviewImage.value=texture;
    imageReady.value=1;
    document.getElementById('satelliteCredit').hidden=false;
  }).catch(()=>{});
  const overviewTerrain=new THREE.Mesh(geometry,material);
  scene.add(overviewTerrain);
  const distantTerrain=overviewTerrain.clone();
  distantTerrain.position.y=-40;
  const marker=new THREE.Mesh(new THREE.CircleGeometry(1,24),
    new THREE.MeshBasicMaterial({color:0xffdb71,toneMapped:false}));
  marker.rotation.x=-Math.PI/2;
  scene.add(marker);
  function resize(w,h){
    const aspect=w/h,halfHeight=Math.max(265000,218000/aspect);
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
