'use strict';

/**
 * SKYBOUND GLOBAL - 3D Airport Infrastructure & NAVAIDS (v0.48)
 * 3D Physical VOR/DME Stations, ILS Localizer arrays, Glide Slope towers,
 * Doppler Weather Radar Radomes, and ICAO Taxiway Guidance Signboards.
 */
(function(root) {
  const airportInfrastructure = (() => {
    let infraGroup = null;
    const movingParts = [];

    // Canvas Texture Generators for ICAO Taxiway Signboards
    function createSignTexture(THREE, items) {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.clearRect(0, 0, 512, 128);

      let curX = 12;
      const h = 104, y = 12;

      items.forEach((item) => {
        const text = item.text;
        ctx.font = 'bold 54px "Segoe UI", Arial, sans-serif';
        const textWidth = ctx.measureText(text).width;
        const boxWidth = textWidth + 36;

        if (item.type === 'mandatory') {
          // Red background, white text (Runway holding position)
          ctx.fillStyle = '#b71c1c';
          ctx.fillRect(curX, y, boxWidth, h);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          ctx.strokeRect(curX + 2, y + 2, boxWidth - 4, h - 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, curX + 18, y + 74);
        } else if (item.type === 'location') {
          // Black background, yellow text & border (Current taxiway)
          ctx.fillStyle = '#11181c';
          ctx.fillRect(curX, y, boxWidth, h);
          ctx.strokeStyle = '#ffd600';
          ctx.lineWidth = 6;
          ctx.strokeRect(curX + 3, y + 3, boxWidth - 6, h - 6);
          ctx.fillStyle = '#ffd600';
          ctx.fillText(text, curX + 18, y + 74);
        } else {
          // Yellow background, black text (Direction / Destination)
          ctx.fillStyle = '#ffd600';
          ctx.fillRect(curX, y, boxWidth, h);
          ctx.strokeStyle = '#11181c';
          ctx.lineWidth = 4;
          ctx.strokeRect(curX + 2, y + 2, boxWidth - 4, h - 4);
          ctx.fillStyle = '#11181c';
          ctx.fillText(text, curX + 18, y + 74);
        }
        curX += boxWidth + 8;
      });

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // 1. Build Physical VOR/DME Ground Station 3D Model
    function buildVORStation(THREE, vor, elevation) {
      const group = new THREE.Group();
      group.name = `VOR_${vor.id}`;

      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.35, metalness: 0.1 });
      const grayMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.65 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.4 });
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.3, metalness: 0.8 });

      // Octagonal Elevated Counterpoise Building
      const baseRadius = 16;
      const baseHeight = 4.2;
      const baseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(baseRadius, baseRadius * 1.05, baseHeight, 8),
        grayMat
      );
      baseMesh.position.y = baseHeight * 0.5;
      group.add(baseMesh);

      // Upper Counterpoise Ground Plane
      const deckMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(baseRadius * 1.08, baseRadius * 1.08, 0.4, 24),
        whiteMat
      );
      deckMesh.position.y = baseHeight + 0.2;
      group.add(deckMesh);

      // Central Conical Fiberglass Radome
      const coneHeight = 3.8;
      const coneMesh = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, coneHeight, 16),
        whiteMat
      );
      coneMesh.position.y = baseHeight + coneHeight * 0.5 + 0.4;
      group.add(coneMesh);

      // Alford-Loop Slot Antenna Perimeter Array (48 elements)
      const antCount = 24;
      const antRadius = baseRadius * 0.88;
      for (let i = 0; i < antCount; i++) {
        const a = (i * Math.PI * 2) / antCount;
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), steelMat);
        ant.position.set(Math.cos(a) * antRadius, baseHeight + 1.0, Math.sin(a) * antRadius);
        group.add(ant);
      }

      // Adjacent DME Antenna Mast (Red/White Striped Lattice Tower)
      const dmeTowerHeight = 14;
      const dmeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.6, dmeTowerHeight, 6),
        steelMat
      );
      dmeMesh.position.set(baseRadius * 1.35, dmeTowerHeight * 0.5, 0);
      group.add(dmeMesh);

      // DME Red stripes
      for (let s = 0; s < 3; s++) {
        const stripe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36, 0.42, 2.0, 8),
          redMat
        );
        stripe.position.set(baseRadius * 1.35, 3.5 + s * 4.2, 0);
        group.add(stripe);
      }

      // Top Obstruction Strobe
      const strobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff1744 })
      );
      strobe.position.set(baseRadius * 1.35, dmeTowerHeight + 0.35, 0);
      group.add(strobe);

      group.position.set(vor.x, elevation || vor.elevation || 10, vor.z);
      return group;
    }

    // 2. Build ILS Localizer Array 3D Model
    function buildLocalizerArray(THREE, position, heading) {
      const group = new THREE.Group();
      group.name = 'ILS_Localizer_Array';

      const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff6d00, roughness: 0.4 });
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.3, metalness: 0.7 });

      // Horizontal Truss Beam (42 meters wide)
      const trussWidth = 38;
      const truss = new THREE.Mesh(new THREE.BoxGeometry(trussWidth, 0.4, 0.4), steelMat);
      truss.position.y = 2.4;
      group.add(truss);

      // Support legs
      for (let i = -2; i <= 2; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), steelMat);
        leg.position.set(i * (trussWidth * 0.22), 1.2, 0);
        group.add(leg);
      }

      // 16 Log-Periodic Antenna Elements
      const elemCount = 14;
      for (let i = 0; i < elemCount; i++) {
        const ex = (i - (elemCount - 1) / 2) * (trussWidth / elemCount);
        const elem = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.8, 1.2), orangeMat);
        elem.position.set(ex, 2.5, 0.3);
        group.add(elem);
      }

      group.position.copy(position);
      group.rotation.y = heading + Math.PI / 2;
      return group;
    }

    // 3. Build ILS Glide Slope Mast 3D Model
    function buildGlideSlopeTower(THREE, position, heading) {
      const group = new THREE.Group();
      group.name = 'ILS_GlideSlope_Tower';

      const steelMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.3, metalness: 0.8 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xd50000, roughness: 0.4 });
      const antMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

      const towerHeight = 22;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.85, towerHeight, 4), steelMat);
      mast.position.y = towerHeight * 0.5;
      group.add(mast);

      // Red Warning Bands
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 1.2), redMat);
        band.position.set(0, 4.5 + i * 6.5, 0);
        group.add(band);
      }

      // Glide Slope Corner-Reflector Antennas (Upper, Middle, Lower)
      [6, 12, 18].forEach((h) => {
        const ant = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.4), antMat);
        ant.position.set(0, h, 0.8);
        group.add(ant);
      });

      // Equipment Shelter at base
      const shelter = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.0, 3.8), steelMat);
      shelter.position.set(0, 1.5, -3.2);
      group.add(shelter);

      // Top Beacon
      const topLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff1744 })
      );
      topLight.position.set(0, towerHeight + 0.3, 0);
      group.add(topLight);

      group.position.copy(position);
      group.rotation.y = heading;
      return group;
    }

    // 4. Build Doppler Weather Radar Tower 3D Model
    function buildDopplerRadarTower(THREE, position) {
      const group = new THREE.Group();
      group.name = 'Doppler_Weather_Radar_Tower';

      const towerHeight = 28;
      const domeRadius = 4.2;

      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f9fc, roughness: 0.35 });
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.4, metalness: 0.75 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.4 });

      // Concrete Pedestal
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.0, 5, 8), steelMat);
      pedestal.position.y = 2.5;
      group.add(pedestal);

      // Lattice Tower Columns
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.8, towerHeight - 5, 4), steelMat);
      tower.position.y = 5 + (towerHeight - 5) * 0.5;
      group.add(tower);

      // Red Aviation Warning Bands
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 4.2), redMat);
        band.position.set(0, 8.5 + i * 6.5, 0);
        group.add(band);
      }

      // Upper Catwalk Platform
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.4, 16), steelMat);
      platform.position.y = towerHeight;
      group.add(platform);

      // Geodesic Radome Sphere
      const radome = new THREE.Mesh(new THREE.SphereGeometry(domeRadius, 24, 18), whiteMat);
      radome.position.y = towerHeight + domeRadius * 0.95;
      group.add(radome);

      // Rotating Scanner Beam Beacon (userData tagged for animation)
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 });
      const scanner = new THREE.Mesh(new THREE.ConeGeometry(0.8, 12, 8), beaconMat);
      scanner.rotation.x = Math.PI / 2;
      scanner.position.set(0, towerHeight + domeRadius, 0);
      group.add(scanner);

      group.userData = { scanner };
      movingParts.push(scanner);

      group.position.copy(position);
      return group;
    }

    // 5. Build Taxiway Guidance Signboards
    function buildTaxiwaySignboard(THREE, position, heading, items) {
      const group = new THREE.Group();
      group.name = 'Taxiway_Signboard';

      const tex = createSignTexture(THREE, items);
      if (!tex) return group;

      const signWidth = 3.6;
      const signHeight = 0.9;

      const signMat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: 0xffffff,
        emissiveIntensity: 0.15,
        roughness: 0.4
      });

      // Signboard Panel
      const panel = new THREE.Mesh(new THREE.BoxGeometry(signWidth, signHeight, 0.22), signMat);
      panel.position.y = signHeight * 0.5 + 0.35;
      group.add(panel);

      // Steel Mounting Legs
      const legMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6 });
      for (const lx of [-signWidth * 0.36, signWidth * 0.36]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), legMat);
        leg.position.set(lx, 0.2, 0);
        group.add(leg);
      }

      group.position.copy(position);
      group.rotation.y = heading;
      return group;
    }

    // Initialize all Infrastructure across Taiwan
    function init(scene, THREE, airports, vorStations, geoPointFn) {
      if (!scene || !THREE) return;
      if (infraGroup) {
        scene.remove(infraGroup);
        infraGroup = null;
      }

      infraGroup = new THREE.Group();
      infraGroup.name = 'Airport_Infrastructure_NAVAIDS';

      // 1. Build Physical VOR Stations
      if (Array.isArray(vorStations)) {
        vorStations.forEach((v) => {
          let elevation = v.elevation || 15;
          if (typeof geoPointFn === 'function' && v.lat && v.lon) {
            const p = geoPointFn(v.lat, v.lon);
            v.x = p.x;
            v.z = p.z;
          }
          if (v.x !== undefined && v.z !== undefined) {
            const vor3D = buildVORStation(THREE, v, elevation);
            infraGroup.add(vor3D);
          }
        });
      }

      // 2. Build ILS Antennas, Radar Towers, and Signs at Major Airports
      if (Array.isArray(airports)) {
        airports.forEach((r) => {
          if (!r.length || !r.heading || r.carrier) return;

          const s = Math.sin(r.heading), c = Math.cos(r.heading);
          const aptPt = (along, cross) => ({
            x: r.x + along * s + cross * c,
            y: r.elevation + 0.2,
            z: r.z - along * c + cross * s
          });

          // A. Localizer Antenna (Departure threshold + 300m)
          const locPos = aptPt(r.length * 0.5 + 280, 0);
          infraGroup.add(buildLocalizerArray(THREE, new THREE.Vector3(locPos.x, locPos.y, locPos.z), r.heading));

          // B. Glide Slope Mast (Touchdown zone + 320m, 120m offset)
          const gsPos = aptPt(-r.length * 0.5 + 320, 110);
          infraGroup.add(buildGlideSlopeTower(THREE, new THREE.Vector3(gsPos.x, gsPos.y, gsPos.z), r.heading));

          // C. Doppler Weather Radar Tower (at RCTP and RCSS)
          if (r.code === 'RCTP' || r.code === 'RCSS' || r.code === 'RCKH') {
            const radarPos = aptPt(0, (r.apron || 300) * 1.75);
            infraGroup.add(buildDopplerRadarTower(THREE, new THREE.Vector3(radarPos.x, radarPos.y, radarPos.z)));
          }

          // D. Taxiway Guidance Signboards
          const rwyNum = r.runway || '10';
          const rwyOpp = r.opposite || '28';
          const sign1Pos = aptPt(-r.length * 0.35, (r.width || 60) * 0.5 + 14);
          infraGroup.add(buildTaxiwaySignboard(THREE, new THREE.Vector3(sign1Pos.x, sign1Pos.y, sign1Pos.z), r.heading, [
            { text: `${rwyNum}-${rwyOpp}`, type: 'mandatory' },
            { text: 'A', type: 'location' }
          ]));

          const sign2Pos = aptPt(r.length * 0.2, (r.width || 60) * 0.5 + 14);
          infraGroup.add(buildTaxiwaySignboard(THREE, new THREE.Vector3(sign2Pos.x, sign2Pos.y, sign2Pos.z), r.heading, [
            { text: 'B', type: 'location' },
            { text: 'RAMP →', type: 'direction' }
          ]));
        });
      }

      scene.add(infraGroup);
      return infraGroup;
    }

    // Frame update for rotating Doppler radar scanners and night glow
    function update(cameraPos, isNight, dt) {
      if (!infraGroup) return;

      // Rotate Doppler radar scanning beams
      const rotSpeed = 2.4 * dt;
      movingParts.forEach((scanner) => {
        scanner.rotation.z += rotSpeed;
      });

      // Emissive night lighting
      const emissiveGain = isNight ? 0.85 : 0.15;
      infraGroup.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissiveMap) {
          o.material.emissiveIntensity = emissiveGain;
        }
      });
    }

    return {
      init,
      update,
      buildVORStation,
      buildLocalizerArray,
      buildGlideSlopeTower,
      buildDopplerRadarTower,
      buildTaxiwaySignboard
    };
  })();

  if (typeof module !== 'undefined') module.exports = airportInfrastructure;
  if (typeof root !== 'undefined') root.airportInfrastructure = airportInfrastructure;
})(typeof window !== 'undefined' ? window : global);
