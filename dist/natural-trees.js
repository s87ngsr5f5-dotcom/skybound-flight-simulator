'use strict';
// Smooth, irregular broadleaf crowns at true metre scale; shared by forest and airport trees.
function naturalTreeCrown(detail=1){
  const geometry=new THREE.SphereGeometry(1,detail===2?16:detail===1?11:8,detail===2?11:detail===1?8:6);
  const p=geometry.attributes.position;
  const colors=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),angle=Math.atan2(z,x);
    const shape=1+.13*Math.sin(angle*3+y*2.4)+.075*Math.cos(angle*5-y*3.7);
    p.setXYZ(i,x*shape,y*(1+.04*Math.cos(angle*4))+.055*Math.sin(x*3+z*2),z*shape);
    const shade=.80+.12*(y*.5+.5)+.06*Math.sin(angle*7+y*6);
    colors.push(shade,shade,shade);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
