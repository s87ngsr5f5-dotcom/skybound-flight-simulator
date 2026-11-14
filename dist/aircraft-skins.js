'use strict';

/**
 * SKYBOUND GLOBAL - Aircraft Skins & Procedural Livery System (v0.44)
 * Generates ultra-crisp aerodynamic panel lines, rivet arrays, military roundels,
 * airline cheatlines, and PBR aerospace metallic surfaces.
 */
const aircraftSkins = (() => {
  const textureCache = new Map();
  const LIVERY_THEMES = [
    { id: 'default', name: '太平洋海灣 (Pacific Teal)', primary: '#0f405c', accent: '#00b4d8', tail: '#003399', text: '#0d2d3e', label: 'SKYBOUND GLOBAL' },
    { id: 'starlux', name: '曜石鎏金 (Obsidian Gold)', primary: '#1e242b', accent: '#d4af37', tail: '#2c353f', text: '#b8942e', label: 'STARBOUND LUX' },
    { id: 'plum', name: '梅花紫紺 (Formosa Plum)', primary: '#1d2d6b', accent: '#d85a98', tail: '#2b3990', text: '#1d2d6b', label: 'FORMOSA AIRLINES' },
    { id: 'thunder', name: '雷虎特技 (Thunder Tigers)', primary: '#b71c1c', accent: '#ffffff', tail: '#0d47a1', text: '#b71c1c', label: 'THUNDER TIGERS' },
    { id: 'camo', name: '戰術迷彩 (Digital Stealth)', primary: '#37474f', accent: '#607d8b', tail: '#263238', text: '#cfd8dc', label: '401 TFW · LOW VIS' },
    { id: 'rescue', name: '空勤搜救 (NASC Rescue)', primary: '#e65100', accent: '#ffd54f', tail: '#bf360c', text: '#ffffff', label: 'NASC RESCUE' }
  ];
  let selectedTheme = 'default';
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('skybound.liveryTheme');
      if (saved && LIVERY_THEMES.some(t => t.id === saved)) selectedTheme = saved;
    }
  } catch {}
  function getThemeSpec(themeId) {
    return LIVERY_THEMES.find(t => t.id === (themeId || selectedTheme)) || LIVERY_THEMES[0];
  }
  function getSelectedTheme() { return selectedTheme; }
  function setSelectedTheme(themeId) {
    if (LIVERY_THEMES.some(t => t.id === themeId)) {
      selectedTheme = themeId;
      try { if (typeof localStorage !== 'undefined') localStorage.setItem('skybound.liveryTheme', themeId); } catch {}
    }
    return selectedTheme;
  }

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
  function createFighterTailTexture(THREE, profile, themeId) {
    const theme = getThemeSpec(themeId);
    const key = `tail_${profile.id || 'f16'}_${theme.id}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const canvas = createOffscreenCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 512, 512);

    // Diagonal tactical camouflage streak
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, theme.primary);
    grad.addColorStop(1, theme.tail);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(30, 480);
    ctx.lineTo(480, 480);
    ctx.lineTo(440, 40);
    ctx.lineTo(260, 40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Sun God Maladao / Ace Totem artwork
    const cx = 350, cy = 250;
    ctx.fillStyle = theme.id === 'thunder' ? '#ffffff' : '#ffb300';
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.fill();

    // Sun Rays
    ctx.strokeStyle = theme.id === 'camo' ? '#90a4ae' : '#ff3d00';
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
    ctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(theme.id === 'thunder' ? 'THUNDER' : '401 TFW', 350, 390);

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

  // 4. Commercial Airliner / Cargo Fuselage Cheatline & Brand Decal
  function createAirlinerLiveryTexture(THREE, profile, themeId) {
    const theme = getThemeSpec(themeId);
    const isCargo = profile.role === 'cargo';
    const key = `airliner_${profile.id || 'a320'}_${theme.id}_${isCargo}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const canvas = createOffscreenCanvas(2048, 256);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 2048, 256);

    // Dual Sweeping Cheatlines
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.bezierCurveTo(400, 165, 1400, 155, 2048, 80);
    ctx.lineTo(2048, 125);
    ctx.bezierCurveTo(1400, 195, 400, 200, 0, 185);
    ctx.closePath();
    ctx.fillStyle = theme.primary;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.bezierCurveTo(400, 195, 1400, 190, 2048, 120);
    ctx.lineTo(2048, 145);
    ctx.bezierCurveTo(1400, 215, 400, 215, 0, 195);
    ctx.closePath();
    ctx.fillStyle = theme.accent;
    ctx.fill();

    // Airline Typography Logo
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 62px "Segoe UI", "Helvetica Neue", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isCargo ? `${theme.label} CARGO` : theme.label, 320, 130);

    ctx.fillStyle = theme.accent;
    ctx.font = '600 28px "Segoe UI", sans-serif';
    ctx.fillText(isCargo ? 'HEAVY FREIGHTER · TRANS-PACIFIC' : `${theme.name} · B-18901`, 325, 70);

    if (isCargo) {
      // Freighter Cargo Doors & Safety Stencils
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 4;
      ctx.strokeRect(420, 138, 130, 56);
      ctx.strokeRect(1380, 132, 160, 58);
      ctx.fillStyle = '#ff6d00';
      ctx.fillRect(1560, 156, 95, 12);
    } else {
      // Realistic Passenger Window Band with warm cabin glare
      const startX = 260;
      const windowCount = profile.id === 'b773' || profile.id === 'sa380' ? 68 : 42;
      for (let i = 0; i < windowCount; i++) {
        const wx = startX + i * 24;
        const wy = 142;

        ctx.fillStyle = '#0a1620';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(wx, wy, 12, 19, 4) : ctx.rect(wx, wy, 12, 19);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 225, 170, 0.65)';
        ctx.fillRect(wx + 2, wy + 2, 8, 4);

        ctx.fillStyle = 'rgba(100, 200, 255, 0.35)';
        ctx.fillRect(wx + 2, wy + 7, 8, 9);
      }
    }

    let tex = null;
    if (THREE && THREE.CanvasTexture) {
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    textureCache.set(key, tex);
    return tex;
  }

  // 4B. Wing & Tail Crest Decal (Visible from chase camera)
  function createWingStripeTexture(THREE, profile, themeId) {
    const theme = getThemeSpec(themeId);
    const key = `wing_${profile.id || 'jet'}_${theme.id}`;
    if (textureCache.has(key)) return textureCache.get(key);
    const canvas = createOffscreenCanvas(512, 256);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = theme.primary;
    ctx.beginPath();
    ctx.moveTo(0, 40); ctx.lineTo(512, 110); ctx.lineTo(512, 175); ctx.lineTo(0, 110); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.moveTo(0, 115); ctx.lineTo(512, 180); ctx.lineTo(512, 215); ctx.lineTo(0, 150); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px monospace';
    ctx.fillText(profile.role === 'fighter' ? 'TW-AF' : 'B-189', 54, 96);
    let tex = null;
    if (THREE && THREE.CanvasTexture) {
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    textureCache.set(key, tex);
    return tex;
  }

  // 4C. Helicopter Rescue / Tactical Stencil Texture
  function createHelicopterLiveryTexture(THREE, themeId) {
    const theme = getThemeSpec(themeId);
    const key = `heli_${theme.id}`;
    if (textureCache.has(key)) return textureCache.get(key);
    const canvas = createOffscreenCanvas(512, 256);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = theme.primary;
    ctx.fillRect(0, 88, 512, 54);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, 144, 512, 22);
    // Hazard Tail Stripe
    ctx.fillStyle = '#ffd54f';
    for (let x = 360; x < 490; x += 26) {
      ctx.fillRect(x, 88, 12, 78);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
    ctx.fillText(theme.id === 'camo' ? 'ROCA AVN' : 'NASC 空中勤務', 24, 128);
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
  function applyLivery(model, profile, THREE, themeOverride) {
    if (!model || !profile || !THREE) return;
    const theme = getThemeSpec(themeOverride);
    if (model.userData?.skinApplied && model.userData?.skinTheme === theme.id) return;
    if (model.userData?.decalGroup) {
      try {
        if (model.userData.decalGroup.parent) model.userData.decalGroup.parent.remove(model.userData.decalGroup);
      } catch {}
      model.userData.decalGroup = null;
    }

    const isFighter = profile.role === 'fighter';
    const isF16 = isFighter && (profile.id === 'sf16' || profile.f16Family);
    const isPassenger = profile.role === 'passenger' || profile.role === 'cargo';
    const isHelicopter = Boolean(profile.helicopter);
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
      const roundelTex = createRoundelTexture(THREE, theme.id === 'camo');
      const tailTex = createFighterTailTexture(THREE, profile, theme.id);
      const wingTex = createWingStripeTexture(THREE, profile, theme.id);
      const fWingY = (profile.geometry[3] ?? 0.12) + 0.085;
      const fWingZ = isF16 ? half * 0.10 : half * 0.12;

      if (roundelTex) {
        const rwSize = Math.min(0.68, radius * 0.72);
        const roundelGeo = new THREE.PlaneGeometry(rwSize, rwSize);
        const roundelMat = new THREE.MeshBasicMaterial({
          map: roundelTex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false
        });

        const rwLeft = new THREE.Mesh(roundelGeo, roundelMat);
        rwLeft.rotation.x = -Math.PI / 2;
        rwLeft.position.set(-span * 0.56, fWingY, fWingZ);
        decalGroup.add(rwLeft);

        const rwRight = new THREE.Mesh(roundelGeo, roundelMat);
        rwRight.rotation.x = -Math.PI / 2;
        rwRight.position.set(span * 0.56, fWingY, fWingZ);
        decalGroup.add(rwRight);

        const srSize = Math.min(0.66, radius * 0.65);
        const sideRoundelGeo = new THREE.PlaneGeometry(srSize, srSize);
        for (const side of [-1, 1]) {
          const rSide = new THREE.Mesh(sideRoundelGeo, roundelMat);
          rSide.rotation.y = side * Math.PI / 2;
          rSide.position.set(side * (radius * 0.94 + 0.02), radius * 0.12, -half * 0.18);
          decalGroup.add(rSide);
        }
      }

      if (wingTex && !isFighter) {
        const wGeo = new THREE.PlaneGeometry(span * 0.55, half * 0.28);
        const wMat = new THREE.MeshBasicMaterial({ map: wingTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
        for (const side of [-1, 1]) {
          const wMesh = new THREE.Mesh(wGeo, wMat);
          wMesh.rotation.x = -Math.PI / 2;
          wMesh.position.set(side * span * 0.44, 0.25, half * 0.18);
          decalGroup.add(wMesh);
        }
      }

      if (tailTex && isF16) {
        // Keep F-16 art strictly inside the actual swept fin trapezoid.
        const tailH = profile.finHeight ?? half * 0.41;
        const tailGeo = new THREE.PlaneGeometry(Math.min(0.60, half * 0.22), Math.min(1.15, tailH * 0.42));
        const tailMat = new THREE.MeshBasicMaterial({
          map: tailTex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        for (const side of [-1, 1]) {
          const tDecal = new THREE.Mesh(tailGeo, tailMat);
          tDecal.rotation.y = side * Math.PI / 2;
          tDecal.position.set(side * 0.10, radius * 0.65 + tailH * 0.38, half * 0.60);
          decalGroup.add(tDecal);
        }
      }
    }

    // B. Commercial Airliner / Cargo Decals (Contoured Fuselage Cheatline + Swept Wing Stripe + Fin Crest)
    if (isPassenger) {
      const liveryTex = createAirlinerLiveryTexture(THREE, profile, theme.id);
      const wingTex = createWingStripeTexture(THREE, profile, theme.id);
      if (liveryTex) {
        const bannerLength = half * 1.12;
        const bannerHeight = radius * 0.52;
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
          banner.position.set(side * (radius * 1.005), radius * 0.12, -half * 0.04);
          decalGroup.add(banner);
        }
      }
      if (wingTex && profile.wingDecalApproved) {
        const wLen = Math.min(span * 0.30, span * 0.28);
        const wChord = Math.min(radius * 0.44, half * 0.10);
        const wingGeo = new THREE.PlaneGeometry(wLen, wChord);
        const wingMat = new THREE.MeshBasicMaterial({ map: wingTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
        const wingBaseY = profile.geometry[3] ?? -radius * 0.2;
        const wingSweepZ = profile.geometry[5] ?? half * 0.24;
        const sweepAngle = Math.atan2(wingSweepZ, Math.max(1, span));
        const decalY = wingBaseY + 0.22 * 0.22 * 0.72 + Math.min(0.28, half * 0.015);
        for (const side of [-1, 1]) {
          const wm = new THREE.Mesh(wingGeo, wingMat);
          wm.rotation.order = 'YXZ';
          wm.rotation.set(-Math.PI / 2, -side * sweepAngle, 0);
          wm.position.set(side * span * 0.44, decalY, -half * 0.04 + wingSweepZ * 0.42);
          decalGroup.add(wm);
        }
        // Compact vertical-fin crest wholly inside the swept tail fin bounds
        const tailH = profile.finHeight ?? half * 0.36;
        const tailBannerGeo = new THREE.PlaneGeometry(Math.min(half * 0.20, radius * 1.45), Math.min(tailH * 0.44, radius * 1.15));
        for (const side of [-1, 1]) {
          const tb = new THREE.Mesh(tailBannerGeo, wingMat);
          tb.rotation.y = side * Math.PI / 2;
          tb.position.set(side * 0.14, radius * 0.72 + tailH * 0.42, half * 0.57);
          decalGroup.add(tb);
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

    // D. Helicopter Rescue / Army Tactical Decals
    if (isHelicopter) {
      const heliTex = createHelicopterLiveryTexture(THREE, theme.id);
      if (heliTex) {
        const hWidth=Math.min(half*.36,1.9);
        const hGeo=new THREE.PlaneGeometry(hWidth,Math.min(radius*.68,.75));
        const hMat = new THREE.MeshBasicMaterial({ map: heliTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
        for (const side of [-1, 1]) {
          const hMesh = new THREE.Mesh(hGeo, hMat);
          hMesh.rotation.y = side * Math.PI / 2;
          hMesh.position.set(side * (radius * 0.82 + 0.05), radius * 0.15, half * 0.18);
          decalGroup.add(hMesh);
        }
      }
    }

    model.add(decalGroup);
    if (!model.userData) model.userData = {};
    model.userData.skinApplied = true;
    model.userData.skinTheme = theme.id;
    model.userData.decalGroup = decalGroup;
  }

  function reapplyLivery(model, profile, THREE, themeOverride) {
    if (!model) return;
    if (model.userData) model.userData.skinApplied = false;
    applyLivery(model, profile, THREE, themeOverride);
  }

  return {
    releaseProfile(id){
      for(const [key,texture] of textureCache)if(key.includes('_'+id+'_')){texture.dispose?.();textureCache.delete(key);}
    },
    LIVERY_THEMES,
    getSelectedTheme,
    setSelectedTheme,
    getPanelBumpTexture,
    createRoundelTexture,
    createFighterTailTexture,
    createAirlinerLiveryTexture,
    createWingStripeTexture,
    createHelicopterLiveryTexture,
    createTrainerLiveryTexture,
    applyLivery,
    reapplyLivery
  };
})();

if (typeof module !== 'undefined') module.exports = aircraftSkins;
