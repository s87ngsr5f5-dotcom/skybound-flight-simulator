const assert = require('assert');
const fs = require('fs');
const THREE = require('./dist/three.js');
const { createAtmosphericSky } = require('./dist/atmospheric-sky.js');

console.log('Testing bright atmospheric sky & ray-traced lighting effects...');

global.THREE = THREE;
const scene = new THREE.Scene();
const sky = createAtmosphericSky(scene);

// 1. Verify uniforms and bright clear-sky shader enhancements
assert.ok(sky && sky.uniforms, 'Atmospheric sky must expose uniforms');
assert.strictEqual(sky.uniforms.raytrace.value, 1, 'Ray-traced mode should default to enabled (1)');

const dome = scene.children.find(c => c.material && c.material.fragmentShader && c.material.fragmentShader.includes('godRays'));
assert.ok(dome, 'SkyDome fragment shader must contain volumetric crepuscular godRays logic');
assert.ok(dome.material.fragmentShader.includes('vec3(.48,.78,.98)'), 'Daytime horizon should use brighter clear azure tint');
assert.ok(dome.material.fragmentShader.includes('vec3(.07,.36,.88)'), 'Daytime zenith should use brighter luminous blue tint');

// 2. Verify dynamic weather & raytrace toggle updates uniforms cleanly
sky.setWeather(13, 1, '0', new THREE.Vector3(-400, 750, -250), true);
assert.strictEqual(sky.uniforms.raytrace.value, 1);
sky.setWeather(13, 1, '0', new THREE.Vector3(-400, 750, -250), false);
assert.strictEqual(sky.uniforms.raytrace.value, 0);

// 3. Verify dynamic equirectangular IBL environment texture painter
let fillCount = 0;
let radialArgs = null;
const mockCtx = {
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: (x, y, r0, x1, y1, r1) => {
    radialArgs = { x, y, r0, r1 };
    return { addColorStop() {} };
  },
  fillRect: () => { fillCount++; },
  set fillStyle(_) {}
};
const mockCanvas = { width: 512, height: 256, getContext: () => mockCtx };
const mockTex = { needsUpdate: false };
const painted = sky.updateEnvironment(mockCanvas, mockTex, new THREE.Vector3(200, 500, -100), 1, 0, '0', true);
assert.strictEqual(painted, true, 'updateEnvironment should paint environment map on first call');
assert.strictEqual(mockTex.needsUpdate, true, 'updateEnvironment must mark texture dirty for GPU upload');
assert.ok(fillCount >= 4 && radialArgs && radialArgs.r1 > 80, 'Ray-traced environment map should render sun specular lobe');

// Caching skips redundant repaints for unchanged sun/weather parameters
mockTex.needsUpdate = false;
assert.strictEqual(sky.updateEnvironment(mockCanvas, mockTex, new THREE.Vector3(200, 500, -100), 1, 0, '0', true), false);

// 4. Verify index.html and flight.js integration
const html = fs.readFileSync('dist/index.html', 'utf8');
const flightJs = fs.readFileSync('dist/flight.js', 'utf8');
assert.ok(html.includes('id="rtLighting"'), 'index.html must include #rtLighting toggle');
assert.ok(/<small id="edition">\d+\.\d+<\/small>/.test(html), 'index.html must display semantic version in #edition');
assert.ok(flightJs.includes('seaRayUniforms') && flightJs.includes('sunTrail') && flightJs.includes('fresnel'),
  'flight.js terrain shader must include ocean Fresnel and sun specular trail reflection');
assert.ok(flightJs.includes('atmosphericSky.updateEnvironment('), 'setEnvironment must refresh dynamic IBL sky map');
assert.ok(flightJs.includes('skybound.rtLighting'), 'flight.js must persist ray-traced lighting toggle');

console.log('Sky brightness & ray-traced lighting assertions passed!');
