(function(root){
'use strict';

/**
 * SKYBOUND GLOBAL - Aerial Refueling Operations (KC-135 空中加油編隊對接系統)
 * Flying Boom & Receptacle Refueling, Pilot Director Lights (PDI: FORE/AFT, UP/DOWN),
 * Contact Envelope Mechanics & High-Pressure Fuel Transfer
 */
const airRefueling = (() => {
  // Tanker Racetrack Orbit in Central Taiwan Airspace
  const tanker = {
    callsign: 'TEXACO-21',
    code: 'KC135',
    name: 'KC-135 空中加油機',
    // Racetrack orbit configuration
    orbitLeg: 22000,   // 22km straight leg
    orbitTurnRadius: 4000, // 4km turn radius
    altitude: 6400,    // FL210 (6,400m, ~21,000 ft)
    speed: 125,        // 125 m/s (~243 kt IAS)
    heading: 0,        // 0 rad (North)
    x: -38000,
    y: 6400,
    z: 22000,
    turnProgress: 0,
    legProgress: 0,
    orbitPhase: 'northLeg', // northLeg -> turnEast -> southLeg -> turnWest
    // Flying Boom Geometry relative to tanker center:
    // extends 18.5m aft, 6.8m down
    boomOffset: { along: 18.5, cross: 0, down: 6.8 },
    // Contact Envelope
    envelope: {
      alongTolerance: 3.2, // ±3.2m fore/aft
      crossTolerance: 2.4, // ±2.4m lateral
      vertTolerance: 1.8,  // ±1.8m vertical
      maxClosureSpeed: 3.2 // m/s (~6.2 kt max closure)
    },
    transferRate: 22.0 // kg/sec (~1,320 kg/min)
  };

  const state = {
    active: true,
    connected: false,
    connectDuration: 0,
    fuelDelivered: 0,
    totalFuelCapacity: 12000,
    guidance: {
      alongErr: 999, // > 0 behind boom tip, < 0 ahead
      crossErr: 0,   // > 0 right of boom tip, < 0 left
      vertErr: 0,    // > 0 below boom tip, < 0 above
      range: 999,
      closureRate: 0,
      inEnvelope: false
    },
    lights: {
      ready: true,
      contact: false,
      disconnect: false,
      fore: false, // need to fly forward
      aft: false,  // need to fly aft
      up: false,   // need to fly up
      down: false  // need to fly down
    },
    mesh: null,
    boomMesh: null,
    pdiLights: null
  };

  // Step Tanker Flight along Racetrack Orbit
  function stepTanker(dt){
    const spd = tanker.speed;
    const dist = spd * dt;

    if(tanker.orbitPhase === 'northLeg'){
      tanker.heading = 0; // heading North
      tanker.z -= dist;
      tanker.legProgress += dist;
      if(tanker.legProgress >= tanker.orbitLeg){
        tanker.orbitPhase = 'turnEast';
        tanker.legProgress = 0;
        tanker.turnProgress = 0;
      }
    } else if(tanker.orbitPhase === 'turnEast'){
      // Turn right (heading 0 to PI)
      const turnRate = spd / tanker.orbitTurnRadius;
      tanker.heading += turnRate * dt;
      tanker.x += Math.cos(tanker.heading - Math.PI / 2) * dist;
      tanker.z -= Math.sin(tanker.heading - Math.PI / 2) * dist;
      tanker.turnProgress += turnRate * dt;
      if(tanker.turnProgress >= Math.PI){
        tanker.heading = Math.PI;
        tanker.orbitPhase = 'southLeg';
        tanker.turnProgress = 0;
      }
    } else if(tanker.orbitPhase === 'southLeg'){
      tanker.heading = Math.PI; // heading South
      tanker.z += dist;
      tanker.legProgress += dist;
      if(tanker.legProgress >= tanker.orbitLeg){
        tanker.orbitPhase = 'turnWest';
        tanker.legProgress = 0;
        tanker.turnProgress = 0;
      }
    } else if(tanker.orbitPhase === 'turnWest'){
      // Turn right (heading PI to 2PI)
      const turnRate = spd / tanker.orbitTurnRadius;
      tanker.heading += turnRate * dt;
      if(tanker.heading >= Math.PI * 2) tanker.heading -= Math.PI * 2;
      tanker.x += Math.cos(tanker.heading - Math.PI / 2) * dist;
      tanker.z -= Math.sin(tanker.heading - Math.PI / 2) * dist;
      tanker.turnProgress += turnRate * dt;
      if(tanker.turnProgress >= Math.PI){
        tanker.heading = 0;
        tanker.orbitPhase = 'northLeg';
        tanker.turnProgress = 0;
      }
    }

    // Update 3D mesh position & orientation if rendered
    if(state.mesh){
      state.mesh.position.set(tanker.x, tanker.y, tanker.z);
      state.mesh.rotation.set(0, -tanker.heading, 0, 'YXZ');
    }
  }

  // Get World Coordinate of Boom Tip
  function getBoomTipWorld(){
    const sinH = Math.sin(tanker.heading);
    const cosH = Math.cos(tanker.heading);
    // boom extends aft along tanker heading
    const tipX = tanker.x - sinH * tanker.boomOffset.along;
    const tipZ = tanker.z + cosH * tanker.boomOffset.along;
    const tipY = tanker.y - tanker.boomOffset.down;
    return { x: tipX, y: tipY, z: tipZ };
  }

  // Calculate Relative Guidance between receiver aircraft and boom tip
  function calculateGuidance(receiver){
    if(!receiver) return state.guidance;
    const tip = getBoomTipWorld();

    // World relative vector
    const dx = receiver.x - tip.x;
    const dy = receiver.y - tip.y;
    const dz = receiver.z - tip.z;

    // Transform into tanker reference frame:
    // Along (tanker longitudinal axis: positive behind boom, negative ahead)
    const sinH = Math.sin(tanker.heading);
    const cosH = Math.cos(tanker.heading);
    const alongErr = -(dx * sinH - dz * cosH);
    const crossErr = dx * cosH + dz * sinH;
    const vertErr = -dy; // positive below boom tip, negative above

    const range = Math.hypot(dx, dy, dz);

    // Relative speed (closure rate: positive means closing in towards boom)
    const receiverSpd = receiver.speed || Math.hypot(receiver.vx || 0, receiver.vz || 0);
    const closureRate = receiverSpd - tanker.speed;

    const env = tanker.envelope;
    const inEnvelope = Math.abs(alongErr) <= env.alongTolerance &&
                       Math.abs(crossErr) <= env.crossTolerance &&
                       Math.abs(vertErr) <= env.vertTolerance &&
                       closureRate < env.maxClosureSpeed;

    state.guidance = {
      alongErr: Math.round(alongErr * 10) / 10,
      crossErr: Math.round(crossErr * 10) / 10,
      vertErr: Math.round(vertErr * 10) / 10,
      range: Math.round(range * 10) / 10,
      closureRate: Math.round(closureRate * 10) / 10,
      inEnvelope
    };

    // Update Director Lights (PDI)
    state.lights.ready = !state.connected && range < 80;
    state.lights.fore = alongErr > 0.8;
    state.lights.aft = alongErr < -0.8;
    state.lights.up = vertErr > 0.6;
    state.lights.down = vertErr < -0.6;

    return state.guidance;
  }

  // Step Aerial Refueling Logic & Fuel Transfer
  function stepRefueling(receiver, dt, showPill){
    if(!receiver) return;
    stepTanker(dt);
    const guide = calculateGuidance(receiver);

    if(!state.connected){
      // Check latch condition
      if(guide.inEnvelope && receiver.speed > 50){
        state.connected = true;
        state.lights.contact = true;
        state.lights.ready = false;
        state.lights.disconnect = false;
        if(typeof showPill === 'function'){
          showPill('⛽ AAR CONTACT! 加油椼已鎖定對接 · 高壓燃油傳輸中！');
        }
      }
    } else {
      // Already connected
      state.connectDuration += dt;
      // Transfer fuel
      const maxFuel = receiver.fuelCapacity || receiver.fuelStart || 8500;
      if(receiver.fuel < maxFuel){
        const flow = Math.min(tanker.transferRate * dt, maxFuel - receiver.fuel);
        receiver.fuel += flow;
        state.fuelDelivered += flow;
      }

      // Check disconnect boundary (exceeding envelope by 40% margin)
      const env = tanker.envelope;
      const breakout = Math.abs(guide.alongErr) > env.alongTolerance * 1.45 ||
                       Math.abs(guide.crossErr) > env.crossTolerance * 1.5 ||
                       Math.abs(guide.vertErr) > env.vertTolerance * 1.5;

      if(breakout){
        state.connected = false;
        state.lights.contact = false;
        state.lights.disconnect = true;
        state.lights.ready = true;
        if(typeof showPill === 'function'){
          showPill('🚨 AAR DISCONNECT! 脫離安全加油信封 · 自動斷開！');
        }
      }
    }
  }

  // Build Three.js 3D Model for KC-135 Stratotanker
  function buildTanker3D(THREE, scene){
    if(!THREE || !scene) return null;
    const tankerGroup = new THREE.Group();

    // Fuselage Material (Air Force ghost grey)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x98aab8,
      roughness: 0.38,
      metalness: 0.15
    });
    // Dark trim material
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x2d3a45,
      roughness: 0.45
    });
    // PDI Director light materials
    const pdiGreen = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const pdiAmber = new THREE.MeshBasicMaterial({ color: 0xffbb00 });
    const pdiRed = new THREE.MeshBasicMaterial({ color: 0xff3333 });

    // Main Fuselage (cylinder 41m long, radius 2.1m)
    const fuseGeo = new THREE.CylinderGeometry(2.0, 2.1, 41, 16);
    fuseGeo.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuseGeo, bodyMat);
    tankerGroup.add(fuselage);

    // Nose Cone
    const noseGeo = new THREE.ConeGeometry(2.0, 6.5, 16);
    noseGeo.rotateX(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0, -23.7);
    tankerGroup.add(nose);

    // Cockpit Glazing
    const glassGeo = new THREE.BoxGeometry(2.4, 1.2, 3.2);
    const glass = new THREE.Mesh(glassGeo, trimMat);
    glass.position.set(0, 1.3, -20.5);
    tankerGroup.add(glass);

    // Main Wings (39.8m span, swept 35 deg)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -4.5);
    wingShape.lineTo(19.9, 8.5);
    wingShape.lineTo(19.9, 11.2);
    wingShape.lineTo(0, 3.8);
    wingShape.closePath();
    const wingExt = new THREE.ExtrudeGeometry(wingShape, { depth: 0.55, bevelEnabled: false });
    wingExt.rotateX(Math.PI / 2);
    const rightWing = new THREE.Mesh(wingExt, bodyMat);
    rightWing.position.set(0, -0.2, 0);
    tankerGroup.add(rightWing);

    const leftWingShape = new THREE.Shape();
    leftWingShape.moveTo(0, -4.5);
    leftWingShape.lineTo(-19.9, 8.5);
    leftWingShape.lineTo(-19.9, 11.2);
    leftWingShape.lineTo(0, 3.8);
    leftWingShape.closePath();
    const leftWingExt = new THREE.ExtrudeGeometry(leftWingShape, { depth: 0.55, bevelEnabled: false });
    leftWingExt.rotateX(Math.PI / 2);
    const leftWing = new THREE.Mesh(leftWingExt, bodyMat);
    leftWing.position.set(0, -0.2, 0);
    tankerGroup.add(leftWing);

    // 4 Turbofan Engines (CFM56)
    const engineGeo = new THREE.CylinderGeometry(0.95, 0.9, 5.2, 12);
    engineGeo.rotateX(Math.PI / 2);
    const enginePositions = [
      { x: -6.8, y: -1.4, z: 2.2 },
      { x: -12.8, y: -1.2, z: 5.5 },
      { x: 6.8, y: -1.4, z: 2.2 },
      { x: 12.8, y: -1.2, z: 5.5 }
    ];
    for(const pos of enginePositions){
      const eng = new THREE.Mesh(engineGeo, trimMat);
      eng.position.set(pos.x, pos.y, pos.z);
      tankerGroup.add(eng);
    }

    // Vertical Stabilizer (Tail Fin)
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(4.8, 0);
    finShape.lineTo(2.2, 8.2);
    finShape.lineTo(0.5, 8.2);
    finShape.closePath();
    const finExt = new THREE.ExtrudeGeometry(finShape, { depth: 0.4, bevelEnabled: false });
    finExt.rotateY(Math.PI / 2);
    const fin = new THREE.Mesh(finExt, bodyMat);
    fin.position.set(0.2, 1.8, 14.5);
    tankerGroup.add(fin);

    // Horizontal Tailplanes
    const hTailShape = new THREE.Shape();
    hTailShape.moveTo(-7.5, 0);
    hTailShape.lineTo(7.5, 0);
    hTailShape.lineTo(5.8, 2.8);
    hTailShape.lineTo(-5.8, 2.8);
    hTailShape.closePath();
    const hTailExt = new THREE.ExtrudeGeometry(hTailShape, { depth: 0.35, bevelEnabled: false });
    hTailExt.rotateX(Math.PI / 2);
    const hTail = new THREE.Mesh(hTailExt, bodyMat);
    hTail.position.set(0, 8.8, 16.2);
    tankerGroup.add(hTail);

    // Flying Boom (Articulated fuel boom extending aft-downward)
    const boomGroup = new THREE.Group();
    const boomGeo = new THREE.CylinderGeometry(0.22, 0.28, 16.5, 8);
    boomGeo.rotateX(Math.PI / 2);
    const boomPipe = new THREE.Mesh(boomGeo, trimMat);
    boomPipe.position.set(0, 0, 8.2);
    boomGroup.add(boomPipe);

    // Boom Ruddervators (v-tail wings on the boom)
    const rudShape = new THREE.Shape();
    rudShape.moveTo(-1.6, 0);
    rudShape.lineTo(1.6, 0);
    rudShape.lineTo(1.2, 0.8);
    rudShape.lineTo(-1.2, 0.8);
    rudShape.closePath();
    const rudGeo = new THREE.ExtrudeGeometry(rudShape, { depth: 0.12, bevelEnabled: false });
    rudGeo.rotateX(Math.PI / 2);
    const ruddervator = new THREE.Mesh(rudGeo, pdiAmber);
    ruddervator.position.set(0, 0.2, 12.5);
    boomGroup.add(ruddervator);

    // Position boom at tail pod angled downward 28 degrees
    boomGroup.position.set(0, -1.8, 19.5);
    boomGroup.rotation.x = -0.48; // ~28 deg downward
    tankerGroup.add(boomGroup);
    state.boomMesh = boomGroup;

    // Pilot Director Lights (PDI Strip on forward belly)
    const pdiGroup = new THREE.Group();
    const pdiBox = new THREE.BoxGeometry(0.3, 0.1, 4.2);
    const pdiMesh = new THREE.Mesh(pdiBox, pdiGreen);
    pdiMesh.position.set(0, -2.15, -4.5);
    pdiGroup.add(pdiMesh);
    tankerGroup.add(pdiGroup);
    state.pdiLights = pdiGroup;

    tankerGroup.position.set(tanker.x, tanker.y, tanker.z);
    scene.add(tankerGroup);
    state.mesh = tankerGroup;

    return tankerGroup;
  }

  return {
    tanker,
    state,
    stepTanker,
    getBoomTipWorld,
    calculateGuidance,
    stepRefueling,
    buildTanker3D
  };
})();

if(typeof root !== 'undefined') root.airRefueling = airRefueling;
if(typeof window !== 'undefined') window.airRefueling = airRefueling;
if(typeof global !== 'undefined') global.airRefueling = airRefueling;
if(typeof module !== 'undefined' && module.exports) module.exports = airRefueling;
})(typeof window !== 'undefined' ? window : global);
