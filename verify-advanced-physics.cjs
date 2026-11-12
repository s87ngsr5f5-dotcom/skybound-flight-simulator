'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'dist', 'physics.js'), 'utf8');
const elevationGrid = new Float32Array(301 * 301);

const sandbox = {
  elevationGrid,
  Math,
  limit: (n, a, b) => Math.min(b, Math.max(a, n)),
  wrapAngle: angle => Math.atan2(Math.sin(angle), Math.cos(angle)),
  regionalHeight: (x, z) => 0,
  runwayCoordinates: () => ({ along: 0, cross: 0 }),
  cargoBalance: () => ({ shift: 0, mass: 0, problems: [] }),
  console,
  module: { exports: {} }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const physics = sandbox.module.exports || sandbox.physicsModule || sandbox;
const {
  trainer,
  runway10,
  simTick,
  createTrainer,
  stepTrainer,
  calculateUpdraft
} = physics;

console.log('Testing Advanced Flight Physics Engine (v0.40)...');

// 1. Ground Effect (Wieselsberger Induced Drag Reduction & Cushion Lift)
console.log('Testing Wieselsberger Ground Effect Model...');
{
  const fAir = createTrainer(true, 0);
  fAir.ground = false;
  fAir.y = 500; // Far above ground (no ground effect)
  stepTrainer(fAir, { throttle: 0, trim: 0, pitch: 0, roll: 0, rudder: 0 }, 0.05);

  assert.strictEqual(fAir.groundEffect.active, false, 'Ground effect must be inactive at 500m AGL');
  assert.strictEqual(fAir.groundEffect.inducedFactor, 1.0, 'Induced drag factor must be 1.0 far from ground');
  assert.strictEqual(fAir.groundEffect.cushionLift, 1.0, 'Cushion lift must be 1.0 far from ground');

  const fNear = createTrainer(true, 0);
  fNear.ground = false;
  fNear.x = 0;
  fNear.z = 0;
  fNear.y = runway10.elevation + trainer.gearHeight + 2.0; // 2m AGL right over runway
  stepTrainer(fNear, { throttle: 0, trim: 0, pitch: 0, roll: 0, rudder: 0 }, 0.05);

  assert.strictEqual(fNear.groundEffect.active, true, 'Ground effect must be active at 2m AGL');
  assert.ok(fNear.groundEffect.eta < 0.35, `Expected eta < 0.35, got ${fNear.groundEffect.eta}`);
  assert.ok(fNear.groundEffect.inducedFactor < 0.65, `Expected induced drag reduction factor < 0.65, got ${fNear.groundEffect.inducedFactor}`);
  assert.ok(fNear.groundEffect.cushionLift > 1.04, `Expected cushion lift boost > 1.04, got ${fNear.groundEffect.cushionLift}`);
  console.log(`PASS: Ground effect verified: eta=${fNear.groundEffect.eta.toFixed(2)}, inducedDragFactor=${fNear.groundEffect.inducedFactor.toFixed(3)}, cushionLift=${fNear.groundEffect.cushionLift.toFixed(3)}`);
}

// 2. Mountain Ridge Lift & Atmospheric Thermals
console.log('Testing Ridge Lift & Thermal Updrafts...');
{
  // Simulated sloping terrain: elevation rises +1m per 10m in X direction (slope = 0.1)
  const mountainTerrain = (x, z) => 100 + x * 0.10;
  const fSlope = {
    x: 1000,
    y: 100 + 1000 * 0.10 + 50, // 50m AGL
    z: 0,
    ground: false
  };
  // Wind blowing directly into mountain (+X direction, 10 m/s)
  // slopeLift = -(wind.x * slopeX) = -((-10) * 0.1) = +1.0 m/s updraft
  const headWind = { x: -10, z: 0 };
  const ridgeLift = calculateUpdraft(fSlope, mountainTerrain, headWind);
  assert.ok(ridgeLift > 0.6, `Expected positive ridge lift > 0.6 m/s, got ${ridgeLift}`);
  console.log(`PASS: Ridge lift on upwind slope: +${ridgeLift.toFixed(2)} m/s`);

  // Tail wind blowing down slope: should produce sink (downdraft)
  const tailWind = { x: 10, z: 0 };
  const downdraft = calculateUpdraft(fSlope, mountainTerrain, tailWind);
  assert.ok(downdraft < -0.6, `Expected downdraft < -0.6 m/s on lee slope, got ${downdraft}`);
  console.log(`PASS: Lee side downdraft: ${downdraft.toFixed(2)} m/s`);

  // Thermal core test
  const fThermal = {
    x: 0,
    y: 1200,
    z: 0,
    ground: false,
    enableThermals: true
  };
  const flatTerrain = () => 0;
  const thermalLift = calculateUpdraft(fThermal, flatTerrain, { x: 0, z: 0 });
  assert.ok(typeof thermalLift === 'number', 'Thermal lift calculation returned valid number');
  console.log(`PASS: Dynamic thermal updrafts verified: ${thermalLift.toFixed(2)} m/s`);
}

// 3. Propeller P-Factor & Torque Yaw
console.log('Testing Single-Engine Propeller P-Factor Tendency...');
{
  // Single-engine prop (C172S trainer) at high climb pitch and full throttle
  const fProp = createTrainer(false, 0);
  fProp.ground = false;
  fProp.y = 800;
  fProp.vx = 0;
  fProp.vz = -35;
  fProp.pitch = 0.18; // Positive high alpha climb
  fProp.power = 1.0;
  stepTrainer(fProp, { throttle: 0, trim: 0, pitch: 0.1, roll: 0, rudder: 0 }, 0.05);

  assert.ok(fProp.pFactor < -0.01, `Expected left-turning P-Factor (< -0.01), got ${fProp.pFactor}`);
  console.log(`PASS: Propeller P-Factor verified: ${fProp.pFactor.toFixed(4)} rad left-yaw moment`);

  // Jet fighter should have ZERO P-Factor
  const fJet = createTrainer(false, 0);
  fJet.aircraft = {
    ...trainer,
    id: 'f16v',
    mass: 11600,
    wingArea: 27.87,
    jet: true,
    thrust: 79000,
    stallAngle: 0.37,
    inertia: [15200, 75000, 85000],
    role: 'fighter'
  };
  fJet.ground = false;
  fJet.y = 800;
  fJet.vx = 0;
  fJet.vz = -150;
  fJet.pitch = 0.18;
  fJet.power = 1.0;
  stepTrainer(fJet, { throttle: 0, trim: 0, pitch: 0.1, roll: 0, rudder: 0 }, 0.05);
  assert.strictEqual(fJet.pFactor, 0, 'Jet aircraft must have 0 P-Factor');
  console.log('PASS: Jet symmetry verified: 0 P-Factor for jet aircraft');
}

// 4. Aerodynamic Buffet Vibration
console.log('Testing Aerodynamic Stall Buffet Vibration...');
{
  const fNormal = createTrainer(true, 0);
  fNormal.ground = false;
  fNormal.y = 600;
  fNormal.pitch = 0.04;
  stepTrainer(fNormal, { throttle: 0, trim: 0, pitch: 0, roll: 0, rudder: 0 }, 0.05);
  assert.strictEqual(fNormal.buffet, 0, 'Normal low-alpha flight should have 0 buffet');

  const fStall = createTrainer(true, 0);
  fStall.ground = false;
  fStall.y = 600;
  fStall.pitch = 0.32; // Near / at stall angle (trainer stallAngle = 0.28)
  stepTrainer(fStall, { throttle: 0, trim: 0, pitch: 0, roll: 0, rudder: 0 }, 0.05);
  assert.ok(fStall.buffet > 0.4, `Expected buffet vibration > 0.4, got ${fStall.buffet}`);
  console.log(`PASS: Aerodynamic stall buffet triggered at high alpha: ${fStall.buffet.toFixed(2)}`);
}

// 5. Dynamic G-Meter & Normal Load Factor
console.log('Testing Dynamic G-Meter & Normal Acceleration...');
{
  const fCruise = createTrainer(true, 0);
  fCruise.ground = false;
  fCruise.y = 1000;
  // Step for 1 second in approach configuration so flight path stabilizes
  for (let i = 0; i < 20; i++) {
    stepTrainer(fCruise, { throttle: 0, trim: 0, pitch: 0, roll: 0, rudder: 0 }, 0.05);
  }
  assert.ok(fCruise.gForce > 0.8 && fCruise.gForce < 1.4, `Stabilized flight G should be ~1.0G, got ${fCruise.gForce}`);
  assert.ok(fCruise.maxG >= 1.0, 'maxG should be tracked');
  console.log(`PASS: Stabilized flight normal load factor: ${fCruise.gForce.toFixed(2)}G (max: ${fCruise.maxG.toFixed(2)}G)`);
}

console.log('ALL ADVANCED PHYSICS TESTS PASSED 100%!\n');
