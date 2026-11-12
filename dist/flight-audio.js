'use strict';
function makeFlightAudio(){
  let context, master, noiseBuffer, fan, core, roar, air, stall, roarFilter, windFilter,rotorPulse,rotorDepth;
  let level=.85, speaking=false;
  function layer(source,filter){
    const gain=context.createGain();
    gain.gain.value=0;
    if(filter) source.connect(filter).connect(gain);
    else source.connect(gain);
    gain.connect(master);
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
      master=context.createGain();
      master.gain.value=level;
      master.connect(context.destination);
      fan=tone('triangle');
      rotorPulse=context.createOscillator();rotorPulse.frequency.value=25;
      rotorDepth=context.createGain();rotorDepth.gain.value=0;
      rotorPulse.connect(rotorDepth).connect(fan.gain);rotorPulse.start();
      core=tone('sine');
      stall=tone('triangle');
      stall.frequency.value=830;
      const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
      noiseBuffer=buffer;
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
    if(!enabled) stopSpeech();
    if(!context) return;
    const engines=f?.engines??[];
    const running=engines.length?engines.filter(Boolean).length/engines.length:0;
    const power=f?.power||0;
    const t=context.currentTime;
    const helicopter=f?.aircraft?.helicopter;
    const jet=f?.aircraft?.jet, widebody=f?.aircraft?.id==='b773';
    const afterburner=f?.boost&&power>.89;
    const strength=enabled&&f?.fuel!==0?Math.sqrt(running)*(cockpit?.60:1):0;
    const fanHz=helicopter?25+65*(f.rotorRPM??0):widebody?82+160*power:jet?112+220*power:58+80*power;
    fan.frequency.setTargetAtTime(fanHz,t,.30);
    core.frequency.setTargetAtTime(fanHz*(widebody?2.17:2.7),t,.38);
    fan.gain.setTargetAtTime(strength*(helicopter?.17:.065+.085*power),t,.25);
    rotorPulse.frequency.setTargetAtTime(Math.max(1,25*(f?.rotorRPM??1)),t,.2);
    rotorDepth.gain.setTargetAtTime(helicopter?strength*.06:0,t,.2);
    core.gain.setTargetAtTime(strength*(cockpit?.47:1)*(.018+.042*power),t,.30);
    roarFilter.frequency.setTargetAtTime((cockpit?300:490)+power*(afterburner?1600:970),t,.30);
    roar.setTargetAtTime(strength*(.10+power*(afterburner?.57:.39)),t,.29);
    windFilter.frequency.setTargetAtTime(cockpit?420:760,t,.20);
    air.setTargetAtTime(enabled&&f?(cockpit?.55:1)*Math.min(.08,f.speed*.00053):0,t,.20);
    const warning=enabled&&f?.stall&&!f.ground&&!f.ended;
    stall.gain.setTargetAtTime(warning&&Math.floor(t*6)%2===0?.095:0,t,.025);
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
    source.connect(gain).connect(master);
    source.start(now);source.stop(now+.34);
  }
  function radarTone(phase){
    if(context?.state!=='running') return;
    const beep=(frequency,delay)=>{
      const source=context.createOscillator(),gain=context.createGain();
      const at=context.currentTime+delay;
      source.type='sine';
      source.frequency.value=frequency;
      gain.gain.setValueAtTime(.0001,at);
      gain.gain.exponentialRampToValueAtTime(.10,at+.009);
      gain.gain.exponentialRampToValueAtTime(.0001,at+.105);
      source.connect(gain).connect(master);
      source.start(at);source.stop(at+.11);
    };
    if(phase==='lock'){
      beep(1200,0);beep(1480,.14);
    }else beep(phase==='acquire'?940:660,0);
  }
  function volume(value){
    level=value;
    if(master) master.gain.setTargetAtTime(value,context.currentTime,.03);
    if(!value) stopSpeech();
  }
  function gateChime(){
    effect(680,.095);
    effect(1019,.075);
  }
  function touchdown(sink){
    if(context?.state!=='running') return;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    const time=context.currentTime;
    source.buffer=noiseBuffer;
    filter.type='bandpass';
    filter.frequency.setValueAtTime(730,time);
    filter.frequency.exponentialRampToValueAtTime(220,time+.26);
    gain.gain.setValueAtTime(Math.min(.24,.095+Math.abs(sink)*.027),time);
    gain.gain.exponentialRampToValueAtTime(.001,time+.30);
    source.connect(filter).connect(gain).connect(master);
    source.start(time);source.stop(time+.31);
  }
  function crashExplosion(){
    if(!context||context.state!=='running') return;
    const now=context.currentTime;
    const sub=context.createOscillator(),subGain=context.createGain();
    sub.type='sine';
    sub.frequency.setValueAtTime(160,now);
    sub.frequency.exponentialRampToValueAtTime(25,now+.65);
    subGain.gain.setValueAtTime(Math.min(1,.85*level),now);
    subGain.gain.exponentialRampToValueAtTime(.0001,now+1.2);
    sub.connect(subGain).connect(master);
    sub.start(now);sub.stop(now+1.25);
    if(noiseBuffer){
      const blast=context.createBufferSource(),bFilter=context.createBiquadFilter(),bGain=context.createGain();
      blast.buffer=noiseBuffer;
      bFilter.type='lowpass';
      bFilter.frequency.setValueAtTime(1400,now);
      bFilter.frequency.exponentialRampToValueAtTime(80,now+1.8);
      bGain.gain.setValueAtTime(Math.min(1,.95*level),now);
      bGain.gain.exponentialRampToValueAtTime(.0001,now+2.1);
      blast.connect(bFilter).connect(bGain).connect(master);
      blast.start(now);blast.stop(now+2.2);
    }
  }
  function callout(message,urgent=false){
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance||!level) return;
    if(speaking&&!urgent) return;
    if(speaking) stopSpeech();
    const phrase=new SpeechSynthesisUtterance(message);
    phrase.lang='en-US';phrase.rate=1.12;phrase.volume=level;
    phrase.onend=phrase.onerror=()=>{speaking=false;};
    speaking=true;
    window.speechSynthesis.speak(phrase);
  }
  function stopSpeech(){
    if(speaking){speaking=false;window.speechSynthesis.cancel();}
  }
  return {start,update,effect,radarTone,volume,gateChime,touchdown,crashExplosion,callout,stopSpeech};
}

