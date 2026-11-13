'use strict';
function createAtmosphericSky(scene){
  const size=128, pixels=new Uint8Array(size*size*4);
  let seed=6194;
  for(let i=0;i<pixels.length;i+=4){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    pixels[i]=seed>>>24;
    pixels[i+3]=255;
  }
  const noise=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  noise.wrapS=noise.wrapT=THREE.RepeatWrapping;
  noise.minFilter=noise.magFilter=THREE.LinearFilter;
  noise.needsUpdate=true;
  const uniforms={
    noiseMap:{value:noise},eye:{value:new THREE.Vector3()},sun:{value:new THREE.Vector3(0,1,0)},moon:{value:new THREE.Vector3()},
    daylight:{value:1},twilight:{value:0},coverage:{value:.55},mist:{value:0},
    seconds:{value:0},steps:{value:8},raytrace:{value:1}
  };
  const sampleNoise=`
    float noise3(vec3 p){
      vec3 i=floor(p), f=fract(p);
      f=f*f*(3.-2.*f);
      vec2 cell=i.xy+vec2(17.,47.)*i.z+f.xy+.5;
      return mix(texture2D(noiseMap,cell/128.).r,
        texture2D(noiseMap,(cell+vec2(17.,47.))/128.).r,f.z);
    }
  `;
  const material=new THREE.ShaderMaterial({
    uniforms,side:THREE.BackSide,depthWrite:false,
    vertexShader:`
      varying vec3 ray;
      void main(){
        ray=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        gl_Position.z=gl_Position.w;
      }
    `,
    fragmentShader:`
      varying vec3 ray;
      uniform sampler2D noiseMap;
      uniform vec3 eye,sun,moon;
      uniform float daylight,twilight,coverage,mist,seconds,raytrace;
      uniform int steps;

      ${sampleNoise}
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float cloud(vec3 world){
        float h=(world.y-1450.)/1150.;
        vec3 p=vec3((world.x-seconds*11.)/2150.,(world.z-seconds*4.)/2150.,world.y/940.);
        float shape=noise3(p)*.69+noise3(p*2.15+4.3)*.23+noise3(p*4.4)*.08;
        float edges=smoothstep(0.,.21,h)*(1.-smoothstep(.66,1.,h));
        return smoothstep(coverage,coverage+.21,shape)*edges;
      }
      void main(){
        vec3 d=normalize(ray);
        float up=max(0.,d.y);
        float glare=max(0.,dot(sun,d));
        float mie=pow(glare,4.5)*.30+pow(glare,18.)*.48+pow(glare,90.)*1.15;
        vec3 horizon=mix(vec3(.028,.045,.088),vec3(.48,.78,.98),daylight);
        vec3 zenith=mix(vec3(.007,.018,.048),vec3(.07,.36,.88),daylight);
        vec3 sky=mix(horizon,zenith,pow(up,.72));
        sky+=vec3(.06,.18,.32)*daylight*exp(-up*3.5)*.35;
        sky+=vec3(.98,.44,.12)*twilight*pow(glare,3.5)*exp(-up*2.6);
        sky+=vec3(.55,.19,.33)*twilight*exp(-up*4.8);
        sky+=vec3(1.,.90,.66)*daylight*(pow(glare,12.)*.26+smoothstep(.99982,.99997,glare)*8.5)+vec3(.55,.76,1.)*mie*daylight*.75;
        float night=(1.-smoothstep(.02,.40,daylight))*(1.-mist*.9);
        if(night>.01&&d.y>0.){
          vec2 grid=vec2(atan(d.x,-d.z)*103.,asin(d.y)*135.);
          vec2 cell=floor(grid);
          float random=hash(cell);
          vec2 offset=vec2(hash(cell+1.),hash(cell+19.))*.64+.18;
          float star=(1.-smoothstep(.025,.12,length(fract(grid)-offset)))*smoothstep(.76,.99,random);
          sky+=vec3(.76,.84,1.)*star*night*smoothstep(.02,.21,up)*(1.1+random);
          float moonFacing=max(0.,dot(moon,d));
          float disc=smoothstep(.99992,.99995,moonFacing);
          float detail=noise3((d-moon)*340.+3.6);
          sky+=vec3(.91,.94,1.)*night*(disc*(1.10+.83*detail)+pow(moonFacing,700.)*.09);
        }
        float dy=abs(d.y)<.001?(d.y<0.?-.001:.001):d.y;
        float a=(1450.-eye.y)/dy,b=(2600.-eye.y)/dy;
        float start=max(0.,min(a,b)),end=min(46000.,max(a,b));
        if(end>start&&!(eye.y>2700.&&d.y<0.)){
          float stride=(end-start)/float(steps);
          float light=0.,opacity=0.;
          for(int i=0;i<18;i++){
            if(i>=steps||opacity>.98) break;
            vec3 p=eye+d*(start+(float(i)+.48)*stride);
            float density=cloud(p);
            if(density>.012){
              float lit=1.-cloud(p+sun*440.)*.76;
              float weight=(1.-opacity)*(1.-exp(-density*min(1800.,stride)*.004));
              light+=weight*lit;
              opacity+=weight;
            }
          }
          vec3 cloudColor=mix(vec3(.048,.066,.105),vec3(.42,.52,.64),daylight)*opacity;
          cloudColor+=vec3(.75,.72,.66)*light*daylight;
          cloudColor+=vec3(.72,.26,.08)*light*twilight;
          float silver=pow(glare,5.5)*light*(1.-opacity*.52);
          cloudColor+=vec3(1.18,1.06,.84)*silver*daylight*(.48+.38*raytrace);
          float distanceFade=exp(-start/28000.)*smoothstep(.028,.16,abs(d.y));
          sky=mix(sky,cloudColor+sky*(1.-opacity),distanceFade);
        }
        if(raytrace>.01&&glare>.18&&(daylight+twilight)>.04&&d.y>-.06){
          float shaftMask=pow(glare,3.0)*(.42+.58*smoothstep(-.06,.45,d.y));
          vec3 sunAxis=normalize(mix(d,sun,.32));
          float denom=abs(sunAxis.y)<.09?(sunAxis.y>=0.?.09:-.09):sunAxis.y;
          float baseDist=clamp(abs((1950.-eye.y)/denom),1800.,14000.);
          float shadowSum=0.;
          for(int r=0;r<5;r++){
            float frac=(float(r)+.5)/5.;
            vec3 sp=eye+sunAxis*mix(900.,baseDist,frac);
            sp.y=mix(1550.,2420.,frac);
            shadowSum+=cloud(sp);
          }
          float gap=clamp(1.-shadowSum*.32,0.,1.);
          vec3 tang=normalize(d-sun*dot(d,sun)+vec3(.0001,.0002,.0001));
          float streak=.55+.45*noise3(vec3(tang.x*4.4,tang.z*4.4,tang.y*2.4+seconds*.04));
          float godRays=shaftMask*gap*(.55+.45*pow(glare,8.))*streak*raytrace;
          sky+=vec3(1.15,.88,.48)*godRays*(daylight*.62+twilight*.78);
        }
        vec3 haze=mix(vec3(.08,.10,.14),vec3(.78,.86,.93),daylight);
        sky=mix(sky,haze,mist*exp(-up*2.8));
        gl_FragColor=vec4(sky,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const dome=new THREE.Mesh(new THREE.SphereGeometry(90000,32,20),material);
  // Render after opaque terrain so hidden sky pixels fail the depth test.
  dome.renderOrder=1000;
  dome.frustumCulled=false;
  scene.add(dome);
  // A separate layer can appear in front of the landscape when viewed from above.
  const cloudDeck=new THREE.Mesh(new THREE.PlaneGeometry(144000,144000),new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`
      varying vec3 world;
      void main(){
        vec4 p=modelMatrix*vec4(position,1.);
        world=p.xyz;
        gl_Position=projectionMatrix*viewMatrix*p;
      }
    `,
    fragmentShader:`
      varying vec3 world;
      uniform sampler2D noiseMap;
      uniform vec3 eye,sun;
      uniform float daylight,coverage,seconds,mist;
      ${sampleNoise}
      float field(vec2 p){
        return noise3(vec3(p,1.6))*.60+noise3(vec3(p*2.2,3.3))*.28+
          noise3(vec3(p*5.5,1.2))*.12;
      }
      void main(){
        vec2 p=(world.xz-seconds*vec2(11.,4.))/1650.;
        float shape=field(p);
        float deckCoverage=coverage>.50?coverage+.13:coverage;
        float alpha=smoothstep(deckCoverage-.04,deckCoverage+.12,shape);
        alpha*=1.-smoothstep(30000.,67000.,length(world.xz-eye.xz));
        if(alpha<.012) discard;
        float shading=clamp(.68+(shape-field(p+sun.xz*.16))*2.9,0.,1.);
        vec3 color=mix(vec3(.055,.085,.14),mix(vec3(.74,.83,.93),vec3(1.24,1.25,1.27),shading),daylight);
        color+=vec3(.82,.30,.12)*twilight*shading*.65;
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  cloudDeck.rotation.x=-Math.PI/2;
  cloudDeck.visible=false;
  cloudDeck.renderOrder=1001;
  scene.add(cloudDeck);
  let lastEnvKey='';
  function updateEnvironment(canvas,texture,direction,day,twilight,weather,raytrace=true){
    if(!canvas||!texture) return false;
    const w=canvas.width||512, h=canvas.height||256;
    const ink=canvas.getContext?.('2d');
    if(!ink) return false;
    const dir=direction?direction.clone().normalize():{x:0,y:1,z:0};
    const key=[
      Math.round(dir.x*25),Math.round(dir.y*25),Math.round(dir.z*25),
      Math.round((day||0)*20),Math.round((twilight||0)*20),weather||'',raytrace?1:0
    ].join('|');
    if(key===lastEnvKey) return false;
    lastEnvKey=key;
    const d=Math.max(0,Math.min(1,day??1));
    const tw=Math.max(0,Math.min(1,twilight??0));
    const storm=weather==='storm', fog=weather==='fog';
    const skyFade=ink.createLinearGradient(0,0,0,h);
    const topR=Math.round((storm?22:fog?110:24)+d*(storm?52:fog?68:76));
    const topG=Math.round((storm?32:fog?124:46)+d*(storm?68:fog?84:146));
    const topB=Math.round((storm?52:fog?138:86)+d*(storm?94:fog?98:158));
    const horR=Math.round((storm?28:38)+d*(storm?78:fog?162:192)+tw*42);
    const horG=Math.round((storm?36:56)+d*(storm?90:fog?166:182)+tw*18);
    const horB=Math.round((storm?48:82)+d*(storm?108:fog?162:168)-tw*12);
    const seaR=Math.round(14+d*(storm?30:fog?84:48));
    const seaG=Math.round(28+d*(storm?46:fog?98:106));
    const seaB=Math.round(42+d*(storm?66:fog?108:136));
    skyFade.addColorStop(0,`rgb(${topR},${topG},${topB})`);
    skyFade.addColorStop(.43,`rgb(${Math.min(255,horR-12)},${Math.min(255,horG-2)},${Math.min(255,horB)})`);
    skyFade.addColorStop(.50,`rgb(${Math.min(255,horR)},${Math.min(255,horG)},${Math.min(255,horB)})`);
    skyFade.addColorStop(.54,`rgb(${seaR},${seaG},${seaB})`);
    skyFade.addColorStop(1,`rgb(${Math.round(seaR*.68)},${Math.round(seaG*.76)},${Math.round(seaB*.84)})`);
    ink.fillStyle=skyFade;
    ink.fillRect(0,0,w,h);
    // Specular sun reflection lobe & horizon glow for PBR aircraft/canopy ray-traced IBL
    const u=((Math.atan2(dir.z,dir.x)/(Math.PI*2))+1)%1;
    const v=Math.acos(Math.max(-1,Math.min(1,dir.y)))/Math.PI;
    const sunGain=(d*.92+tw*.75)*(storm?.25:fog?.42:1)*(raytrace?1:.45);
    if(sunGain>.03){
      for(const offset of [-w,0,w]){
        const sx=u*w+offset, sy=v*h;
        const glowR=raytrace?h*.42:h*.30;
        const grad=ink.createRadialGradient(sx,sy,1,sx,sy,glowR);
        grad.addColorStop(0,`rgba(255,250,232,${Math.min(1,.96*sunGain)})`);
        grad.addColorStop(.16,`rgba(255,232,188,${Math.min(1,.62*sunGain)})`);
        grad.addColorStop(.55,`rgba(186,226,255,${Math.min(1,.24*sunGain)})`);
        grad.addColorStop(1,'rgba(186,226,255,0)');
        ink.fillStyle=grad;
        ink.fillRect(sx-glowR,sy-glowR,glowR*2,glowR*2);
      }
    }
    texture.needsUpdate=true;
    return true;
  }
  return {
    uniforms,
    setWeather(hours,day,weather,direction,raytrace=true){
      uniforms.sun.value.copy(direction).normalize();
      const moonAngle=(hours+3)*Math.PI/12;
      uniforms.moon.value.set(Math.sin(moonAngle),.41,-Math.cos(moonAngle)).normalize();
      uniforms.daylight.value=day;
      uniforms.twilight.value=Math.max(0,1-Math.min(Math.abs(hours-6),Math.abs(hours-18))/1.45);
      uniforms.coverage.value=weather==='storm'?.78:weather==='wet'?.30:weather==='clouds'?.40:weather==='fog'?.39:.51;
      uniforms.mist.value=weather==='storm'?.65:weather==='fog'?.89:weather==='wet'?.23:0;
      uniforms.raytrace.value=raytrace?1:0;
    },
    update(camera,dt,quality){
      dome.position.copy(camera.position);
      cloudDeck.visible=camera.position.y>2700;
      cloudDeck.position.set(camera.position.x,2180,camera.position.z);
      uniforms.eye.value.copy(camera.position);
      uniforms.seconds.value+=dt;
      uniforms.steps.value=quality==='ultra'?18:quality==='low'?5:quality==='high'?11:8;
    },
    updateEnvironment
  };
}
if(typeof module!=='undefined') module.exports={createAtmosphericSky};
