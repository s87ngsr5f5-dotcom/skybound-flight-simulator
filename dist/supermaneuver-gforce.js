'use strict';

/**
 * SKYBOUND GLOBAL - High-AoA Supermaneuverability & Physiological G-Force Blackout/Redout (v0.50)
 * Realistic Pugachev's Cobra maneuver dynamics, Leading-Edge Extension (LERX) vortex lift,
 * and pilot physiological G-force tunnel vision (Blackout / Greyout) and Redout visual simulation.
 */
(function(root) {
  const supermaneuverGforce = (() => {
    // Physiological pilot G tolerance state
    const state = {
      cobraArmed: false,
      cobraActive: false,
      cobraTimer: 0,
      smoothedG: 1.0,
      blackout: 0.0,    // 0 (clear) to 1.0 (complete blackness)
      redout: 0.0,      // 0 (clear) to 1.0 (blood red vision)
      tunnelVision: 1.0, // 1.0 (full field of view) to 0.15 (narrow center pinhole)
      audioMuffle: 0.0,
      vortexLift: 0.0,
      cobraDrag: 1.0
    };

    let overlayCanvas = null;
    let overlayCtx = null;
    let hudPillEl = null;

    // Initialize overlay element (kept clear; blackout/redout visual overlays disabled)
    function initOverlay() {
      if (typeof document === 'undefined') return;
      if (overlayCanvas) return;

      overlayCanvas = document.createElement('canvas');
      overlayCanvas.id = 'gforceVisualOverlay';
      overlayCanvas.style.position = 'fixed';
      overlayCanvas.style.top = '0';
      overlayCanvas.style.left = '0';
      overlayCanvas.style.width = '100vw';
      overlayCanvas.style.height = '100dvh';
      overlayCanvas.style.pointerEvents = 'none';
      overlayCanvas.style.display = 'none';
      overlayCanvas.style.zIndex = '9998';
      document.body.appendChild(overlayCanvas);

      overlayCtx = overlayCanvas.getContext('2d');
      resizeOverlay();
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('resize', resizeOverlay);
      }

      // HUD Cobra Indicator Pill
      hudPillEl = document.createElement('div');
      hudPillEl.id = 'hudCobraPill';
      hudPillEl.style.position = 'fixed';
      hudPillEl.style.top = '72px';
      hudPillEl.style.left = '50%';
      hudPillEl.style.transform = 'translateX(-50%)';
      hudPillEl.style.background = 'rgba(234, 88, 12, 0.9)';
      hudPillEl.style.border = '1px solid #ffedd5';
      hudPillEl.style.borderRadius = '20px';
      hudPillEl.style.padding = '4px 16px';
      hudPillEl.style.color = '#ffffff';
      hudPillEl.style.fontFamily = 'monospace';
      hudPillEl.style.fontSize = '12px';
      hudPillEl.style.fontWeight = 'bold';
      hudPillEl.style.letterSpacing = '1px';
      hudPillEl.style.boxShadow = '0 0 15px rgba(234, 88, 12, 0.6)';
      hudPillEl.style.display = 'none';
      hudPillEl.style.zIndex = '9999';
      hudPillEl.innerHTML = '🐍 COBRA SUPERMANEUVER ARMED (PULL FULL UP)';
      document.body.appendChild(hudPillEl);
    }

    function resizeOverlay() {
      if (!overlayCanvas) return;
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      overlayCanvas.width = Math.max(1, Math.round(vv?.width || window.innerWidth || overlayCanvas.width || 1));
      overlayCanvas.height = Math.max(1, Math.round(vv?.height || window.innerHeight || overlayCanvas.height || 1));
    }

    // Toggle Cobra / AoA limiter override
    function toggleCobraArmed(flight) {
      if (!flight || flight.aircraft?.role !== 'fighter') return false;
      state.cobraArmed = !state.cobraArmed;
      flight.cobraArmed = state.cobraArmed;
      if (hudPillEl) {
        hudPillEl.style.display = state.cobraArmed ? 'block' : 'none';
      }
      return state.cobraArmed;
    }

    // Aerodynamic calculations for high AoA vortex lift and Cobra
    function computeSupermaneuverAero(flight, dt) {
      if (!flight) return { vortexLift: 0, cobraDrag: 1.0 };
      const aircraft = flight.aircraft;
      if (!aircraft || aircraft.role !== 'fighter') {
        state.vortexLift = 0;
        state.cobraDrag = 1.0;
        return { vortexLift: 0, cobraDrag: 1.0 };
      }

      const pitch = flight.pitch || 0;
      const vy = flight.vy || 0;
      const tas = Math.hypot(flight.vx, flight.vy, flight.vz) || 1;
      const pathAngle = Math.atan2(vy, Math.max(1, Math.hypot(flight.vx, flight.vz)));
      const alpha = pitch - pathAngle;

      // Cobra Maneuver Trigger: Armed + Speed between 100~160 m/s (~190-310 kt) + Pitch Pulling
      if (state.cobraArmed && !flight.ground && tas >= 85 && tas <= 175) {
        if (pitch > 0.45 && !state.cobraActive) {
          state.cobraActive = true;
          flight.cobraActive = true;
          state.cobraTimer = 0;
        }
      }

      if (state.cobraActive) {
        state.cobraTimer += dt;
        // Pitch reaches up to 1.75 rad (~100 deg)
        if (state.cobraTimer < 1.1) {
          flight.pitchRate = Math.max(flight.pitchRate, 1.4 * (1.2 - state.cobraTimer));
        } else if (state.cobraTimer < 2.2) {
          // Automatic recovery moment: nose down restoring moment
          flight.pitchRate = Math.min(flight.pitchRate, -1.6);
        } else {
          // Cobra maneuver completed
          state.cobraActive = false;
          flight.cobraActive = false;
          state.cobraArmed = false;
          if (hudPillEl) hudPillEl.style.display = 'none';
        }
      }

      // 1. Leading-Edge Extension (LERX) Vortex Lift
      let vortexLift = 0;
      const stallAngle = aircraft.stallAngle || 0.28;
      if (alpha > stallAngle && alpha < 1.45) {
        const extraAlpha = alpha - stallAngle;
        vortexLift = Math.sin(extraAlpha * 2.2) * 1.75 * (aircraft.vortexFactor || 1.15);
      }

      // 2. High-AoA Body Form Drag (Airbrake effect)
      let cobraDrag = 1.0;
      if (alpha > 0.45 || state.cobraActive) {
        cobraDrag = 1.0 + 3.8 * Math.sin(Math.min(Math.PI * 0.5, Math.abs(alpha))) * Math.sin(Math.min(Math.PI * 0.5, Math.abs(alpha)));
      }

      state.vortexLift = vortexLift;
      state.cobraDrag = cobraDrag;
      return { vortexLift, cobraDrag };
    }

    // Step G-force telemetry without inducing dizziness, blackout, tunnel vision, or redout overlays
    function stepPhysiology(flight, dt) {
      if (!flight || dt <= 0) return;
      const rawG = flight.gForce !== undefined ? flight.gForce : 1.0;

      // Smooth G for telemetry display without applying physiological vision impairers
      state.smoothedG += (rawG - state.smoothedG) * Math.min(1.0, 4.0 * dt);
      state.blackout = 0.0;
      state.redout = 0.0;
      state.tunnelVision = 1.0;
      state.audioMuffle = 0.0;
    }

    // Keep fullscreen overlay clear (no blackout, tunnel vision, or redout effects)
    function renderVisualFX() {
      if (!overlayCanvas || !overlayCtx) return;
      const w = overlayCanvas.width;
      const h = overlayCanvas.height;
      if (!w || !h) return;

      overlayCtx.clearRect(0, 0, w, h);
    }

    // Update called per frame in main loop
    function update(flight, dt) {
      if (!flight) return;
      computeSupermaneuverAero(flight, dt);
      stepPhysiology(flight, dt);
      renderVisualFX();
    }

    return {
      state,
      initOverlay,
      resizeOverlay,
      toggleCobraArmed,
      computeSupermaneuverAero,
      stepPhysiology,
      renderVisualFX,
      update
    };
  })();

  if (typeof module !== 'undefined') module.exports = supermaneuverGforce;
  if (typeof root !== 'undefined') root.supermaneuverGforce = supermaneuverGforce;
})(typeof window !== 'undefined' ? window : global);
