'use strict';

/**
 * SKYBOUND GLOBAL - Aircraft Carrier Operations (CVN-78 福特號航空母艦起降系統)
 * Catapult Launch (3.5G 蒸氣/電磁彈射) & 4-Wire Arrested Landing (攔截索三線阻攔) & FLOLS 光學助降鏡
 */
const carrierOps = (() => {
  // Carrier Global Positioning: Pacific Ocean offshore Yilan/Hualien
  const carrier = {
    code: 'CVN78',
    name: '福特號航空母艦',
    x: 60245,
    y: 0,
    z: 79710,
    deckElevation: 18.5,
    heading: 0, // Heading North (0 rad) into Pacific wind
    speed: 12,  // 12 m/s (~23 knots) forward cruise
    length: 333,
    width: 78,
    // Angled flight deck offset: -8.9 degrees to port
    angledHeading: -0.155,
    angledLength: 220,
    angledWidth: 28,
    // Catapults on deck (relative along/cross from carrier center)
    catapults: [
      { id: 1, name: '一號艦艏彈射器 (Bow 1)', along: -55, cross: 8, heading: 0, stroke: 90 },
      { id: 2, name: '二號艦艏彈射器 (Bow 2)', along: -50, cross: -6, heading: 0, stroke: 90 },
      { id: 3, name: '三號斜角彈射器 (Waist 3)', along: 15, cross: -16, heading: -0.155, stroke: 85 },
      { id: 4, name: '四號斜角彈射器 (Waist 4)', along: 22, cross: -26, heading: -0.155, stroke: 85 }
    ],
    // 4 Arresting wires across angled deck
    wires: [
      { id: 1, name: '一號索', along: 72, cross: -12, grade: '1-Wire (進場略低)' },
      { id: 2, name: '二號索', along: 59, cross: -14, grade: '2-Wire (良好攔截)' },
      { id: 3, name: '三號索 (Target)', along: 46, cross: -16, grade: 'OK 3-Wire (完美王牌降落！)' },
      { id: 4, name: '四號索', along: 33, cross: -18, grade: '4-Wire (進場略深)' }
    ],
    // FLOLS Optical Landing System (Fresnel Lens) on port catwalk
    flols: { along: 46, cross: -39, y: 19.5, targetGlideSlope: 3.5 * Math.PI / 180 }
  };

  let carrierMesh = null;
  let catapultState = { armed: false, launching: false, timer: 0, catId: 1 };
  let arrestState = { caught: false, wireId: 0, grade: '', cableStretch: 0 };
  let flolsLight = null;

  function getCarrierData() {
    return carrier;
  }

  function getDeckPoint(along, cross, height = carrier.deckElevation) {
    const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
    return {
      x: carrier.x + along * s + cross * c,
      y: height,
      z: carrier.z - along * c + cross * s
    };
  }

  /**
   * Check if a world point (x, z) is physically on the flight deck
   */
  function isOnDeck(x, z) {
    const dx = x - carrier.x, dz = z - carrier.z;
    const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
    const along = dx * s - dz * c;
    const cross = dx * c + dz * s;
    return Math.abs(along) <= carrier.length / 2 + 10 && Math.abs(cross) <= carrier.width / 2 + 5;
  }

  /**
   * Catapult launch check and step simulation
   */
  function stepCatapult(f, dt, onLaunchPill) {
    if (!f || f.aircraft?.helicopter) return;
    const dx = f.x - carrier.x, dz = f.z - carrier.z;
    const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
    const shipAlong = dx * s - dz * c;
    const shipCross = dx * c + dz * s;

    // Check if on carrier deck
    if (!isOnDeck(f.x, f.z)) {
      if (catapultState.launching || catapultState.armed) {
        catapultState.armed = false;
        catapultState.launching = false;
      }
      return;
    }

    // Check catapult shuttle alignment
    if (!catapultState.launching) {
      for (const cat of carrier.catapults) {
        const dAlong = shipAlong - cat.along;
        const dCross = shipCross - cat.cross;
        const distToShuttle = Math.hypot(dAlong, dCross);

        if (distToShuttle < 12 && f.speed < 15 && f.ground) {
          if (!catapultState.armed) {
            catapultState.armed = true;
            catapultState.catId = cat.id;
            catapultState.timer = 0;
            if (onLaunchPill) onLaunchPill(`⚓ 已對準 ${cat.name}！拉緊煞車並將油門推至 100% 進行彈射！`);
          }

          // Full throttle + hold brakes -> trigger launch stroke
          if (catapultState.armed && f.power >= 0.92) {
            catapultState.timer += dt;
            if (catapultState.timer >= 1.2) {
              catapultState.launching = true;
              catapultState.timer = 0;
              f.parkingBrake = false;
              if (onLaunchPill) onLaunchPill(`🚀 彈射出發！3.5G 彈射衝刺！`);
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([80, 40, 150]);
            }
          }
          break;
        }
      }
    }

    // Execute 3.5G Catapult Launch acceleration stroke
    if (catapultState.launching) {
      catapultState.timer += dt;
      const cat = carrier.catapults.find(c => c.id === catapultState.catId) || carrier.catapults[0];
      const catHeading = carrier.heading + cat.heading;

      // 3.6G acceleration = 35.5 m/s^2 forward
      const accel = 35.5;
      f.speed += accel * dt;
      f.heading = catHeading;
      f.vx = Math.sin(catHeading) * f.speed;
      f.vz = -Math.cos(catHeading) * f.speed;
      f.power = 1.0;

      // When reaching deck edge (approx 2.25s or speed >= 80 m/s = ~156 kts)
      if (catapultState.timer >= 2.25 || f.speed >= 80) {
        catapultState.launching = false;
        catapultState.armed = false;
        f.ground = false;
        f.vy = Math.max(f.vy, 4.5); // Positive rate of climb off the deck
        if (onLaunchPill) onLaunchPill(`✈ 成功彈射離艦！空速 ${Math.round(f.speed * 1.944)} 節，爬升中！`);
      }
    }
  }

  /**
   * Arrestor hook and wire trap simulation
   */
  function stepArrestor(f, dt, onTrapGrade) {
    if (!f || f.aircraft?.helicopter) return;

    // Aircraft tailhook state
    f.tailhook = Boolean(f.tailhook);

    // If already trapped, apply heavy cable deceleration until stop
    if (arrestState.caught) {
      // 2.9G deceleration = 28.5 m/s^2
      f.speed = Math.max(0, f.speed - 28.5 * dt);
      f.vx = Math.sin(f.heading) * f.speed;
      f.vz = -Math.cos(f.heading) * f.speed;
      arrestState.cableStretch += f.speed * dt;

      if (f.speed <= 0.5) {
        f.speed = 0;
        f.vx = 0;
        f.vz = 0;
        f.parkingBrake = true;
        arrestState.caught = false;
        if (onTrapGrade) onTrapGrade(`⚓ ${arrestState.grade} · 停機滑行，歡迎登艦！`);
      }
      return;
    }

    // Check touchdown in carrier wire arrestor zone
    if (isOnDeck(f.x, f.z) && f.y <= carrier.deckElevation + 1.2) {
      const dx = f.x - carrier.x, dz = f.z - carrier.z;
      const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
      const shipAlong = dx * s - dz * c;
      const shipCross = dx * c + dz * s;

      // Angled runway strip boundaries
      const inLandingStrip = shipCross >= -32 && shipCross <= 8;

      if (inLandingStrip && f.speed >= 25 && f.speed <= 95) {
        if (f.tailhook) {
          // Find closest wire
          let caughtWire = null;
          let minDiff = Infinity;
          for (const wire of carrier.wires) {
            const diff = Math.abs(shipAlong - wire.along);
            if (diff < minDiff) {
              minDiff = diff;
              caughtWire = wire;
            }
          }

          if (caughtWire && minDiff < 10) {
            arrestState.caught = true;
            arrestState.wireId = caughtWire.id;
            arrestState.grade = caughtWire.grade;
            arrestState.cableStretch = 0;
            f.ground = true;
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 150]);
            if (onTrapGrade) onTrapGrade(`🪝 抓到 ${caughtWire.name}！${caughtWire.grade}`);
            return;
          }
        }

        // If tailhook not down or missed all wires while on carrier deck
        if (shipAlong > 85 && !arrestState.caught && f.speed > 35) {
          if (onTrapGrade) onTrapGrade(`⚠️ BOLTER! 觸艦復飛！立即開全油門拉起！`);
        }
      }
    }
  }

  /**
   * FLOLS Glide slope calculation for optical Meatball indicator
   */
  function calculateFLOLS(f) {
    if (!f) return null;
    const dx = f.x - carrier.x, dz = f.z - carrier.z;
    const s = Math.sin(carrier.heading), c = Math.cos(carrier.heading);
    const shipAlong = dx * s - dz * c;
    const shipCross = dx * c + dz * s;

    // Approach distance behind carrier
    const distanceBehind = Math.abs(shipAlong - carrier.wires[2].along);
    if (distanceBehind <= 50 || distanceBehind > 8000) return null;

    const altAboveDeck = f.y - carrier.deckElevation;
    const currentSlope = Math.atan2(altAboveDeck, distanceBehind);
    const targetSlope = carrier.flols.targetGlideSlope; // 3.5 deg
    const slopeDiff = (currentSlope - targetSlope) * (180 / Math.PI); // deg

    // -1 (very low) to +1 (very high), 0 (centered meatball)
    const ballPos = Math.max(-1.5, Math.min(1.5, slopeDiff / 0.8));
    const isWaveOff = ballPos < -1.0 || slopeDiff < -1.2;

    return {
      ballPos,
      isWaveOff,
      distanceKm: distanceBehind / 1000,
      altM: altAboveDeck
    };
  }

  /**
   * Build realistic Three.js 3D Carrier Model
   */
  function buildCarrier3D(scene) {
    if (carrierMesh && carrierMesh.parent) {
      carrierMesh.parent.remove(carrierMesh);
    }
    if (typeof THREE === 'undefined') return null;

    const root = new THREE.Group();
    root.name = 'USS_Gerald_R_Ford_CVN78';
    root.position.set(carrier.x, carrier.y, carrier.z);
    root.rotation.y = -carrier.heading;

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x48515c, roughness: 0.72, metalness: 0.35 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x1f242a, roughness: 0.88, metalness: 0.15 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f7fa });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfac832 });
    const redMat = new THREE.MeshBasicMaterial({ color: 0xcc292b });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x5a636e, roughness: 0.65, metalness: 0.45 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.85 });

    // 1. Ship Hull
    const hullGeo = new THREE.BoxGeometry(carrier.width - 12, carrier.deckElevation, carrier.length - 20);
    const hullMesh = new THREE.Mesh(hullGeo, steelMat);
    hullMesh.position.set(0, carrier.deckElevation / 2, 0);
    root.add(hullMesh);

    // 2. Bulbous Bow
    const bowGeo = new THREE.ConeGeometry(18, 52, 6);
    const bowMesh = new THREE.Mesh(bowGeo, steelMat);
    bowMesh.rotation.x = Math.PI / 2;
    bowMesh.position.set(0, carrier.deckElevation * 0.4, -carrier.length / 2 + 10);
    root.add(bowMesh);

    // 3. Flight Deck Platform
    const deckGeo = new THREE.BoxGeometry(carrier.width, 1.8, carrier.length);
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.set(0, carrier.deckElevation, 0);
    root.add(deckMesh);

    // 4. Angled Deck Strip (Painted lines)
    const stripGeo = new THREE.PlaneGeometry(carrier.angledWidth, carrier.angledLength);
    const stripMesh = new THREE.Mesh(stripGeo, deckMat);
    stripMesh.rotation.x = -Math.PI / 2;
    stripMesh.rotation.z = -carrier.angledHeading;
    stripMesh.position.set(-10, carrier.deckElevation + 0.92, 10);
    root.add(stripMesh);

    // Dashed Centerline for Angled Runway
    for (let z = -80; z <= 80; z += 16) {
      const dashGeo = new THREE.PlaneGeometry(1.2, 8);
      const dashMesh = new THREE.Mesh(dashGeo, lineMat);
      dashMesh.rotation.x = -Math.PI / 2;
      dashMesh.rotation.z = -carrier.angledHeading;
      const cz = z * Math.cos(-carrier.angledHeading);
      const cx = -10 + z * Math.sin(-carrier.angledHeading);
      dashMesh.position.set(cx, carrier.deckElevation + 0.95, cz + 10);
      root.add(dashMesh);
    }

    // 5. 4 Arresting Wire Cables
    for (const wire of carrier.wires) {
      const cableGeo = new THREE.CylinderGeometry(0.12, 0.12, carrier.angledWidth + 4, 6);
      const cableMesh = new THREE.Mesh(cableGeo, cableMat);
      cableMesh.rotation.z = Math.PI / 2;
      cableMesh.rotation.y = -carrier.angledHeading;
      cableMesh.position.set(wire.cross, carrier.deckElevation + 1.05, wire.along);
      root.add(cableMesh);
    }

    // 6. Island Superstructure (Tower on starboard side)
    const islandGroup = new THREE.Group();
    islandGroup.position.set(26, carrier.deckElevation + 12, 28);
    const islandBody = new THREE.Mesh(new THREE.BoxGeometry(10, 22, 28), towerMat);
    islandGroup.add(islandBody);
    // Mast & Radome
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 16, 6), steelMat);
    mast.position.set(0, 19, 0);
    islandGroup.add(mast);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), lineMat);
    dome.position.set(0, 27, 0);
    islandGroup.add(dome);
    // Bridge windows
    const winGeo = new THREE.BoxGeometry(8.5, 2.2, 28.2);
    const winMat = new THREE.MeshBasicMaterial({ color: 0x5bc0eb });
    const winMesh = new THREE.Mesh(winGeo, winMat);
    winMesh.position.set(0, 7.5, 0);
    islandGroup.add(winMesh);
    root.add(islandGroup);

    // 7. FLOLS Optical Light Assembly (Port catwalk)
    const flolsGroup = new THREE.Group();
    flolsGroup.position.set(carrier.flols.cross, carrier.flols.y, carrier.flols.along);
    const flolsBox = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 3), steelMat);
    flolsGroup.add(flolsBox);
    // Green Datum Bar Lights
    const datumGeo = new THREE.BoxGeometry(3.6, 0.3, 0.4);
    const datumMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const datumMesh = new THREE.Mesh(datumGeo, datumMat);
    datumMesh.position.set(0, 0, 1.6);
    flolsGroup.add(datumMesh);
    // Amber Meatball Light
    const meatballMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const meatballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), meatballMat);
    meatballMesh.position.set(0, 0, 1.6);
    flolsGroup.add(meatballMesh);
    flolsLight = meatballMesh;
    root.add(flolsGroup);

    // 8. Ocean Wake Foam Trails
    const wakeGeo = new THREE.PlaneGeometry(carrier.width * 1.5, 320);
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0xecf8ff,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    });
    const wakeMesh = new THREE.Mesh(wakeGeo, wakeMat);
    wakeMesh.rotation.x = -Math.PI / 2;
    wakeMesh.position.set(0, 0.2, carrier.length / 2 + 150);
    root.add(wakeMesh);

    scene.add(root);
    carrierMesh = root;
    return root;
  }

  function getCatapultState() {
    return { ...catapultState };
  }

  function getArrestState() {
    return { ...arrestState };
  }

  return {
    getCarrierData,
    getDeckPoint,
    isOnDeck,
    stepCatapult,
    stepArrestor,
    calculateFLOLS,
    buildCarrier3D,
    getCatapultState,
    getArrestState
  };
})();

if (typeof module !== 'undefined') module.exports = carrierOps;
