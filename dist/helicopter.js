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

  if(input.brake && !f.ground){ pitch = limit(-forward * .18, -1, 1); roll = limit(-right * .18, -1, 1); }

  // Forward pitch authority: responsive cyclic control for agile handling and cruising
  const pTarget = -pitch * (pitch > 0 ? .46 : .34);
  const bTarget = roll * .42;
  f.commandPitch = pTarget; f.commandBank = bTarget;
  f.pitchRate += ((pTarget - f.pitch) * 16 - f.pitchRate * 7) * dt;
  f.bankRate += ((bTarget - f.bank) * 15 - f.bankRate * 6) * dt;
  f.pitch = limit(f.pitch + f.pitchRate * dt, -.60, .52);
  f.bank = limit(f.bank + f.bankRate * dt, -.55, .55);

  const bankTurn = !f.ground ? Math.sin(f.bank) * (.72 + Math.min(.65, Math.hypot(vx, vz) * .012)) + roll * .24 : (f.rotorRPM > .35 ? roll * .45 : 0);
  const targetYaw = rudder * .95 + bankTurn;
  f.yawRate += (targetYaw - f.yawRate) * (1 - Math.exp(-dt * 4.5));
  if(!f.ground || f.rotorRPM > .35) f.heading = wrapAngle(f.heading + f.yawRate * dt);

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
    // UH-60M Black Hawk contoured aerodynamic fuselage, GE T700 pods, swept airfoil stabilator & rotor blades
    if(typeof AeroCraft!=='undefined'){
      const hullGeo=AeroCraft.buildFuselageLoft([
        {z:-6.2,rx:.14,ryTop:.10,ryBot:.10,y:-.18,power:2},
        {z:-5.2,rx:.78,ryTop:.42,ryBot:.38,y:-.05,pTop:2.2,pBot:2.6},
        {z:-3.8,rx:1.12,ryTop:.92,ryBot:.58,y:.22,pTop:2.3,pBot:2.8},
        {z:-1.6,rx:1.18,ryTop:.96,ryBot:.64,y:.25,pTop:2.4,pBot:3.0},
        {z:1.2,rx:1.14,ryTop:.92,ryBot:.60,y:.25,pTop:2.4,pBot:2.8},
        {z:2.8,rx:.68,ryTop:.62,ryBot:.48,y:.35,power:2.1},
        {z:4.8,rx:.42,ryTop:.44,ryBot:.40,y:.45,power:2},
        {z:7.5,rx:.24,ryTop:.32,ryBot:.28,y:.52,power:2}
      ],28);
      mesh(root,hullGeo,militaryGreen,0,0,0);
      mesh(root,AeroCraft.buildCanopyGeometry(2.6,2.08,.76,12,18),glass,0,.58,-3.7);
      for(const s of [-1,1]){
        const engPod=mesh(root,AeroCraft.buildCanoeGeometry(3.4,.38,.36),dark,s*.68,1.24,-.25);
        engPod.rotation.x=-.03;
        const exh=mesh(root,new THREE.CylinderGeometry(.22,.28,.75,14),metal,s*.86,1.22,1.55);
        exh.rotation.set(Math.PI/2,0,-s*.24);
        const hTail=mesh(root,AeroCraft.buildWingLoft([
          {x:.18,leadZ:6.75,chord:1.05,y:.48,thick:.11,camber:0},
          {x:2.15,leadZ:6.95,chord:.68,y:.52,thick:.09,camber:0}
        ],{slices:16,capTip:true,mirror:s<0}),militaryGreen,0,0,0);
        void hTail;
        const strut=mesh(gear,new THREE.CylinderGeometry(.075,.065,1.08,10),metal,s*1.28,-.45,-1.2);
        strut.rotation.z=s*.35;
        const dragBeam=mesh(gear,new THREE.CylinderGeometry(.055,.055,1.25,8),metal,s*.95,-.52,-1.75);
        dragBeam.rotation.set(.48,0,s*.25);
        const wheel=mesh(gear,new THREE.TorusGeometry(.24,.10,12,22),dark,s*1.55,-.92,-1.2);
        wheel.rotation.y=Math.PI/2;
        mesh(wheel,new THREE.CylinderGeometry(.15,.15,.14,14),metal,0,0,0).rotation.x=Math.PI/2;
      }
      mesh(root,AeroCraft.buildVerticalFoilLoft([
        {y:.48,leadZ:6.35,chord:1.65,thick:.10},
        {y:2.35,leadZ:7.28,chord:.75,thick:.09}
      ],{slices:16,capTip:true}),militaryGreen,-.08,0,0);
    }else{
      box(root, militaryGreen, 2.3, 1.8, 8.2, 0, .25, -.5);
    }
    const tailWheel=mesh(gear,new THREE.TorusGeometry(.14,.06,10,18),dark,0,-.35,6.8);
    tailWheel.rotation.y=Math.PI/2;
    rotor.position.set(0,1.85,-.4);root.add(rotor);
    mesh(rotor,new THREE.CylinderGeometry(.32,.35,.25,18),metal,0,0,0);
    mesh(rotor,new THREE.SphereGeometry(.26,16,10),dark,0,.12,0).scale.set(1.2,.45,1.2);
    const bladeGeo=typeof AeroCraft!=='undefined'?AeroCraft.buildTwistedBlade(7.6,.34,.28,.16):new THREE.BoxGeometry(7.2,.04,.24);
    for(let b=0;b<4;b++){
      const arm=new THREE.Group();arm.rotation.y=b*Math.PI/2;rotor.add(arm);
      const bm=new THREE.Mesh(bladeGeo,dark);bm.rotation.y=Math.PI/2;arm.add(bm);
    }
    tailRotor.position.set(-.35,1.85,7.8);root.add(tailRotor);
    const trGeo=typeof AeroCraft!=='undefined'?AeroCraft.buildTwistedBlade(1.55,.20,.16,.18):new THREE.BoxGeometry(1.55,.04,.16);
    for(let i=0;i<4;i++){const b=new THREE.Mesh(trGeo,dark);b.rotation.order='ZYX';b.rotation.z=Math.PI/2;b.rotation.x=i*Math.PI/2;tailRotor.add(b);}
  } else if(profile.id === 'ah64'){
    // AH-64E Apache Guardian: contoured slim tandem fuselage, stepped flat-plate canopy, sponsons, EFAB pylons & T700 pods
    if(typeof AeroCraft!=='undefined'){
      const hullGeo=AeroCraft.buildFuselageLoft([
        {z:-5.2,rx:.24,ryTop:.18,ryBot:.20,y:-.18,power:2},
        {z:-4.2,rx:.54,ryTop:.46,ryBot:.44,y:0,pTop:2.2,pBot:2.6},
        {z:-2.4,rx:.78,ryTop:.78,ryBot:.60,y:.15,pTop:2.3,pBot:3.0},
        {z:.6,rx:.84,ryTop:.84,ryBot:.64,y:.22,pTop:2.4,pBot:3.0},
        {z:2.4,rx:.52,ryTop:.56,ryBot:.44,y:.30,power:2.1},
        {z:5.0,rx:.32,ryTop:.36,ryBot:.32,y:.40,power:2},
        {z:7.3,rx:.20,ryTop:.28,ryBot:.24,y:.48,power:2}
      ],24);
      mesh(root,hullGeo,militaryGreen,0,0,0);
      mesh(root,AeroCraft.buildCanopyGeometry(2.3,1.12,.68,10,14),glass,0,.76,-1.8);
      mesh(root,AeroCraft.buildCanopyGeometry(1.9,1.02,.56,10,14),glass,0,.52,-3.2);
      const turret=mesh(root,new THREE.SphereGeometry(.44,18,14),dark,0,-.22,-4.7);
      mesh(turret,new THREE.CylinderGeometry(.12,.12,.32,12),metal,.18,0,-.34).rotation.x=Math.PI/2;
      const gun=mesh(root,AeroCraft.buildCanoeGeometry(1.65,.14,.14),dark,0,-.72,-2.2);
      mesh(gun,new THREE.CylinderGeometry(.045,.045,1.45,10),metal,0,-.06,-1.15).rotation.x=Math.PI/2;
      for(const side of [-1,1]){
        mesh(root,AeroCraft.buildCanoeGeometry(3.2,.30,.32),dark,side*.92,.88,-.1);
        mesh(root,AeroCraft.buildCanoeGeometry(4.4,.28,.26),militaryGreen,side*.92,-.26,-.9);
        const wing=mesh(root,AeroCraft.buildWingLoft([
          {x:.65,leadZ:-1.25,chord:.95,y:.16,thick:.12,camber:.02},
          {x:2.65,leadZ:-1.05,chord:.68,y:.10,thick:.10,camber:.015}
        ],{slices:16,capTip:true,mirror:side<0}),militaryGreen,0,0,0);
        void wing;
        for(const px of [1.45,2.25]){
          mesh(root,AeroCraft.buildAeroPylonGeometry(.34,.62,.42,.14,.08),dark,side*px,-.18,-.82);
        }
        const pod=mesh(root,new THREE.CylinderGeometry(.25,.25,1.45,14),militaryGreen,side*2.25,-.42,-.82);
        pod.rotation.x=Math.PI/2;
        mesh(pod,new THREE.SphereGeometry(.25,12,8),dark,0,.72,0).scale.y=.55;
        const strut=mesh(gear,new THREE.CylinderGeometry(.07,.06,1.15,10),metal,side*1.08,-.5,-1.4);
        strut.rotation.z=side*.35;
        const wheel=mesh(gear,new THREE.TorusGeometry(.22,.09,10,20),dark,side*1.35,-.98,-1.4);
        wheel.rotation.y=Math.PI/2;
        mesh(root,AeroCraft.buildWingLoft([
          {x:.12,leadZ:6.4,chord:.90,y:.42,thick:.10,camber:0},
          {x:1.65,leadZ:6.55,chord:.55,y:.44,thick:.09,camber:0}
        ],{slices:14,capTip:true,mirror:side<0}),militaryGreen,0,0,0);
      }
      mesh(root,AeroCraft.buildVerticalFoilLoft([
        {y:.42,leadZ:6.2,chord:1.45,thick:.10},
        {y:2.15,leadZ:7.1,chord:.68,thick:.09}
      ],{slices:14,capTip:true}),militaryGreen,0,0,0);
    }else{
      box(root, militaryGreen, 1.6, 1.7, 7.4, 0, .2, -.4);
    }
    const tailWheel=mesh(gear,new THREE.TorusGeometry(.13,.05,8,16),dark,0,-.25,6.2);
    tailWheel.rotation.y=Math.PI/2;
    rotor.position.set(0,1.75,-.5);root.add(rotor);
    mesh(rotor,new THREE.CylinderGeometry(.28,.3,.3,16),metal,0,0,0);
    const radome=mesh(rotor,new THREE.SphereGeometry(.65,18,12),dark,0,.75,0);
    radome.scale.set(1.15,.55,1.15);
    const ahBlade=typeof AeroCraft!=='undefined'?AeroCraft.buildTwistedBlade(6.9,.32,.26,.16):new THREE.BoxGeometry(6.8,.04,.22);
    for(let b=0;b<4;b++){
      const arm=new THREE.Group();arm.rotation.y=b*Math.PI/2;rotor.add(arm);
      const bm=new THREE.Mesh(ahBlade,dark);bm.rotation.y=Math.PI/2;arm.add(bm);
    }
    tailRotor.position.set(.25,1.4,7.4);root.add(tailRotor);
    const atrGeo=typeof AeroCraft!=='undefined'?AeroCraft.buildTwistedBlade(1.4,.18,.14,.18):new THREE.BoxGeometry(1.4,.04,.16);
    for(let i=0;i<4;i++){const b=new THREE.Mesh(atrGeo,dark);b.rotation.order='ZYX';b.rotation.z=Math.PI/2;b.rotation.x=i*Math.PI/2;tailRotor.add(b);}
  } else {
    // Default H6 Light Cruise Helicopter (streamlined teardrop MD500/Bell silhouette + curved glass dome + twisted rotor blades)
    if(typeof AeroCraft!=='undefined'){
      mesh(root,AeroCraft.buildFuselageLoft([
        {z:-2.75,rx:.14,ryTop:.12,ryBot:.12,y:-.18,power:2},
        {z:-2.15,rx:.78,ryTop:.56,ryBot:.48,y:-.04,power:2.1},
        {z:-.85,rx:.94,ryTop:.92,ryBot:.84,y:.05,power:2.1},
        {z:.65,rx:.82,ryTop:.84,ryBot:.72,y:.15,power:2},
        {z:1.55,rx:.44,ryTop:.48,ryBot:.38,y:.26,power:2},
        {z:5.45,rx:.16,ryTop:.20,ryBot:.18,y:.38,power:2}
      ],28),paint,0,0,0);
      mesh(root,AeroCraft.buildCanopyGeometry(2.15,1.76,.98,14,22),glass,0,.32,-1.52);
      mesh(root,AeroCraft.buildCanoeGeometry(2.35,.52,.42),blue,0,.98,.35);
      const exhaust=mesh(root,new THREE.CylinderGeometry(.17,.20,.7,18,1,true),metal,.32,1.05,1.28);
      exhaust.rotation.x=Math.PI/2;
      mesh(root,new THREE.CylinderGeometry(.08,.11,.65,12),metal,0,1.44,.05);
      for(const side of [-1,1]){
        const skid=mesh(gear,new THREE.CylinderGeometry(.055,.055,4.6,12),metal,side*.97,-1.27,-.3);
        skid.rotation.x=Math.PI/2;
        const tip=mesh(gear,new THREE.SphereGeometry(.065,10,8),metal,side*.97,-1.18,-2.58);
        tip.scale.set(1,1.6,1.6);
        for(const z of [-1.35,.70]){
          const strut=mesh(gear,new THREE.CylinderGeometry(.045,.045,.68,10),metal,side*.76,-.94,z);
          strut.rotation.z=side*.45;
        }
        mesh(root,AeroCraft.buildWingLoft([
          {x:.12,leadZ:3.55,chord:.60,y:.42,thick:.10,camber:0},
          {x:1.18,leadZ:3.68,chord:.42,y:.46,thick:.09,camber:0}
        ],{slices:14,capTip:true,mirror:side<0}),blue,0,0,0);
      }
      mesh(root,AeroCraft.buildVerticalFoilLoft([
        {y:.26,leadZ:4.65,chord:1.05,thick:.095},
        {y:1.95,leadZ:5.25,chord:.55,thick:.085}
      ],{slices:16,capTip:true}),paint,0,0,0);
    }else{
      const body = mesh(root, new THREE.SphereGeometry(1, 44, 26), paint, 0, 0, -.65);
      body.scale.set(.9, .89, 2.2);
    }
    rotor.position.set(0,1.79,.05);root.add(rotor);
    mesh(rotor,new THREE.SphereGeometry(.17,16,10),metal,0,0,0);
    const hBladeGeo=typeof AeroCraft!=='undefined'?AeroCraft.buildTwistedBlade(4.9,.24,.19,.16):new THREE.BoxGeometry(4.8,.045,.22);
    for(let blade=0;blade<4;blade++){
      const arm=new THREE.Group();arm.rotation.y=blade*Math.PI/2;rotor.add(arm);
      const bm=new THREE.Mesh(hBladeGeo,dark);bm.rotation.y=Math.PI/2;arm.add(bm);
    }
    tailRotor.position.set(.20,.72,5.45);root.add(tailRotor);
    const htrGeo=typeof AeroCraft!=='undefined'?AeroCraft.buildTwistedBlade(1.45,.17,.14,.18):new THREE.BoxGeometry(1.45,.04,.16);
    for(let i=0;i<4;i++){const b=new THREE.Mesh(htrGeo,dark);b.rotation.order='ZYX';b.rotation.z=Math.PI/2;b.rotation.x=i*Math.PI/2;tailRotor.add(b);}
  }

  const navLights = [], strobes = [], beacons = [];
  for(const side of [-1, 1]) navLights.push(mesh(root, new THREE.SphereGeometry(.06, 9, 6), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff5347 : 0x57e9ac }), side * .91, .28, .9));
  const heliStrobe = mesh(root, new THREE.SphereGeometry(.07, 9, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 1.45, -.15);
  const heliBeacon = mesh(root, new THREE.SphereGeometry(.07, 9, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }), 0, -.48, .12);
  const tailLight = mesh(root, new THREE.SphereGeometry(.05, 9, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, .85, 5.65);
  strobes.push(heliStrobe);
  beacons.push(heliBeacon);
  navLights.push(tailLight);

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

  root.userData = { gear, blades: [], surfaces: [], navLights, strobes, beacons, cabin, rotor, tailRotor, updateHelicopter: update };

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
