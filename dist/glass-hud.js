'use strict';

function makeGlassReadouts(canvas){
  const ink=canvas.getContext('2d');
  const green='#a1ffba', panel='#0b201adf', outline='#0b2117';
  const cardinal={0:'北',90:'東',180:'南',270:'西'};
  let width=0,height=0,dpr=0,unit=1;
  function label(text,x,y,size=12,align='center',color=green){
    ink.font='700 '+size*unit+'px system-ui,sans-serif';
    ink.textAlign=align;ink.textBaseline='middle';
    ink.strokeStyle=outline;ink.lineWidth=2.7*unit;
    ink.strokeText(text,x,y);
    ink.fillStyle=color;ink.fillText(text,x,y);
  }
  function line(x,y,endX,endY){
    ink.moveTo(x,y);ink.lineTo(endX,endY);
  }
  function badge(text,x,y,side=0){
    const halfW=27*unit,halfH=11*unit;
    ink.beginPath();
    ink.moveTo(x-halfW,y-halfH);
    ink.lineTo(x+halfW,y-halfH);
    if(side>0) ink.lineTo(x+halfW+6*unit,y);
    ink.lineTo(x+halfW,y+halfH);
    ink.lineTo(x-halfW,y+halfH);
    if(side<0) ink.lineTo(x-halfW-6*unit,y);
    ink.closePath();
    ink.fillStyle=panel;ink.fill();
    ink.strokeStyle=green;ink.lineWidth=1.2*unit;ink.stroke();
    label(text,x,y,14);
  }
  function tape(value,step,x,y,side,name){
    const span=height*.25, gap=span*.34;
    const lowerSpan=side>0&&innerWidth>innerHeight&&height<320?span*.64:span;
    ink.beginPath();
    line(x,y-span,x,y+lowerSpan);
    const first=Math.floor(value/step)*step-4*step;
    for(let tick=first;tick<=first+8*step;tick+=step){
      if(tick<0) continue;
      const markY=y+(value-tick)/step*gap;
      if(markY<y-span||markY>y+lowerSpan) continue;
      line(x,markY,x+side*9*unit,markY);
      if(Math.abs(y-markY)>14*unit) label(String(tick),x+side*13*unit,markY,11,side<0?'right':'left');
    }
    for(let i=-12;i<=12;i++){
      const markY=y+i*gap/4;
      if(markY>=y-span&&markY<=y+lowerSpan) line(x,markY,x+side*4*unit,markY);
    }
    ink.strokeStyle=green;ink.lineWidth=1.35*unit;ink.stroke();
    const anchor=x+side*33*unit;
    badge(String(Math.round(value)),anchor,y,-side);
    label(name,anchor,y-span-9*unit,10);
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
    const center=width/2,y=height*.60;
    const degrees=((f.heading*180/Math.PI)%360+360)%360;
    const compassY=14*unit, headingGap=height*.092;
    const first=Math.floor(degrees/10)*10-30;
    ink.beginPath();
    for(let tick=first;tick<=first+70;tick+=5){
      const x=center+(tick-degrees)/10*headingGap;
      if(Math.abs(x-center)>headingGap*3.45) continue;
      const major=tick%10===0;
      line(x,compassY+9*unit,x,compassY+(major?18:14)*unit);
      const heading=(tick+360)%360;
      if(major) label(cardinal[heading]||String(heading/10).padStart(2,'0'),x,compassY,11);
    }
    ink.strokeStyle=green;ink.lineWidth=1.35*unit;ink.stroke();
    badge(String(Math.round(degrees)%360).padStart(3,'0')+'°',center,compassY+32*unit);
    const tapeOffset=Math.min(width*.31,height*.45);
    const ias=displayKmh(speeds.ias);
    tape(ias,ias>1100?100:50,center-tapeOffset,y,-1,'IAS km/h');
    tape(f.y,f.y>5000?100:50,center+tapeOffset,y,1,'高度 m');
    const rising=f.vy>=0;
    const vertical=(rising?'▲ ':'▼ ')+Math.abs(f.vy).toFixed(1)+' m/s';
    const tas='TAS '+displayKmh(speeds.tas),gs='GS '+displayKmh(speeds.gs);
    const mach='M '+speeds.mach.toFixed(2),power=(f.aircraft.helicopter?'總距 ':'油門 ')+Math.round(f.power*100)+'%';
    if(width>=365&&innerWidth>innerHeight){
      const iasX=center-tapeOffset-44*unit,right=center+tapeOffset+44*unit;
      const infoY=y-height*.21;
      [tas,gs,mach].forEach((text,i)=>label(text,iasX,infoY+i*13*unit,10,'right'));
      label(power,iasX,infoY+41*unit,11,'right','#ffdb87');
      [vertical,f.aircraft.helicopter?'旋翼 '+Math.round((f.rotorRPM??0)*100)+'%':f.gear?'起落架放下':'起落架收起',f.hold||f.hover?'輔助開啟':'輔助關閉',view]
        .forEach((text,i)=>label(text,right,infoY+i*13*unit,10,'left'));
    }else{
      label(tas+'   '+gs+'   '+mach,center,height-20*unit,11);
      label(vertical+'   '+power+'   '+(f.hold?'輔助開':'輔助關'),center,height-7*unit,10);
    }
  }
  return {draw};
}
