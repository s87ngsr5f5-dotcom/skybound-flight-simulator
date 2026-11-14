'use strict';
function makeFlightAudio(){
  let context, master, noiseBuffer;
  let fan, fanHarmonic, core, whine, subBass, tailRotor, stall;
  let roar, abRoar, air;
  let roarFilter, abFilter, windFilter, buzzFilter;
  let rotorPulse, rotorDepth, syncLfo, syncDepth;
  let level=.85, speaking=false, wasAfterburner=false, currentProfileId='';

  const ACOUSTIC_PROFILES={
    // 1. Lycoming IO-360 4-Cylinder Boxer Piston Prop (Cessna 172S)
    c172s:{
      kind:'piston',
      baseHz:36, rangeHz:78,
      harmonicRatio:2.0, harmonicType:'sawtooth', harmonicGain:0.095,
      coreRatio:1.5, coreGain:0.032,
      whineHz:0, whineGain:0,
      subRatio:0.5, subGain:0.11,
      pulseRateBase:14, pulseRateRange:34, pulseDepth:0.055,
      roarBaseHz:220, roarRangeHz:520, roarGain:0.16,
      buzzCenterHz:190, buzzQ:2.2
    },
    // 2. Turboshaft Helicopters (H6, UH-60M Black Hawk, AH-64E Apache, AW101 Merlin)
    sh6:{
      kind:'heli', blades:4,
      baseHz:24, rangeHz:48,
      harmonicRatio:2.0, harmonicType:'triangle', harmonicGain:0.055,
      coreRatio:3.2, coreGain:0.028,
      whineHz:1680, whineGain:0.022,
      subRatio:0.5, subGain:0.075,
      pulseRateBase:22, pulseRateRange:8, pulseDepth:0.075,
      tailRatio:4.6, tailGain:0.026,
      roarBaseHz:260, roarRangeHz:420, roarGain:0.18,
      buzzCenterHz:320, buzzQ:1.5
    },
    uh60:{
      kind:'heli', blades:4,
      baseHz:19, rangeHz:42,
      harmonicRatio:2.0, harmonicType:'sawtooth', harmonicGain:0.072,
      coreRatio:3.5, coreGain:0.034,
      whineHz:1480, whineGain:0.028,
      subRatio:0.5, subGain:0.115,
      pulseRateBase:17.2, pulseRateRange:5.5, pulseDepth:0.095,
      tailRatio:4.8, tailGain:0.034,
      roarBaseHz:210, roarRangeHz:390, roarGain:0.22,
      buzzCenterHz:280, buzzQ:1.8
    },
    ah64:{
      kind:'heli', blades:4,
      baseHz:20, rangeHz:44,
      harmonicRatio:2.0, harmonicType:'sawtooth', harmonicGain:0.078,
      coreRatio:3.8, coreGain:0.036,
      whineHz:1620, whineGain:0.032,
      subRatio:0.5, subGain:0.11,
      pulseRateBase:18.5, pulseRateRange:6.0, pulseDepth:0.092,
      tailRatio:5.1, tailGain:0.038,
      roarBaseHz:230, roarRangeHz:430, roarGain:0.23,
      buzzCenterHz:310, buzzQ:1.9
    },
    aw101:{
      kind:'heli', blades:5,
      baseHz:16, rangeHz:36,
      harmonicRatio:2.0, harmonicType:'triangle', harmonicGain:0.068,
      coreRatio:3.1, coreGain:0.035,
      whineHz:1320, whineGain:0.026,
      subRatio:0.5, subGain:0.135,
      pulseRateBase:15.2, pulseRateRange:4.8, pulseDepth:0.088,
      tailRatio:4.4, tailGain:0.028,
      roarBaseHz:185, roarRangeHz:350, roarGain:0.25,
      buzzCenterHz:250, buzzQ:1.6
    },
    // 3. Airbus A220-300 (PW1500G Geared Turbofan with signature "whale song" spool resonance)
    a223:{
      kind:'gtf',
      baseHz:96, rangeHz:195,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.065,
      coreRatio:2.45, coreGain:0.038,
      whineHz:340, whineGain:0.065,
      subRatio:0.5, subGain:0.065,
      roarBaseHz:380, roarRangeHz:820, roarGain:0.32,
      buzzCenterHz:420, buzzQ:3.2
    },
    // 4. Narrowbody CFM LEAP Turbofans (A320neo / 737 MAX 8)
    a320neo:{
      kind:'narrowbody',
      baseHz:104, rangeHz:210,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.072,
      coreRatio:2.62, coreGain:0.040,
      whineHz:1180, whineGain:0.018,
      subRatio:0.5, subGain:0.075,
      roarBaseHz:410, roarRangeHz:890, roarGain:0.35,
      buzzCenterHz:460, buzzQ:3.5
    },
    b38m:{
      kind:'narrowbody',
      baseHz:100, rangeHz:204,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.076,
      coreRatio:2.55, coreGain:0.042,
      whineHz:1120, whineGain:0.019,
      subRatio:0.5, subGain:0.080,
      roarBaseHz:395, roarRangeHz:870, roarGain:0.36,
      buzzCenterHz:445, buzzQ:3.6
    },
    // 5. Heavy Twin Widebody (777-300ER GE90-115B / 767-300ER CF6)
    b773:{
      kind:'widebody',
      baseHz:68, rangeHz:148,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.092,
      coreRatio:2.12, coreGain:0.045,
      whineHz:890, whineGain:0.016,
      subRatio:0.5, subGain:0.145,
      roarBaseHz:290, roarRangeHz:780, roarGain:0.44,
      buzzCenterHz:330, buzzQ:4.0
    },
    b763er:{
      kind:'widebody',
      baseHz:78, rangeHz:164,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.082,
      coreRatio:2.28, coreGain:0.042,
      whineHz:980, whineGain:0.020,
      subRatio:0.5, subGain:0.115,
      roarBaseHz:330, roarRangeHz:820, roarGain:0.39,
      buzzCenterHz:375, buzzQ:3.6
    },
    b763f:{
      kind:'widebody',
      baseHz:78, rangeHz:164,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.084,
      coreRatio:2.28, coreGain:0.042,
      whineHz:980, whineGain:0.020,
      subRatio:0.5, subGain:0.118,
      roarBaseHz:330, roarRangeHz:820, roarGain:0.40,
      buzzCenterHz:375, buzzQ:3.6
    },
    // 6. Quad-Engine Heavy Transports (747-8F GEnx / 747-400 / A380 / An-124)
    sf748:{
      kind:'quad',
      baseHz:72, rangeHz:154,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.088,
      coreRatio:2.18, coreGain:0.046,
      whineHz:920, whineGain:0.018,
      subRatio:0.5, subGain:0.150,
      roarBaseHz:280, roarRangeHz:760, roarGain:0.46,
      buzzCenterHz:345, buzzQ:3.8
    },
    b744:{
      kind:'quad',
      baseHz:75, rangeHz:160,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.090,
      coreRatio:2.24, coreGain:0.048,
      whineHz:960, whineGain:0.021,
      subRatio:0.5, subGain:0.145,
      roarBaseHz:295, roarRangeHz:790, roarGain:0.46,
      buzzCenterHz:360, buzzQ:3.8
    },
    sa380:{
      kind:'quad',
      baseHz:64, rangeHz:138,
      harmonicRatio:1.5, harmonicType:'triangle', harmonicGain:0.075,
      coreRatio:2.05, coreGain:0.040,
      whineHz:840, whineGain:0.015,
      subRatio:0.5, subGain:0.155,
      roarBaseHz:265, roarRangeHz:710, roarGain:0.44,
      buzzCenterHz:315, buzzQ:3.2
    },
    an124:{
      kind:'quad',
      baseHz:70, rangeHz:152,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.098,
      coreRatio:2.32, coreGain:0.052,
      whineHz:1060, whineGain:0.028,
      subRatio:0.5, subGain:0.160,
      roarBaseHz:275, roarRangeHz:810, roarGain:0.48,
      buzzCenterHz:340, buzzQ:4.1
    },
    // 7. Supersonic Fighters (F-16V / SF-16, Mirage 2000-5, F-CK-1 IDF, F-5E, SF-15)
    f16v:{
      kind:'fighter',
      baseHz:132, rangeHz:285,
      harmonicRatio:1.8, harmonicType:'sawtooth', harmonicGain:0.088,
      coreRatio:2.85, coreGain:0.058,
      whineHz:1420, whineGain:0.036,
      subRatio:0.5, subGain:0.125,
      roarBaseHz:520, roarRangeHz:1380, roarGain:0.48,
      buzzCenterHz:680, buzzQ:2.8
    },
    sf16:{
      kind:'fighter',
      baseHz:130, rangeHz:280,
      harmonicRatio:1.8, harmonicType:'sawtooth', harmonicGain:0.085,
      coreRatio:2.82, coreGain:0.056,
      whineHz:1390, whineGain:0.034,
      subRatio:0.5, subGain:0.120,
      roarBaseHz:510, roarRangeHz:1350, roarGain:0.46,
      buzzCenterHz:660, buzzQ:2.8
    },
    m2000:{
      kind:'fighter',
      baseHz:148, rangeHz:320,
      harmonicRatio:2.1, harmonicType:'sawtooth', harmonicGain:0.092,
      coreRatio:3.15, coreGain:0.064,
      whineHz:1760, whineGain:0.044,
      subRatio:0.5, subGain:0.115,
      roarBaseHz:590, roarRangeHz:1520, roarGain:0.47,
      buzzCenterHz:790, buzzQ:3.4
    },
    fck1:{
      kind:'fighter',
      baseHz:142, rangeHz:305,
      harmonicRatio:1.95, harmonicType:'sawtooth', harmonicGain:0.086,
      coreRatio:3.0, coreGain:0.060,
      whineHz:1640, whineGain:0.040,
      subRatio:0.5, subGain:0.112,
      roarBaseHz:560, roarRangeHz:1440, roarGain:0.45,
      buzzCenterHz:740, buzzQ:3.1
    },
    f5e:{
      kind:'fighter',
      baseHz:156, rangeHz:340,
      harmonicRatio:2.2, harmonicType:'sawtooth', harmonicGain:0.090,
      coreRatio:3.25, coreGain:0.062,
      whineHz:1890, whineGain:0.045,
      subRatio:0.5, subGain:0.105,
      roarBaseHz:610, roarRangeHz:1560, roarGain:0.44,
      buzzCenterHz:820, buzzQ:3.5
    },
    sf15:{
      kind:'fighter',
      baseHz:118, rangeHz:260,
      harmonicRatio:1.75, harmonicType:'sawtooth', harmonicGain:0.096,
      coreRatio:2.68, coreGain:0.058,
      whineHz:1280, whineGain:0.032,
      subRatio:0.5, subGain:0.150,
      roarBaseHz:460, roarRangeHz:1320, roarGain:0.52,
      buzzCenterHz:610, buzzQ:2.9
    }
  };

  function getProfile(f){
    const id=f?.aircraft?.id||'c172s';
    if(ACOUSTIC_PROFILES[id]) return ACOUSTIC_PROFILES[id];
    if(f?.aircraft?.helicopter) return ACOUSTIC_PROFILES.uh60;
    if(f?.aircraft?.role==='fighter') return ACOUSTIC_PROFILES.f16v;
    if(f?.aircraft?.role==='cargo') return ACOUSTIC_PROFILES.sf748;
    if(f?.aircraft?.jet) return ACOUSTIC_PROFILES.a320neo;
    return ACOUSTIC_PROFILES.c172s;
  }

  function layer(source,filter){
    const gain=context.createGain();
    gain.gain.value=0;
    if(filter) source.connect(filter).connect(gain);
    else source.connect(gain);
    gain.connect(master);
    source.start();
    return gain.gain;
  }
  function tone(type,filter){
    const node=context.createOscillator();
    node.type=type;
    return {node,frequency:node.frequency,gain:layer(node,filter)};
  }
  function triggerAfterburnerIgnition(){
    if(!context||context.state!=='running') return;
    const now=context.currentTime;
    const thump=context.createOscillator(),tGain=context.createGain();
    thump.type='sine';
    thump.frequency.setValueAtTime(125,now);
    thump.frequency.exponentialRampToValueAtTime(34,now+0.28);
    tGain.gain.setValueAtTime(Math.min(0.65,0.48*level),now);
    tGain.gain.exponentialRampToValueAtTime(0.0001,now+0.32);
    thump.connect(tGain).connect(master);
    thump.start(now);thump.stop(now+0.34);
    if(noiseBuffer){
      const whoosh=context.createBufferSource(),wFilter=context.createBiquadFilter(),wGain=context.createGain();
      whoosh.buffer=noiseBuffer;
      wFilter.type='bandpass';
      wFilter.frequency.setValueAtTime(920,now);
      wFilter.frequency.exponentialRampToValueAtTime(360,now+0.35);
      wFilter.Q.value=1.1;
      wGain.gain.setValueAtTime(Math.min(0.55,0.38*level),now);
      wGain.gain.exponentialRampToValueAtTime(0.0001,now+0.38);
      whoosh.connect(wFilter).connect(wGain).connect(master);
      whoosh.start(now);whoosh.stop(now+0.40);
    }
  }
  function start(){
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio) return false;
      try{context=new Audio();}catch{return false;}
      master=context.createGain();
      master.gain.value=level;
      master.connect(context.destination);

      buzzFilter=context.createBiquadFilter();
      buzzFilter.type='bandpass';
      buzzFilter.frequency.value=420;
      buzzFilter.Q.value=3.0;

      fan=tone('triangle');
      fanHarmonic=tone('sawtooth',buzzFilter);
      core=tone('sine');
      whine=tone('sine');
      subBass=tone('sine');
      tailRotor=tone('sawtooth');

      rotorPulse=context.createOscillator();
      rotorPulse.frequency.value=22;
      rotorDepth=context.createGain();
      rotorDepth.gain.value=0;
      rotorPulse.connect(rotorDepth).connect(fan.gain);
      rotorPulse.start();

      syncLfo=context.createOscillator();
      syncLfo.frequency.value=1.8;
      syncDepth=context.createGain();
      syncDepth.gain.value=0;
      syncLfo.connect(syncDepth).connect(fanHarmonic.gain);
      syncLfo.start();

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
      roarFilter.Q.value=.75;
      roar=noise(roarFilter,0);

      abFilter=context.createBiquadFilter();
      abFilter.type='bandpass';
      abFilter.frequency.value=640;
      abFilter.Q.value=.85;
      abRoar=noise(abFilter,.19);

      windFilter=context.createBiquadFilter();
      windFilter.type='bandpass';
      windFilter.Q.value=.65;
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
    const prof=getProfile(f);
    const acId=f?.aircraft?.id||'c172s';
    if(acId!==currentProfileId){
      currentProfileId=acId;
      try{fanHarmonic.node.type=prof.harmonicType||'sawtooth';}catch{}
    }
    const helicopter=prof.kind==='heli'||Boolean(f?.aircraft?.helicopter);
    const piston=prof.kind==='piston';
    const fighter=prof.kind==='fighter';
    const gtf=prof.kind==='gtf';
    const quad=prof.kind==='quad';
    const afterburner=Boolean((f?.boost||fighter)&&power>.88&&running>0);
    if(afterburner&&!wasAfterburner&&enabled){
      triggerAfterburnerIgnition();
    }
    wasAfterburner=afterburner;

    const cockpitAtten=cockpit?0.58:1.0;
    const strength=enabled&&f?.fuel!==0?Math.sqrt(running)*cockpitAtten:0;
    const rpmFactor=helicopter?Math.max(0.05,f?.rotorRPM??1):power;

    // 1. Primary Fan / Prop Blade-Pass Frequency
    const fanHz=prof.baseHz+prof.rangeHz*rpmFactor;
    fan.frequency.setTargetAtTime(fanHz,t,.22);
    fan.gain.setTargetAtTime(strength*(helicopter?.18:piston?.11+.09*power:.068+.088*power),t,.20);

    // 2. Harmonic Layer (Turbofan Buzz-Saw / Piston Exhaust Bark / Rotor Slap Harmonic)
    const buzzSpool=piston?(.35+.65*power):helicopter?(.3+.7*rpmFactor):Math.max(0,(power-.52)/.48);
    buzzFilter.frequency.setTargetAtTime(prof.buzzCenterHz*(0.75+0.65*power),t,.22);
    buzzFilter.Q.setTargetAtTime(prof.buzzQ||2.8,t,.25);
    fanHarmonic.frequency.setTargetAtTime(fanHz*(prof.harmonicRatio||1.5),t,.22);
    fanHarmonic.gain.setTargetAtTime(strength*(prof.harmonicGain||.07)*buzzSpool,t,.22);

    // 3. Core Compressor & Characteristic Whine (A220 Whale Song / Fighter Intake Scream / Turboshaft Whine)
    core.frequency.setTargetAtTime(fanHz*(prof.coreRatio||2.5),t,.28);
    core.gain.setTargetAtTime(strength*(cockpit?.48:1)*((prof.coreGain||.035)*(.28+.72*power)),t,.25);

    if(gtf){
      // Famous A220 PW1500G hollow whale-song howl peaking between 25% and 68% throttle
      const whaleBell=Math.exp(-Math.pow((power-0.47)/0.16,2));
      whine.frequency.setTargetAtTime(275+165*power,t,.18);
      whine.gain.setTargetAtTime(strength*0.078*whaleBell,t,.18);
    }else if(prof.whineGain>0){
      const wHz=prof.whineHz*(0.68+0.55*rpmFactor);
      whine.frequency.setTargetAtTime(wHz,t,.24);
      whine.gain.setTargetAtTime(strength*(cockpit?.45:1)*prof.whineGain*(0.25+0.75*rpmFactor),t,.24);
    }else{
      whine.gain.setTargetAtTime(0,t,.20);
    }

    // 4. Sub-Bass Chest Rumble (Heavy Widebody GE90/GEnx, Afterburner Sub-Thrum, Piston Firing Thump)
    const subHz=Math.max(24,fanHz*(prof.subRatio||0.5));
    subBass.frequency.setTargetAtTime(subHz,t,.25);
    const abSubBoost=afterburner?1.65:1.0;
    subBass.gain.setTargetAtTime(strength*(prof.subGain||.08)*(0.22+0.78*power)*abSubBoost,t,.24);

    // 5. Rotor Blade-Slap (Helicopter BVI load) / Piston Cylinder Pulse / Quad Engine Synchrophasing
    if(helicopter){
      const bankLoad=1+Math.min(1.2,Math.abs(f?.bank||0)*1.4+Math.abs(f?.pitch||0)*0.9);
      const pulseHz=Math.max(2,(prof.pulseRateBase||18)+(prof.pulseRateRange||6)*(f?.rotorRPM??1));
      rotorPulse.frequency.setTargetAtTime(pulseHz,t,.15);
      rotorDepth.gain.setTargetAtTime(strength*(prof.pulseDepth||.08)*bankLoad,t,.15);
      tailRotor.frequency.setTargetAtTime(fanHz*(prof.tailRatio||4.7),t,.18);
      tailRotor.gain.setTargetAtTime(strength*(prof.tailGain||.03)*(0.4+0.6*Math.abs(f?.yawRate||0)*3+0.5*rpmFactor),t,.18);
    }else if(piston){
      const cylHz=Math.max(8,(prof.pulseRateBase||14)+(prof.pulseRateRange||34)*power);
      rotorPulse.frequency.setTargetAtTime(cylHz,t,.15);
      rotorDepth.gain.setTargetAtTime(strength*(prof.pulseDepth||.055),t,.15);
      tailRotor.gain.setTargetAtTime(0,t,.15);
    }else{
      rotorDepth.gain.setTargetAtTime(0,t,.20);
      tailRotor.gain.setTargetAtTime(0,t,.20);
    }
    syncLfo.frequency.setTargetAtTime(quad?1.75:fighter&&f?.aircraft?.geometry?.[4]===2?2.4:1.1,t,.3);
    syncDepth.gain.setTargetAtTime(strength*(quad?.022:0),t,.25);

    // 6. Combustion & Jet Exhaust Roar + Afterburner / Reverse Thrust Tear
    const reverseActive=Boolean(f?.ground&&f?.aircraft?.reverse&&f?.manualControls?.brake&&(f?.speed||0)>18);
    const roarCutoff=(cockpit?prof.roarBaseHz*.68:prof.roarBaseHz)+power*(afterburner?prof.roarRangeHz*1.55:prof.roarRangeHz);
    roarFilter.frequency.setTargetAtTime(roarCutoff,t,.25);
    roar.setTargetAtTime(strength*((prof.roarGain||.35)*(.16+.84*power)*(afterburner?1.38:1)),t,.24);

    if(afterburner||reverseActive){
      const abIntensity=afterburner?Math.min(1,(power-.86)/.14):0.55;
      abFilter.frequency.setTargetAtTime(afterburner?580+420*abIntensity:390,t,.16);
      abRoar.setTargetAtTime(strength*(afterburner?0.42*abIntensity:0.26),t,.16);
    }else{
      abRoar.setTargetAtTime(0,t,.20);
    }

    // 7. Dynamic Airframe Boundary-Layer Wind & High-G Buffet
    const gLoad=Math.max(0,Math.abs(f?.gForce||1)-1.35);
    const speedRatio=Math.min(1.4,(f?.speed||0)/180);
    windFilter.frequency.setTargetAtTime((cockpit?390:720)+speedRatio*340+gLoad*140,t,.18);
    air.setTargetAtTime(enabled&&f?(cockpit?.52:1)*Math.min(.11,(f.speed||0)*.00055+gLoad*.018):0,t,.18);

    // 8. Stall Warning Horn
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
    sub.frequency.setValueAtTime(195,now);
    sub.frequency.exponentialRampToValueAtTime(22,now+.95);
    subGain.gain.setValueAtTime(Math.min(1,.95*level),now);
    subGain.gain.exponentialRampToValueAtTime(.0001,now+1.65);
    sub.connect(subGain).connect(master);
    sub.start(now);sub.stop(now+1.7);
    const crunch=context.createOscillator(),cGain=context.createGain();
    crunch.type='sawtooth';
    crunch.frequency.setValueAtTime(92,now);
    crunch.frequency.exponentialRampToValueAtTime(28,now+.45);
    cGain.gain.setValueAtTime(Math.min(1,.55*level),now);
    cGain.gain.exponentialRampToValueAtTime(.0001,now+.48);
    crunch.connect(cGain).connect(master);
    crunch.start(now);crunch.stop(now+.5);
    if(noiseBuffer){
      const snap=context.createBufferSource(),sFilter=context.createBiquadFilter(),sGain=context.createGain();
      snap.buffer=noiseBuffer;
      sFilter.type='bandpass';
      sFilter.frequency.setValueAtTime(1850,now);
      sFilter.Q.value=0.9;
      sGain.gain.setValueAtTime(Math.min(1,.85*level),now);
      sGain.gain.exponentialRampToValueAtTime(.0001,now+.35);
      snap.connect(sFilter).connect(sGain).connect(master);
      snap.start(now);snap.stop(now+.38);
      const blast=context.createBufferSource(),bFilter=context.createBiquadFilter(),bGain=context.createGain();
      blast.buffer=noiseBuffer;
      bFilter.type='lowpass';
      bFilter.frequency.setValueAtTime(2100,now);
      bFilter.frequency.exponentialRampToValueAtTime(68,now+2.8);
      bGain.gain.setValueAtTime(Math.min(1,1.0*level),now);
      bGain.gain.exponentialRampToValueAtTime(.0001,now+3.1);
      blast.connect(bFilter).connect(bGain).connect(master);
      blast.start(now);blast.stop(now+3.2);
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
  return {start,update,effect,radarTone,volume,gateChime,touchdown,crashExplosion,callout,stopSpeech,getProfile};
}
