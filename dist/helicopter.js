'use strict';
// Multi-model helicopter fleet with high-speed cruise & level-flight stabilization.
const helicopterProfile = {
  ...trainer, id: 'sh6', name: 'SKYBOUND H6 · 巡遊直升機', type: '單發渦軸直升機 · 總距／懸停',
  helicopter: true, mass: 1900, missionFuel: 280, geometry: [5.8, .90, 5.25, .15, 1, 0], gearHeight: 1.40,
  rotation: 0, approach: 45, retract: false, jet: false, flapLift: [0, 0, 0], flapDrag: [0, 0, 0], glass: true,
  speedBonus: 1.4, dragCoeff: 0.015
};

const aw101Profile = {
  ...trainer, id: 'aw101', name: 'AW101 Merlin · 搜救巡邏直升機', type: '三發重型多用途搜救直升機 · 3D 擬真模型',
  helicopter: true, mass: 9300, missionFuel: 1200, geometry: [11.2, 1.8, 9.4, .3, 1, 0], gearHeight: 2.10,
  rotation: 0, approach: 55, retract: true, jet: false, flapLift: [0, 0, 0], flapDrag: [0, 0, 0], glass: true,
  externalModel: 'models/ac_aw101.glb', speedBonus: 1.6, dragCoeff: 0.012
};

const uh60Profile = {
  ...trainer, id: 'uh60', name: 'UH-60M 黑鷹直升機 · 戰術搜救', type: '雙發戰術搜救直升機 · 國軍主力戰術機',
  helicopter: true, mass: 5350, missionFuel: 800, geometry: [9.6, 1.4, 8.2, .25, 1, 0], gearHeight: 1.75,
  rotation: 0, approach: 50, retract: false, jet: false, flapLift: [0, 0, 0], flapDrag: [0, 0, 0], glass: true,
  speedBonus: 1.55, dragCoeff: 0.013
};

const ah64Profile = {
  ...trainer, id: 'ah64', name: 'AH-64E 阿帕契守護者 · 重型攻擊直升機', type: '雙座重型武裝攻擊直升機 · 30mm 鏈砲／地獄火',
  helicopter: true, mass: 5160, missionFuel: 750, geometry: [8.8, 1.3, 7.3, .2, 1, 0], gearHeight: 1.65,
  rotation: 0, approach: 52, retract: false, jet: false, flapLift: [0, 0, 0], flapDrag: [0, 0, 0], glass: true,
  speedBonus: 1.7, dragCoeff: 0.011
};

fleet.push(helicopterProfile, aw101Profile, uh60Profile, ah64Profile);

function configureHelicopterFlight(f){
  f.fastCruise = false; f.flaps = 0; f.gear = true; f.hold = null;
  f.rotorRPM = f.start === 'cold' ? 0 : 1;
  f.fuel ??= f.aircraft.missionFuel; f.fuelStart ??= f.fuel;
  if(f.start === 'air'){
    f.power = .55; f.vx = f.vy = f.vz = 0; f.speed = 0;
    f.y = f.departure.elevation + 150;
  }
  return f;
}

function toggleHelicopterHover(f){
  if(f.hover){ f.hover = null; return; }
  if(f.battery && f.engines.some(Boolean) && !f.ground && !f.ended)
    f.hover = { x: f.x, z: f.z, y: f.y, heading: f.heading };
}

function stepHelicopter(f, input, dt = simTick){
  if(f.ended || f.finished) return;
  const g = 9.80665, wind = flightWind(f), density = atmosphere(f.y).density / 1.225;
  const mass = Math.max(1400, f.aircraft.mass + (f.fuel ?? 280) - 280);
  f.elapsed += dt;

  f.power = limit(f.power + (input.throttle || 0) * dt * .55, 0, 1);
  const running = f.engines.some(Boolean) && f.fuel !== 0;
  f.rotorRPM ??= f.start === 'cold' ? 0 : 1;
  f.rotorRPM += ((running ? 1 : 0) - f.rotorRPM) * (1 - Math.exp(-dt / (running ? 2.8 : 7)));

  if(Number.isFinite(f.fuel)){
    f.fuelFlow = running ? .016 + .040 * f.power : 0;
    f.fuel = Math.max(0, f.fuel - f.fuelFlow * dt);
    if(f.fuel === 0){ f.fuelFlow = 0; f.engines.fill(false); f.hover = null; }
  }

  let pitch = input.pitch || 0, roll = input.roll || 0, rudder = input.rudder || 0;
  const sine = Math.sin(f.heading), cosine = Math.cos(f.heading);
  const vx = f.vx - wind.x, vz = f.vz - wind.z;
  const forward = f.vx * sine - f.vz * cosine, right = f.vx * cosine + f.vz * sine;

  if(f.hover){
    if(Math.abs(pitch) + Math.abs(roll) + Math.abs(rudder) + Math.abs(input.throttle || 0) > .15) f.hover = null;
    else{
      const ax = limit((f.hover.x - f.x) * .35 - f.vx * .9, -3, 3), az = limit((f.hover.z - f.z) * .35 - f.vz * .9, -3, 3);
      pitch = limit((ax * sine - az * cosine) / g / .28, -.8, .8);
      roll = limit((ax * cosine + az * sine) / g / .32, -.8, .8);
      rudder = limit(wrapAngle(f.hover.heading - f.heading) * 2, -.7, .7);
      const desiredVS = limit((f.hover.y - f.y) * .8, -3, 3);
      f.power = limit(.55 / Math.pow(density, .65) / Math.max(.6, Math.cos(f.bank) * Math.cos(f.pitch)) + (desiredVS - f.vy) * .055, .12, .92);
    }
  }

  if(input.brake && !f.ground){ pitch = limit(-forward * .10, -1, 1); roll = limit(-right * .10, -1, 1); }

  // Forward pitch authority: more forward cyclic response for high-speed cruising
  const pTarget = -pitch * (pitch > 0 ? .45 : .28);
  const bTarget = roll * .32;
  f.commandPitch = pTarget; f.commandBank = bTarget;
  f.pitchRate += ((pTarget - f.pitch) * 16 - f.pitchRate * 7) * dt;
  f.bankRate += ((bTarget - f.bank) * 14 - f.bankRate * 6) * dt;
  f.pitch = limit(f.pitch + f.pitchRate * dt, -.60, .52);
  f.bank = limit(f.bank + f.bankRate * dt, -.55, .55);

  f.yawRate += (rudder * .75 - f.yawRate) * (1 - Math.exp(-dt * 4));
  if(!f.ground) f.heading = wrapAngle(f.heading + f.yawRate * dt);

  const lift = g * (f.power / .55) * f.rotorRPM * f.rotorRPM * Math.pow(density, .65) * 1900 / mass;
  f.engineThrust = lift * mass; f.stall = false; f.airBrake = Boolean(input.brake && !f.ground);
  const floor = (f.regional ? regionalHeight(f.x, f.z) : groundHeight(f.x, f.z)) + f.aircraft.gearHeight;

  if(f.ground){
    f.vx = f.vy = f.vz = 0; f.y = floor;
    if(!f.parkingBrake && lift * Math.cos(f.pitch) * Math.cos(f.bank) > g * 1.025 && f.rotorRPM > .88){
      f.ground = false; f.airborne = true; f.landed = false; f.touchdown = null;
    }
  }

  if(!f.ground){
    // High-speed forward rotor propulsion:
    const forwardAcceleration = -Math.sin(f.pitch) * lift * (f.pitch < 0 ? 1.85 : 1.0);
    const rightAcceleration = Math.sin(f.bank) * lift;

    // Aerodynamic fuselage drag: allows smooth high-speed cruise (280-360 km/h)
    const dragCoeff = (f.aircraft.dragCoeff || .014) + .00020 * Math.hypot(vx, vz);
    f.vx += (sine * forwardAcceleration + cosine * rightAcceleration - vx * dragCoeff) * dt;
    f.vz += (-cosine * forwardAcceleration + sine * rightAcceleration - vz * dragCoeff) * dt;

    // Vertical flight control:
    // When flying forward without active throttle commands, automatically damp vertical acceleration
    // so the helicopter flies forward level without climbing!
    let verticalAccel = lift * Math.cos(f.pitch) * Math.cos(f.bank) - g;
    if(Math.abs(input.throttle || 0) < 0.05){
      const horizontalSpeed = Math.hypot(f.vx, f.vz);
      if(horizontalSpeed > 2){
        verticalAccel = (0 - f.vy) * 2.5;
      } else {
        verticalAccel -= f.vy * 0.85;
      }
    } else {
      verticalAccel -= f.vy * 0.55;
    }
    f.vy += verticalAccel * dt;

    f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    const landingFloor = (f.regional ? regionalHeight(f.x, f.z) : groundHeight(f.x, f.z)) + f.aircraft.gearHeight;
    if(f.y <= landingFloor){
      const horizontal = Math.hypot(f.vx, f.vz);
      const frame = f.destination ? runwayCoordinates(f.x, f.z, f.destination) : { along: 0, cross: 0 };
      f.touchdown = { ...frame, verticalSpeed: f.vy, speed: horizontal };
      f.landed = f.vy > -3 && horizontal < 8 && Math.abs(f.bank) < .23 && Math.abs(f.pitch) < .23;
      f.ended = !f.landed; f.ground = true; f.hover = null; f.y = landingFloor;
      f.vx = f.vy = f.vz = 0; f.pitch = f.bank = f.pitchRate = f.bankRate = 0;
    }
  }
  f.speed = Math.hypot(f.vx - wind.x, f.vy, f.vz - wind.z); f.vs = f.vy; f.lateralAcceleration = 0;
}

function updateHelicopterFlight(f, save){
  if(f.finished) return;
  f.phase = f.ground ? (f.landed ? 'landed' : !f.battery ? 'cold' : 'takeoff') : f.hover ? 'hover' : 'cruise';
  if(f.ended){ f.finished = true; f.recorded = save(f, '直升機重落地'); }
  else if(f.landed && f.parkingBrake && !f.engines.some(Boolean)){
    f.finished = true; f.recorded = save(f, '直升機降落完成');
  }
}

function buildHelicopter(profile, scene){
  if(typeof THREE === 'undefined') return {};
  const root = new THREE.Group(); root.name = profile.name || 'Helicopter';
  const cabin = new THREE.Group(), gear = new THREE.Group(), rotor = new THREE.Group(), tailRotor = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xe5e9e8, roughness: .36, metalness: .15 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x216b83, roughness: .38, metalness: .2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x242e35, roughness: .76 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x747f82, roughness: .32, metalness: .65 });
  const militaryGreen = new THREE.MeshStandardMaterial({ color: 0x303c34, roughness: .68, metalness: .25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x91b8c1, roughness: .13, metalness: .25, clearcoat: 1, transparent: true, opacity: .38, depthWrite: false });

  function mesh(parent, geometry, mat, x, y, z){ const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); parent.add(m); return m; }
  const box = (p, m, w, h, d, x, y, z) => mesh(p, new THREE.BoxGeometry(w, h, d), m, x, y, z);

  let extMainRotor = null, extTailRotor = null;

  if(profile.id === 'aw101' && profile.externalModel){
    // AW101 Merlin 3D Model loading via GLTFLoader
    const placeholder = new THREE.Group();
    box(placeholder, militaryGreen, 2.2, 2.4, 8.5, 0, 0, 0);
    root.add(placeholder);

    if(THREE.GLTFLoader){
      new THREE.GLTFLoader().load(profile.externalModel, gltf => {
        root.remove(placeholder);
        const obj = gltf.scene;
        obj.rotation.y = Math.PI; // Correct model forward orientation
        obj.position.y = -profile.gearHeight + .45;
        root.add(obj);

        obj.traverse(child => {
          if(child.isMesh){
            child.castShadow = child.receiveShadow = true;
          }
          if(child.name === 'AW101_propellar') extMainRotor = child;
          if(child.name === 'AW101_backrotor') extTailRotor = child;
        });
      }, undefined, () => {});
    }
  } else if(profile.id === 'uh60'){
    // UH-60M Black Hawk (tactical transport & rescue)
    const body = box(root, militaryGreen, 2.3, 1.8, 8.2, 0, .25, -.5);
    const nose = mesh(root, new THREE.ConeGeometry(1.2, 2.2, 8), militaryGreen, 0, .15, -5.2);
    nose.rotation.x = -Math.PI / 2;
    // Dual GE T700 engines on spine
    box(root, dark, 2.6, .75, 3.2, 0, 1.25, -.4);
    box(root, metal, .55, .55, .8, -.95, 1.25, 1.4);
    box(root, metal, .55, .55, .8, .95, 1.25, 1.4);
    // Tail boom and large stabilator
    const boom = mesh(root, new THREE.CylinderGeometry(.25, .65, 7.2, 16), militaryGreen, 0, .45, 4.4);
    boom.rotation.x = Math.PI / 2;
    box(root, militaryGreen, 4.2, .08, .95, 0, .48, 7.2); // Horizontal stabilator
    const tailFin = box(root, militaryGreen, .15, 2.1, 1.2, -.15, 1.25, 7.8);
    tailFin.rotation.x = .25;
    // Cockpit windows
    box(root, glass, 2.1, .95, 1.4, 0, .75, -3.8);
    // Landing gear
    for(const side of [-1, 1]){
      const strut = box(gear, metal, .12, .95, .12, side * 1.35, -.45, -1.2);
      strut.rotation.z = side * .35;
      const wheel = mesh(gear, new THREE.CylinderGeometry(.28, .28, .22, 16), dark, side * 1.55, -.92, -1.2);
      wheel.rotation.z = Math.PI / 2;
    }
    const tailWheel = mesh(gear, new THREE.CylinderGeometry(.16, .16, .14, 12), dark, 0, -.35, 6.8);
    tailWheel.rotation.z = Math.PI / 2;

    // 4-blade swept rotor
    rotor.position.set(0, 1.85, -.4); root.add(rotor);
    mesh(rotor, new THREE.CylinderGeometry(.32, .35, .25, 16), metal, 0, 0, 0);
    for(let b = 0; b < 4; b++){
      const arm = new THREE.Group(); arm.rotation.y = b * Math.PI / 2; rotor.add(arm);
      box(arm, dark, .24, .04, 7.2, 0, .02, -4.1);
      box(arm, metal, .25, .05, .55, 0, .02, -7.6);
    }
    tailRotor.position.set(-.35, 1.85, 7.8); root.add(tailRotor);
    for(let i = 0; i < 4; i++){ const b = box(tailRotor, dark, .04, .18, 1.6, 0, 0, 0); b.rotation.x = i * Math.PI / 2; }
  } else if(profile.id === 'ah64'){
    // AH-64E Apache Guardian (stepped tandem attack helicopter)
    const body = box(root, militaryGreen, 1.6, 1.7, 7.4, 0, .2, -.4);
    // Stepped tandem cockpit
    box(root, glass, 1.15, .82, 2.2, 0, .92, -1.8);
    box(root, glass, 1.05, .72, 1.8, 0, .62, -3.2);
    // Nose M-TADS/PNVS sensor turret
    const turret = mesh(root, new THREE.SphereGeometry(.45, 16, 12), dark, 0, -.25, -4.5);
    mesh(turret, new THREE.CylinderGeometry(.12, .12, .3, 12), metal, .2, 0, .35);
    // 30mm M230 chain gun
    const gun = box(root, dark, .15, .22, 1.6, 0, -.75, -2.2);
    mesh(gun, new THREE.CylinderGeometry(.045, .045, 1.4, 8), metal, 0, -.08, -1.1).rotation.x = Math.PI / 2;
    // Stub wings with Hellfires and Hydra rockets
    for(const side of [-1, 1]){
      box(root, militaryGreen, 2.1, .15, .75, side * 1.8, .15, -.8);
      // Pylon racks
      box(root, dark, .4, .45, 1.2, side * 1.5, -.2, -.8);
      box(root, dark, .4, .45, 1.2, side * 2.3, -.2, -.8);
      // Rocket pod
      mesh(root, new THREE.CylinderGeometry(.25, .25, 1.4, 12), militaryGreen, side * 2.3, -.45, -.8).rotation.x = Math.PI / 2;
      // Landing gear
      const strut = box(gear, metal, .12, 1.1, .12, side * 1.05, -.5, -1.4);
      strut.rotation.z = side * .35;
      const wheel = mesh(gear, new THREE.CylinderGeometry(.25, .25, .18, 16), dark, side * 1.35, -.98, -1.4);
      wheel.rotation.z = Math.PI / 2;
    }
    // Tail boom
    const boom = mesh(root, new THREE.CylinderGeometry(.22, .55, 6.8, 16), militaryGreen, 0, .35, 4.1);
    boom.rotation.x = Math.PI / 2;
    box(root, militaryGreen, 3.2, .08, .75, 0, .42, 6.8); // Stabilator
    box(root, militaryGreen, .14, 1.8, .9, 0, 1.1, 7.3);
    const tailWheel = mesh(gear, new THREE.CylinderGeometry(.14, .14, .12, 12), dark, 0, -.25, 6.2);
    tailWheel.rotation.z = Math.PI / 2;

    // 4-blade rotor with Longbow radar mast
    rotor.position.set(0, 1.75, -.5); root.add(rotor);
    mesh(rotor, new THREE.CylinderGeometry(.28, .3, .3, 16), metal, 0, 0, 0);
    // Longbow AN/APG-78 radar dome
    const radome = mesh(rotor, new THREE.SphereGeometry(.65, 18, 12), dark, 0, .75, 0);
    radome.scale.set(1.15, .55, 1.15);
    for(let b = 0; b < 4; b++){
      const arm = new THREE.Group(); arm.rotation.y = b * Math.PI / 2; rotor.add(arm);
      box(arm, dark, .22, .04, 6.8, 0, .02, -3.8);
    }
    tailRotor.position.set(.25, 1.4, 7.4); root.add(tailRotor);
    for(let i = 0; i < 4; i++){ const b = box(tailRotor, dark, .04, .16, 1.4, 0, 0, 0); b.rotation.x = i * Math.PI / 2; }
  } else {
    // Default H6 Light Cruise Helicopter
    const body = mesh(root, new THREE.SphereGeometry(1, 44, 26), paint, 0, 0, -.65);
    body.scale.set(.9, .89, 2.2);
    const bodyIndex = body.geometry.index.array, bodyPosition = body.geometry.attributes.position, skin = [];
    for(let i = 0; i < bodyIndex.length; i += 3){
      const ids = [bodyIndex[i], bodyIndex[i + 1], bodyIndex[i + 2]];
      const y = ids.reduce((n, k) => n + bodyPosition.getY(k) / 3, 0), z = ids.reduce((n, k) => n + bodyPosition.getZ(k) / 3, 0);
      if(!(y > 0 && z < -.13)) skin.push(...ids);
    }
    body.geometry.setIndex(skin);
    const windscreen = mesh(root, new THREE.SphereGeometry(1, 36, 22, 0, Math.PI * 2, 0, Math.PI), glass, 0, .28, -1.4);
    windscreen.scale.set(.88, .77, 1.39);
    const chin = mesh(root, new THREE.SphereGeometry(1, 32, 16), blue, 0, -.34, -1.4);
    chin.scale.set(.92, .46, 1.25);
    for(const side of [-1, 1]){
      box(root, dark, .055, .82, 1.65, side * .84, .30, -.68);
      box(root, blue, .12, .07, 2.75, side * .90, -.25, -.35);
      box(root, metal, .07, .06, .31, side * .93, .18, .15);
      const skid = mesh(gear, new THREE.CylinderGeometry(.055, .055, 4.6, 12), metal, side * .97, -1.27, -.3);
      skid.rotation.x = Math.PI / 2;
      for(const z of [-1.35, .70]){
        const strut = box(gear, metal, .065, .65, .065, side * .76, -.94, z);
        strut.rotation.z = side * .45;
      }
    }
    const boom = mesh(root, new THREE.CylinderGeometry(.16, .43, 5.1, 22), blue, 0, .30, 3.05);
    boom.rotation.x = Math.PI / 2;
    const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.lineTo(.9, 0); finShape.lineTo(.65, 1.7); finShape.lineTo(.12, 1.5); finShape.closePath();
    const fin = mesh(root, new THREE.ExtrudeGeometry(finShape, { depth: .07, bevelEnabled: false }), paint, -.035, .28, 4.8);
    fin.rotation.y = Math.PI / 2;
    box(root, blue, 2.3, .07, .55, 0, .45, 3.8);
    const pod = mesh(root, new THREE.SphereGeometry(1, 24, 16), blue, 0, .98, .40);
    pod.scale.set(.55, .45, 1.30);
    const exhaust = mesh(root, new THREE.CylinderGeometry(.17, .20, .7, 18, 1, true), metal, .32, 1.05, 1.28);
    exhaust.rotation.x = Math.PI / 2;
    mesh(root, new THREE.CylinderGeometry(.08, .11, .65, 12), metal, 0, 1.44, .05);
    rotor.position.set(0, 1.79, .05); root.add(rotor);
    mesh(rotor, new THREE.SphereGeometry(.17, 16, 10), metal, 0, 0, 0);
    for(let blade = 0; blade < 4; blade++){
      const arm = new THREE.Group(); arm.rotation.y = blade * Math.PI / 2; rotor.add(arm);
      box(arm, dark, .22, .045, 4.80, 0, .02, -2.75); box(arm, paint, .23, .05, .31, 0, .02, -5.02);
      box(arm, metal, .08, .09, .6, 0, -.03, -.30);
    }
    tailRotor.position.set(.20, .72, 5.45); root.add(tailRotor);
    for(let i = 0; i < 4; i++){ const b = box(tailRotor, dark, .055, .17, 1.5, 0, 0, 0); b.rotation.x = i * Math.PI / 2; }
  }

  const navLights = [];
  for(const side of [-1, 1]) navLights.push(mesh(root, new THREE.SphereGeometry(.06, 9, 6), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff5347 : 0x57e9ac }), side * .91, .28, .9));

  const panelCanvas = document.createElement('canvas'); panelCanvas.width = 768; panelCanvas.height = 320;
  const ink = panelCanvas.getContext('2d'), panelTexture = new THREE.CanvasTexture(panelCanvas); panelTexture.colorSpace = THREE.SRGBColorSpace;
  const display = mesh(cabin, new THREE.PlaneGeometry(1.28, .53), new THREE.MeshBasicMaterial({ map: panelTexture }), 0, .09, -2.08);
  display.rotation.x = -.1;
  box(cabin, dark, 1.51, .62, .25, 0, .05, -2.21); box(cabin, dark, 1.6, .08, .35, 0, .43, -2.23);
  for(const side of [-1, 1]){
    box(cabin, dark, .46, .12, .57, side * .43, -.46, -1.01); box(cabin, dark, .46, .70, .10, side * .43, -.13, -.68);
    box(cabin, dark, .035, .55, .04, side * .43, -.40, -1.45);
    box(cabin, metal, .035, .04, .26, side * .43, -.13, -1.48);
    box(cabin, dark, .04, 1.4, .05, side * .80, .45, -1.33);
  }
  box(cabin, dark, .045, .98, .05, 0, .88, -2.30);
  cabin.visible = false; root.add(gear); scene.add(root, cabin);

  let nextInstrument = 0;
  function update(f, dt, now, cockpit, paused){
    if(!paused){
      const speedRpm = f?.rotorRPM ?? .35;
      rotor.rotation.y += dt * 39 * speedRpm;
      tailRotor.rotation.x += dt * 150 * speedRpm;
      if(extMainRotor) extMainRotor.rotation.y += dt * 39 * speedRpm;
      if(extTailRotor) extTailRotor.rotation.x += dt * 150 * speedRpm;
    }
    cabin.position.copy(root.position); cabin.quaternion.copy(root.quaternion); cabin.visible = cockpit;
    if(now < nextInstrument) return; nextInstrument = now + 100;
    ink.fillStyle = '#17232a'; ink.fillRect(0, 0, 768, 320); ink.font = 'bold 25px sans-serif'; ink.fillStyle = '#b7d9c8';
    ink.fillText(profile.name || 'HELICOPTER', 25, 34);
    const rows = [
      ['空速', Math.round((f?.speed ?? 0) * 3.6) + ' km/h'],
      ['高度', Math.round(f?.y ?? 0) + ' m'],
      ['升降', ((f?.vy ?? 0)).toFixed(1) + ' m/s'],
      ['旋翼 NR', Math.round((f?.rotorRPM ?? 0) * 100) + '%'],
      ['總距', Math.round((f?.power ?? 0) * 100) + '%'],
      ['燃油', Math.round(f?.fuel ?? 280) + ' kg']
    ];
    rows.forEach(([title, value], i) => {
      const x = 25 + i % 3 * 250, y = 90 + Math.floor(i / 3) * 100;
      ink.fillStyle = '#97aeb2'; ink.fillText(title, x, y);
      ink.fillStyle = '#7affbe'; ink.font = 'bold 33px monospace'; ink.fillText(value, x, y + 38);
      ink.font = 'bold 25px sans-serif';
    });
    panelTexture.needsUpdate = true;
  }

  root.userData = { gear, blades: [], surfaces: [], navLights, cabin, rotor, tailRotor, updateHelicopter: update };

  if(typeof allAirports !== 'undefined'){
    const airport = allAirports.find(a => a.code === 'RCSS'), pad = airportPoint(airport, 385, airport.apron + 46);
    const padCanvas = document.createElement('canvas'); padCanvas.width = padCanvas.height = 256;
    const p = padCanvas.getContext('2d'); p.fillStyle = '#666e70'; p.fillRect(0, 0, 256, 256);
    p.strokeStyle = '#ece4a6'; p.lineWidth = 7; p.beginPath(); p.arc(128, 128, 105, 0, Math.PI * 2); p.stroke();
    p.fillStyle = '#f3edc4'; p.font = 'bold 126px sans-serif'; p.textAlign = 'center'; p.fillText('H', 128, 173);
    const t = new THREE.CanvasTexture(padCanvas); t.colorSpace = THREE.SRGBColorSpace;
    const padMesh = new THREE.Mesh(new THREE.PlaneGeometry(28, 28), new THREE.MeshStandardMaterial({ map: t, roughness: .88 }));
    padMesh.rotation.x = -Math.PI / 2; padMesh.position.set(pad.x, airport.elevation + .13, pad.z); padMesh.name = 'H1 training helipad'; scene.add(padMesh);
  }

  return root;
}

if(typeof module !== 'undefined') Object.assign(globalThis, {
  helicopterProfile, aw101Profile, uh60Profile, ah64Profile,
  configureHelicopterFlight, stepHelicopter, toggleHelicopterHover, updateHelicopterFlight
});
