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
    seconds:{value:0},steps:{value:8}
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
      uniform float daylight,twilight,coverage,mist,seconds;
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
        vec3 horizon=mix(vec3(.024,.035,.070),vec3(.54,.70,.83),daylight);
        vec3 zenith=mix(vec3(.004,.010,.033),vec3(.046,.25,.57),daylight);
        vec3 sky=mix(horizon,zenith,pow(up,.48));
        sky+=vec3(.61,.21,.046)*twilight*pow(glare,5.)*exp(-up*4.);
        sky+=vec3(1.,.81,.53)*daylight*(pow(glare,16.)*.17+smoothstep(.99991,.99997,glare)*6.);
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
          vec3 cloudColor=mix(vec3(.039,.053,.086),vec3(.45,.50,.58),daylight)*opacity;
          cloudColor+=vec3(.45,.42,.35)*light*daylight;
          cloudColor+=vec3(.40,.15,.052)*light*twilight;
          float distanceFade=exp(-start/28000.)*smoothstep(.028,.16,abs(d.y));
          sky=mix(sky,cloudColor+sky*(1.-opacity),distanceFade);
        }
        vec3 haze=mix(vec3(.07,.085,.12),vec3(.62,.69,.74),daylight);
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
        float alpha=smoothstep(coverage-.04,coverage+.12,shape);
        alpha*=1.-smoothstep(30000.,67000.,length(world.xz-eye.xz));
        if(alpha<.012) discard;
        float shading=clamp(.66+(shape-field(p+sun.xz*.16))*2.8,0.,1.);
        vec3 color=mix(vec3(.043,.069,.12),mix(vec3(.58,.69,.81),vec3(1.1,1.12,1.14),shading),daylight);
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
  return {
    setWeather(hours,day,weather,direction){
      uniforms.sun.value.copy(direction).normalize();
      const moonAngle=(hours+3)*Math.PI/12;
      uniforms.moon.value.set(Math.sin(moonAngle),.41,-Math.cos(moonAngle)).normalize();
      uniforms.daylight.value=day;
      uniforms.twilight.value=Math.max(0,1-Math.min(Math.abs(hours-6),Math.abs(hours-18))/1.45);
      uniforms.coverage.value=weather==='wet'?.30:weather==='clouds'?.40:weather==='fog'?.39:.51;
      uniforms.mist.value=weather==='fog'?.89:weather==='wet'?.23:0;
    },
    update(camera,dt,quality){
      dome.position.copy(camera.position);
      cloudDeck.visible=camera.position.y>2700;
      cloudDeck.position.set(camera.position.x,2180,camera.position.z);
      uniforms.eye.value.copy(camera.position);
      uniforms.seconds.value+=dt;
      uniforms.steps.value=quality==='ultra'?18:quality==='low'?5:quality==='high'?11:8;
    }
  };
}
