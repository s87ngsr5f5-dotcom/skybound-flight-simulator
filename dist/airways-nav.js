'use strict';

/**
 * SKYBOUND GLOBAL - Airways & VOR Navigation Network (v0.41)
 * Aeronautical VOR/DME stations, civil airways corridors,
 * 14 NM ILS approach feather cones, and ALSF-2 precision runway lighting.
 */
(function(root) {
  // Taiwan Aeronautical VOR/DME Stations Database
  const taiwanVORStations = [
    { id: 'APU', name: '鞍部 VOR/DME', freq: '112.5', channel: '72X', lat: 25.1840, lon: 121.5230, elevation: 832, magVar: -4.2 },
    { id: 'TNA', name: '台北 VOR/DME', freq: '114.3', channel: '90X', lat: 25.0700, lon: 121.5520, elevation: 15, magVar: -4.1 },
    { id: 'HLG', name: '後龍 VOR/DME', freq: '114.0', channel: '87X', lat: 24.5980, lon: 120.7670, elevation: 52, magVar: -4.0 },
    { id: 'MKG', name: '馬公 VOR/DME', freq: '115.2', channel: '99X', lat: 23.5590, lon: 119.6300, elevation: 28, magVar: -3.8 },
    { id: 'TNN', name: '台南 VOR/DME', freq: '113.3', channel: '80X', lat: 22.9510, lon: 120.2070, elevation: 20, magVar: -3.5 },
    { id: 'GID', name: '綠島 VOR/DME', freq: '113.7', channel: '84X', lat: 22.6730, lon: 121.4660, elevation: 12, magVar: -3.4 },
    { id: 'HCN', name: '恆春 VOR/DME', freq: '113.5', channel: '82X', lat: 22.0400, lon: 120.7290, elevation: 35, magVar: -3.3 }
  ];

  // International VOR/DME Stations Database across Asia-Pacific Hubs
  const internationalVORStations = [
    { id: 'HND', name: '東京羽田 VOR/DME', freq: '112.2', channel: '59X', lat: 35.5522, lon: 139.7805, elevation: 12, magVar: -7.5, intl: true },
    { id: 'NRE', name: '東京成田 VOR/DME', freq: '117.9', channel: '126X', lat: 35.7720, lon: 140.3860, elevation: 45, magVar: -7.6, intl: true },
    { id: 'KMC', name: '大阪關西 VOR/DME', freq: '111.8', channel: '55X', lat: 34.4310, lon: 135.2380, elevation: 10, magVar: -7.2, intl: true },
    { id: 'NHC', name: '沖繩那霸 VORTAC', freq: '116.5', channel: '112X', lat: 26.2080, lon: 127.6460, elevation: 18, magVar: -5.2, intl: true },
    { id: 'CHC', name: '香港長洲 VOR/DME', freq: '112.3', channel: '70X', lat: 22.2190, lon: 114.0300, elevation: 95, magVar: -2.8, intl: true },
    { id: 'SEL', name: '首爾仁川 VOR/DME', freq: '115.5', channel: '102X', lat: 37.4130, lon: 126.9280, elevation: 180, magVar: -8.5, intl: true },
    { id: 'VJB', name: '新加坡樟宜 VOR/DME', freq: '116.5', channel: '112X', lat: 1.4150, lon: 104.0220, elevation: 24, magVar: 0.4, intl: true },
    { id: 'MIA', name: '馬尼拉 VOR/DME', freq: '113.8', channel: '85X', lat: 14.5080, lon: 121.0210, elevation: 28, magVar: -1.6, intl: true },
    { id: 'BKK', name: '曼谷蘇凡納布 VOR/DME', freq: '117.7', channel: '124X', lat: 13.8930, lon: 100.5960, elevation: 8, magVar: -0.7, intl: true }
  ];

  // Civil Aviation High/Low Altitude Airways Corridors
  const civilAirways = [
    { id: 'W4', name: 'W4 航線 (松山 - 後龍 - 馬公)', fixes: ['TNA', 'HLG', 'MKG'], waypoints: ['TNA', 'HLG', 'MKG'], color: 0x38e8ac, mea: 5000, widthKm: 8 },
    { id: 'B591', name: 'B591 西部低空幹線 (鞍部 - 後龍 - 台南 - 恆春)', fixes: ['APU', 'HLG', 'TNN', 'HCN'], waypoints: ['APU', 'HLG', 'TNN', 'HCN'], color: 0x4ac7ff, mea: 7000, widthKm: 10 },
    { id: 'A1', name: 'A1 東部外海大動脈 (恆春 - 綠島 - 花蓮外海)', fixes: ['HCN', 'GID', 'RCYU'], waypoints: ['HCN', 'GID', 'NHC'], color: 0xffd557, mea: 11000, widthKm: 14 },
    { id: 'G581', name: 'G581 琉球關西東京幹線', fixes: ['APU', 'NHC', 'KMC', 'HND', 'NRE'], waypoints: ['APU', 'NHC', 'KMC', 'HND', 'NRE'], color: 0xfbbf24, mea: 15000, widthKm: 16 }
  ];

  // Cache projected simulation coordinates
  let coordsInitialized = false;
  function ensureVORCoordinates(geoPointFn) {
    if (coordsInitialized || typeof geoPointFn !== 'function') return;
    for (const v of [...taiwanVORStations, ...internationalVORStations]) {
      const p = geoPointFn(v.lat, v.lon);
      v.x = p.x;
      v.z = p.z;
    }
    coordsInitialized = true;
  }

  // Calculate VOR Radial & DME Distance from any aircraft point
  function tuneVOR(vorId, aircraftPos) {
    const vor = taiwanVORStations.find(v => v.id === vorId) || internationalVORStations.find(v => v.id === vorId);
    if (!vor || !aircraftPos) return null;
    const dx = aircraftPos.x - vor.x;
    const dz = aircraftPos.z - vor.z;
    const distanceMeters = Math.hypot(dx, dz);
    const dmeNM = distanceMeters / 1852;
    // Radial bearing from station to aircraft in magnetic degrees
    let trueBearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    let radial = (trueBearing - vor.magVar + 360) % 360;
    return {
      vor,
      dmeNM,
      radial: Math.round(radial),
      toFrom: Math.abs(radial - ((trueBearing + 180) % 360)) < 90 ? 'TO' : 'FROM',
      lineOfSight: aircraftPos.y >= (vor.elevation - 50)
    };
  }

  // Generate 14 NM ILS Feather approach geometry
  function getILSFeatherDetails(airport) {
    if (!airport || airport.carrier) return null;
    const lengthNM = 14;
    const lengthM = lengthNM * 1852; // ~25,928m
    const glideSlopeDeg = 3.0;
    const halfSpreadDeg = 2.5; // +/-2.5 deg Localizer width

    const heading = airport.heading;
    const sinH = Math.sin(heading), cosH = Math.cos(heading);

    // Threshold touchdown point
    const tdAlong = -airport.length / 2 + 300;
    const tdx = airport.x + tdAlong * sinH;
    const tdz = airport.z - tdAlong * cosH;
    const tdy = airport.elevation + 2;

    // Upwind direction (extending backwards from runway threshold)
    const upAlong = tdAlong - lengthM;
    const halfWidth = lengthM * Math.tan(halfSpreadDeg * Math.PI / 180); // ~1,130m

    // Left and right edges of 14 NM feather cone
    const leftX = airport.x + upAlong * sinH - halfWidth * cosH;
    const leftZ = airport.z - upAlong * cosH - halfWidth * sinH;
    const rightX = airport.x + upAlong * sinH + halfWidth * cosH;
    const rightZ = airport.z - upAlong * cosH + halfWidth * sinH;
    const featherAltitude = tdy + lengthM * Math.tan(glideSlopeDeg * Math.PI / 180); // ~1,360m AGL

    // Outer Marker (OM, 4 NM) and Middle Marker (MM, 1 NM)
    const omDist = 4 * 1852;
    const mmDist = 1 * 1852;
    const omPos = {
      x: airport.x + (tdAlong - omDist) * sinH,
      z: airport.z - (tdAlong - omDist) * cosH,
      y: tdy + omDist * Math.tan(glideSlopeDeg * Math.PI / 180),
      name: 'OM (Outer Marker · 4 NM)'
    };
    const mmPos = {
      x: airport.x + (tdAlong - mmDist) * sinH,
      z: airport.z - (tdAlong - mmDist) * cosH,
      y: tdy + mmDist * Math.tan(glideSlopeDeg * Math.PI / 180),
      name: 'MM (Middle Marker · 1 NM)'
    };

    return {
      airport,
      touchdown: { x: tdx, y: tdy, z: tdz },
      coneVertices: [
        { x: tdx, y: tdy, z: tdz },
        { x: leftX, y: featherAltitude, z: leftZ },
        { x: rightX, y: featherAltitude, z: rightZ }
      ],
      om: omPos,
      mm: mmPos,
      glideSlope: glideSlopeDeg
    };
  }

  // Build 3D Precision Approach Lighting System (PALS: ALSF-2 / Rabbit Flasher)
  function buildPrecisionLighting(THREE, parentGroup, airport) {
    if (!THREE || !parentGroup || !airport || airport.carrier) return null;

    const palsGroup = new THREE.Group();
    palsGroup.name = airport.code + ' PALS';
    parentGroup.add(palsGroup);

    const halfLen = airport.length / 2;
    const heading = airport.heading;
    const sinH = Math.sin(heading), cosH = Math.cos(heading);

    // Materials
    const whiteLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x22ff66 });
    const blueLightMat = new THREE.MeshBasicMaterial({ color: 0x3388ff });
    const rabbitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });

    const lightGeo = new THREE.BoxGeometry(0.35, 0.15, 0.35);

    // 1. Approach Light Bars (ALSF-2: 720m extending backwards from threshold)
    const rabbitFlasherMeshes = [];
    for (let d = 30; d <= 720; d += 30) {
      const along = -halfLen - d;
      // White 5-light barrette across centerline
      for (let offset = -4; offset <= 4; offset += 2) {
        const lx = offset * cosH + along * sinH;
        const lz = offset * sinH - along * cosH;
        const m = new THREE.Mesh(lightGeo, whiteLightMat);
        m.position.set(airport.x + lx, airport.elevation + 0.3, airport.z + lz);
        palsGroup.add(m);
      }
      // Red side barrettes for first 300m
      if (d <= 300) {
        for (const side of [-1, 1]) {
          const sx = (side * 12) * cosH + along * sinH;
          const sz = (side * 12) * sinH - along * cosH;
          const rm = new THREE.Mesh(lightGeo, redLightMat);
          rm.position.set(airport.x + sx, airport.elevation + 0.3, airport.z + sz);
          palsGroup.add(rm);
        }
      }
      // Sequenced Flasher (Rabbit) single center light
      const rx = along * sinH;
      const rz = -along * cosH;
      const rabbitMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.6), rabbitMat.clone());
      rabbitMesh.position.set(airport.x + rx, airport.elevation + 0.5, airport.z + rz);
      palsGroup.add(rabbitMesh);
      rabbitFlasherMeshes.push({ mesh: rabbitMesh, dist: d });
    }

    // 2. Runway Centerline Inset Lights (White -> Alternating Red/White -> Red)
    for (let d = -halfLen + 30; d <= halfLen - 30; d += 15) {
      const remainingDist = halfLen - d;
      let mat = whiteLightMat;
      if (remainingDist <= 300) {
        mat = redLightMat; // Final 300m all red
      } else if (remainingDist <= 900) {
        mat = (Math.floor(d / 15) % 2 === 0) ? whiteLightMat : redLightMat; // Alternating
      }
      const cx = d * sinH;
      const cz = -d * cosH;
      const m = new THREE.Mesh(lightGeo, mat);
      m.position.set(airport.x + cx, airport.elevation + 0.12, airport.z + cz);
      palsGroup.add(m);
    }

    // 3. Touchdown Zone Lights (TDZ: first 900m white barrettes)
    for (let d = -halfLen + 60; d <= -halfLen + 900; d += 60) {
      for (const side of [-1, 1]) {
        for (let b = 0; b < 3; b++) {
          const latOffset = side * (airport.width * 0.28 + b * 1.5);
          const tx = latOffset * cosH + d * sinH;
          const tz = latOffset * sinH - d * cosH;
          const tm = new THREE.Mesh(lightGeo, whiteLightMat);
          tm.position.set(airport.x + tx, airport.elevation + 0.14, airport.z + tz);
          palsGroup.add(tm);
        }
      }
    }

    // 4. Taxiway Edge Blue Lights & Centerline Green Lights
    const apronOffset = airport.apron || 175;
    for (let d = -halfLen + 100; d <= halfLen - 100; d += 40) {
      // Taxiway green centerline
      const gx = (apronOffset * 0.7) * cosH + d * sinH;
      const gz = (apronOffset * 0.7) * sinH - d * cosH;
      const gm = new THREE.Mesh(lightGeo, greenLightMat);
      gm.position.set(airport.x + gx, airport.elevation + 0.12, airport.z + gz);
      palsGroup.add(gm);
      // Taxiway edge blue
      for (const edge of [-15, 15]) {
        const bx = (apronOffset * 0.7 + edge) * cosH + d * sinH;
        const bz = (apronOffset * 0.7 + edge) * sinH - d * cosH;
        const bm = new THREE.Mesh(lightGeo, blueLightMat);
        bm.position.set(airport.x + bx, airport.elevation + 0.12, airport.z + bz);
        palsGroup.add(bm);
      }
    }

    return {
      palsGroup,
      updateRabbit: function(elapsedTime) {
        // Rabbit flasher sweeps inward from 720m to 30m twice a second (2 Hz)
        const cycle = (elapsedTime * 2.0) % 1.0;
        const activeIdx = Math.floor(cycle * rabbitFlasherMeshes.length);
        rabbitFlasherMeshes.forEach((item, idx) => {
          const distFromWave = Math.abs(idx - activeIdx);
          if (distFromWave === 0) {
            item.mesh.material.opacity = 1.0;
          } else if (distFromWave === 1) {
            item.mesh.material.opacity = 0.35;
          } else {
            item.mesh.material.opacity = 0.0;
          }
        });
      }
    };
  }

  // Draw Aeronautical Overlay onto Overview Navigation Map Canvas
  function drawAirwaysOverlay(canvas, transformFn) {
    if (!canvas || typeof transformFn !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // 1. Draw Airways Corridors
    for (const airway of civilAirways) {
      ctx.strokeStyle = airway.color ? '#' + airway.color.toString(16).padStart(6, '0') : '#38e8ac';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 5]);

      ctx.beginPath();
      let first = true;
      for (const fixId of airway.fixes) {
        const vor = taiwanVORStations.find(v => v.id === fixId);
        if (!vor || !vor.x) continue;
        const pt = transformFn(vor.x, vor.z);
        if (first) {
          ctx.moveTo(pt.x, pt.y);
          first = false;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();

      // Airway Label (MEA & Name)
      if (airway.fixes.length >= 2) {
        const v1 = taiwanVORStations.find(v => v.id === airway.fixes[0]);
        const v2 = taiwanVORStations.find(v => v.id === airway.fixes[1]);
        if (v1 && v2 && v1.x && v2.x) {
          const midX = (v1.x + v2.x) / 2;
          const midZ = (v1.z + v2.z) / 2;
          const midPt = transformFn(midX, midZ);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${airway.id} [MEA ${airway.mea}']`, midPt.x, midPt.y - 6);
        }
      }
    }
    ctx.setLineDash([]);

    // 2. Draw VOR Compass Roses
    for (const vor of taiwanVORStations) {
      if (!vor.x) continue;
      const pt = transformFn(vor.x, vor.z);

      // Hexagonal VOR Icon
      ctx.strokeStyle = '#65dcff';
      ctx.fillStyle = 'rgba(12, 38, 54, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const r = 7;
      for (let i = 0; i < 6; i++) {
        const a = (i * 60) * Math.PI / 180;
        const hx = pt.x + r * Math.cos(a);
        const hy = pt.y + r * Math.sin(a);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Center dot
      ctx.fillStyle = '#65dcff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Station Identifier & Frequency
      ctx.font = 'bold 9.5px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(vor.id, pt.x, pt.y + 16);
      ctx.fillStyle = '#9ac2d7';
      ctx.font = '8px monospace';
      ctx.fillText(vor.freq, pt.x, pt.y + 25);
    }

    ctx.restore();
  }

  function getVORStations() {
    return taiwanVORStations;
  }

  function getAllVORStations() {
    return [...taiwanVORStations, ...internationalVORStations];
  }

  const airwaysNavModule = {
    taiwanVORStations,
    internationalVORStations,
    getVORStations,
    getAllVORStations,
    civilAirways,
    ensureVORCoordinates,
    tuneVOR,
    getILSFeatherDetails,
    buildPrecisionLighting,
    drawAirwaysOverlay
  };

  if (typeof root !== 'undefined') root.airwaysNav = airwaysNavModule;
  if (typeof window !== 'undefined') window.airwaysNav = airwaysNavModule;
  if (typeof global !== 'undefined') global.airwaysNav = airwaysNavModule;
  if (typeof module !== 'undefined' && module.exports) module.exports = airwaysNavModule;
})(typeof window !== 'undefined' ? window : global);
