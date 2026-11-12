'use strict';

/**
 * SKYBOUND GLOBAL - Aircraft Skins & Procedural Livery System (v0.44)
 * Generates ultra-crisp aerodynamic panel lines, rivet arrays, military roundels,
 * airline cheatlines, and PBR aerospace metallic surfaces.
 */
const aircraftSkins = (() => {
  const textureCache = new Map();

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
        createLinearGradient: () => ({ addColorStop: () => {} })
      })
    };
  }

  // 1. Procedural Aerodynamic Panel Lines & Rivet Matrix (Bump & Specular)
  function getPanelBumpTexture(THREE, isFighter = false) {
    const key = `bump_${isFighter}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const size = 1024;
    const canvas = createOffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Neutral gray mid-level bump base
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    // Micro-alloy grain noise
    for (let i = 0; i < 3500; i++) {
      const x = (i * 197.3) % size;
      const y = (i * 83.1) % size;
      ctx.fillStyle = i % 2 === 0 ? '#868686' : '#7a7a7a';
      ctx.fillRect(x, y, 2, 2);
    }

    // Aerodynamic panel dividing lines (darker = indented seams)
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 2.0;

    // Longitudinal panel seams
    const longRows = isFighter ? 12 : 8;
    for (let r = 0; r < longRows; r++) {
      const y = (size / longRows) * r + 24;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();

      // Transverse structural ribs & maintenance access doors
      const cols = isFighter ? 8 : 6;
      for (let c = 0; c < cols; c++) {
        const x = (size / cols) * c + (r % 2) * 32;
        const panelW = size / cols - 16;
        const panelH = size / longRows - 12;

        ctx.strokeStyle = '#484848';
        ctx.strokeRect(x, y + 4, panelW, panelH);

        // Circular access inspection hatches
        if ((r + c) % 3 === 0) {
          ctx.beginPath();
          ctx.arc(x + panelW * 0.5, y + panelH * 0.5, isFighter ? 7 : 10, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Precision Rivet Lines along seams
        ctx.fillStyle = '#303030';
        const rivetCount = Math.floor(panelW / 14);
        for (let i = 0; i < rivetCount; i++) {
          ctx.fillRect(x + i * 14 + 4, y + 2, 1.8, 1.8);
          ctx.fillRect(x + i * 14 + 4, y + panelH + 2, 1.8, 1.8);
        }
      }
    }

    let tex = null;
    if (THREE && THREE.CanvasTexture) {
      tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
    }
    textureCache.set(key, tex);
    return tex;
  }

  // 2. High-Visibility / Tactical Roundel Water Decal
  function createRoundelTexture(THREE, lowVis = false) {
    const key = `roundel_${lowVis}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const canvas = createOffscreenCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 256, 256);
    const cx = 128, cy = 128, r = 110;

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = lowVis ? 'rgba(70, 85, 95, 0.90)' : '#003399';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = lowVis ? 'rgba(40, 50, 60, 0.85)' : '#ffffff';
    ctx.stroke();

    // Inner 12-ray sun
    ctx.fillStyle = lowVis ? 'rgba(175, 190, 200, 0.88)' : '#ffffff';
    const innerR = r * 0.48;
    const outerR = r * 0.92;
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI) / 12 - Math.PI / 2;
      const radius = i % 2 === 0 ? outerR : innerR;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Central core sun circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = lowVis ? 'rgba(70, 85, 95, 0.90)' : '#003399';
    ctx.fill();

    let tex = null;
    if (THREE && THREE.CanvasTexture) {
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    textureCache.set(key, tex);
    return tex;
  }

  // 3. Tactical Fighter Tail Art Decal (Sun God Totem / Tail Flash)
  function createFighterTailTexture(THREE, profile) {
    const key = `tail_${profile.id || 'f16'}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const canvas = createOffscreenCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 512, 512);

    // Diagonal tactical camouflage streak
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, 'rgba(45, 55, 65, 0.92)');
    grad.addColorStop(1, 'rgba(25, 35, 42, 0.95)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(30, 480);
    ctx.lineTo(480, 480);
    ctx.lineTo(440, 40);
    ctx.lineTo(260, 40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Sun God Maladao / Ace Totem artwork
    const cx = 350, cy = 250;
    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.fill();

    // Sun Rays
    ctx.strokeStyle = '#ff3d00';
    ctx.lineWidth = 5;
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
      ctx.lineTo(cx + Math.cos(a) * 95, cy + Math.sin(a) * 95);
      ctx.stroke();
    }

    // Squadron Stencils
    ctx.fillStyle = '#e2f5ff';
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('401 TFW', 350, 390);

    ctx.fillStyle = '#9fbacf';
    ctx.font = 'bold 26px "Courier New", monospace';
    const serial = profile.id === 'f16v' ? 'AF 93-042' : profile.id === 'm2000' ? 'ROCAF 2020' : 'TW-8801';
    ctx.fillText(serial, 350, 435);

    let tex = null;
    if (THREE && THREE.CanvasTexture) {
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    textureCache.set(key, tex);
    return tex;
  }

  // 4. Commercial Airliner Fuselage Cheatline & Brand Decal
  function createAirlinerLiveryTexture(THREE, profile) {
    const key = `airliner_${profile.id || 'a320'}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const canvas = createOffscreenCanvas(2048, 256);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 2048, 256);

    // Dual Sweeping Cheatlines (Deep Teal & Vibrant Cyan)
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.bezierCurveTo(400, 165, 1400, 155, 2048, 80);
    ctx.lineTo(2048, 125);
    ctx.bezierCurveTo(1400, 195, 400, 200, 0, 185);
    ctx.closePath();
    ctx.fillStyle = '#0f405c';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.bezierCurveTo(400, 195, 1400, 190, 2048, 120);
    ctx.lineTo(2048, 145);
    ctx.bezierCurveTo(1400, 215, 400, 215, 0, 195);
    ctx.closePath();
    ctx.fillStyle = '#00b4d8';
    ctx.fill();

    // Airline Typography Logo
    ctx.fillStyle = '#0d2d3e';
    ctx.font = 'bold 64px "Segoe UI", "Helvetica Neue", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SKYBOUND GLOBAL', 320, 130);

    ctx.fillStyle = '#0096c7';
    ctx.font = '600 30px "Segoe UI", sans-serif';
    ctx.fillText('PACIFIC AIRWAYS  ·  HORIZON', 325, 70);

    // Realistic Passenger Window Band with warm cabin glare
    const startX = 260;
    const windowCount = profile.id === 'b773' || profile.id === 'sa380' ? 68 : 42;
    for (let i = 0; i < windowCount; i++) {
      const wx = startX + i * 24;
      const wy = 142;

      // Window Frame & Tinted Polarized Glass
      ctx.fillStyle = '#0a1620';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(wx, wy, 12, 19, 4) : ctx.rect(wx, wy, 12, 19);
      ctx.fill();

      // Warm interior reflection
      ctx.fillStyle = 'rgba(255, 225, 170, 0.65)';
      ctx.fillRect(wx + 2, wy + 2, 8, 4);

      // Glass specular sheen
      ctx.fillStyle = 'rgba(100, 200, 255, 0.35)';
      ctx.fillRect(wx + 2, wy + 7, 8, 9);
    }

    let tex = null;
    if (THREE && THREE.CanvasTexture) {
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    textureCache.set(key, tex);
    return tex;
  }

  // 5. General Aviation Speed Stripes Decal (C172S)
  function createTrainerLiveryTexture(THREE) {
    const key = 'trainer_c172';
    if (textureCache.has(key)) return textureCache.get(key);

    const canvas = createOffscreenCanvas(1024, 256);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 1024, 256);

    // Bold classic burgundy & cobalt dynamic swoops
    ctx.beginPath();
    ctx.moveTo(0, 140);
    ctx.bezierCurveTo(300, 140, 700, 160, 1024, 70);
    ctx.lineTo(1024, 100);
    ctx.bezierCurveTo(700, 185, 300, 165, 0, 165);
    ctx.closePath();
    ctx.fillStyle = '#b71c1c';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 165);
    ctx.bezierCurveTo(300, 175, 700, 195, 1024, 105);
    ctx.lineTo(1024, 125);
    ctx.bezierCurveTo(700, 210, 300, 190, 0, 180);
    ctx.closePath();
    ctx.fillStyle = '#0d47a1';
    ctx.fill();

    // Registry Stencil
    ctx.fillStyle = '#1a237e';
    ctx.font = 'bold 42px "Segoe UI", Arial, sans-serif';
    ctx.fillText('B-55588', 680, 60);

    let tex = null;
    if (THREE && THREE.CanvasTexture) {
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    textureCache.set(key, tex);
    return tex;
  }

  // 6. Spawn High-Precision Decal Meshes & Apply Livery
  function applyLivery(model, profile, THREE) {
    if (!model || !profile || !THREE) return;
    if (model.userData?.skinApplied) return;

    const isFighter = profile.role === 'fighter';
    const isPassenger = profile.role === 'passenger' || profile.role === 'cargo';
    const isTrainer = profile.id === 'c172s';
    const half = profile.geometry ? profile.geometry[0] : 10;
    const radius = profile.geometry ? profile.geometry[1] : 1.5;
    const span = profile.geometry ? profile.geometry[2] : 12;

    const bumpMap = getPanelBumpTexture(THREE, isFighter);

    // Upgrade all primary materials across the model
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
            if (bumpMap && !m.bumpMap) {
              m.bumpMap = bumpMap;
              m.bumpScale = isFighter ? 0.035 : 0.022;
            }
            // Elevate plastic/dull look to metallic aerospace surface
            if (isFighter) {
              m.metalness = Math.max(m.metalness || 0, 0.48);
              m.roughness = Math.min(m.roughness || 1, 0.38);
            } else if (isPassenger) {
              m.metalness = Math.max(m.metalness || 0, 0.35);
              m.roughness = Math.min(m.roughness || 1, 0.28);
            }
            if (m.clearcoat !== undefined) {
              m.clearcoat = 0.85;
              m.clearcoatRoughness = 0.12;
            }
            m.needsUpdate = true;
          }
        });
      }
    });

    const decalGroup = new THREE.Group();
    decalGroup.name = 'AircraftSkins_Decals';

    // A. Fighter Decals (Roundels on Wings & Fuselage, Tail Art)
    if (isFighter) {
      const roundelTex = createRoundelTexture(THREE, true);
      const tailTex = createFighterTailTexture(THREE, profile);

      if (roundelTex) {
        // Wing Roundels (Left & Right outer wings)
        const roundelGeo = new THREE.PlaneGeometry(1.4, 1.4);
        const roundelMat = new THREE.MeshBasicMaterial({
          map: roundelTex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false
        });

        // Left Wing Top
        const rwLeft = new THREE.Mesh(roundelGeo, roundelMat);
        rwLeft.rotation.x = -Math.PI / 2;
        rwLeft.position.set(-span * 0.58, 0.22, half * 0.12);
        decalGroup.add(rwLeft);

        // Right Wing Bottom
        const rwRight = new THREE.Mesh(roundelGeo, roundelMat);
        rwRight.rotation.x = Math.PI / 2;
        rwRight.position.set(span * 0.58, -0.22, half * 0.12);
        decalGroup.add(rwRight);

        // Fuselage Side Roundels
        const sideRoundelGeo = new THREE.PlaneGeometry(0.9, 0.9);
        for (const side of [-1, 1]) {
          const rSide = new THREE.Mesh(sideRoundelGeo, roundelMat);
          rSide.rotation.y = side * Math.PI / 2;
          rSide.position.set(side * (radius * 0.96 + 0.02), radius * 0.15, -half * 0.18);
          decalGroup.add(rSide);
        }
      }

      // Tail Artwork on Vertical Stabilizer
      if (tailTex) {
        const tailGeo = new THREE.PlaneGeometry(half * 0.45, half * 0.35);
        const tailMat = new THREE.MeshBasicMaterial({
          map: tailTex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        for (const side of [-1, 1]) {
          const tDecal = new THREE.Mesh(tailGeo, tailMat);
          tDecal.rotation.y = side * Math.PI / 2;
          tDecal.position.set(side * 0.11, radius * 1.5, half * 0.56);
          decalGroup.add(tDecal);
        }
      }
    }

    // B. Commercial Airliner Decals (Fuselage Cheatline & Brand Decals)
    if (isPassenger) {
      const liveryTex = createAirlinerLiveryTexture(THREE, profile);
      if (liveryTex) {
        const bannerLength = half * 1.35;
        const bannerHeight = radius * 0.72;
        const bannerGeo = new THREE.PlaneGeometry(bannerLength, bannerHeight);
        const bannerMat = new THREE.MeshBasicMaterial({
          map: liveryTex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false
        });

        for (const side of [-1, 1]) {
          const banner = new THREE.Mesh(bannerGeo, bannerMat);
          banner.rotation.y = side * Math.PI / 2;
          // Position precisely on the cylindrical fuselage side
          banner.position.set(side * (radius * 0.98 + 0.03), radius * 0.22, -half * 0.08);
          decalGroup.add(banner);
        }
      }
    }

    // C. General Aviation Decals (C172S Speed Swoops)
    if (isTrainer) {
      const trainerTex = createTrainerLiveryTexture(THREE);
      if (trainerTex) {
        const tGeo = new THREE.PlaneGeometry(half * 1.25, radius * 0.85);
        const tMat = new THREE.MeshBasicMaterial({
          map: trainerTex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        for (const side of [-1, 1]) {
          const tMesh = new THREE.Mesh(tGeo, tMat);
          tMesh.rotation.y = side * Math.PI / 2;
          tMesh.position.set(side * (radius * 0.98 + 0.02), radius * 0.12, 0);
          decalGroup.add(tMesh);
        }
      }
    }

    model.add(decalGroup);
    if (!model.userData) model.userData = {};
    model.userData.skinApplied = true;
    model.userData.decalGroup = decalGroup;
  }

  return {
    getPanelBumpTexture,
    createRoundelTexture,
    createFighterTailTexture,
    createAirlinerLiveryTexture,
    createTrainerLiveryTexture,
    applyLivery
  };
})();

if (typeof module !== 'undefined') module.exports = aircraftSkins;
