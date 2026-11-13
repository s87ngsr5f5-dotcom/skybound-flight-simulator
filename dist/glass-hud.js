'use strict';

function makeGlassReadouts(canvas){
  const ink=canvas.getContext('2d');
  const ice='#e9f6ff', cyan='#6fd5ff', gold='#f0c464', emerald='#68e8ba';
  const glass='rgba(8, 12, 18, 0.72)', halo='rgba(4, 8, 14, 0.85)';
  const cardinal={0:'N',90:'E',180:'S',270:'W'};
  let width=0,height=0,dpr=0,unit=1;
  function label(text,x,y,size=12,align='center',color=ice){
    ink.font='600 '+size*unit+'px "Inter",system-ui,monospace';
    ink.textAlign=align;ink.textBaseline='middle';
    ink.strokeStyle=halo;ink.lineWidth=3*unit;
    ink.strokeText(text,x,y);
    ink.fillStyle=color;ink.fillText(text,x,y);
  }
  function capsule(text,x,y,accent=cyan,sub=''){
    const w=62*unit,h=23*unit,r=5*unit;
    ink.beginPath();
    ink.roundRect?ink.roundRect(x-w/2,y-h/2,w,h,r):ink.rect(x-w/2,y-h/2,w,h);
    ink.fillStyle=glass;ink.fill();
    ink.strokeStyle='rgba(220, 238, 255, 0.28)';ink.lineWidth=1*unit;ink.stroke();
    ink.fillStyle=accent;ink.fillRect(x-w/2+1.5*unit,y-h/2+4*unit,2.5*unit,h-8*unit);
    label(text,x+2*unit,y,13,'center',ice);
    if(sub) label(sub,x,y-h/2-8*unit,9,'center',accent);
  }
  function scaleRail(value,step,x,y,side,title,accent){
    const span=height*.23,gap=span*.34;
    const lowerSpan=side>0&&innerWidth>innerHeight&&height<320?span*.62:span;
    const curveX=t=>x-side*Math.pow(Math.abs(t)/span,1.8)*7*unit;
    ink.beginPath();
    const first=Math.floor(value/step)*step-4*step;
    for(let tick=first;tick<=first+8*step;tick+=step){
      if(tick<0) continue;
      const dy=(value-tick)/step*gap;
      if(dy<-span||dy>lowerSpan) continue;
      const markY=y+dy, rx=curveX(dy);
      ink.moveTo(rx,markY);ink.lineTo(rx+side*8*unit,markY);
      if(Math.abs(dy)>25*unit) label(String(tick),rx+side*12*unit,markY,10,side<0?'right':'left','rgba(226,242,255,0.78)');
    }
    for(let i=-12;i<=12;i++){
      const dy=i*gap/4;
      if(dy>=-span&&dy<=lowerSpan){
        const rx=curveX(dy);
        ink.moveTo(rx,y+dy);ink.lineTo(rx+side*3.5*unit,y+dy);
      }
    }
    ink.strokeStyle='rgba(165, 222, 255, 0.55)';ink.lineWidth=1.15*unit;ink.stroke();
    const anchor=x+side*38*unit;
    capsule(String(Math.round(value)),anchor,y,accent,title);
  }
  function draw(f,speeds,view){
    if(!ink) return;
    const w=canvas.clientWidth,h=canvas.clientHeight,pixels=Math.min(devicePixelRatio||1,2);
    if(!w||!h) return;
    if(w!==width||h!==height||pixels!==dpr){
      width=w;height=h;dpr=pixels;
      canvas.width=Math.round(w*pixels);canvas.height=Math.round(h*pixels);
      unit=Math.max(.77,Math.min(1.5,Math.min(w/430,h/250)));
    }
    ink.setTransform(dpr,0,0,dpr,0,0);
    ink.clearRect(0,0,width,height);
    const center=width/2,y=height*.58;
    const degrees=((f.heading*180/Math.PI)%360+360)%360;
    const compassY=14*unit,headingGap=height*.092;
    const first=Math.floor(degrees/10)*10-30;
    ink.beginPath();
    for(let tick=first;tick<=first+70;tick+=5){
      const x=center+(tick-degrees)/10*headingGap;
      if(Math.abs(x-center)>headingGap*3.4) continue;
      const major=tick%10===0;
      const arcDip=Math.pow((x-center)/(headingGap*3.4),2)*5*unit;
      ink.moveTo(x,compassY+10*unit+arcDip);ink.lineTo(x,compassY+(major?18:14)*unit+arcDip);
      const heading=(tick+360)%360;
      if(major) label(cardinal[heading]||String(heading/10).padStart(2,'0'),x,compassY+arcDip,10,'center',cardinal[heading]?gold:'rgba(225,242,255,0.85)');
    }
    ink.strokeStyle='rgba(175, 224, 255, 0.6)';ink.lineWidth=1.2*unit;ink.stroke();
    // Signature top diamond pointer + compact heading readout
    ink.beginPath();ink.moveTo(center,compassY+20*unit);ink.lineTo(center-4*unit,compassY+25*unit);ink.lineTo(center+4*unit,compassY+25*unit);ink.closePath();
    ink.fillStyle=gold;ink.fill();
    capsule(String(Math.round(degrees)%360).padStart(3,'0')+'°',center,compassY+38*unit,gold);

    const tapeOffset=Math.min(width*.31,height*.45);
    const ias=displayKmh(speeds.ias);
    scaleRail(ias,ias>1100?100:50,center-tapeOffset,y,-1,'IAS',cyan);
    scaleRail(f.y,f.y>5000?100:50,center+tapeOffset,y,1,'ALT m',gold);

    const rising=f.vy>=0;
    const vertical=(rising?'▲ ':'▼ ')+Math.abs(f.vy).toFixed(1)+' m/s';
    const tas='TAS '+displayKmh(speeds.tas),gs='GS '+displayKmh(speeds.gs);
    const mach='M '+speeds.mach.toFixed(2),power=(f.aircraft.helicopter?'ROTOR ':'THR ')+Math.round(f.power*100)+'%';
    const gText=f.gForce!==undefined?(f.gForce>=0?'+':'')+f.gForce.toFixed(1)+'G':'';
    const geText=f.groundEffect?.active?' · GE':'';
    if(width>=365&&innerWidth>innerHeight){
      const iasX=center-tapeOffset-46*unit,right=center+tapeOffset+46*unit;
      const infoY=y-height*.25;
      [tas,gs,mach].forEach((text,i)=>label(text,iasX,infoY+i*13*unit,10,'right','rgba(215,235,248,0.88)'));
      label(power,iasX,infoY+42*unit,11,'right',gold);
      if(gText) label(gText+geText,iasX,infoY+55*unit,10,'right',(f.gForce>3.0||f.gForce<0.2)?'#ff8a5c':cyan);
      [vertical,f.aircraft.helicopter?'NR '+Math.round((f.rotorRPM??0)*100)+'%':f.gear?'GEAR DOWN':'GEAR UP',f.hold||f.hover?'AP ENGAGED':'MANUAL',view]
        .forEach((text,i)=>label(text,right,infoY+i*13*unit,10,'left',i===1&&f.gear?emerald:ice));
    }else{
      label(tas+' · '+gs+' · '+mach+(gText?' · '+gText:''),center,height-22*unit,10,'center','rgba(225,242,255,0.9)');
      label(vertical+' · '+power+' · '+(f.hold?'AP ON':'MANUAL')+geText,center,height-8*unit,10,'center',gold);
    }
  }
  return {draw};
}
