'use strict';

function createInstrumentRenderer(){
  const canvas=document.createElement('canvas');
  const ink=canvas.getContext('2d');
  if(!ink) return null;
  let width=0,height=0,dpr=1;
  const forward=new THREE.Vector3();

  function draw(f,camera,gates,day){
    ink.setTransform(dpr,0,0,dpr,0,0);
    ink.fillStyle=day>.25?'#86b6d2':'#102842';
    ink.fillRect(0,0,width,height);
    if(!f) return;
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    const focal=height/(2*Math.tan(camera.fov*Math.PI/360));
    const pitch=Math.asin(forward.y),reach=Math.hypot(width,height)*2;
    ink.save();
    ink.translate(width/2,height/2);
    ink.rotate(-f.bank);
    ink.fillStyle=day>.25?'#607254':'#273a32';
    ink.fillRect(-reach,Math.tan(pitch)*focal,2*reach,2*reach);
    ink.restore();

    // Clip the polygon in eye space so it stays visible during the runway roll.
    function polygon(points,fill,stroke){
      const view=points.map(p=>p.applyMatrix4(camera.matrixWorldInverse));
      const clipped=[];
      let a=view.at(-1);
      for(const b of view){
        if((a.z<=-3)!==(b.z<=-3)) clipped.push(a.clone().lerp(b,(-3-a.z)/(b.z-a.z)));
        if(b.z<=-3) clipped.push(b);
        a=b;
      }
      if(clipped.length<3) return;
      ink.beginPath();
      clipped.forEach((p,i)=>{
        const x=width/2-p.x*focal/p.z,y=height/2+p.y*focal/p.z;
        if(i===0) ink.moveTo(x,y);else ink.lineTo(x,y);
      });
      ink.closePath();
      if(fill){ink.fillStyle=fill;ink.fill();}
      if(stroke){ink.strokeStyle=stroke;ink.lineWidth=2;ink.stroke();}
    }
    for(const runway of new Set([f.departure,f.destination])){
      if(!runway||Math.hypot(f.x-runway.x,f.z-runway.z)>25000) continue;
      const half=runway.length/2, edge=runway.width/2;
      const runwayPoint=(along,cross)=>{
        const {x,z}=airportPoint(runway,along,cross);
        return new THREE.Vector3(x,runway.elevation+.16,z);
      };
      const stripe=(a,b,left,right,color,stroke)=>polygon(
        [runwayPoint(a,left),runwayPoint(a,right),runwayPoint(b,right),runwayPoint(b,left)],color,stroke);
      stripe(-half,half,-edge,edge,'#353d45','#d0e2e3');
      for(let a=-half+82;a<half-72;a+=100) stripe(a,a+48,-.85,.85,'#eaf1e7');
      for(const end of [-1,1]) for(const side of [-1,1]){
        const a=end*(half-18),b=end*(half-54);
        for(let i=1;i<6;i++){
          const x=side*edge*i/7;
          stripe(a,b,x-1.2,x+1.2,'#f6f8ed');
        }
      }
    }
    if(gates.visible){
      for(const gate of gates.children){
        if(!gate.visible) continue;
        const {x,y,z}=gate.position;
        const w=27*gate.scale.x,h=12*gate.scale.y;
        const c=Math.cos(gate.rotation.y)*w,s=Math.sin(gate.rotation.y)*w;
        polygon([new THREE.Vector3(x-c,y-h,z+s),new THREE.Vector3(x+c,y-h,z-s),
          new THREE.Vector3(x+c,y+h,z-s),new THREE.Vector3(x-c,y+h,z+s)],null,'#a9ffd6');
      }
    }
  }
  return {
    instrumentOnly:true,domElement:canvas,shadowMap:{enabled:false},capabilities:{getMaxAnisotropy:()=>1},
    setPixelRatio:()=>{},
    setSize(w,h){
      width=w;height=h;dpr=Math.min(window.devicePixelRatio||1,1.5);
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      canvas.style.width=w+'px';canvas.style.height=h+'px';
    },
    render:()=>{},draw
  };
}
