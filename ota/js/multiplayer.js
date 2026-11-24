(() => {
  'use strict';

  const DEFAULT_SERVER_URL = 'wss://brasilrp-server.onrender.com';
  const STORAGE_SERVER_KEY = 'brasilrp_mp_server';
  const STORAGE_NAME_KEY = 'brasilrp_mp_name';

  const VOICE_MIN_DIST = 6;   // 100% volume ate 6 metros
  const VOICE_MAX_DIST = 35;  // mudo acima de 35 metros
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  let serverUrl = localStorage.getItem(STORAGE_SERVER_KEY) || DEFAULT_SERVER_URL;
  let playerName = localStorage.getItem(STORAGE_NAME_KEY) || ('RP_' + Math.floor(100 + Math.random() * 899));
  let deviceId = localStorage.getItem('brasilrp_device_id');
  if (!deviceId) {
    deviceId = 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem('brasilrp_device_id', deviceId); } catch (_) {}
  }

  let ws = null;
  let myId = null;
  let connected = false;
  let reconnectTimer = null;
  let onlineCount = 0;

  // Voice WebRTC state
  let micEnabled = false;
  let localStream = null;
  let audioCtx = null;
  let micAnalyser = null;
  let micData = null;
  let isSpeaking = false;
  let micHoldTimer = 0;
  let micGateOpen = false;

  const peers = new Map();       // peerId -> { pc, audioEl }
  const remotePlayers = new Map(); // id -> { id, name, targetX, targetY, targetZ, targetRotY, speed, inCar, speaking, mesh, labelSprite, labelCtx, labelTex, lastLabelKey, walkPhase }

  const el = (id) => document.getElementById(id);
  const ui = {
    nameInput: el('mpNameInput'),
    statusPill: el('mpStatusPill'),
    btnVoice: el('btnVoice'),
    btnChatToggle: el('btnChatToggle'),
    chatBox: el('rpChatBox'),
    chatLog: el('rpChatLog'),
    chatInput: el('rpChatInput'),
    btnSendChat: el('btnSendChat'),
    btnCloseChat: el('btnCloseChat')
  };

  if (ui.nameInput) {
    ui.nameInput.value = playerName;
    ui.nameInput.addEventListener('change', () => {
      const v = ui.nameInput.value.trim().slice(0, 16);
      if (v) {
        playerName = v;
        localStorage.setItem(STORAGE_NAME_KEY, playerName);
        sendWS({ type: 'join', name: playerName });
      }
    });
  }

  function toast(msg) {
    if (window.BrasilRPBridge && typeof window.BrasilRPBridge.showToast === 'function') {
      window.BrasilRPBridge.showToast(msg);
    }
  }

  function addChatLine(text, kind) {
    if (!ui.chatLog) return;
    const div = document.createElement('div');
    div.className = 'rp-chat-msg' + (kind ? ' ' + kind : '');
    div.textContent = text;
    ui.chatLog.appendChild(div);
    while (ui.chatLog.children.length > 40) {
      ui.chatLog.removeChild(ui.chatLog.firstChild);
    }
    ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
  }

  function addPlayerChat(name, text) {
    if (!ui.chatLog) return;
    const div = document.createElement('div');
    if (text.startsWith('/me ')) {
      div.className = 'rp-chat-msg me';
      div.textContent = '* ' + name + ' ' + text.slice(4);
    } else if (text.startsWith('/do ')) {
      div.className = 'rp-chat-msg sys';
      div.textContent = '[RP] ' + text.slice(4) + ' ((' + name + '))';
    } else {
      div.className = 'rp-chat-msg';
      const b = document.createElement('b');
      b.textContent = name + ': ';
      div.appendChild(b);
      div.appendChild(document.createTextNode(text));
    }
    ui.chatLog.appendChild(div);
    while (ui.chatLog.children.length > 40) {
      ui.chatLog.removeChild(ui.chatLog.firstChild);
    }
    ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
  }

  function updateStatusUI() {
    const islandTxt = el('phoneIslandText');
    if (connected) {
      const cnt = Math.max(1, onlineCount);
      if (ui.statusPill) {
        ui.statusPill.className = 'mp-pill online';
        ui.statusPill.textContent = '🟢 ' + cnt;
      }
      if (islandTxt) islandTxt.textContent = cnt + ' Online • 5G';
    } else {
      if (ui.statusPill) {
        ui.statusPill.className = 'mp-pill offline';
        ui.statusPill.textContent = '⚪';
      }
      if (islandTxt) islandTxt.textContent = 'Reconectando...';
    }
  }

  function sendWS(obj) {
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify(obj)); } catch (_) {}
    }
  }

  // --- Avatar 3D dos jogadores remotos ---
  function makeLabelSprite(name, speaking) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.8, 0.45, 1);
    sprite.position.set(0, 2.15, 0);
    drawLabel(ctx, tex, name, speaking);
    return { sprite, ctx, tex };
  }

  function drawLabel(ctx, tex, name, speaking, inCar) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = speaking ? 'rgba(0, 170, 80, 0.88)' : 'rgba(6, 12, 22, 0.82)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 44, 14);
    ctx.fill();
    ctx.strokeStyle = speaking ? '#69f0ae' : 'rgba(0, 240, 255, 0.72)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const prefix = (speaking ? '🔊 ' : '') + (inCar ? '🏎️ ' : '');
    ctx.fillText(prefix + String(name || 'Jogador').slice(0, 14), 128, 33);
    tex.needsUpdate = true;
  }

  function createRemoteAvatar(p) {
    const bridge = window.BrasilRPBridge;
    if (!bridge || !bridge.scene || typeof THREE === 'undefined') return null;

    const group = new THREE.Group();
    const numId = parseInt(String(p.id).replace(/\D/g, ''), 10) || 1;

    // 1. Personagem 3D real rigado (usa a skin real do jogador!)
    const wantedChar = p.charId || 'cool_man';
    let charState = bridge.createRemoteCharVisual ? bridge.createRemoteCharVisual(wantedChar) : null;
    let fallbackParts = null;
    if (charState && charState.mesh) {
      group.add(charState.mesh);
    } else {
      const fbGroup = new THREE.Group();
      const shirtHue = (numId * 67) % 360;
      const shirtMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('hsl(' + shirtHue + ', 75%, 50%)'), roughness: 0.65 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.6 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.24), shirtMat);
      torso.position.y = 1.15; fbGroup.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skinMat);
      head.position.y = 1.66; fbGroup.add(head);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.16), pantsMat);
      legL.position.set(-0.12, 0.42, 0); fbGroup.add(legL);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.16), pantsMat);
      legR.position.set(0.12, 0.42, 0); fbGroup.add(legR);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.56, 0.13), shirtMat);
      armL.position.set(-0.31, 1.15, 0); fbGroup.add(armL);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.56, 0.13), shirtMat);
      armR.position.set(0.31, 1.15, 0); fbGroup.add(armR);
      group.add(fbGroup);
      fallbackParts = { root: fbGroup, legL, legR, armL, armR };
    }

    // 2. Veículo 3D real quando o jogador remoto está dirigindo!
    let carVisual = bridge.createRemoteCarVisual ? bridge.createRemoteCarVisual(numId, p.carType) : null;
    if (carVisual && carVisual.mesh) {
      carVisual.mesh.visible = !!p.inCar;
      group.add(carVisual.mesh);
    }
    if (charState && charState.mesh) charState.mesh.visible = !p.inCar;
    if (fallbackParts) fallbackParts.root.visible = !p.inCar;

    const lbl = makeLabelSprite(p.name, !!p.speaking);
    drawLabel(lbl.ctx, lbl.tex, p.name, !!p.speaking, !!p.inCar);
    lbl.sprite.position.y = p.inCar ? 2.35 : 2.05;
    group.add(lbl.sprite);

    group.position.set(p.x || 0, p.y || 0, p.z || 0);
    bridge.scene.add(group);

    return {
      id: p.id,
      numId,
      name: p.name || 'Jogador',
      charId: wantedChar,
      carType: p.carType || '',
      targetX: p.x || 0,
      targetY: p.y || 0,
      targetZ: p.z || 0,
      targetRotY: p.rotY || 0,
      speed: p.speed || 0,
      inCar: !!p.inCar,
      speaking: !!p.speaking,
      mesh: group,
      charState,
      carVisual,
      fallbackParts,
      labelSprite: lbl.sprite,
      labelCtx: lbl.ctx,
      labelTex: lbl.tex,
      lastLabelKey: (p.name || 'Jogador') + '|' + (p.speaking ? '1' : '0') + '|' + (p.inCar ? '1' : '0'),
      walkPhase: 0
    };
  }

  function upsertRemotePlayer(p) {
    if (!p || !p.id || p.id === myId) return;
    let rp = remotePlayers.get(p.id);
    if (!rp) {
      rp = createRemoteAvatar(p);
      if (rp) remotePlayers.set(p.id, rp);
      return;
    }
    const bridge = window.BrasilRPBridge;
    const wantedChar = p.charId || rp.charId || 'cool_man';
    // Se criou antes dos GLBs carregarem ou mudou de skin, promove/atualiza para o modelo 3D real!
    if (bridge && bridge.createRemoteCharVisual && (!rp.charState || (p.charId && rp.charId !== wantedChar))) {
      const cs = bridge.createRemoteCharVisual(wantedChar);
      if (cs && cs.mesh) {
        if (rp.charState && rp.charState.mesh) rp.mesh.remove(rp.charState.mesh);
        if (rp.fallbackParts) rp.mesh.remove(rp.fallbackParts.root);
        rp.fallbackParts = null;
        rp.charState = cs;
        rp.charId = wantedChar;
        rp.mesh.add(cs.mesh);
      }
    }
    const wantedCar = p.carType || '';
    if (bridge && bridge.createRemoteCarVisual && (!rp.carVisual || (wantedCar && rp.carType !== wantedCar))) {
      const cv = bridge.createRemoteCarVisual(rp.numId, wantedCar);
      if (cv && cv.mesh) {
        if (rp.carVisual && rp.carVisual.mesh) rp.mesh.remove(rp.carVisual.mesh);
        rp.carVisual = cv;
        rp.carType = wantedCar;
        rp.mesh.add(cv.mesh);
      }
    }

    rp.name = p.name || rp.name;
    if (Number.isFinite(p.x)) rp.targetX = p.x;
    if (Number.isFinite(p.y)) rp.targetY = p.y;
    if (Number.isFinite(p.z)) rp.targetZ = p.z;
    if (Number.isFinite(p.rotY)) rp.targetRotY = p.rotY;
    rp.speed = p.speed || 0;
    rp.inCar = !!p.inCar;
    rp.speaking = !!p.speaking;

    if (rp.charState && rp.charState.mesh) rp.charState.mesh.visible = !rp.inCar;
    if (rp.fallbackParts) rp.fallbackParts.root.visible = !rp.inCar;
    if (rp.carVisual && rp.carVisual.mesh) rp.carVisual.mesh.visible = rp.inCar;
    if (rp.labelSprite) rp.labelSprite.position.y = rp.inCar ? 2.35 : 2.05;

    const key = rp.name + '|' + (rp.speaking ? '1' : '0') + '|' + (rp.inCar ? '1' : '0');
    if (key !== rp.lastLabelKey) {
      rp.lastLabelKey = key;
      drawLabel(rp.labelCtx, rp.labelTex, rp.name, rp.speaking, rp.inCar);
    }
  }

  function removeRemotePlayer(id) {
    const rp = remotePlayers.get(id);
    if (rp && rp.mesh && window.BrasilRPBridge && window.BrasilRPBridge.scene) {
      window.BrasilRPBridge.scene.remove(rp.mesh);
    }
    remotePlayers.delete(id);
    closePeer(id);
  }

  // --- WebRTC Chat de Voz por Proximidade (Anti-Eco & Baixa Latência) ---
  function tuneOpusLowLatency(sdp) {
    if (!sdp) return sdp;
    return sdp.replace(/a=fmtp:111 ([^\r\n]+)/g, (m, params) => {
      let p = params
        .replace(/;?minptime=\d+/g, '')
        .replace(/;?maxptime=\d+/g, '')
        .replace(/;?stereo=\d+/g, '')
        .replace(/;?sprop-stereo=\d+/g, '')
        .replace(/;?maxaveragebitrate=\d+/g, '')
        .replace(/;?dtx=\d+/g, '');
      return `a=fmtp:111 ${p};minptime=10;maxptime=20;useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=24000;dtx=1`;
    });
  }

  function closePeer(peerId) {
    const entry = peers.get(peerId);
    if (!entry) return;
    try { entry.pc.close(); } catch (_) {}
    if (entry.audioEl) {
      try { entry.audioEl.pause(); entry.audioEl.srcObject = null; entry.audioEl.remove(); } catch (_) {}
    }
    peers.delete(peerId);
  }

  function getOrCreatePeer(peerId, initiator) {
    if (!peerId || peerId === myId) return null;
    if (peers.has(peerId)) return peers.get(peerId);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.volume = 0.85;
    audioEl.dataset.peerId = peerId;
    document.body.appendChild(audioEl);

    const entry = { pc, audioEl };
    peers.set(peerId, entry);

    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendWS({ type: 'rtc_ice', to: peerId, data: ev.candidate });
      }
    };

    pc.ontrack = (ev) => {
      if (ev.receiver) {
        try {
          if ('playoutDelayHint' in ev.receiver) ev.receiver.playoutDelayHint = 0.02;
          if ('jitterBufferTarget' in ev.receiver) ev.receiver.jitterBufferTarget = 20;
        } catch (_) {}
      }
      if (ev.streams && ev.streams[0]) {
        audioEl.srcObject = ev.streams[0];
        audioEl.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeer(peerId);
      }
    };

    if (initiator) {
      pc.createOffer({ offerToReceiveAudio: true })
        .then((offer) => {
          offer.sdp = tuneOpusLowLatency(offer.sdp);
          return pc.setLocalDescription(offer).then(() => offer);
        })
        .then((offer) => {
          sendWS({ type: 'rtc_offer', to: peerId, data: offer });
        })
        .catch(() => {});
    }

    return entry;
  }

  async function handleRtcOffer(fromId, offer) {
    if (!fromId || fromId === myId) return;
    let entry = peers.get(fromId);
    if (entry && entry.pc.signalingState !== 'stable') {
      // Evita glare / conexoes duplicadas que causam eco duplo
      if (String(myId) > String(fromId)) return;
      closePeer(fromId);
      entry = null;
    }
    if (!entry) entry = getOrCreatePeer(fromId, false);
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await entry.pc.createAnswer();
      answer.sdp = tuneOpusLowLatency(answer.sdp);
      await entry.pc.setLocalDescription(answer);
      sendWS({ type: 'rtc_answer', to: fromId, data: answer });
    } catch (_) {}
  }

  async function handleRtcAnswer(fromId, answer) {
    if (!fromId || fromId === myId) return;
    const entry = peers.get(fromId);
    if (!entry || entry.pc.signalingState !== 'have-local-offer') return;
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (_) {}
  }

  async function handleRtcIce(fromId, candidate) {
    if (!fromId || fromId === myId) return;
    const entry = peers.get(fromId);
    if (!entry) return;
    try {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {}
  }

  async function toggleVoice() {
    if (!micEnabled) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('Microfone não disponível neste aparelho.');
        return;
      }
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: false },
            channelCount: { ideal: 1 },
            sampleRate: { ideal: 16000 },
            latency: { ideal: 0.01 }
          },
          video: false
        });
        micEnabled = true;
        micGateOpen = false;
        micHoldTimer = 0;
        // Começa com gate fechado até detectar voz (evita transmitir eco ambiente)
        for (const t of localStream.getAudioTracks()) t.enabled = false;

        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          audioCtx = new AC({ latencyHint: 'interactive' });
          const src = audioCtx.createMediaStreamSource(localStream);
          micAnalyser = audioCtx.createAnalyser();
          micAnalyser.fftSize = 256;
          micAnalyser.smoothingTimeConstant = 0.25;
          micData = new Uint8Array(micAnalyser.frequencyBinCount);
          // Conecta apenas ao analyser (NUNCA ao destination -> zero retorno local)
          src.connect(micAnalyser);
        } catch (_) {}

        if (ui.btnVoice) {
          ui.btnVoice.classList.add('voice-on');
          ui.btnVoice.textContent = '🎙️';
        }
        toast('🎙️ Microfone ligado (anti-eco ativo)!');
        addChatLine('🎙️ Microfone ativado (voz por proximidade anti-eco).', 'sys');

        // Renegocia / inicia chamadas de voz com jogadores conectados
        for (const id of remotePlayers.keys()) {
          if (id === myId) continue;
          closePeer(id);
          getOrCreatePeer(id, true);
        }
      } catch (err) {
        toast('Permissão de microfone negada.');
      }
    } else {
      micEnabled = false;
      isSpeaking = false;
      micGateOpen = false;
      micHoldTimer = 0;
      if (localStream) {
        for (const t of localStream.getTracks()) t.stop();
        localStream = null;
      }
      if (audioCtx) {
        try { audioCtx.close(); } catch (_) {}
        audioCtx = null;
        micAnalyser = null;
      }
      if (ui.btnVoice) {
        ui.btnVoice.classList.remove('voice-on', 'voice-speaking');
        ui.btnVoice.textContent = '🎙️';
      }
      toast('🎙️ Microfone desligado.');
    }
  }

  // --- Conexao WebSocket ---
  function connect() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    clearTimeout(reconnectTimer);
    updateStatusUI();

    try {
      ws = new WebSocket(serverUrl);
    } catch (_) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      connected = true;
      const curChar = (window.BrasilRPBridge && window.BrasilRPBridge.player && window.BrasilRPBridge.player.charId) || 'cool_man';
      sendWS({
        type: 'join',
        name: playerName,
        charId: curChar,
        deviceId,
        appVersion: (window.BrasilRPVersion && window.BrasilRPVersion.versionName) || '1.0.42',
        otaVersion: (window.BrasilRPVersion && window.BrasilRPVersion.otaVersion) || '31'
      });
      updateStatusUI();
      addChatLine('🟢 Conectado ao servidor Brasil RP!', 'sys');
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'welcome':
          myId = msg.id;
          onlineCount = msg.onlineCount || 1;
          updateStatusUI();
          if (Array.isArray(msg.players)) {
            for (const p of msg.players) {
              upsertRemotePlayer(p);
              if (micEnabled) getOrCreatePeer(p.id, true);
            }
          }
          break;
        case 'player_join':
          onlineCount = msg.onlineCount || (remotePlayers.size + 1);
          updateStatusUI();
          if (msg.player) {
            upsertRemotePlayer(msg.player);
            addChatLine('➡️ ' + msg.player.name + ' entrou na cidade.', 'sys');
            if (micEnabled && msg.player.id !== myId) {
              getOrCreatePeer(msg.player.id, true);
            }
          }
          break;
        case 'player_update':
          if (msg.player) upsertRemotePlayer(msg.player);
          break;
        case 'snapshot':
          if (Array.isArray(msg.players)) {
            onlineCount = msg.players.length;
            updateStatusUI();
            for (const p of msg.players) upsertRemotePlayer(p);
          }
          break;
        case 'player_leave':
          onlineCount = msg.onlineCount || Math.max(1, remotePlayers.size);
          updateStatusUI();
          if (msg.id) {
            const rp = remotePlayers.get(msg.id);
            if (rp) addChatLine('⬅️ ' + rp.name + ' saiu da cidade.', 'sys');
            removeRemotePlayer(msg.id);
          }
          break;
        case 'chat':
          addPlayerChat(msg.name || 'Jogador', msg.text || '');
          break;
        case 'rtc_offer':
          handleRtcOffer(msg.from, msg.data);
          break;
        case 'rtc_answer':
          handleRtcAnswer(msg.from, msg.data);
          break;
        case 'rtc_ice':
          handleRtcIce(msg.from, msg.data);
          break;
      }
    };

    ws.onclose = () => {
      connected = false;
      updateStatusUI();
      for (const id of Array.from(remotePlayers.keys())) removeRemotePlayer(id);
      scheduleReconnect();
    };

    ws.onerror = () => {
      try { ws.close(); } catch (_) {}
    };
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
  }

  // --- Eventos de UI ---
  if (ui.btnVoice) {
    ui.btnVoice.addEventListener('click', toggleVoice);
  }
  if (ui.btnChatToggle && ui.chatBox) {
    ui.btnChatToggle.addEventListener('click', () => {
      ui.chatBox.classList.toggle('hidden');
    });
  }
  if (ui.btnCloseChat && ui.chatBox) {
    ui.btnCloseChat.addEventListener('click', () => {
      ui.chatBox.classList.add('hidden');
    });
  }
  function sendChatMessage() {
    if (!ui.chatInput) return;
    const text = ui.chatInput.value.trim();
    if (!text) return;
    ui.chatInput.value = '';
    if (!connected) {
      addChatLine('⚪ Aguardando conexão com o servidor...', 'sys');
      return;
    }
    sendWS({ type: 'chat', text, scope: 'global' });
  }
  if (ui.btnSendChat) ui.btnSendChat.addEventListener('click', sendChatMessage);
  if (ui.chatInput) {
    ui.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }
  if (ui.statusPill) {
    ui.statusPill.addEventListener('click', () => {
      const next = window.prompt('Endereço WebSocket do Servidor Brasil RP:', serverUrl);
      if (next && (next.startsWith('ws://') || next.startsWith('wss://'))) {
        serverUrl = next.trim();
        localStorage.setItem(STORAGE_SERVER_KEY, serverUrl);
        if (ws) try { ws.close(); } catch (_) {}
        connect();
      }
    });
  }

  // --- Loop de sincronizacao + volume de voz por proximidade ---
  let sendAccum = 0;
  let pingAccum = 0;
  function tick(dt) {
    const bridge = window.BrasilRPBridge;
    if (!bridge || !bridge.player) return;

    // Keep-alive a cada 20s para manter o servidor Render sempre ativo
    pingAccum += dt;
    if (connected && pingAccum >= 20.0) {
      pingAccum = 0;
      sendWS({ type: 'ping', ts: Date.now() });
    }

    // 1. Detecta se algum jogador remoto esta falando perto (para suprimir eco acústico)
    let anyRemoteSpeaking = false;
    for (const rp of remotePlayers.values()) {
      if (rp.speaking) { anyRemoteSpeaking = true; break; }
    }

    // Detecta se o jogador local esta falando + Voice Activity Gate (corta eco quando em silêncio!)
    if (micEnabled && micAnalyser && micData) {
      micAnalyser.getByteTimeDomainData(micData);
      let sum = 0;
      for (let i = 0; i < micData.length; i++) {
        const v = (micData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / micData.length);
      // Threshold mais rígido se alguém estiver falando no alto-falante (evita loop de eco!)
      const openThresh = anyRemoteSpeaking ? 0.075 : 0.038;
      if (rms > openThresh) {
        micHoldTimer = 0.32;
        isSpeaking = true;
      } else {
        micHoldTimer = Math.max(0, micHoldTimer - dt);
        isSpeaking = micHoldTimer > 0;
      }
      if (localStream && micGateOpen !== isSpeaking) {
        micGateOpen = isSpeaking;
        for (const t of localStream.getAudioTracks()) t.enabled = micGateOpen;
      }
      if (ui.btnVoice) {
        ui.btnVoice.classList.toggle('voice-speaking', isSpeaking);
      }
    }

    const p = bridge.player;
    const px = p.inCar ? p.inCar.pos.x : p.pos.x;
    const py = p.inCar ? p.inCar.pos.y : p.pos.y;
    const pz = p.inCar ? p.inCar.pos.z : p.pos.z;
    // Corrige yaw real do jogo (antes lia p.rotY inexistente -> NaN!)
    const rotY = p.inCar ? (p.inCar.yaw || 0) : ((p.yaw || 0) + Math.PI);
    const speed = p.inCar ? Math.abs(p.inCar.speed || 0) : Math.hypot(p.velX || 0, p.velZ || 0);
    const carType = p.inCar ? (p.inCar.templateKey || p.inCar.type || p.inCar.key || '') : '';

    // 2. Envia posicao, skin e estado de voz ~15 Hz
    sendAccum += dt;
    if (connected && sendAccum >= 0.066) {
      sendAccum = 0;
      sendWS({
        type: 'state',
        charId: p.charId || 'cool_man',
        carType,
        x: Math.round(px * 100) / 100,
        y: Math.round(py * 100) / 100,
        z: Math.round(pz * 100) / 100,
        rotY: Math.round(rotY * 1000) / 1000,
        speed: Math.round(speed * 10) / 10,
        inCar: !!p.inCar,
        speaking: isSpeaking
      });
    }

    // 3. Interpola avatares/veículos 3D remotos e ajusta volume de voz por proximidade 3D
    const lerpK = Math.min(1, dt * 11);
    for (const [id, rp] of remotePlayers.entries()) {
      const distJump = Math.hypot(rp.targetX - rp.mesh.position.x, rp.targetZ - rp.mesh.position.z);
      if (distJump > 40) {
        rp.mesh.position.set(rp.targetX, rp.targetY, rp.targetZ);
      } else {
        rp.mesh.position.x += (rp.targetX - rp.mesh.position.x) * lerpK;
        rp.mesh.position.y += (rp.targetY - rp.mesh.position.y) * lerpK;
        rp.mesh.position.z += (rp.targetZ - rp.mesh.position.z) * lerpK;
      }
      let dyaw = rp.targetRotY - rp.mesh.rotation.y;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      rp.mesh.rotation.y += dyaw * Math.min(1, dt * 12);

      if (rp.inCar) {
        if (rp.carVisual && rp.carVisual.wheels && rp.speed > 0.2) {
          const spin = rp.speed * dt * 2.8;
          for (let wi = 0; wi < rp.carVisual.wheels.length; wi++) {
            rp.carVisual.wheels[wi].rotation.x = (rp.carVisual.wheels[wi].rotation.x + spin) % (Math.PI * 2);
          }
        }
      } else if (rp.charState && bridge.animateRemoteChar) {
        const walking = rp.speed > 0.25;
        const sprinting = rp.speed > 4.2;
        const timeScale = walking ? Math.max(0.65, rp.speed / 3.4) : 1.0;
        bridge.animateRemoteChar(rp.charState, dt * timeScale, walking, sprinting);
      } else if (rp.fallbackParts) {
        const fp = rp.fallbackParts;
        if (rp.speed > 0.4) {
          rp.walkPhase += dt * Math.min(12, rp.speed * 2.4);
          const sw = Math.sin(rp.walkPhase) * 0.55;
          fp.legL.rotation.x = sw; fp.legR.rotation.x = -sw;
          fp.armL.rotation.x = -sw * 0.7; fp.armR.rotation.x = sw * 0.7;
        } else {
          fp.legL.rotation.x *= 0.85; fp.legR.rotation.x *= 0.85;
          fp.armL.rotation.x *= 0.85; fp.armR.rotation.x *= 0.85;
        }
      }

      // Volume de voz por proximidade + ducking anti-eco quando o jogador local fala
      const peer = peers.get(id);
      if (peer && peer.audioEl) {
        const dist = Math.hypot(rp.mesh.position.x - px, rp.mesh.position.z - pz);
        let vol = 0.0;
        if (dist <= VOICE_MIN_DIST) {
          vol = 0.85;
        } else if (dist < VOICE_MAX_DIST) {
          const t = 1 - (dist - VOICE_MIN_DIST) / (VOICE_MAX_DIST - VOICE_MIN_DIST);
          vol = Math.max(0, Math.min(0.85, t * t * 0.85));
        }
        if (micEnabled && isSpeaking) vol *= 0.25;
        peer.audioEl.volume = vol;
      }
    }
  }

  function getRemotePlayers() {
    const arr = [];
    for (const rp of remotePlayers.values()) {
      arr.push({
        id: rp.id,
        name: rp.name,
        x: rp.mesh.position.x,
        y: rp.mesh.position.y,
        z: rp.mesh.position.z,
        inCar: rp.inCar,
        speaking: rp.speaking
      });
    }
    return arr;
  }

  window.BrasilMP = { tick, connect, toggleVoice, getRemotePlayers };
  setTimeout(connect, 900);
})();
