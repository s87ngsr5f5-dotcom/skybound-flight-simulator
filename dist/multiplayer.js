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
          billboard: null
        };
        peers.set(msg.sender, peer);
        notify('peer_joined', peer);
      } else {
        peer.callsign = msg.callsign || peer.callsign;
        peer.aircraftId = msg.aircraftId || peer.aircraftId;
        peer.targetState = { ...msg.state };
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
        contrails: Boolean(f.y > 7200 && f.power > 0.6)
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
        if (peer.billboard.parent) peer.billboard.parent.remove(peer.billboard);
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

    function updateLabel(altM, speedKmh, distKm) {
      ctx.clearRect(0, 0, 320, 84);
      // Background badge
      ctx.fillStyle = 'rgba(10, 22, 34, 0.85)';
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(4, 4, 312, 76, 12);
      ctx.fill();
      ctx.stroke();

      // Pilot Callsign
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`✈ ${callsign}`, 18, 36);

      // Aircraft & Telemetry
      ctx.fillStyle = '#6ee8b3';
      ctx.font = 'bold 19px monospace';
      ctx.fillText(`${aircraftId.toUpperCase()} · ${Math.round(altM)}m · ${Math.round(speedKmh)}km/h · ${distKm.toFixed(1)}km`, 18, 64);
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
        peer.billboard.updateLabel(s.y, s.speed * 3.6, distKm);
      }
    }
  }

  return {
    joinRoom,
    leaveRoom,
    sendRadio,
    broadcastFlight,
    updatePeers3D,
    getRoomId: () => roomId,
    getCallsign: () => callsign,
    isConnected: () => isConnected,
    getPeers: () => Array.from(peers.values()),
    getRadioMessages: () => [...radioMessages],
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
    defaultRoom,
    defaultCallsign
  };
})();

if (typeof module !== 'undefined') module.exports = multiplayer;
