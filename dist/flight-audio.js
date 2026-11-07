'use strict';
function makeFlightAudio(){
  let context, engine, engineGain, filter, airGain, air;
  function start(){
    if(!context){
      context=new AudioContext();
      engine=context.createOscillator();
      engine.type='sawtooth';
      engineGain=context.createGain();
      engineGain.gain.value=0;
      filter=context.createBiquadFilter();
      filter.type='lowpass';
      engine.connect(filter).connect(engineGain).connect(context.destination);
      engine.start();
      const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
      const sample=buffer.getChannelData(0);
      for(let i=0;i<sample.length;i++) sample[i]=Math.random()*2-1;
      air=context.createBufferSource();air.buffer=buffer;air.loop=true;
      const windFilter=context.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=720;
      airGain=context.createGain();airGain.gain.value=0;
      air.connect(windFilter).connect(airGain).connect(context.destination);air.start();
    }
    context.resume().catch(()=>{});
  }
  function update(f,cockpit,enabled){
    if(!context) return;
    const powered=f?.engines?.filter(Boolean).length||0;
    const power=f?.power||0;
    const t=context.currentTime, fighter=f?.aircraft?.role==='fighter';
    const scale=cockpit?.57:1;
    engine.frequency.setTargetAtTime((fighter?58:33)+power*(fighter?103:67),t,.11);
    filter.frequency.setTargetAtTime((cockpit?190:430)+power*(f?.boost?950:430),t,.13);
    engineGain.gain.setTargetAtTime(enabled&&powered?scale*(.018+.038*power):0,t,.15);
    airGain.gain.setTargetAtTime(enabled&&f?scale*Math.min(.073,f.speed*.00062):0,t,.20);
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

