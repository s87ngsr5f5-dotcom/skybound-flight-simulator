'use strict';

/**
 * SKYBOUND GLOBAL - Multiplayer Room System
 * 房間號多人線上連線系統 (Zero-Backend Serverless via MQTT WebSocket & BroadcastChannel)
 */
const multiplayer = (() => {
  let roomId = '';
  let callsign = '';
  let localId = 'pilot_' + Math.random().toString(36).slice(2, 9);
  let isConnected = false;
  let broadcastChannel = null;
  let mqttSocket = null;
  let lastBroadcast = 0;
  let pingTimer = null;
  const peers = new Map();
  const listeners = new Set();
  const radioMessages = [];
  const killFeed = [];
  const leaderboardScores = new Map();
  let localHp = 100;
  let localKills = 0;
  let localDeaths = 0;
  let isCombatMode = false;

  const defaultRoom = '8888';
  const defaultCallsign = 'SKY-' + Math.floor(100 + Math.random() * 900);

  // Fallback / Public MQTT broker endpoints
  const BROKERS = [
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081'
  ];
  let brokerIndex = 0;

  function notify(event, data) {
    for (const fn of listeners) {
      try { fn(event, data); } catch (e) { console.error('Multiplayer listener error:', e); }
    }
  }

  function encodeMqttConnect(clientId) {
    const id = new TextEncoder().encode(clientId);
    const varHeader = [0, 4, 77, 81, 84, 84, 4, 2, 0, 60];
    const payload = [id.length >> 8, id.length & 0xff, ...id];
    const remLen = varHeader.length + payload.length;
    return new Uint8Array([0x10, remLen, ...varHeader, ...payload]);
  }

  function encodeMqttSubscribe(topic, packetId = 1) {
    const t = new TextEncoder().encode(topic);
    const varHeader = [packetId >> 8, packetId & 0xff];
    const payload = [t.length >> 8, t.length & 0xff, ...t, 0];
    const remLen = varHeader.length + payload.length;
    return new Uint8Array([0x82, remLen, ...varHeader, ...payload]);
  }

  function encodeMqttPublish(topic, jsonString) {
    const t = new TextEncoder().encode(topic);
    const p = new TextEncoder().encode(jsonString);
    const varHeader = [t.length >> 8, t.length & 0xff, ...t];
    const remLen = varHeader.length + p.length;
    // RemLen encoding
    const lenBytes = [];
    let l = remLen;
    do {
      let b = l % 128;
      l = Math.floor(l / 128);
      if (l > 0) b |= 128;
      lenBytes.push(b);
    } while (l > 0);
    return new Uint8Array([0x30, ...lenBytes, ...varHeader, ...p]);
  }

  function connectMqtt(targetRoom) {
    if (mqttSocket) {
      try { mqttSocket.close(); } catch {}
      mqttSocket = null;
    }
    const url = BROKERS[brokerIndex % BROKERS.length];
    try {
      const ws = new WebSocket(url, ['mqttv3.1', 'mqtt']);
      ws.binaryType = 'arraybuffer';
      mqttSocket = ws;

      ws.onopen = () => {
        ws.send(encodeMqttConnect(localId));
        clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(new Uint8Array([0xc0, 0x00])); // PINGREQ
        }, 25000);
      };

      ws.onmessage = (event) => {
        const bytes = new Uint8Array(event.data);
        const type = bytes[0] >> 4;
        if (type === 2) {
          // CONNACK
          ws.send(encodeMqttSubscribe(`skybound/room/${targetRoom}`));
          isConnected = true;
          notify('connect', { roomId: targetRoom, callsign });
        } else if (type === 3) {
          // PUBLISH packet received
          try {
            let offset = 1;
            let multiplier = 1, remLen = 0;
            let digit;
            do {
              digit = bytes[offset++];
              remLen += (digit & 127) * multiplier;
              multiplier *= 128;
            } while ((digit & 128) !== 0);

            const topicLen = (bytes[offset] << 8) | bytes[offset + 1];
            offset += 2 + topicLen;
            const payloadBytes = bytes.slice(offset);
            const text = new TextDecoder('utf-8').decode(payloadBytes);
            const msg = JSON.parse(text);
            handleIncomingMessage(msg);
          } catch {}
        }
      };

      ws.onerror = () => {
        // Try fallback broker on error
        brokerIndex++;
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        if (isConnected && roomId === targetRoom) {
          setTimeout(() => {
            if (roomId === targetRoom) connectMqtt(targetRoom);
          }, 4000);
        }
      };
    } catch (e) {
      // Offline or network sandbox
    }
  }

  function recordKillEvent(killer, victim) {
    if (!killer || !victim) return;
    const k = leaderboardScores.get(killer) || { callsign: killer, kills: 0, deaths: 0 };
    k.kills++;
    leaderboardScores.set(killer, k);

    const v = leaderboardScores.get(victim) || { callsign: victim, kills: 0, deaths: 0 };
    v.deaths++;
    leaderboardScores.set(victim, v);

    notify('leaderboard', getLeaderboard());
  }

  function getLeaderboard() {
    if (callsign) {
      const self = leaderboardScores.get(callsign) || { callsign, kills: localKills, deaths: localDeaths };
      self.kills = Math.max(self.kills, localKills);
      self.deaths = Math.max(self.deaths, localDeaths);
      leaderboardScores.set(callsign, self);
    }
    const list = Array.from(leaderboardScores.values());
    list.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    return list.map((item, idx) => ({
      rank: idx + 1,
      callsign: item.callsign,
      kills: item.kills,
      deaths: item.deaths,
      kd: (item.kills / Math.max(1, item.deaths)).toFixed(2)
    }));
  }

  function speakTacticalRadio(phrase) {
    if (!phrase) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(phrase);
        utter.rate = 1.15;
        utter.pitch = 1.05;
        utter.volume = 0.9;
        utter.lang = 'en-US';
        window.speechSynthesis.speak(utter);
      } catch {}
    }
    notify('tactical_radio_callout', phrase);
  }

  function handleCombatMessage(msg) {
    if (!msg || msg.roomId !== roomId) return;
    if (msg.action === 'hit') {
      if (msg.targetId === localId) {
        const dmg = msg.damage || 35;
        localHp = Math.max(0, localHp - dmg);
        notify('damage_received', { damage: dmg, attacker: msg.callsign, weapon: msg.weapon, remainingHp: localHp });
        if (localHp <= 0) {
          localDeaths++;
          sendCombatEvent('kill', {
            killerId: msg.sender,
            killerCallsign: msg.callsign,
            victimId: localId,
            victimCallsign: callsign,
            weapon: msg.weapon || '飛彈'
          });
          notify('player_killed', { killer: msg.callsign, weapon: msg.weapon });
          speakTacticalRadio('Mayday! Mayday! Aircraft destroyed, ejecting!');
        } else {
          speakTacticalRadio('Warning! We took a direct hit!');
        }
      } else {
        const peer = peers.get(msg.targetId);
        if (peer) {
          peer.hp = Math.max(0, (peer.hp ?? 100) - (msg.damage || 35));
        }
      }
    } else if (msg.action === 'kill') {
      const killer = msg.killerCallsign || msg.callsign || '機長';
      const victim = msg.victimCallsign || '敵機';
      recordKillEvent(killer, victim);
      killFeed.unshift({
        killer,
        victim,
        weapon: msg.weapon || '飛彈',
        time: Date.now()
      });
      if (killFeed.length > 15) killFeed.pop();
      if (msg.killerId === localId) {
        localKills++;
        notify('player_scored_kill', { victim: msg.victimCallsign, weapon: msg.weapon });
        speakTacticalRadio('Splash one! Target destroyed!');
      } else if (msg.victimId !== localId) {
        speakTacticalRadio(`Target down! ${killer} splashed ${victim}!`);
      }
      notify('kill_feed', killFeed);
    } else if (msg.action === 'fire_missile') {
      if (msg.targetId === localId) {
        speakTacticalRadio('Warning! Missile launch detected! Chaff flare!');
      }
      notify('enemy_fire_missile', msg);
    } else if (msg.action === 'fire_gun') {
      notify('enemy_fire_gun', msg);
    } else if (msg.action === 'flare') {
      notify('enemy_flare', msg);
    }
  }

  function handleIncomingMessage(msg) {
    if (!msg || msg.sender === localId || msg.roomId !== roomId) return;
    if (msg.type === 'state') {
      let peer = peers.get(msg.sender);
      if (!peer) {
        peer = {
          id: msg.sender,
          callsign: msg.callsign || 'UNKNOWN',
          aircraftId: msg.aircraftId || 'c172s',
          state: { ...msg.state },
          targetState: { ...msg.state },
          lastSeen: performance.now(),
          mesh: null,
          billboard: null,
          hp: msg.state?.hp ?? 100,
          isCombat: Boolean(msg.state?.combat)
        };
        peers.set(msg.sender, peer);
        notify('peer_joined', peer);
      } else {
        peer.callsign = msg.callsign || peer.callsign;
        peer.aircraftId = msg.aircraftId || peer.aircraftId;
        peer.targetState = { ...msg.state };
        peer.hp = msg.state?.hp ?? peer.hp ?? 100;
        peer.isCombat = Boolean(msg.state?.combat);
        peer.lastSeen = performance.now();
      }
    } else if (msg.type === 'leave') {
      const peer = peers.get(msg.sender);
      if (peer) {
        destroyPeer3D(peer);
        peers.delete(msg.sender);
        notify('peer_left', peer);
      }
    } else if (msg.type === 'radio') {
      radioMessages.unshift({ sender: msg.callsign || '機長', text: msg.text, time: Date.now() });
      if (radioMessages.length > 20) radioMessages.pop();
      notify('radio', { sender: msg.callsign || '機長', text: msg.text });
    } else if (msg.type === 'combat') {
      handleCombatMessage(msg);
    }
  }

  function joinRoom(newRoom, newCallsign) {
    leaveRoom();
    roomId = (newRoom || defaultRoom).toString().trim().toUpperCase();
    callsign = (newCallsign || defaultCallsign).toString().trim().toUpperCase();

    // Local / cross-tab broadcast channel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        broadcastChannel = new BroadcastChannel(`skybound_room_${roomId}`);
        broadcastChannel.onmessage = (e) => handleIncomingMessage(e.data);
      } catch {}
    }

    // Connect remote broker
    connectMqtt(roomId);
    isConnected = true;
    notify('connect', { roomId, callsign });

    // Announce presence
    sendRadio(`進入房間 ${roomId}`);
    return { roomId, callsign };
  }

  function leaveRoom() {
    if (isConnected && roomId) {
      const leaveMsg = { type: 'leave', sender: localId, roomId, callsign };
      sendRaw(leaveMsg);
    }
    if (broadcastChannel) {
      try { broadcastChannel.close(); } catch {}
      broadcastChannel = null;
    }
    if (mqttSocket) {
      try { mqttSocket.close(); } catch {}
      mqttSocket = null;
    }
    clearInterval(pingTimer);
    peers.forEach(peer => destroyPeer3D(peer));
    peers.clear();
    leaderboardScores.clear();
    isConnected = false;
    roomId = '';
    notify('disconnect', {});
  }

  function sendRaw(msg) {
    if (broadcastChannel) {
      try { broadcastChannel.postMessage(msg); } catch {}
    }
    if (mqttSocket && mqttSocket.readyState === WebSocket.OPEN && roomId) {
      try {
        const json = JSON.stringify(msg);
        mqttSocket.send(encodeMqttPublish(`skybound/room/${roomId}`, json));
      } catch {}
    }
  }

  function sendRadio(text) {
    if (!isConnected || !roomId || !text) return;
    const cleanText = text.trim();
    radioMessages.unshift({ sender: callsign || '機長', text: cleanText, time: Date.now() });
    if (radioMessages.length > 20) radioMessages.pop();
    notify('radio', { sender: callsign || '機長', text: cleanText });
    const msg = { type: 'radio', sender: localId, roomId, callsign, text: cleanText };
    sendRaw(msg);
  }

  function sendCombatEvent(action, data = {}) {
    if (!isConnected || !roomId) return;
    const msg = {
      type: 'combat',
      action,
      sender: localId,
      callsign,
      roomId,
      timestamp: Date.now(),
      ...data
    };
    sendRaw(msg);
    if (action === 'fire_missile') {
      speakTacticalRadio('Fox 2! Missile away!');
    } else if (action === 'fire_gun') {
      speakTacticalRadio('Guns, guns, guns!');
    } else if (action === 'flare') {
      speakTacticalRadio('Deploying countermeasures!');
    } else if (action === 'kill') {
      const killer = data.killerCallsign || callsign;
      const victim = data.victimCallsign || '敵機';
      recordKillEvent(killer, victim);
      killFeed.unshift({
        killer,
        victim,
        weapon: data.weapon || 'AIM-9X',
        time: Date.now()
      });
      if (killFeed.length > 15) killFeed.pop();
      notify('kill_feed', killFeed);
    }
  }

  function broadcastFlight(f, profile) {
    if (!isConnected || !roomId || !f) return;
    const now = performance.now();
    if (now - lastBroadcast < 95) return; // ~10 Hz
    lastBroadcast = now;

    const payload = {
      type: 'state',
      sender: localId,
      roomId,
      callsign,
      aircraftId: profile?.id || 'c172s',
      state: {
        x: Math.round(f.x * 10) / 10,
        y: Math.round(f.y * 10) / 10,
        z: Math.round(f.z * 10) / 10,
        pitch: Math.round((f.pitch || 0) * 1000) / 1000,
        bank: Math.round((f.bank || 0) * 1000) / 1000,
        heading: Math.round((f.heading || 0) * 1000) / 1000,
        speed: Math.round((f.speed || 0) * 10) / 10,
        vy: Math.round((f.vy || 0) * 10) / 10,
        flaps: f.flaps || 0,
        gear: f.gear !== false,
        lights: Boolean(f.lights),
        contrails: Boolean(f.y > 7200 && f.power > 0.6),
        hp: localHp,
        combat: Boolean(isCombatMode || f.combatMode || f.tactical?.armed)
      }
    };
    sendRaw(payload);
  }

  function destroyPeer3D(peer) {
    if (peer.mesh) {
      try {
        if (peer.mesh.parent) peer.mesh.parent.remove(peer.mesh);
      } catch {}
      peer.mesh = null;
    }
    if (peer.billboard) {
      try {
        const sprite = peer.billboard.sprite || peer.billboard;
        if (sprite && sprite.parent) sprite.parent.remove(sprite);
        if (sprite?.material?.map) sprite.material.map.dispose();
        if (sprite?.material) sprite.material.dispose();
      } catch {}
      peer.billboard = null;
    }
  }

  function createBillboardSprite(callsign, aircraftId) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 84;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(32, 8.4, 1);

    function updateLabel(altM, speedKmh, distKm, hp, isCombat) {
      ctx.clearRect(0, 0, 320, 84);
      // Background badge
      ctx.fillStyle = 'rgba(10, 22, 34, 0.85)';
      ctx.strokeStyle = (isCombat || (hp !== undefined && hp < 100)) ? '#ff5252' : '#00e5ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(4, 4, 312, 76, 12);
      } else {
        ctx.rect(4, 4, 312, 76);
      }
      ctx.fill();
      ctx.stroke();

      // Pilot Callsign
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      const combatTag = isCombat ? ' ⚔' : '';
      ctx.fillText(`✈ ${callsign}${combatTag}`, 18, 36);

      // Aircraft & Telemetry
      const hpVal = Math.max(0, Math.min(100, Math.round(hp ?? 100)));
      const hpColor = hpVal <= 30 ? '#ff4d4f' : hpVal <= 70 ? '#ffcf5e' : '#6ee8b3';
      ctx.fillStyle = hpColor;
      ctx.font = 'bold 18px monospace';
      const hpText = (isCombat || hpVal < 100) ? ` · HP ${hpVal}%` : '';
      ctx.fillText(`${aircraftId.toUpperCase()} · ${Math.round(altM)}m · ${Math.round(speedKmh)}km/h · ${distKm.toFixed(1)}km${hpText}`, 18, 64);
      texture.needsUpdate = true;
    }

    return { sprite, updateLabel };
  }

  /**
   * Called on every 3D animation frame in render()
   */
  function updatePeers3D(dt, now, ownFlight, scene, camera) {
    if (!isConnected || !scene) return;
    const timeout = 12000;

    for (const [id, peer] of peers.entries()) {
      // Timeout inactive peers
      if (now - peer.lastSeen > timeout) {
        destroyPeer3D(peer);
        peers.delete(id);
        notify('peer_left', peer);
        continue;
      }

      // Smooth interpolation (Dead reckoning & Lerp)
      const t = peer.targetState, s = peer.state;
      const lerpFactor = Math.min(1, dt * 12);
      s.x += (t.x - s.x) * lerpFactor;
      s.y += (t.y - s.y) * lerpFactor;
      s.z += (t.z - s.z) * lerpFactor;
      s.pitch += (t.pitch - s.pitch) * lerpFactor;
      s.bank += (t.bank - s.bank) * lerpFactor;
      // Heading wrap interpolation
      let dh = t.heading - s.heading;
      while (dh < -Math.PI) dh += Math.PI * 2;
      while (dh > Math.PI) dh -= Math.PI * 2;
      s.heading += dh * lerpFactor;
      s.speed = t.speed;
      s.gear = t.gear;
      s.flaps = t.flaps;
      s.lights = t.lights;

      // Spawn 3D mesh if not present
      if (!peer.mesh) {
        const fleetList = typeof fleet !== 'undefined' ? fleet : [];
        const profile = fleetList.find(a => a.id === peer.aircraftId) || fleetList[0];
        if (profile) {
          if (profile.helicopter && typeof buildHelicopter === 'function') {
            peer.mesh = buildHelicopter(profile, scene);
          } else if (typeof buildBenchmarkAirframe === 'function') {
            peer.mesh = buildBenchmarkAirframe(profile, scene);
          }
          if (peer.mesh) {
            if (typeof aircraftSkins !== 'undefined' && typeof THREE !== 'undefined') {
              aircraftSkins.applyLivery(peer.mesh, profile, THREE);
            }
            peer.mesh.name = `Multiplayer_${peer.callsign}`;
            scene.add(peer.mesh);
          }
        }
      }

      // Update 3D aircraft position & orientation
      if (peer.mesh) {
        peer.mesh.position.set(s.x, s.y, s.z);
        peer.mesh.rotation.set(s.pitch, -s.heading, -s.bank, 'YXZ');

        // Gear & animation
        const ud = peer.mesh.userData;
        if (ud) {
          if (ud.gear) ud.gear.visible = Boolean(s.gear);
          if (ud.blades) {
            ud.blades.forEach(b => { b.rotation.z += dt * (15 + (s.speed || 50) * 0.4); });
          }
          if (ud.flaps) ud.flaps.forEach(f => { f.rotation.x = -s.flaps * 0.2; });
          if (ud.exhaustPlumes) {
            ud.exhaustPlumes.forEach(p => { p.visible = Boolean(s.speed > 250); });
          }
        }
      }

      // 3D Billboard Nameplate above aircraft
      if (!peer.billboard && camera) {
        peer.billboard = createBillboardSprite(peer.callsign, peer.aircraftId);
        scene.add(peer.billboard.sprite);
      }

      if (peer.billboard && ownFlight) {
        const dx = s.x - ownFlight.x, dz = s.z - ownFlight.z;
        const distKm = Math.hypot(dx, dz) / 1000;
        peer.billboard.sprite.position.set(s.x, s.y + 12, s.z);
        // Dynamic scale with distance
        const scale = Math.max(14, Math.min(85, distKm * 4.5 + 16));
        peer.billboard.sprite.scale.set(scale, scale * 0.26, 1);
        peer.billboard.sprite.visible = distKm < 45; // Visible within 45 km
        peer.billboard.updateLabel(s.y, s.speed * 3.6, distKm, peer.hp, peer.isCombat);
      }
    }
  }

  const PRESET_ROOMS = [
    { id: '8888', name: '公共大廳', desc: '自由空域 · 全機型' },
    { id: 'DOGFIGHT', name: '空戰纏鬥', desc: 'PVP 對決 · 飛彈機砲' },
    { id: 'CARRIER', name: '福特號航艦', desc: 'CVN-78 彈射攔截' },
    { id: 'REFUEL', name: '空中加油', desc: 'KC-135 編隊對接' },
    { id: 'RCSS-01', name: '松山起落航線', desc: '五邊飛行 · 起降練習' },
    { id: 'RCTP-HEAVY', name: '桃園客貨幹線', desc: '重型廣體 · 巡航練習' }
  ];

  function generateCustomRoomId() {
    const prefixes = ['SKY', 'ACE', 'TOPGUN', 'AIR', 'VIPER', 'HAWK', 'EAGLE'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${p}-${num}`;
  }

  function getRoomUrl(targetRoom) {
    const r = targetRoom || roomId || defaultRoom;
    if (typeof location !== 'undefined') {
      return `${location.origin}${location.pathname}?room=${encodeURIComponent(r)}`;
    }
    return `?room=${encodeURIComponent(r)}`;
  }

  function parseUrlRoom() {
    if (typeof location !== 'undefined' && location.search) {
      try {
        const params = new URLSearchParams(location.search);
        const r = params.get('room');
        if (r && r.trim()) return r.trim().toUpperCase();
      } catch {}
    }
    return '';
  }

  function computeFormationRendezvous(peer, offsetDistM = 600, lateralOffsetM = 90) {
    if (!peer || !peer.state) return null;
    const s = peer.state;
    const h = Number.isFinite(s.heading) ? s.heading : 0;
    const sinH = Math.sin(h), cosH = Math.cos(h);
    // Position offsetDistM behind peer and lateralOffsetM to right wing
    const rx = (s.x || 0) - sinH * offsetDistM + cosH * lateralOffsetM;
    const rz = (s.z || 0) + cosH * offsetDistM + sinH * lateralOffsetM;
    const ry = Math.max(150, Number.isFinite(s.y) ? s.y : 600);
    const speed = Math.max(95, Number.isFinite(s.speed) ? s.speed : 140);
    return {
      x: rx,
      y: ry,
      z: rz,
      heading: h,
      speed,
      vx: sinH * speed,
      vy: 0,
      vz: -cosH * speed,
      pitch: 0,
      bank: 0
    };
  }

  function getNearestPeer(ownFlight) {
    if (!ownFlight || peers.size === 0) return null;
    let best = null, bestDist = Infinity;
    for (const peer of peers.values()) {
      if (!peer.state) continue;
      const d = Math.hypot((peer.state.x || 0) - ownFlight.x, (peer.state.z || 0) - ownFlight.z);
      if (d < bestDist) {
        bestDist = d;
        best = peer;
      }
    }
    return best ? { peer: best, distance: bestDist } : null;
  }

  function computeFormationGuidance(ownFlight, peer, spacingM = 180, lateralM = 55) {
    if (!ownFlight || !peer || !peer.state) return null;
    const s = peer.state;
    const h = Number.isFinite(s.heading) ? s.heading : 0;
    const sinH = Math.sin(h), cosH = Math.cos(h);
    const slotX = (s.x || 0) - sinH * spacingM + cosH * lateralM;
    const slotZ = (s.z || 0) + cosH * spacingM + sinH * lateralM;
    const slotY = Math.max(150, Number.isFinite(s.y) ? s.y : ownFlight.y);
    const dx = slotX - ownFlight.x, dz = slotZ - ownFlight.z;
    const slotDist = Math.hypot(dx, dz);
    const bearingToSlot = Math.atan2(dx, -dz);
    const wrapDiff = (target, current) => {
      let d = target - current;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    };
    const alignBlend = Math.min(1, slotDist / 380);
    const desiredHeading = h + wrapDiff(bearingToSlot, h) * alignBlend;
    const headingErr = wrapDiff(desiredHeading, ownFlight.heading || 0);
    const roll = Math.max(-0.55, Math.min(0.55, headingErr * 1.8));
    const altErr = slotY - (ownFlight.y || 0);
    const desiredVS = Math.max(-12, Math.min(12, altErr * 0.18));
    const pitch = Math.max(-0.5, Math.min(0.6, 0.08 + (desiredVS - (ownFlight.vy || 0)) * 0.09));
    const leaderSpeed = Math.max(85, Number.isFinite(s.speed) ? s.speed : 130);
    const catchupBoost = Math.max(-25, Math.min(60, (slotDist - 40) * 0.08));
    const targetSpeed = leaderSpeed + catchupBoost;
    const speedErr = targetSpeed - (ownFlight.speed || 0);
    const throttle = Math.max(-0.35, Math.min(0.45, speedErr * 0.025));
    return { slotX, slotY, slotZ, slotDist, targetSpeed, roll, pitch, throttle };
  }

  return {
    joinRoom,
    leaveRoom,
    sendRadio,
    sendCombatEvent,
    broadcastFlight,
    updatePeers3D,
    computeFormationRendezvous,
    computeFormationGuidance,
    getNearestPeer,
    getRoomId: () => roomId,
    getCallsign: () => callsign,
    getLocalId: () => localId,
    isConnected: () => isConnected,
    getPeers: () => Array.from(peers.values()),
    getRadioMessages: () => [...radioMessages],
    getKillFeed: () => [...killFeed],
    getLocalHp: () => localHp,
    setLocalHp: (val) => { localHp = Math.max(0, Math.min(100, val)); },
    getLocalStats: () => ({ hp: localHp, kills: localKills, deaths: localDeaths }),
    resetCombatStats: () => { localHp = 100; localKills = 0; localDeaths = 0; },
    setCombatMode: (val) => { isCombatMode = Boolean(val); },
    isCombatMode: () => isCombatMode,
    handleIncomingMessage,
    injectPeer: (peer) => { peers.set(peer.id, peer); },
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
    generateCustomRoomId,
    getPresetRooms: () => [...PRESET_ROOMS],
    getRoomUrl,
    parseUrlRoom,
    switchRoom: (r, c) => joinRoom(r, c),
    getLeaderboard,
    speakTacticalRadio,
    recordKillEvent,
    defaultRoom,
    defaultCallsign
  };
})();

if (typeof module !== 'undefined') module.exports = multiplayer;
