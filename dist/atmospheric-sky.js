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
    noiseMap:{value:noise},eye:{value:new THREE.Vector3()},sun:{value:new THREE.Vector3(0,1,0)},
    daylight:{value:1},twilight:{value:0},coverage:{value:.55},mist:{value:0},
    seconds:{value:0},steps:{value:8}
  };
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
      uniform vec3 eye,sun;
      uniform float daylight,twilight,coverage,mist,seconds;
      uniform int steps;

      float noise3(vec3 p){
        vec3 i=floor(p), f=fract(p);
        f=f*f*(3.-2.*f);
        vec2 cell=i.xy+vec2(17.,47.)*i.z+f.xy+.5;
        return mix(texture2D(noiseMap,cell/128.).r,
          texture2D(noiseMap,(cell+vec2(17.,47.))/128.).r,f.z);
      }
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
        float dy=abs(d.y)<.001?(d.y<0.?-.001:.001):d.y;
        float a=(1450.-eye.y)/dy,b=(2600.-eye.y)/dy;
        float start=max(0.,min(a,b)),end=min(46000.,max(a,b));
        if(end>start){
          float stride=(end-start)/float(steps);
          float light=0.,opacity=0.;
          for(int i=0;i<11;i++){
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
  return {
    setWeather(hours,day,weather,direction){
      uniforms.sun.value.copy(direction).normalize();
      uniforms.daylight.value=day;
      uniforms.twilight.value=Math.max(0,1-Math.min(Math.abs(hours-6),Math.abs(hours-18))/1.45);
      uniforms.coverage.value=weather==='wet'?.30:weather==='fog'?.39:.51;
      uniforms.mist.value=weather==='fog'?.89:weather==='wet'?.23:0;
    },
    update(camera,dt,quality){
      dome.position.copy(camera.position);
      uniforms.eye.value.copy(camera.position);
      uniforms.seconds.value+=dt;
      uniforms.steps.value=quality==='low'?5:quality==='high'?11:8;
    }
  };
}
