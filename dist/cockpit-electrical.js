'use strict';

/**
 * SKYBOUND GLOBAL - Interactive Cockpit Switches & Cold-and-Dark Electrical Simulation (v0.49)
 * Full 3D clickable toggle switches, APU & starter sequencing, electrical bus power simulation,
 * and realistic metallic switch snap audio.
 */
(function(root) {
  const cockpitElectrical = (() => {
    // Electrical state
    const state = {
      coldAndDark: false,
      battery: true,
      avionics: true,
      apu: false,
      fuelPumpL: true,
      fuelPumpR: true,
      starter1: false,
      starter2: false,
      beacon: true,
      navLight: true,
      strobe: true,
      apuRpm: 0,
      eng1Rpm: 62.0,
      eng2Rpm: 62.0,
      gen1Online: true,
      gen2Online: true,
      busVoltage: 28.2,
      starter1Timer: 0,
      starter2Timer: 0
    };

    const switchDefs = [
      { id: 'battery', name: 'BATTERY MASTER', label: 'BAT', col: 0, row: 0, color: 0xff3333, guard: true },
      { id: 'avionics', name: 'AVIONICS MASTER', label: 'AVIONICS', col: 1, row: 0, color: 0x33ff66, guard: false },
      { id: 'apu', name: 'APU MASTER & BLEED', label: 'APU', col: 2, row: 0, color: 0xffaa00, guard: false },
      { id: 'fuelPumpL', name: 'L FUEL BOOST PUMP', label: 'PUMP L', col: 0, row: 1, color: 0x33ffaa, guard: false },
      { id: 'fuelPumpR', name: 'R FUEL BOOST PUMP', label: 'PUMP R', col: 1, row: 1, color: 0x33ffaa, guard: false },
      { id: 'starter1', name: 'ENG 1 STARTER', label: 'START 1', col: 0, row: 2, color: 0xffffff, guard: false },
      { id: 'starter2', name: 'ENG 2 STARTER', label: 'START 2', col: 1, row: 2, color: 0xffffff, guard: false },
      { id: 'beacon', name: 'BEACON LIGHTS', label: 'BCN', col: 3, row: 0, color: 0xff2222, guard: false },
      { id: 'navLight', name: 'NAVIGATION LIGHTS', label: 'NAV', col: 3, row: 1, color: 0x22ff44, guard: false },
      { id: 'strobe', name: 'STROBE LIGHTS', label: 'STRB', col: 3, row: 2, color: 0xffffff, guard: false }
    ];

    let panelGroup = null;
    const switchMeshes = new Map();
    let hoveredSwitch = null;
    let raycaster = null;
    let mouse = null;
    let boundCamera = null;
    let tooltipEl = null;

    // Realistic Web Audio synthesized metallic switch snap sound
    function playSwitchSound(isOff) {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        const ctx = (window.flightAudio && window.flightAudio.context) || new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime;

        // 1. High frequency metallic impact
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isOff ? 1100 : 1750, t);
        osc.frequency.exponentialRampToValueAtTime(320, t + 0.038);
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.045);

        // 2. Spring-loaded toggle detent resonance noise
        const len = Math.floor(ctx.sampleRate * 0.03);
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.006));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = isOff ? 2100 : 3200;
        filter.Q.value = 5.0;
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.22, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        noise.connect(filter).connect(nGain).connect(ctx.destination);
        noise.start(t);
      } catch (e) {}
    }

    // Canvas texture for panel faceplate text
    function createFaceplateTexture(THREE) {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 384;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Dark aerospace anodized aluminum background
      ctx.fillStyle = '#1a1e22';
      ctx.fillRect(0, 0, 512, 384);

      // Border frame
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 504, 376);

      // Section header
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(8, 8, 496, 44);
      ctx.font = 'bold 22px "Consolas", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('ELECTRICAL & SYSTEM CONTROLS', 24, 38);

      // Grid dividers
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(380, 52); ctx.lineTo(380, 370);
      ctx.stroke();

      ctx.font = 'bold 15px "Consolas", monospace';
      switchDefs.forEach((sw) => {
        const x = 20 + sw.col * 92;
        const y = 80 + sw.row * 96;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(sw.label, x, y);
      });

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    }

    // Build 3D switch panel inside cockpit
    function buildSwitchPanel(THREE, cabin, isFighter, profile) {
      if (!cabin) return null;
      panelGroup = new THREE.Group();
      panelGroup.name = 'electricalSwitchPanel';

      // 1. Backing Panel Box
      const plateTex = createFaceplateTexture(THREE);
      const plateMat = new THREE.MeshStandardMaterial({
        color: 0x22262a,
        roughness: 0.6,
        metalness: 0.45,
        map: plateTex
      });
      const panelMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.02), plateMat);
      panelGroup.add(panelMesh);

      // 2. Build Toggle Switches
      switchDefs.forEach((sw) => {
        const swGroup = new THREE.Group();
        swGroup.name = `switch_${sw.id}`;
        swGroup.userData = { switchId: sw.id, def: sw };

        // Position on plate
        const px = -0.135 + sw.col * 0.088;
        const py = 0.075 - sw.row * 0.082;
        swGroup.position.set(px, py, 0.01);

        // Bezel collar ring
        const collarMat = new THREE.MeshStandardMaterial({ color: 0x8899a6, roughness: 0.25, metalness: 0.85 });
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.01, 16), collarMat);
        collar.rotation.x = Math.PI / 2;
        swGroup.add(collar);

        // Toggle Lever Pivot Group
        const leverPivot = new THREE.Group();
        leverPivot.position.set(0, 0, 0.005);

        const leverMat = new THREE.MeshStandardMaterial({
          color: 0xd0d8e0,
          roughness: 0.2,
          metalness: 0.95
        });
        const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.038, 12), leverMat);
        lever.position.y = 0.019;
        leverPivot.add(lever);

        // Toggle tip knob
        const knobMat = new THREE.MeshStandardMaterial({
          color: sw.color || 0xffffff,
          roughness: 0.3,
          metalness: 0.4
        });
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 12), knobMat);
        knob.position.y = 0.038;
        leverPivot.add(knob);

        // Initial angle based on state
        const isTurnedOn = state[sw.id];
        leverPivot.rotation.x = isTurnedOn ? -0.45 : 0.45;
        swGroup.add(leverPivot);

        // LED Indicator Light
        const ledMat = new THREE.MeshStandardMaterial({
          color: isTurnedOn ? sw.color : 0x222222,
          emissive: sw.color,
          emissiveIntensity: isTurnedOn ? 1.0 : 0.0,
          roughness: 0.3
        });
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 10), ledMat);
        led.position.set(0, 0.025, 0.006);
        swGroup.add(led);

        // Clickable hitbox mesh (invisible)
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, 0.04), hitMat);
        hitBox.position.set(0, 0, 0.015);
        hitBox.userData = { switchId: sw.id, parentGroup: swGroup };
        swGroup.add(hitBox);

        panelGroup.add(swGroup);
        switchMeshes.set(sw.id, {
          group: swGroup,
          pivot: leverPivot,
          ledMat,
          hitBox,
          def: sw,
          targetRotX: leverPivot.rotation.x
        });
      });

      // Position panel in cockpit (center console or lower left depending on airframe)
      const g = profile && profile.geometry;
      if (isFighter) {
        panelGroup.position.set(g ? -Math.min(0.28, g[1] * 0.25) : -0.28, -0.15, -0.52);
        panelGroup.rotation.set(-0.35, 0.28, 0);
      } else if (profile && (profile.role === 'passenger' || profile.role === 'cargo')) {
        panelGroup.position.set(0, g[1] * 0.17 - 0.24, -g[0] * 0.56 + 0.05);
        panelGroup.rotation.set(-0.85, 0, 0);
      } else if (profile && profile.helicopter) {
        panelGroup.position.set(0, -0.22, -1.78);
        panelGroup.rotation.set(-0.65, 0, 0);
      } else if (g) {
        panelGroup.position.set(0, g[1] * 0.44, -g[0] * 0.36);
        panelGroup.rotation.set(-0.55, 0, 0);
      } else {
        panelGroup.position.set(0, -0.18, -0.56);
        panelGroup.rotation.set(-0.45, 0, 0);
      }

      cabin.add(panelGroup);
      return panelGroup;
    }

    // Toggle switch logic
    function toggleSwitch(id) {
      if (!(id in state)) return false;
      state[id] = !state[id];
      const isNowOn = state[id];

      playSwitchSound(!isNowOn);

      const item = switchMeshes.get(id);
      if (item) {
        item.targetRotX = isNowOn ? -0.45 : 0.45;
        if (item.ledMat) {
          item.ledMat.emissiveIntensity = isNowOn ? 1.0 : 0.0;
          if (item.ledMat.color && item.def) {
            item.ledMat.color.setHex(isNowOn ? item.def.color : 0x222222);
          }
        }
      }

      // Starter trigger
      if (id === 'starter1' && isNowOn) state.starter1Timer = 4.5;
      if (id === 'starter2' && isNowOn) state.starter2Timer = 4.5;

      updateElectricalBus();
      updateTooltip();
      return isNowOn;
    }

    // Set full Cold and Dark or Ready for Takeoff state
    function setColdAndDark(cold) {
      state.coldAndDark = cold;
      if (cold) {
        state.battery = false;
        state.avionics = false;
        state.apu = false;
        state.fuelPumpL = false;
        state.fuelPumpR = false;
        state.starter1 = false;
        state.starter2 = false;
        state.beacon = false;
        state.navLight = false;
        state.strobe = false;
        state.apuRpm = 0;
        state.eng1Rpm = 0;
        state.eng2Rpm = 0;
        state.gen1Online = false;
        state.gen2Online = false;
        state.busVoltage = 0.0;
      } else {
        state.battery = true;
        state.avionics = true;
        state.apu = false;
        state.fuelPumpL = true;
        state.fuelPumpR = true;
        state.starter1 = false;
        state.starter2 = false;
        state.beacon = true;
        state.navLight = true;
        state.strobe = true;
        state.apuRpm = 0;
        state.eng1Rpm = 62.0;
        state.eng2Rpm = 62.0;
        state.gen1Online = true;
        state.gen2Online = true;
        state.busVoltage = 28.2;
      }

      // Sync 3D meshes
      switchMeshes.forEach((item, id) => {
        const on = state[id];
        item.targetRotX = on ? -0.45 : 0.45;
        if (item.pivot) item.pivot.rotation.x = item.targetRotX;
        if (item.ledMat) {
          item.ledMat.emissiveIntensity = on ? 1.0 : 0.0;
          if (item.ledMat.color && item.def) {
            item.ledMat.color.setHex(on ? item.def.color : 0x222222);
          }
        }
      });
      updateTooltip();
    }

    // Update electrical bus power and engines
    function updateElectricalBus() {
      // Battery supplies essential bus 24V
      let volt = 0;
      if (state.battery) volt = 24.0;
      if (state.apuRpm > 85.0) volt = Math.max(volt, 28.0);
      if (state.gen1Online || state.gen2Online) volt = 28.5;
      state.busVoltage = volt;
    }

    // Per-frame physics and animation update
    function update(dt, flightState) {
      if (!dt) dt = 0.016;

      // 1. Smooth toggle lever transition
      switchMeshes.forEach((item) => {
        if (item.pivot && Math.abs(item.pivot.rotation.x - item.targetRotX) > 0.01) {
          item.pivot.rotation.x += (item.targetRotX - item.pivot.rotation.x) * Math.min(1.0, 18.0 * dt);
        }
      });

      // 2. APU Spool-up / Spool-down
      if (state.battery && state.apu) {
        if (state.apuRpm < 100.0) state.apuRpm = Math.min(100.0, state.apuRpm + 22.0 * dt);
      } else {
        if (state.apuRpm > 0.0) state.apuRpm = Math.max(0.0, state.apuRpm - 18.0 * dt);
      }

      // 3. Engine 1 Starter & Spool-up
      const hasStartPower = state.battery && (state.apuRpm > 80.0 || state.busVoltage >= 24.0);
      if (state.starter1Timer > 0) {
        state.starter1Timer -= dt;
        if (hasStartPower && state.fuelPumpL) {
          if (state.eng1Rpm < 62.0) state.eng1Rpm = Math.min(62.0, state.eng1Rpm + 16.0 * dt);
          if (state.eng1Rpm >= 55.0) state.gen1Online = true;
        }
        if (state.starter1Timer <= 0) {
          state.starter1 = false;
          const sw = switchMeshes.get('starter1');
          if (sw) sw.targetRotX = 0.45;
        }
      } else if (!state.fuelPumpL && state.coldAndDark) {
        state.eng1Rpm = Math.max(0.0, state.eng1Rpm - 12.0 * dt);
        if (state.eng1Rpm < 45.0) state.gen1Online = false;
      }

      // 4. Engine 2 Starter & Spool-up
      if (state.starter2Timer > 0) {
        state.starter2Timer -= dt;
        if (hasStartPower && state.fuelPumpR) {
          if (state.eng2Rpm < 62.0) state.eng2Rpm = Math.min(62.0, state.eng2Rpm + 16.0 * dt);
          if (state.eng2Rpm >= 55.0) state.gen2Online = true;
        }
        if (state.starter2Timer <= 0) {
          state.starter2 = false;
          const sw = switchMeshes.get('starter2');
          if (sw) sw.targetRotX = 0.45;
        }
      } else if (!state.fuelPumpR && state.coldAndDark) {
        state.eng2Rpm = Math.max(0.0, state.eng2Rpm - 12.0 * dt);
        if (state.eng2Rpm < 45.0) state.gen2Online = false;
      }

      updateElectricalBus();

      // If cold and dark with 0 engine RPM, limit flight throttle thrust
      if (flightState && state.coldAndDark) {
        const avgRpm = (state.eng1Rpm + state.eng2Rpm) * 0.5;
        if (avgRpm < 40.0) {
          flightState.thrustLimited = true;
          if (flightState.throttle) flightState.throttle = Math.min(flightState.throttle, (avgRpm / 40.0) * 0.2);
        } else {
          flightState.thrustLimited = false;
        }
      }
    }

    // Setup mouse raycast interaction for cockpit view
    function initInteraction(domElement, camera, THREE) {
      if (!domElement || !THREE) return;
      boundCamera = camera;
      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();

      // Tooltip DOM element
      if (typeof document !== 'undefined' && !tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'cockpitSwitchTooltip';
        tooltipEl.style.position = 'fixed';
        tooltipEl.style.bottom = '90px';
        tooltipEl.style.left = '50%';
        tooltipEl.style.transform = 'translateX(-50%)';
        tooltipEl.style.background = 'rgba(15, 23, 42, 0.88)';
        tooltipEl.style.border = '1px solid #38bdf8';
        tooltipEl.style.borderRadius = '6px';
        tooltipEl.style.padding = '6px 14px';
        tooltipEl.style.color = '#f8fafc';
        tooltipEl.style.fontFamily = 'monospace';
        tooltipEl.style.fontSize = '13px';
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        tooltipEl.style.display = 'none';
        tooltipEl.style.zIndex = '99999';
        document.body.appendChild(tooltipEl);
      }

      function onPointerMove(e) {
        if (!panelGroup || !boundCamera || !panelGroup.visible) return;
        const rect = domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, boundCamera);
        const hitMeshes = [];
        switchMeshes.forEach((item) => hitMeshes.push(item.hitBox));

        const intersects = raycaster.intersectObjects(hitMeshes, false);
        if (intersects.length > 0) {
          const swId = intersects[0].object.userData?.switchId;
          hoveredSwitch = swId;
          domElement.style.cursor = 'pointer';
          updateTooltip();
        } else {
          if (hoveredSwitch) {
            hoveredSwitch = null;
            domElement.style.cursor = 'default';
            if (tooltipEl) tooltipEl.style.display = 'none';
          }
        }
      }

      function onPointerDown(e) {
        if (e.button !== 0 || !hoveredSwitch) return;
        toggleSwitch(hoveredSwitch);
      }

      domElement.addEventListener('pointermove', onPointerMove);
      domElement.addEventListener('pointerdown', onPointerDown);
    }

    function updateTooltip() {
      if (!tooltipEl || !hoveredSwitch) return;
      const def = switchMeshes.get(hoveredSwitch)?.def;
      if (!def) return;
      const current = state[hoveredSwitch] ? '【ON】' : '【OFF】';
      const action = state[hoveredSwitch] ? '關閉 (Click to Turn OFF)' : '開啟 (Click to Turn ON)';
      tooltipEl.innerHTML = `<span style="color:#38bdf8;font-weight:bold;">${def.name}</span> : ${current} · 點擊${action}`;
      tooltipEl.style.display = 'block';
    }

    return {
      state,
      switchDefs,
      buildSwitchPanel,
      toggleSwitch,
      setColdAndDark,
      update,
      initInteraction,
      playSwitchSound
    };
  })();

  if (typeof module !== 'undefined') module.exports = cockpitElectrical;
  if (typeof root !== 'undefined') root.cockpitElectrical = cockpitElectrical;
})(typeof window !== 'undefined' ? window : global);
