'use strict';

/**
 * SKYBOUND GLOBAL - Cockpit Enhancements System (v0.45)
 * Next-Gen PBR Instrument Bezels, Warning Placards, Windshield Micro-Scratch Glare,
 * and Dynamic Night Flight Backlight.
 */
const cockpitEnhancements = (() => {
  const cache = new Map();

  function createOffscreenCanvas(w, h) {
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    return {
      width: w,
      height: h,
      getContext: () => ({
        fillRect: () => {},
        clearRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        strokeRect: () => {},
        fillText: () => {},
        closePath: () => {},
        bezierCurveTo: () => {},
        roundRect: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createLinearGradient: () => ({ addColorStop: () => {} })
      })
    };
  }

  // 1. Procedural Windshield Micro-Scratch & Solar Glare Texture
  function getWindshieldGlareTexture(THREE) {
    const key = 'windshield_glare';
    if (cache.has(key)) return cache.get(key);

    const size = 1024;
    const canvas = createOffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    // Subtle polarized anti-reflective aerospace glass gradient (cyan-amber hue)
    const baseGrad = ctx.createLinearGradient(0, 0, size, size);
    baseGrad.addColorStop(0, 'rgba(80, 180, 220, 0.05)');
    baseGrad.addColorStop(0.5, 'rgba(30, 45, 60, 0.03)');
    baseGrad.addColorStop(1, 'rgba(230, 190, 120, 0.04)');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, size, size);

    // Realistic Wiper Arc Scratches (micro-grooves from sand / wipers)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.0;
    const pivots = [{ x: size * 0.35, y: size * 1.1 }, { x: size * 0.65, y: size * 1.1 }];
    pivots.forEach((p) => {
      for (let r = size * 0.45; r <= size * 0.95; r += 18) {
        ctx.beginPath();
        const start = -Math.PI * 0.88 + (Math.random() - 0.5) * 0.1;
        const end = -Math.PI * 0.12 + (Math.random() - 0.5) * 0.1;
        ctx.arc(p.x, p.y, r, start, end);
        ctx.stroke();
      }
    });

    // Random micro-scratches & dust specks
    ctx.strokeStyle = 'rgba(240, 250, 255, 0.06)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 450; i++) {
      const sx = (i * 193.7) % size;
      const sy = (i * 97.3) % size;
      const len = 4 + (i % 9);
      const angle = (i * 0.73) % (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
      ctx.stroke();
    }

    let tex = null;
    if (THREE && THREE.CanvasTexture) {
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    cache.set(key, tex);
    return tex;
  }

  // 2. Cockpit Warning Placards & Checklist Decals
  function getPlacardTexture(THREE, isFighter = false) {
    const key = `placard_${isFighter}`;
    if (cache.has(key)) return cache.get(key);

    const w = 512, h = 512;
    const canvas = createOffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, w, h);

    if (isFighter) {
      // Tactical Fighter Placards (Ejection Seat warning, Vmo limits, Armament)
      // 1. Ejection Warning Red Plaque
      ctx.fillStyle = '#b71c1c';
      ctx.fillRect(10, 10, 240, 70);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText('⚠ DANGER', 24, 34);
      ctx.font = '11px sans-serif';
      ctx.fillText('EJECTION SEAT SYSTEM ARMED', 24, 52);
      ctx.fillText('KEEP CLEAR OF CANOPY JETTISON', 24, 68);

      // 2. Airspeed Limit Plaque
      ctx.fillStyle = '#1e282d';
      ctx.fillRect(10, 95, 240, 90);
      ctx.strokeStyle = '#5a707a';
      ctx.strokeRect(10, 95, 240, 90);
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('MAX OPERATING LIMITS', 20, 118);
      ctx.fillStyle = '#cfd8dc';
      ctx.font = '11px monospace';
      ctx.fillText('Vmo: 450 KIAS / Mmo: 2.05', 20, 138);
      ctx.fillText('GEAR EXTEND: 250 KIAS MAX', 20, 156);
      ctx.fillText('FLAPS FULL: 220 KIAS MAX', 20, 172);

      // 3. Yellow/Black Emergency Pull Handle Stencil
      const stripeY = 200;
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ffeb3b' : '#212121';
        ctx.beginPath();
        ctx.moveTo(10 + i * 15, stripeY);
        ctx.lineTo(25 + i * 15, stripeY);
        ctx.lineTo(15 + i * 15, stripeY + 25);
        ctx.lineTo(0 + i * 15, stripeY + 25);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('PULL TO JETTISON', 65, stripeY + 18);

      // 4. Circuit Breakers Matrix
      ctx.fillStyle = '#10171a';
      ctx.fillRect(270, 10, 230, 215);
      ctx.strokeStyle = '#324249';
      ctx.strokeRect(270, 10, 230, 215);
      ctx.fillStyle = '#78909c';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('CIRCUIT BREAKERS', 320, 28);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
          const bx = 285 + col * 36;
          const by = 42 + row * 28;
          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#263238';
          ctx.fill();
          ctx.strokeStyle = '#90a4ae';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      }
    } else {
      // Commercial Airliner Placards (Speeds, Oxygen, APU, Seatbelts)
      ctx.fillStyle = '#1c2833';
      ctx.fillRect(10, 10, 240, 110);
      ctx.strokeStyle = '#5d6d7e';
      ctx.strokeRect(10, 10, 240, 110);
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('OPERATING LIMITATIONS', 22, 32);
      ctx.fillStyle = '#ecf0f1';
      ctx.font = '11px monospace';
      ctx.fillText('Vmo: 350 KIAS / Mmo: 0.82', 22, 54);
      ctx.fillText('Vle / Vlo: 250 KIAS MAX', 22, 72);
      ctx.fillText('Vfe FLAPS 1: 230 / FULL: 177', 22, 90);
      ctx.fillText('MAX ALTITUDE: 41,000 FT', 22, 108);

      // APU & Oxygen Panel
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(10, 135, 240, 90);
      ctx.strokeStyle = '#7f8c8d';
      ctx.strokeRect(10, 135, 240, 90);
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('CREW OXYGEN: 1,850 PSI - NORM', 22, 160);
      ctx.fillStyle = '#3498db';
      ctx.fillText('APU GEN: AVAIL · 115V / 400Hz', 22, 185);
      ctx.fillStyle = '#e74c3c';
      ctx.fillText('SMOKING PROHIBITED IN CABIN', 22, 210);

      // Overhead Circuit Breaker Panel
      ctx.fillStyle = '#17202a';
      ctx.fillRect(270, 10, 230, 215);
      ctx.strokeStyle = '#34495e';
      ctx.strokeRect(270, 10, 230, 215);
      ctx.fillStyle = '#bdc3c7';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('OVERHEAD PNL C/B', 320, 28);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
          const bx = 285 + col * 36;
          const by = 42 + row * 28;
          ctx.beginPath();
          ctx.arc(bx, by, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = '#212f3d';
          ctx.fill();
          ctx.strokeStyle = '#abb2b9';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ecf0f1';
          ctx.fill();
        }
      }
    }

    let tex = null;
    if (THREE && THREE.CanvasTexture) {
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    cache.set(key, tex);
    return tex;
  }

  // 3. Enhance Aircraft Cockpit
  function enhanceCockpit(model, profile, THREE) {
    if (!model || !profile || !THREE) return;
    if (model.userData?.cockpitEnhanced) return;

    const data = model.userData;
    const cabin = data.cabin;
    if (!cabin) return;

    const isFighter = profile.role === 'fighter';
    const isPassenger = profile.role === 'passenger' || profile.role === 'cargo';
    const half = profile.geometry ? profile.geometry[0] : 10;
    const radius = profile.geometry ? profile.geometry[1] : 1.5;

    const cockpitGroup = new THREE.Group();
    cockpitGroup.name = 'Cockpit_Enhancements';

    // A. Windshield Micro-Scratch & Solar Glare Layer
    const glareTex = getWindshieldGlareTexture(THREE);
    if (glareTex) {
      const gW = Math.min(isFighter ? 1.25 : 3.1, Math.max(.70, radius * 1.22));
      const gH = Math.min(isFighter ? .95 : 1.72, Math.max(.55, radius * .92));
      const glareGeo = new THREE.PlaneGeometry(gW, gH);
      const glareMat = new THREE.MeshPhysicalMaterial({
        map: glareTex,
        transparent: true,
        opacity: 0.18,
        roughness: 0.15,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const glareMesh = new THREE.Mesh(glareGeo, glareMat);
      glareMesh.name = 'Windshield_Glare';

      if (isFighter) {
        const eyeZ = -half * (profile.sideIntakes ? 0.40 : 0.37);
        const eyeY = radius * 0.72 + 0.12;
        glareMesh.position.set(0, eyeY + 0.04, eyeZ - 0.65);
        glareMesh.rotation.x = -0.22;
      } else if (profile.helicopter) {
        glareMesh.position.set(0, .52, -1.75);
        glareMesh.rotation.x = -0.28;
      } else if (!profile.role) {
        glareMesh.position.set(0, radius * .72, -half * .42);
        glareMesh.rotation.x = -0.26;
      } else {
        const cockpitZ = -half * 0.56;
        const cockpitY = radius * 0.17;
        glareMesh.position.set(0, cockpitY + Math.min(0.85, radius * 0.45), cockpitZ - 1.22);
        glareMesh.rotation.x = -0.24;
      }
      cockpitGroup.add(glareMesh);
      data.windshieldGlare = glareMesh;
    }

    // B. Warning Placards Decals on Pedestal & Glare Shield
    const placardTex = getPlacardTexture(THREE, isFighter);
    if (placardTex) {
      const pSize = Math.min(isFighter ? 0.36 : 0.58, Math.max(0.24, radius * 0.36));
      const pGeo = new THREE.PlaneGeometry(pSize, pSize);
      const pMat = new THREE.MeshBasicMaterial({
        map: placardTex,
        transparent: true,
        depthWrite: false
      });

      const placardMesh = new THREE.Mesh(pGeo, pMat);
      placardMesh.name = 'Cockpit_Placards';

      if (isFighter) {
        const eyeZ = -half * (profile.sideIntakes ? 0.40 : 0.37);
        const eyeY = radius * 0.72 + 0.12;
        placardMesh.position.set(Math.min(0.42, radius * 0.36), eyeY - 0.38, eyeZ - 0.55);
        placardMesh.rotation.set(-0.25, -0.18, 0);
      } else if (profile.helicopter) {
        placardMesh.position.set(0, -.12, -1.85);
        placardMesh.rotation.x = -Math.PI / 2 + 0.35;
      } else if (!profile.role) {
        placardMesh.position.set(0, radius * .50, -half * .38);
        placardMesh.rotation.x = -Math.PI / 2 + 0.35;
      } else {
        const cockpitZ = -half * 0.56;
        const cockpitY = radius * 0.17;
        placardMesh.position.set(0, cockpitY - 0.38, cockpitZ - 0.45);
        placardMesh.rotation.x = -Math.PI / 2 + 0.3;
      }
      cockpitGroup.add(placardMesh);
    }

    // C. Night Backlight Emissive Dials
    const dials = [];
    cabin.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
            // Metallic bezels for gauges
            if (m.color && m.color.getHex() === 0x667886) {
              m.metalness = 0.85;
              m.roughness = 0.22;
              m.needsUpdate = true;
            }
            if (m.emissive !== undefined) {
              dials.push(m);
            }
          }
        });
      }
    });

    cabin.add(cockpitGroup);
    if (!data) model.userData = {};
    data.cockpitEnhanced = true;
    data.cockpitGroup = cockpitGroup;
    data.backlightDials = dials;
  }

  // 4. Update Dynamic Cockpit Lighting (Day/Night transition)
  function updateCockpitLighting(model, sunIntensity, timeOfDay) {
    if (!model || !model.userData?.cockpitEnhanced) return;
    const data = model.userData;

    // Windshield glare shines bright when facing sun
    if (data.windshieldGlare && data.windshieldGlare.material) {
      const glareFactor = Math.min(1.0, Math.max(0.08, sunIntensity * 0.35));
      data.windshieldGlare.material.opacity = 0.12 + glareFactor * 0.18;
    }

    // Dial Backlight glows amber/emerald at dusk & night
    const isDark = sunIntensity < 0.65;
    const glowIntensity = isDark ? (0.65 - sunIntensity) * 1.4 : 0;
    if (data.backlightDials && data.backlightDials.length > 0) {
      data.backlightDials.forEach((m) => {
        m.emissiveIntensity = glowIntensity;
      });
    }
  }

  return {
    getWindshieldGlareTexture,
    getPlacardTexture,
    enhanceCockpit,
    updateCockpitLighting
  };
})();

if (typeof module !== 'undefined') module.exports = cockpitEnhancements;
