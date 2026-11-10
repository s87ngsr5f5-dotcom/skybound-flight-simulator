'use strict';
function createHangar(box,material){
  const room=new THREE.Group();
  room.name='SKYBOUND Hangar 01';
  const floor=material(0x5c6870),joint=material(0x414c54);
  const wall=material(0x3b4b58), lowerWall=material(0x243541);
  const steel=new THREE.MeshStandardMaterial({color:0x80919d,roughness:.54,metalness:.27});
  const yellow=material(0xe6b742),white=material(0xdde1d4);
  const lamp=new THREE.MeshBasicMaterial({color:0xe9f6ff});
  const glass=material(0x678598);
  box(room,floor,222,.44,246,0,-.10,0);
  box(room,wall,222,1.4,246,0,31,0);
  for(const side of [-1,1]){
    box(room,wall,.7,31,246,side*110.5,15.5,0);
    box(room,lowerWall,1.0,4.5,246,side*110.2,2.25,0);
    box(room,yellow,.20,.025,106,side*42,.166,0);
    for(let z=-104;z<=104;z+=26){
      box(room,steel,1.2,31,1.4,side*108.4,15.5,z);
      box(room,glass,.18,3.1,19,side*109.96,22,z+9);
      box(room,lamp,.12,.22,17,side*109.79,20.5,z+9);
    }
  }
  for(const end of [-1,1]){
    box(room,wall,222,31,.66,0,15.5,end*122.7);
    box(room,lowerWall,88,20,1.2,0,10,end*121.9);
    for(let x=-42;x<=42;x+=7){
      box(room,steel,.28,20,.24,x,10,end*121.22);
      box(room,glass,4.0,1.45,.24,x,17.6,end*121.13);
    }
    box(room,yellow,84,.025,.20,0,.166,end*53);
  }
  for(let z=-105;z<=105;z+=21){
    box(room,steel,218,.48,.62,0,28.8,z);
    for(const x of [-71,-31,31,71]) box(room,lamp,1.15,.12,10,x,28.45,z);
    box(room,joint,214,.018,.052,0,.151,z);
  }
  for(let x=-105;x<=105;x+=15) box(room,joint,.05,.018,238,x,.151,0);
  for(let z=-45;z<=45;z+=9) box(room,white,.22,.028,4.8,0,.171,z);
  for(const side of [-1,1]){
    const x=side*18,z=side*17;
    box(room,lowerWall,1.8,.84,1.0,x,.62,z);
    box(room,yellow,1.88,.13,1.05,x,1.08,z);
    for(let offset=-1;offset<=1;offset++){
      box(room,steel,1.3,.027,.04,x,.59+offset*.18,z-.51);
    }
    for(const dx of [-.68,.68]) for(const dz of [-.38,.38]){
      box(room,joint,.17,.25,.17,x+dx,.235,z+dz);
    }
    for(let i=0;i<3;i++){
      const cone=new THREE.Mesh(new THREE.ConeGeometry(.22,.64,12),yellow);
      cone.position.set(x-side*1.75,.44,z+(i-1)*1.5);
      room.add(cone);
    }
  }
  const sign=document.createElement('canvas');
  sign.width=768;sign.height=180;
  const ink=sign.getContext('2d');
  ink.fillStyle='#152938';ink.fillRect(0,0,768,180);
  ink.fillStyle='#6de2ff';ink.fillRect(22,24,9,128);
  ink.fillStyle='#eaf6ff';ink.font='bold 61px sans-serif';ink.fillText('SKYBOUND GLOBAL',52,86);
  ink.fillStyle='#9db7c8';ink.font='33px sans-serif';ink.fillText('HANGAR 01  /  FLEET INSPECTION',56,138);
  const texture=new THREE.CanvasTexture(sign);
  texture.colorSpace=THREE.SRGBColorSpace;
  const plaque=new THREE.Mesh(new THREE.PlaneGeometry(35,8.2),new THREE.MeshBasicMaterial({map:texture}));
  plaque.position.set(0,24,-122.25);
  room.add(plaque);
  room.visible=false;
  return room;
}
