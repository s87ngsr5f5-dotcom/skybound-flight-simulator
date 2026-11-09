'use strict';
function makeFlightAudio(){
  let context, fan, core, roar, air, roarFilter, windFilter;
  function layer(source,filter){
    const gain=context.createGain();
    gain.gain.value=0;
    if(filter) source.connect(filter).connect(gain);
    else source.connect(gain);
    gain.connect(context.destination);
    source.start();
    return gain.gain;
  }
  function tone(type){
    const node=context.createOscillator();
    node.type=type;
    return {frequency:node.frequency,gain:layer(node)};
  }
  function start(){
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio) return false;
      try{context=new Audio();}catch{return false;}
      fan=tone('triangle');
      core=tone('sine');
      const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
      const sample=buffer.getChannelData(0);
      for(let i=0;i<sample.length;i++) sample[i]=Math.random()*2-1;
      function noise(filter,offset){
        const source=context.createBufferSource();
        source.buffer=buffer;source.loop=true;
        source.loopStart=offset;
        return layer(source,filter);
      }
      roarFilter=context.createBiquadFilter();
      roarFilter.type='lowpass';
      roarFilter.Q.value=.7;
      roar=noise(roarFilter,0);
      windFilter=context.createBiquadFilter();
      windFilter.type='bandpass';
      windFilter.Q.value=.6;
      air=noise(windFilter,.37);
    }
    if(context.state!=='running') context.resume().catch(()=>{});
    return true;
  }
  function update(f,cockpit,enabled){
    if(!context) return;
    const engines=f?.engines??[];
    const running=engines.length?engines.filter(Boolean).length/engines.length:0;
    const power=f?.power||0;
    const t=context.currentTime;
    const jet=f?.aircraft?.jet, widebody=f?.aircraft?.id==='b773';
    const afterburner=f?.boost&&power>.89;
    const strength=enabled&&f?.fuel!==0?Math.sqrt(running)*(cockpit?.60:1):0;
    const fanHz=widebody?82+160*power:jet?112+220*power:58+80*power;
    fan.frequency.setTargetAtTime(fanHz,t,.30);
    core.frequency.setTargetAtTime(fanHz*(widebody?2.17:2.7),t,.38);
    fan.gain.setTargetAtTime(strength*(.065+.085*power),t,.25);
    core.gain.setTargetAtTime(strength*(cockpit?.47:1)*(.018+.042*power),t,.30);
    roarFilter.frequency.setTargetAtTime((cockpit?300:490)+power*(afterburner?1600:970),t,.30);
    roar.setTargetAtTime(strength*(.10+power*(afterburner?.57:.39)),t,.29);
    windFilter.frequency.setTargetAtTime(cockpit?420:760,t,.20);
    air.setTargetAtTime(enabled&&f?(cockpit?.55:1)*Math.min(.08,f.speed*.00053):0,t,.20);
  }
  function effect(frequency,volume){
    if(!context) return;
    const source=context.createOscillator(), gain=context.createGain();
    const now=context.currentTime;
    source.type='triangle';
    source.frequency.setValueAtTime(frequency,now);
    source.frequency.exponentialRampToValueAtTime(frequency*.53,now+.27);
    gain.gain.setValueAtTime(volume,now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.33);
    source.connect(gain).connect(context.destination);
    source.start(now);source.stop(now+.34);
  }
  return {start,update,effect};
}

