'use strict';

const pitchDash=[3,3], solidPitchLine=[];
const attitudeLimit=(n,limit)=>Math.max(-limit,Math.min(n,limit));

class FlightAttitudeIndicator {
  constructor(canvas) {
    this.canvas=canvas;
    this.ink=canvas.getContext('2d');
    this.size=0;
    this.dpr=0;
    this.mode='';
    this.font='';
    this.ladder=Array.from({length:17},(_,i)=>String(Math.abs(i-8)*10));
    this.banks=[-60,-45,-30,-20,-10,0,10,20,30,45,60];
  }

  resize(size,mode) {
    const dpr=Math.min(2,window.devicePixelRatio||1);
    if(this.size===size&&this.mode===mode&&this.dpr===dpr) return;
    this.size=size;
    this.dpr=dpr;
    this.mode=mode;
    this.canvas.width=this.canvas.height=Math.round(size*dpr);
    const radius=size*.46;
    this.font='600 '+Math.max(9,Math.round(radius*.12))+'px system-ui';
    const ink=this.ink;
    this.sky=ink.createLinearGradient(0,-radius*2,0,0);
    this.sky.addColorStop(0,'#123969');
    this.sky.addColorStop(1,'#247ab6');
    this.earth=ink.createLinearGradient(0,0,0,radius*2);
    this.earth.addColorStop(0,'#895129');
    this.earth.addColorStop(1,'#4b2814');
  }

  draw(f,pitch,bank,heading,size,mode) {
    const ink=this.ink;
    if(!ink||!size) return;
    this.resize(size,mode);
    const half=size/2,r=size*.46,span=r*5;
    const degrees=180/Math.PI, scale=r/29;
    const hud=mode==='hud', color=hud?'#9affc1':'#f4f9ff';
    ink.setTransform(this.dpr,0,0,this.dpr,0,0);
    ink.clearRect(0,0,size,size);
    ink.save();
    ink.translate(half,half);
    ink.beginPath();ink.arc(0,0,r,0,Math.PI*2);ink.clip();
    ink.save();
    ink.rotate(-bank);
    ink.translate(0,pitch*degrees*scale);
    if(!hud){
      ink.fillStyle=this.sky;ink.fillRect(-span,-span,span*2,span);
      ink.fillStyle=this.earth;ink.fillRect(-span,0,span*2,span);
    }
    ink.fillStyle=ink.strokeStyle=color;
    ink.font=this.font;
    ink.textBaseline='middle';
    ink.lineWidth=1.4;
    ink.beginPath();ink.moveTo(-span,0);ink.lineTo(span,0);ink.stroke();
    for(let deg=-80;deg<=80;deg+=5){
      if(deg===0||Math.abs(deg-pitch*degrees)>32) continue;
      const major=deg%10===0,w=r*(major?.30:.17),y=-deg*scale,gap=r*.095;
      ink.setLineDash(deg<0?pitchDash:solidPitchLine);
      ink.beginPath();ink.moveTo(-w,y);ink.lineTo(-gap,y);
      ink.moveTo(gap,y);ink.lineTo(w,y);ink.stroke();
      if(major){
        const label=this.ladder[deg/10+8];
        ink.textAlign='right';ink.fillText(label,-w-4,y);
        ink.textAlign='left';ink.fillText(label,w+4,y);
      }
    }
    ink.restore();
    if(Math.abs(pitch)>.52||Math.abs(bank)>.79){
      ink.save();
      ink.rotate(-bank);
      const direction=Math.sign(pitch)||1;
      const y=-direction*r*.48;
      ink.strokeStyle='#ffad48';ink.lineWidth=2.5;
      ink.beginPath();ink.moveTo(-r*.20,y-direction*r*.10);
      ink.lineTo(0,y);ink.lineTo(r*.20,y-direction*r*.10);ink.stroke();
      ink.restore();
    }
    ink.strokeStyle=color;
    ink.lineWidth=1.25;
    for(const deg of this.banks){
      const angle=deg/degrees;
      const outer=r*.91,inner=outer-r*(deg%30===0?.11:.065);
      ink.beginPath();
      ink.moveTo(Math.sin(angle)*outer,-Math.cos(angle)*outer);
      ink.lineTo(Math.sin(angle)*inner,-Math.cos(angle)*inner);
      ink.stroke();
    }
    ink.save();ink.rotate(bank);
    ink.fillStyle=hud?color:'#ffda68';
    ink.beginPath();ink.moveTo(0,-r*.77);
    ink.lineTo(-4,-r*.69);ink.lineTo(4,-r*.69);ink.fill();
    const slip=attitudeLimit(-(f.lateralAcceleration||0)/3,1)*r*.19;
    ink.fillRect(slip-4,-r*.65,8,2.5);
    ink.restore();

    if(!f.ground&&Math.hypot(f.vx,f.vz)>12){
      const sin=Math.sin(heading),cos=Math.cos(heading);
      const along=f.vx*sin-f.vz*cos;
      const right=f.vx*cos+f.vz*sin;
      const forward=along*Math.cos(pitch)+f.vy*Math.sin(pitch);
      const up=f.vy*Math.cos(pitch)-along*Math.sin(pitch);
      if(forward>0){
        const x=attitudeLimit(Math.atan2(right*Math.cos(bank)-up*Math.sin(bank),forward)*degrees*scale,r*.62);
        const y=attitudeLimit(-Math.atan2(up*Math.cos(bank)+right*Math.sin(bank),forward)*degrees*scale,r*.62);
        const mark=Math.max(3,r*.061);
        ink.strokeStyle='#7effa0';
        ink.beginPath();ink.arc(x,y,mark,0,Math.PI*2);
        ink.moveTo(x-2*mark,y);ink.lineTo(x-mark,y);
        ink.moveTo(x+mark,y);ink.lineTo(x+2*mark,y);
        ink.moveTo(x,y-mark);ink.lineTo(x,y-2*mark);ink.stroke();
      }
    }

    if(f.hold&&!f.ground&&Number.isFinite(f.commandPitch)&&Number.isFinite(f.commandBank)){
      const y=attitudeLimit((pitch-f.commandPitch)*degrees*scale,r*.46);
      ink.save();ink.translate(0,y);ink.rotate(f.commandBank-bank);
      ink.strokeStyle='#ff92e8';ink.lineWidth=2;
      ink.beginPath();ink.moveTo(-r*.34,r*.10);ink.lineTo(0,0);ink.lineTo(r*.34,r*.10);ink.stroke();
      ink.restore();
    }
    ink.beginPath();
    ink.moveTo(-r*.42,0);ink.lineTo(-r*.15,0);ink.lineTo(-r*.15,r*.065);
    ink.moveTo(r*.42,0);ink.lineTo(r*.15,0);ink.lineTo(r*.15,r*.065);
    ink.strokeStyle='#112335';ink.lineWidth=4;ink.stroke();
    ink.strokeStyle=hud?color:'#ffda68';ink.lineWidth=2;ink.stroke();
    ink.fillStyle=ink.strokeStyle;ink.fillRect(-2,-2,4,4);
    if(f.stall&&!f.ground&&!f.ended){
      ink.fillStyle='#8e2333';
      ink.fillRect(-r*.40,r*.48,r*.80,r*.23);
      ink.font=this.font;ink.textAlign='center';ink.textBaseline='middle';
      ink.fillStyle='#fff';ink.fillText('失速',0,r*.60);
    }
    ink.restore();
    if(!hud){
      ink.strokeStyle='#829fb2';ink.lineWidth=1.5;
      ink.beginPath();ink.arc(half,half,r,0,Math.PI*2);ink.stroke();
    }
  }
}
