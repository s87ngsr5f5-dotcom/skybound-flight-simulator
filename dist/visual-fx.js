'use strict';

/**
 * SKYBOUND GLOBAL - Next-Gen Visual Effects & Transonic Shockwave System (v0.42)
 * Prandtl-Glauert condensation vapor cone, afterburner Mach shock diamonds,
 * and high-fidelity PBR environment reflection mappings.
 */
(function(root) {
  function createTransonicVFX(THREE, scene) {
    if (!THREE || !scene) return { update: () => {} };

    const vfxGroup = new THREE.Group();
    vfxGroup.name = 'Transonic Shock & Afterburner VFX';
    scene.add(vfxGroup);

    // 1. Prandtl-Glauert Vapor Cone (Condensation Frustum)
    // Cone geometry along Z axis
    const coneGeo = new THREE.CylinderGeometry(0.2, 4.2, 3.8, 32, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xeef6ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const vaporCone = new THREE.Mesh(coneGeo, coneMat);
    vaporCone.visible = false;
    vfxGroup.add(vaporCone);

    // Shockwave expansion ring
    const ringGeo = new THREE.RingGeometry(1.5, 3.2, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xcde8ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const shockRing = new THREE.Mesh(ringGeo, ringMat);
    shockRing.visible = false;
    vfxGroup.add(shockRing);

    // 2. Afterburner Mach Shock Diamonds (Series of luminous diamond disks)
    const diamondCount = 5;
    const diamondGeo = new THREE.OctahedronGeometry(0.35, 0);
    diamondGeo.scale(1, 1, 1.8);
    const diamondMat = new THREE.MeshBasicMaterial({
      color: 0x99ccff,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const machDiamonds = [];
    for (let i = 0; i < diamondCount; i++) {
      const m = new THREE.Mesh(diamondGeo, diamondMat.clone());
      m.visible = false;
      vfxGroup.add(m);
      machDiamonds.push(m);
    }

    function calculateTransonicIntensity(mach) {
      if (!mach || mach < 0.90 || mach > 1.15) return 0;
      // Peak at Mach 0.99 ~ 1.01
      return Math.max(0, 1 - Math.abs(mach - 1.0) / 0.10);
    }

    function calculateAfterburnerIntensity(power, boost) {
      if (!boost || power <= 0.88) return 0;
      return Math.min(1, (power - 0.88) / 0.12);
    }

    function update(f, dt, speeds) {
      if (!f || f.ground || !speeds) {
        vaporCone.visible = false;
        shockRing.visible = false;
        machDiamonds.forEach(m => (m.visible = false));
        return;
      }

      const mach = speeds.mach || 0;
      const tIntensity = calculateTransonicIntensity(mach);
      const isFighter = f.aircraft?.role === 'fighter';
      const wingSpan = f.aircraft?.geometry ? f.aircraft.geometry[2] * 2 : 14;
      const fuseLen = f.aircraft?.geometry ? f.aircraft.geometry[0] * 2 : 15;

      const rot = new THREE.Euler(f.pitch, -f.heading, f.bank, 'YXZ');
      const quat = new THREE.Quaternion().setFromEuler(rot);

      // --- Transonic Vapor Cone Update ---
      if (tIntensity > 0.05) {
        vaporCone.visible = true;
        shockRing.visible = true;

        const coneScale = (wingSpan / 12) * (0.85 + tIntensity * 0.35);
        vaporCone.scale.set(coneScale, coneScale, coneScale);
        vaporCone.material.opacity = tIntensity * 0.72;

        // Position slightly behind wing mid-chord
        const coneOffset = new THREE.Vector3(0, 0, fuseLen * 0.15).applyQuaternion(quat);
        vaporCone.position.set(f.x + coneOffset.x, f.y + coneOffset.y, f.z + coneOffset.z);
        vaporCone.quaternion.copy(quat);

        // Shock ring expanding backwards
        const ringScale = (wingSpan / 10) * (1.0 + tIntensity * 0.6);
        shockRing.scale.set(ringScale, ringScale, ringScale);
        shockRing.material.opacity = tIntensity * 0.45;
        const ringOffset = new THREE.Vector3(0, 0, fuseLen * 0.35).applyQuaternion(quat);
        shockRing.position.set(f.x + ringOffset.x, f.y + ringOffset.y, f.z + ringOffset.z);
        shockRing.quaternion.copy(quat);
      } else {
        vaporCone.visible = false;
        shockRing.visible = false;
      }

      // --- Afterburner Mach Shock Diamonds Update ---
      const abIntensity = calculateAfterburnerIntensity(f.power, f.boost);
      if (abIntensity > 0.05 && isFighter) {
        const exhaustOffset = new THREE.Vector3(0, 0, fuseLen * 0.52).applyQuaternion(quat);
        const nozzleX = f.x + exhaustOffset.x;
        const nozzleY = f.y + exhaustOffset.y;
        const nozzleZ = f.z + exhaustOffset.z;

        // Direction opposite to flight forward vector (stream behind exhaust)
        const rearDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
        const diamondSpacing = 0.95 + abIntensity * 0.3;

        machDiamonds.forEach((m, idx) => {
          m.visible = true;
          const dist = (idx + 1) * diamondSpacing;
          m.position.set(
            nozzleX + rearDir.x * dist,
            nozzleY + rearDir.y * dist,
            nozzleZ + rearDir.z * dist
          );
          m.quaternion.copy(quat);

          // Pulse glow effect
          const pulse = Math.sin((f.elapsed || 0) * 85 + idx * 1.5) * 0.15;
          const diaScale = (1.0 - idx * 0.12) * (0.8 + abIntensity * 0.5 + pulse);
          m.scale.set(diaScale, diaScale, diaScale * 1.5);
          m.material.opacity = (abIntensity * 0.85) * (1.0 - idx * 0.14);
        });
      } else {
        machDiamonds.forEach(m => (m.visible = false));
      }
    }

    return {
      update,
      calculateTransonicIntensity,
      calculateAfterburnerIntensity,
      vfxGroup
    };
  }

  const visualFXModule = {
    createTransonicVFX
  };

  if (typeof root !== 'undefined') root.visualFX = visualFXModule;
  if (typeof window !== 'undefined') window.visualFX = visualFXModule;
  if (typeof global !== 'undefined') global.visualFX = visualFXModule;
  if (typeof module !== 'undefined' && module.exports) module.exports = visualFXModule;
})(typeof window !== 'undefined' ? window : global);
