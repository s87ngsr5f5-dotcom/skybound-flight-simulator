// weather-storm.js - SKYBOUND GLOBAL Dynamic Thunderstorm, Microburst Windshear & Wiper Simulation
(function(root){
  'use strict';

  function createStormSystem(){
    const state = {
      active: false,
      lightning: {
        timer: 0,
        interval: 7.0,
        flashTimer: 0,
        flashIntensity: 0,
        flashActive: false,
        flashColor: '#d6e8ff',
        coords: { x: -8400, y: 1500, z: -2800 },
        thunderQueue: []
      },
      microburst: {
        active: true,
        // Centered along RCTP 05L final approach (~4.2km from runway threshold)
        center: { x: -8400, y: 180, z: -2800 },
        radius: 3400,
        maxDowndraft: -9.6, // m/s (~1900 fpm severe downdraft)
        shearVelocity: 14.8, // m/s (~29 kt horizontal outflow)
        fFactor: 0,
        warning: false,
        warningText: '',
        lastVoiceTime: 0
      },
      wipers: {
        mode: 0, // 0: OFF, 1: LO, 2: HI
        angle: 0, // 0 to 1.25 rad (~72 deg)
        dir: 1,
        speeds: [0, 1.95, 3.9]
      },
      droplets: [],
      rainParticles: null,
      audioCtx: null
    };

    // Initialize 2D windshield droplets
    function initDroplets(count){
      state.droplets = [];
      const total = count || 180;
      for(let i = 0; i < total; i++){
        state.droplets.push({
          x: Math.random(),
          y: Math.random(),
          r: 1.0 + Math.random() * 2.8,
          streak: 0,
          wiped: 0,
          driftVx: (Math.random() - 0.5) * 0.03
        });
      }
    }
    initDroplets(180);

    // Wiper sweep animation step
    function stepWipers(dt){
      const w = state.wipers;
      if(w.mode === 0){
        if(w.angle > 0.02){
          w.angle = Math.max(0, w.angle - 2.8 * dt);
        } else {
          w.angle = 0;
        }
        return;
      }
      const speed = w.speeds[w.mode] || 1.95;
      w.angle += w.dir * speed * dt;
      if(w.angle >= 1.25){
        w.angle = 1.25;
        w.dir = -1;
      } else if(w.angle <= 0){
        w.angle = 0;
        w.dir = 1;
      }
    }

    // Cycle wiper mode (OFF -> LO -> HI -> OFF)
    function cycleWipers(){
      state.wipers.mode = (state.wipers.mode + 1) % 3;
      return state.wipers.mode;
    }

    // Microburst wind field calculation at (pos, vel)
    function calculateMicroburst(pos, vel, dt){
      const mb = state.microburst;
      if(!mb.active) return { wind: { x: 0, y: 0, z: 0 }, fFactor: 0, warning: false };

      const dx = pos.x - mb.center.x;
      const dz = pos.z - mb.center.z;
      const dist = Math.hypot(dx, dz);

      // Outside microburst radius or above cell top (1600m)
      if(dist > mb.radius || pos.y > 1600){
        mb.fFactor = 0;
        mb.warning = false;
        return { wind: { x: 0, y: 0, z: 0 }, fFactor: 0, warning: false };
      }

      // Height attenuation: maximum downdraft between 80m and 1100m
      const heightFactor = Math.sin(Math.min(1, Math.max(0, (pos.y - 20) / 1000)) * Math.PI);

      // Core downdraft (Gaussian distribution centered at microburst origin)
      const coreDown = mb.maxDowndraft * Math.exp(-Math.pow(dist / (mb.radius * 0.42), 2)) * Math.max(0.25, heightFactor);

      // Radial outflow: 0 at center, peaks at ~0.48 radius, decreases outward
      const outflowShape = (dist / (mb.radius * 0.48)) * Math.exp(-Math.pow(dist / (mb.radius * 0.48), 2) * 0.7);
      const outflowMag = mb.shearVelocity * outflowShape;
      const angle = Math.atan2(dz, dx);
      const windX = Math.cos(angle) * outflowMag;
      const windZ = Math.sin(angle) * outflowMag;

      // NASA / FAA Windshear Hazard Index (F-Factor):
      // F = (dWh/dt) / g - Wv / Vtas
      const tas = Math.max(25, Math.hypot(vel.vx - windX, vel.vy - coreDown, vel.vz - windZ));
      const velMag = Math.max(1, Math.hypot(vel.vx, vel.vz));
      const dirX = vel.vx / velMag;
      const dirZ = vel.vz / velMag;

      // Rate of loss of headwind along flight path
      const dWh_dx = (mb.shearVelocity * 2.2) / (mb.radius * 0.85);
      const dWh_dt = dWh_dx * velMag;
      const g = 9.80665;
      const fFactor = (dWh_dt / g) - (coreDown / tas);

      mb.fFactor = Math.max(0, fFactor);
      mb.warning = fFactor >= 0.12; // FAA AC 120-48 warning threshold

      return {
        wind: { x: windX, y: coreDown, z: windZ },
        fFactor: mb.fFactor,
        warning: mb.warning
      };
    }

    // Step lightning strobe and thunder sound propagation
    function stepLightning(dt, cameraPos){
      const lt = state.lightning;
      lt.timer += dt;
      if(lt.timer >= lt.interval){
        lt.timer = 0;
        lt.interval = 5.5 + Math.random() * 7.5; // 5.5~13s
        lt.flashTimer = 0.24; // 240ms multi-burst
        lt.flashActive = true;

        const bearing = Math.random() * Math.PI * 2;
        const dist = 1400 + Math.random() * 3200;
        lt.coords = {
          x: (cameraPos?.x || 0) + Math.cos(bearing) * dist,
          y: (cameraPos?.y || 400) + 750 + Math.random() * 500,
          z: (cameraPos?.z || 0) + Math.sin(bearing) * dist
        };

        lt.thunderQueue.push({
          delay: Math.max(0.4, dist / 343),
          dist: dist
        });
      }

      if(lt.flashTimer > 0){
        lt.flashTimer -= dt;
        // Double flash strobe waveform
        if(lt.flashTimer > 0.18){
          lt.flashIntensity = (0.24 - lt.flashTimer) / 0.06;
        } else if(lt.flashTimer > 0.13){
          lt.flashIntensity = 0.28;
        } else {
          lt.flashIntensity = (lt.flashTimer / 0.13);
        }
      } else {
        lt.flashActive = false;
        lt.flashIntensity = 0;
      }

      // Propagate acoustic thunder queue
      for(let i = lt.thunderQueue.length - 1; i >= 0; i--){
        const item = lt.thunderQueue[i];
        item.delay -= dt;
        if(item.delay <= 0){
          playThunderAudio(item.dist);
          lt.thunderQueue.splice(i, 1);
        }
      }
    }

    // Synthesized thunder sound using Web Audio API
    function playThunderAudio(dist){
      try {
        if(typeof window === 'undefined') return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if(!AudioCtx) return;
        if(!state.audioCtx) state.audioCtx = new AudioCtx();
        const ctx = state.audioCtx;
        if(ctx.state === 'suspended') ctx.resume();

        const duration = 2.8;
        const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * duration), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let brown = 0.0;
        for(let i = 0; i < data.length; i++){
          const white = Math.random() * 2 - 1;
          brown = (brown + (0.045 * white)) / 1.045;
          const prog = i / data.length;
          const env = Math.pow(1 - prog, 1.7) * (prog < 0.04 ? prog / 0.04 : 1);
          data[i] = brown * 3.8 * env;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = Math.max(80, 400 - (dist || 2000) * 0.07);

        const gain = ctx.createGain();
        const distFactor = Math.max(0.12, 1.0 - (dist || 2000) / 4800);
        gain.gain.value = 0.85 * distFactor;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();
      } catch(e){}
    }

    // Play EGPWS voice / tone windshear warning
    function playWindshearAlert(){
      try {
        if(typeof window === 'undefined') return;
        const now = Date.now();
        if(now - state.microburst.lastVoiceTime < 5000) return; // 5s interval
        state.microburst.lastVoiceTime = now;

        // Web Speech API
        if('speechSynthesis' in window){
          const utterance = new SpeechSynthesisUtterance("Windshear! Windshear! Pull up!");
          utterance.rate = 1.15;
          utterance.pitch = 1.25;
          utterance.volume = 1.0;
          utterance.lang = 'en-US';
          window.speechSynthesis.speak(utterance);
        }

        // Dual-tone siren chime via Web Audio
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if(!AudioCtx) return;
        if(!state.audioCtx) state.audioCtx = new AudioCtx();
        const ctx = state.audioCtx;
        if(ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(680, ctx.currentTime);
        osc.frequency.setValueAtTime(840, ctx.currentTime + 0.18);
        osc.frequency.setValueAtTime(680, ctx.currentTime + 0.36);
        osc.frequency.setValueAtTime(840, ctx.currentTime + 0.54);

        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.82);
      } catch(e){}
    }

    // 2D Cockpit windshield raindrops & wiper rendering
    function renderCockpitWindshield(canvas, ias, dt){
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const wiper = state.wipers;
      const leftPivot = { x: w * 0.32, y: h * 0.96 };
      const rightPivot = { x: w * 0.68, y: h * 0.96 };
      const armLen = Math.min(w * 0.42, h * 0.76);
      const bladeLen = armLen * 0.68;

      // 1. Ambient windshield condensation mist
      ctx.fillStyle = 'rgba(170, 210, 235, 0.09)';
      ctx.fillRect(0, 0, w, h);

      // 2. Clear sector under wiper sweep
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.globalCompositeOperation = 'destination-out';
      [leftPivot, rightPivot].forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, armLen * 1.03, -Math.PI * 0.82, -Math.PI * 0.18);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();

      // 3. Water bead accumulation boundary ridge
      ctx.save();
      ctx.strokeStyle = 'rgba(215, 240, 255, 0.35)';
      ctx.lineWidth = 2.2;
      [leftPivot, rightPivot].forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, armLen * 1.03, -Math.PI * 0.82, -Math.PI * 0.18);
        ctx.stroke();
      });
      ctx.restore();

      // 4. Aerodynamic airflow & gravity raindrop physics
      const isAirborne = ias > 38;
      const airflow = Math.max(0, (ias - 20) * 0.0038);

      for(let i = 0; i < state.droplets.length; i++){
        const d = state.droplets[i];
        if(d.wiped > 0){
          d.wiped -= dt * 0.45;
          continue;
        }

        if(isAirborne){
          // Upward streak + lateral streamline divergence
          d.y -= (airflow * 0.92 + d.r * 0.02) * dt;
          d.x += (d.x - 0.5) * airflow * 0.28 * dt;
        } else {
          // Ground gravity run-down
          d.y += (0.045 + d.r * 0.02) * dt;
          d.x += (d.driftVx || 0) * dt;
        }

        // Loop / respawn drops
        if(d.y < 0 || d.y > 1 || d.x < 0 || d.x > 1){
          d.y = isAirborne ? 1.0 : 0.0;
          d.x = Math.random();
          d.r = 1.0 + Math.random() * 2.8;
        }

        const px = d.x * w;
        const py = d.y * h;

        // Wipe check left and right
        const dxL = px - leftPivot.x, dyL = leftPivot.y - py;
        const distL = Math.hypot(dxL, dyL);
        const angL = Math.atan2(dxL, dyL);
        if(distL > armLen * 0.30 && distL < armLen * 1.05 && Math.abs(angL - (wiper.angle - 0.38)) < 0.16){
          d.wiped = 1.0;
          continue;
        }
        const dxR = px - rightPivot.x, dyR = rightPivot.y - py;
        const distR = Math.hypot(dxR, dyR);
        const angR = Math.atan2(dxR, dyR);
        if(distR > armLen * 0.30 && distR < armLen * 1.05 && Math.abs(angR - (wiper.angle - 0.38)) < 0.16){
          d.wiped = 1.0;
          continue;
        }

        // Render realistic droplet with shadow rim and specular glint
        const rad = d.r;
        ctx.beginPath();
        ctx.arc(px, py, rad + 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 35, 50, 0.32)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(195, 230, 250, 0.62)';
        ctx.fill();

        // Droplet specular highlight
        ctx.beginPath();
        ctx.arc(px - rad * 0.35, py - rad * 0.35, rad * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // High-speed aerodynamic dynamic teardrop trail
        if(isAirborne && airflow > 0.06){
          ctx.beginPath();
          ctx.moveTo(px, py + rad);
          ctx.lineTo(px - (d.x - 0.5) * airflow * 12, py + rad + airflow * 42);
          ctx.strokeStyle = 'rgba(180, 220, 245, 0.38)';
          ctx.lineWidth = rad * 0.8;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      // Draw dual wipers
      function drawBlade(pivot, angleBase, angleOffset){
        const totalAngle = -angleOffset + wiper.angle * 1.08;
        const armMidX = pivot.x + Math.sin(totalAngle) * armLen * 0.45;
        const armMidY = pivot.y - Math.cos(totalAngle) * armLen * 0.45;
        const bladeTopX = pivot.x + Math.sin(totalAngle) * armLen;
        const bladeTopY = pivot.y - Math.cos(totalAngle) * armLen;
        const bladeBotX = pivot.x + Math.sin(totalAngle) * (armLen - bladeLen);
        const bladeBotY = pivot.y - Math.cos(totalAngle) * (armLen - bladeLen);

        ctx.save();
        // Wiper Arm
        ctx.beginPath();
        ctx.moveTo(pivot.x, pivot.y);
        ctx.lineTo(armMidX, armMidY);
        ctx.lineWidth = 5.5;
        ctx.strokeStyle = '#1b2630';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(armMidX, armMidY);
        ctx.lineTo(bladeBotX, bladeBotY);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#273542';
        ctx.stroke();

        // Rubber blade
        ctx.beginPath();
        ctx.moveTo(bladeBotX, bladeBotY);
        ctx.lineTo(bladeTopX, bladeTopY);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#0e141a';
        ctx.stroke();

        // Pivot cap
        ctx.beginPath();
        ctx.arc(pivot.x, pivot.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#2f404f';
        ctx.fill();
        ctx.restore();
      }

      drawBlade(leftPivot, 0, 0.42);
      drawBlade(rightPivot, 0, 0.42);
    }

    // Create 3D Rain Streaks particle geometry for Three.js
    function createRainMesh(THREE){
      if(!THREE) return null;
      const count = 1500;
      const positions = new Float32Array(count * 3);
      const spanX = 140, spanY = 90, spanZ = 140;

      for(let i = 0; i < count; i++){
        positions[i * 3 + 0] = (Math.random() - 0.5) * spanX;
        positions[i * 3 + 1] = (Math.random() - 0.5) * spanY;
        positions[i * 3 + 2] = (Math.random() - 0.5) * spanZ;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: 0xbed6e8,
        size: 1.6,
        transparent: true,
        opacity: 0.62,
        depthWrite: false
      });

      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      state.rainParticles = points;
      return points;
    }

    // Update 3D Rain Streaks
    function updateRainMesh(points, cameraPos, dt, speed){
      if(!points || !cameraPos) return;
      points.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
      const attr = points.geometry.attributes.position;
      const pos = attr.array;
      const spanX = 140, spanY = 90, spanZ = 140;
      const fallSpeed = (24 + (speed || 0) * 0.4) * dt;

      for(let i = 0; i < pos.length / 3; i++){
        pos[i * 3 + 1] -= fallSpeed;
        if(pos[i * 3 + 1] < -spanY * 0.5){
          pos[i * 3 + 1] += spanY;
          pos[i * 3 + 0] = (Math.random() - 0.5) * spanX;
          pos[i * 3 + 2] = (Math.random() - 0.5) * spanZ;
        }
      }
      attr.needsUpdate = true;
    }

    return {
      state,
      initDroplets,
      stepWipers,
      cycleWipers,
      calculateMicroburst,
      stepLightning,
      playThunderAudio,
      playWindshearAlert,
      renderCockpitWindshield,
      createRainMesh,
      updateRainMesh
    };
  }

  const storm = createStormSystem();
  if(typeof root !== 'undefined') root.weatherStorm = storm;
  if(typeof window !== 'undefined') window.weatherStorm = storm;
  if(typeof global !== 'undefined') global.weatherStorm = storm;
  if(typeof module !== 'undefined' && module.exports) module.exports = storm;
})(typeof window !== 'undefined' ? window : global);
