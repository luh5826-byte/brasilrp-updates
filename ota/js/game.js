(function () {
  'use strict';

  const SAVE_KEY = 'brasil_rp_gta6_v4';
  let save = {
    cash: 1500,
    bank: 5000,
    deliveries: 0,
    storyIdx: 0,
    xp: 0,
    level: 1,
    completedMissions: [],
    bestRaceTime: null,
    sideDone: 0,
    starterCar: 'volkswagen_saveiro',
    playerChar: 'cool_man',
    jobNpcTurn: 1,
    paint: '#ffffff',
    camSens: 1.0,
    padSens: 1.0,
    env: 'day',
    gfxQuality: 'medium',
    steerMode: 'buttons',
    targetFps: 90,
    dist: 1,
    soundEnabled: true,
    radioStation: 1
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) save = Object.assign(save, JSON.parse(raw));
  } catch (e) {}
  save.playerChar = 'cool_man';
  function persistSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  let gameMode = 'loading'; // 'loading' | 'lobby' | 'playing'
  let soundEnabled = save.soundEnabled !== false;

  // --- Áudio Sintetizado WebAudio ---
  const AudioFX = {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain.gain.value = 0.0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 280;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    },
    resume() {
      if (!soundEnabled) return;
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    updateEngine(driving, speedAbs) {
      if (window.BrasilAudio) return; // Motor multi-camada gerenciado por audio_world.js
      if (!this.ctx || !this.engineGain) return;
      const targetGain = (soundEnabled && driving) ? Math.min(0.11, 0.032 + speedAbs * 0.0022) : 0.0;
      const targetFreq = 46 + speedAbs * 3.1;
      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.07);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.07);
    },
    beep(freq, dur, type = 'sine', vol = 0.12) {
      if (!soundEnabled) return;
      this.resume();
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    },
    coin() {
      this.beep(880, 0.09, 'triangle', 0.14);
      setTimeout(() => this.beep(1320, 0.16, 'triangle', 0.14), 85);
    },
    ring() {
      this.beep(720, 0.12, 'sine', 0.12);
      setTimeout(() => this.beep(920, 0.14, 'sine', 0.12), 140);
    },
    crash() {
      this.beep(110, 0.16, 'square', 0.11);
    },
    horn() {
      this.beep(340, 0.22, 'sawtooth', 0.12);
      this.beep(425, 0.22, 'sawtooth', 0.10);
    },
    doorLatch() {
      this.beep(520, 0.032, 'triangle', 0.09);
      setTimeout(() => this.beep(780, 0.025, 'square', 0.05), 28);
    },
    _lastCurbMs: 0,
    curbThump(intensity = 0.7) {
      if (!soundEnabled) return;
      const nowMs = performance.now();
      if (nowMs - this._lastCurbMs < 68) return;
      this._lastCurbMs = nowMs;
      this.resume();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const amp = Math.max(0.06, Math.min(0.28, intensity * 0.24));
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(92 + intensity * 38, now);
      o.frequency.exponentialRampToValueAtTime(36, now + 0.085);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      o.connect(g); g.connect(ctx.destination);
      o.start(now); o.stop(now + 0.10);
    },
    doorSlam() {
      if (!soundEnabled) return;
      this.resume();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      // Impacto grave abafado de porta automotiva batendo ("TUM!")
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(118, now);
      o.frequency.exponentialRampToValueAtTime(34, now + 0.15);
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      o.connect(g); g.connect(ctx.destination);
      o.start(now); o.stop(now + 0.18);

      const bufLen = Math.floor(ctx.sampleRate * 0.11);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.28));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(460, now);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.22, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      src.connect(flt); flt.connect(ng); ng.connect(ctx.destination);
      src.start(now);
    },
    explosion() {
      if (!soundEnabled) return;
      this.resume();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      // Sub-bass boom
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(115, now);
      o.frequency.exponentialRampToValueAtTime(24, now + 0.75);
      g.gain.setValueAtTime(0.32, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      o.connect(g); g.connect(ctx.destination);
      o.start(now); o.stop(now + 0.82);
      // White noise blast
      const bufSize = Math.floor(ctx.sampleRate * 0.75);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(1400, now);
      flt.frequency.exponentialRampToValueAtTime(140, now + 0.75);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.36, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      src.connect(flt); flt.connect(ng); ng.connect(ctx.destination);
      src.start(now);
    }
  };

  // --- Rádios Estilo GTA (API Real Web Radio - Radio Browser) ---
  const GTA_RADIO_STATIONS = [
    { id: 'off', name: 'RÁDIO DESLIGADA', genre: 'SEM ÁUDIO' },
    { id: 'jp', name: 'JOVEM PAN 100.9 FM', genre: 'AO VIVO • BRASIL POP / HITS', streamUrl: 'https://stream.zeno.fm/c45wbq2us3buv' },
    { id: 'hits80', name: '80 HITS BRASIL FM', genre: 'AO VIVO • CLÁSSICOS & MPB', streamUrl: 'https://stm5.painelcast.com:7662/stream' },
    { id: 'sertaneja', name: 'SERTANEJA 106.7 FM', genre: 'AO VIVO • SERTANEJO BRASIL', streamUrl: 'https://sc4s.cdn.upx.com:8067/stream' },
    { id: 'mix', name: 'RÁDIO MIX 106.3 FM', genre: 'AO VIVO • POP / ROCK / JOVEM', streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/MIXFM_SAOPAULOAAC.aac' },
    { id: 'jazz', name: 'SMOOTH JAZZ LOUNGE', genre: 'AO VIVO • LOUNGE / CHILL', streamUrl: 'https://radio4.vip-radios.fm:18060/stream-128kmp3-SmoothJazzLounge' }
  ];

  const GtaRadio = {
    stationIdx: (typeof save.radioStation === 'number' && save.radioStation >= 0 && save.radioStation < GTA_RADIO_STATIONS.length) ? save.radioStation : 1,
    playing: false,
    bannerTimer: null,
    audioEl: null,
    apiLoaded: false,
    retryCount: 0,
    async loadApiStations() {
      if (this.apiLoaded) return;
      this.apiLoaded = true;
      const endpoints = [
        'https://de1.api.radio-browser.info/json/stations/search?countrycode=BR&limit=28&order=clickcount&reverse=true&hidebroken=true',
        'https://all.api.radio-browser.info/json/stations/search?countrycode=BR&limit=28&order=clickcount&reverse=true&hidebroken=true'
      ];
      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const list = await res.json();
          if (!Array.isArray(list) || list.length === 0) continue;
          const seen = new Set();
          const webStations = [];
          for (const st of list) {
            const sUrl = (st.url_resolved || st.url || '').trim();
            if (!sUrl.startsWith('https://')) continue;
            if (sUrl.includes('.m3u8') || sUrl.includes('.pls')) continue;
            const cleanName = (st.name || 'WEB RADIO BR').trim().slice(0, 30).toUpperCase();
            if (seen.has(cleanName)) continue;
            seen.add(cleanName);
            const tag = (st.tags || 'MÚSICA AO VIVO').split(',')[0].trim().toUpperCase() || 'AO VIVO';
            const br = st.bitrate ? ` • ${st.bitrate}KBPS` : '';
            webStations.push({
              id: 'api_' + webStations.length,
              name: cleanName,
              genre: `WEB RADIO • ${tag}${br}`,
              streamUrl: sUrl
            });
            if (webStations.length >= 8) break;
          }
          if (webStations.length >= 3) {
            GTA_RADIO_STATIONS.splice(1, GTA_RADIO_STATIONS.length - 1, ...webStations);
            if (this.stationIdx >= GTA_RADIO_STATIONS.length) this.stationIdx = 1;
            if (this.playing && player.inCar) {
              this.showBanner();
              this.start();
            }
          }
          break;
        } catch (e) {}
      }
    },
    ensureAudioEl() {
      if (this.audioEl) return this.audioEl;
      const a = new Audio();
      a.preload = 'none';
      a.volume = 0.72;
      a.addEventListener('playing', () => {
        this.retryCount = 0;
      });
      a.addEventListener('error', () => {
        if (this.playing && player.inCar && this.retryCount < 3) {
          this.retryCount++;
          this.stationIdx = 1 + (this.stationIdx % Math.max(1, GTA_RADIO_STATIONS.length - 1));
          this.showBanner();
          this.start();
        }
      });
      this.audioEl = a;
      return a;
    },
    showBanner() {
      const st = GTA_RADIO_STATIONS[this.stationIdx];
      const b = el('radioBanner');
      if (!b || !st) return;
      el('radioStationName').textContent = st.name;
      el('radioStationGenre').textContent = st.genre;
      b.classList.remove('hidden');
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => b.classList.add('hidden'), 3200);
    },
    start() {
      this.stop(false);
      this.loadApiStations();
      const st = GTA_RADIO_STATIONS[this.stationIdx];
      if (!st || st.id === 'off' || !soundEnabled || !st.streamUrl) return;
      this.playing = true;
      const a = this.ensureAudioEl();
      a.src = st.streamUrl;
      a.play().catch(() => {});
    },
    stop(hideBanner = true) {
      this.playing = false;
      if (this.audioEl) {
        try {
          this.audioEl.pause();
          this.audioEl.removeAttribute('src');
          this.audioEl.load();
        } catch (e) {}
      }
      if (hideBanner && el('radioBanner')) el('radioBanner').classList.add('hidden');
    },
    next() {
      this.retryCount = 0;
      this.stationIdx = (this.stationIdx + 1) % GTA_RADIO_STATIONS.length;
      save.radioStation = this.stationIdx;
      persistSave();
      AudioFX.beep(980, 0.04, 'square', 0.05);
      this.showBanner();
      if (player.inCar) {
        if (GTA_RADIO_STATIONS[this.stationIdx].id === 'off') this.stop(false);
        else this.start();
      }
    }
  };

  function vibrate(ms) {
    if (window.BrasilNative && typeof window.BrasilNative.vibrate === 'function') {
      window.BrasilNative.vibrate(ms);
    }
  }

  const el = (id) => document.getElementById(id);
  const ui = {
    splash: el('splash'),
    loadStatus: el('loadStatus'),
    loadFill: el('loadFill'),
    lobby3d: el('lobby3d'),
    modalOverlay: el('modal-overlay'),
    lobbyCash: el('lobbyCash'),
    lobbyBank: el('lobbyBank'),
    hud: el('hud'),
    uiCash: el('uiCash'),
    uiBank: el('uiBank'),
    hpFill: el('hpFill'),
    stamFill: el('stamFill'),
    wantedStars: el('wantedStars'),
    clockText: el('clockText'),
    fpsText: el('fpsText'),
    speedBox: el('speedBox'),
    speedVal: el('speedVal'),
    missionBanner: el('missionBanner'),
    missionText: el('missionText'),
    toastBox: el('toastBox'),
    footControls: el('footControls'),
    carControls: el('carControls'),
    btnEnterCar: el('btnEnterCar'),
    btnInteract: el('btnInteract'),
    btnSprint: el('btnSprint'),
    btnCarDoors: el('btnCarDoors'),
    btnCarLights: el('btnCarLights'),
    btnCarCam: el('btnCarCam'),
    btnFrontCam: el('btnFrontCam'),
    btnSpinPlayer: el('btnSpinPlayer'),
    screenFx: el('screen-fx'),
    minimap: el('minimapCanvas').getContext('2d')
  };

  let toastTimer = null;
  function showToast(msg, ms = 2800) {
    ui.toastBox.textContent = msg;
    ui.toastBox.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toastBox.classList.add('hidden'), ms);
  }

  function fmtMoney(n) {
    return Math.floor(n).toLocaleString('pt-BR');
  }

  function refreshMoneyUI() {
    ui.uiCash.textContent = fmtMoney(save.cash);
    ui.uiBank.textContent = fmtMoney(save.bank);
    ui.lobbyCash.textContent = fmtMoney(save.cash);
    ui.lobbyBank.textContent = fmtMoney(save.bank);
    el('mCash').textContent = 'R$ ' + fmtMoney(save.cash);
    el('mBank').textContent = 'R$ ' + fmtMoney(save.bank);
  }

  // --- Three.js Setup (Visual Nível GTA V + Performance Mobile) ---
  const canvas = el('gameCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  const gfxQualities = {
    low: { dpr: 0.70, shadows: false, shadowSize: 512, far: 185 },
    medium: { dpr: Math.min(window.devicePixelRatio || 1, 0.95), shadows: false, shadowSize: 1024, far: 245 },
    high: { dpr: Math.min(window.devicePixelRatio || 1, 1.25), shadows: true, shadowSize: 1024, far: 295 },
    ultra: { dpr: Math.min(window.devicePixelRatio || 1, 1.50), shadows: true, shadowSize: 1024, far: 350 }
  };
  let currentGfxQuality = 'medium';
  let targetFps = 90;
  let targetFrameMs = 1000 / 90;
  renderer.setPixelRatio(gfxQualities.medium.dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6db3f2);
  scene.fog = new THREE.FogExp2(0x6db3f2, 0.0022);

  // Environment Map HDR-like procedural 512x256 para reflexos nível GTA V em carros, vidros e água
  (function setupEnvReflections() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(50, 32, 20);
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512; skyCanvas.height = 256;
    const sctx = skyCanvas.getContext('2d');
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#124e9c');
    grad.addColorStop(0.32, '#4ba3eb');
    grad.addColorStop(0.47, '#bce0fd');
    grad.addColorStop(0.50, '#fff2d8');
    grad.addColorStop(0.53, '#54606e');
    grad.addColorStop(0.75, '#2b3440');
    grad.addColorStop(1.0, '#141920');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 512, 256);
    // Nuvens suaves para reflexo realista na lataria
    for (let i = 0; i < 28; i++) {
      const cx = (i * 53) % 512;
      const cy = 48 + (i % 5) * 14;
      sctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      sctx.beginPath(); sctx.ellipse(cx, cy, 34 + (i % 3) * 18, 7 + (i % 3) * 3, 0, 0, Math.PI * 2); sctx.fill();
    }
    // Silhueta urbana sutil no horizonte
    sctx.fillStyle = 'rgba(28, 36, 46, 0.55)';
    for (let bx = 0; bx < 512; bx += 14) {
      const bh = 6 + ((bx * 37) % 18);
      sctx.fillRect(bx, 130 - bh, 11, bh);
    }
    // Disco solar intenso no reflexo
    const sunGrad = sctx.createRadialGradient(340, 82, 2, 340, 82, 28);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.35, 'rgba(255, 244, 210, 0.85)');
    sunGrad.addColorStop(1, 'rgba(255, 230, 170, 0)');
    sctx.fillStyle = sunGrad;
    sctx.beginPath(); sctx.arc(340, 82, 28, 0, Math.PI * 2); sctx.fill();
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.encoding = THREE.sRGBEncoding;
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));
    scene.environment = pmrem.fromScene(envScene, 0.025).texture;
    pmrem.dispose();
  })();

  const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.14, 280);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const hemiLight = new THREE.HemisphereLight(0xbfe2ff, 0x453d34, 0.62);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff1d4, 1.18);
  sunLight.position.set(60, 95, 40);
  sunLight.castShadow = false;
  sunLight.shadow.camera.left = -42;
  sunLight.shadow.camera.right = 42;
  sunLight.shadow.camera.top = 42;
  sunLight.shadow.camera.bottom = -42;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 190;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.03;
  sunLight.shadow.mapSize.set(1024, 1024);
  scene.add(sunLight);
  scene.add(sunLight.target);

  function applyGfxQuality(q) {
    try {
      currentGfxQuality = gfxQualities[q] ? q : 'medium';
      const cfg = gfxQualities[currentGfxQuality];
      const shadowsChanged = (renderer.shadowMap.enabled !== cfg.shadows);
      renderer.setPixelRatio(cfg.dpr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.shadowMap.enabled = cfg.shadows;
      sunLight.castShadow = cfg.shadows;
      if (cfg.shadows && sunLight.shadow.mapSize.width !== cfg.shadowSize) {
        sunLight.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize);
        if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
      }
      if (typeof loadedChunks !== 'undefined') {
        loadedChunks.forEach((entry) => {
          if (entry && entry.group) {
            entry.group.traverse((o) => { if (o.isMesh) o.receiveShadow = cfg.shadows; });
          }
        });
      }
      if (shadowsChanged && scene) {
        scene.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          if (Array.isArray(o.material)) o.material.forEach((m) => { if (m) m.needsUpdate = true; });
          else o.material.needsUpdate = true;
        });
      }
      camera.far = cfg.far;
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate = true;
    } catch (e) {
      console.warn('applyGfxQuality fallback:', e);
    }
  }

  function applyTargetFps(fps) {
    const val = parseInt(fps, 10) || 90;
    targetFps = Math.max(30, Math.min(120, val));
    targetFrameMs = targetFps >= 120 ? 0 : (1000 / targetFps);
  }

  const WATER_Y = -0.45;
  // Textura procedural realista de mar (azul oceano + cristas de ondas + espuma sutil)
  const seaTex = (function buildSeaTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, '#053e63');
    g.addColorStop(0.5, '#0b6696');
    g.addColorStop(1, '#043657');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const w = 18 + Math.random() * 65;
      const h = 2 + Math.random() * 5;
      ctx.fillStyle = i % 5 === 0 ? 'rgba(205, 240, 255, 0.22)' : 'rgba(18, 128, 178, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(28, 28);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  })();

  // Normal map procedural de ondas para reflexo solar dinâmico na água
  const seaNormalTex = (function buildSeaNormalTexture() {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * Math.PI * 2;
        const v = (y / size) * Math.PI * 2;
        const dx = Math.cos(u * 3 + v * 2) * 0.45 + Math.cos(u * 7 - v * 5) * 0.25;
        const dy = Math.sin(v * 4 - u * 2) * 0.45 + Math.sin(v * 6 + u * 4) * 0.25;
        const idx = (y * size + x) * 4;
        data[idx] = Math.round((dx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.round((dy * 0.5 + 0.5) * 255);
        data[idx + 2] = 240;
        data[idx + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(36, 36);
    tex.needsUpdate = true;
    return tex;
  })();

  const waterMat = new THREE.MeshStandardMaterial({
    map: seaTex,
    normalMap: seaNormalTex,
    normalScale: new THREE.Vector2(0.6, 0.6),
    color: 0x1686ba,
    roughness: 0.09,
    metalness: 0.72,
    envMapIntensity: 2.35,
    transparent: false
  });

  // Mar posicionado APENAS nas 4 bordas ao redor do mapa (nunca cobre ruas ou áreas internas!)
  const seaMeshes = [];
  const seaGroup = new THREE.Group();
  const seaPanels = [
    // Norte (z < -1418)
    { w: 7000, h: 2800, x: -70, z: -1418 - 1400 },
    // Sul (z > 192)
    { w: 7000, h: 2800, x: -70, z: 192 + 1400 },
    // Oeste (x < -926)
    { w: 2800, h: 1620, x: -926 - 1400, z: -613 },
    // Leste (x > 790)
    { w: 2800, h: 1620, x: 790 + 1400, z: -613 }
  ];
  // Mar removido: nenhum painel de água ou fundo oceânico é criado/adicionado à cena
  void seaPanels; void waterMat; void seaGroup;

  let oceanWarnCooldown = 0;
  // Limite do mapa = borda da cidade (sem mar ao redor)
  function clampOceanBounds(pos, vel = null) {
    const minX = -922, maxX = 786, minZ = -1414, maxZ = 188;
    let clamped = false;
    if (pos.x < minX) { pos.x = minX; clamped = true; }
    if (pos.x > maxX) { pos.x = maxX; clamped = true; }
    if (pos.z < minZ) { pos.z = minZ; clamped = true; }
    if (pos.z > maxZ) { pos.z = maxZ; clamped = true; }
    if (clamped) {
      if (vel) vel.multiplyScalar(-0.3);
      if (oceanWarnCooldown <= 0) {
        oceanWarnCooldown = 3.0;
        showToast('🚧 Limite do mapa');
      }
    }
    return clamped;
  }

  // --- Loaders & Streaming de Mapa ---
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
  // Textura procedural de micro-detalhe (asfalto/concreto) para nitidez nível GTA V em texturas do mapa
  const detailBumpTex = (function buildDetailBump() {
    const sz = 256;
    const data = new Uint8Array(sz * sz * 4);
    let seed = 1337;
    for (let i = 0; i < sz * sz; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = (seed >>> 24) & 0xff;
      const v = Math.max(96, Math.min(200, 128 + ((n - 128) >> 1)));
      const idx = i * 4;
      data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
    }
    const t = new THREE.DataTexture(data, sz, sz, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 8);
    t.needsUpdate = true;
    return t;
  })();

  const gltfLoader = new THREE.GLTFLoader();
  function convertToFastMapMaterial(m, obj) {
    if (!m) return m;
    if (m.isMeshLambertMaterial) return m;
    const isAtlas = Boolean(obj && obj.geometry && obj.geometry.attributes && obj.geometry.attributes._atlas_rect);
    const lowOrMed = (currentGfxQuality === 'low' || currentGfxQuality === 'medium');
    if (m.map) {
      m.map.encoding = THREE.sRGBEncoding;
      m.map.generateMipmaps = true;
      m.map.minFilter = isAtlas ? THREE.LinearMipmapLinearFilter : (lowOrMed ? THREE.LinearMipmapNearestFilter : THREE.LinearMipmapLinearFilter);
      m.map.anisotropy = isAtlas ? 1 : (lowOrMed ? 1 : Math.min(4, maxAniso));
      if (isAtlas) {
        m.map.wrapS = THREE.ClampToEdgeWrapping;
        m.map.wrapT = THREE.ClampToEdgeWrapping;
      }
    }
    const hasAlpha = (m.alphaTest > 0 || m.transparent || m.alphaMode === 'MASK');
    const hasVCol = Boolean(isAtlas && obj && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.color);
    const lm = new THREE.MeshLambertMaterial({
      map: m.map || null,
      color: isAtlas ? new THREE.Color(0xffffff) : (m.color ? m.color.clone() : new THREE.Color(0xffffff)),
      vertexColors: hasVCol,
      alphaTest: hasAlpha ? 0.45 : 0,
      transparent: false,
      side: hasAlpha ? THREE.DoubleSide : THREE.FrontSide
    });
    if (isAtlas && m.map) {
      const aw = (m.userData && m.userData.atlasWidth) || (m.map.image && m.map.image.width) || 2048;
      const ah = (m.userData && m.userData.atlasHeight) || (m.map.image && m.map.image.height) || 2048;
      const atlasTexel = new THREE.Vector2(1.0 / aw, 1.0 / ah);
      const maxGrad = new THREE.Vector2(1.4 / aw, 1.4 / ah);
      lm.customProgramCacheKey = () => 'brasilrp_atlas_v3_' + (hasAlpha ? 'cut' : 'opq') + (hasVCol ? '_vc' : '');
      lm.onBeforeCompile = (shader) => {
        shader.uniforms.uAtlasTexel = { value: atlasTexel };
        shader.uniforms.uAtlasMaxGrad = { value: maxGrad };
        shader.vertexShader = shader.vertexShader
          .replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nattribute vec4 _atlas_rect;\nvarying vec4 vAtlasRect;')
          .replace('#include <uv_vertex>', '#include <uv_vertex>\nvAtlasRect = _atlas_rect;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nvarying vec4 vAtlasRect;\nuniform vec2 uAtlasTexel;\nuniform vec2 uAtlasMaxGrad;')
          .replace('#include <map_fragment>', [
            '#ifdef USE_MAP',
            '  vec2 _tUv = fract(vUv);',
            '  vec2 _inset = uAtlasTexel * 0.5;',
            '  vec2 _aUv = vAtlasRect.xy + _inset + _tUv * max(vec2(0.0), vAtlasRect.zw - uAtlasTexel);',
            '  #if __VERSION__ == 300',
            '    vec2 _ddx = dFdx(vUv) * vAtlasRect.zw;',
            '    vec2 _ddy = dFdy(vUv) * vAtlasRect.zw;',
            '    float _sx = max(abs(_ddx.x) / uAtlasMaxGrad.x, abs(_ddx.y) / uAtlasMaxGrad.y);',
            '    if (_sx > 1.0) _ddx /= _sx;',
            '    float _sy = max(abs(_ddy.x) / uAtlasMaxGrad.x, abs(_ddy.y) / uAtlasMaxGrad.y);',
            '    if (_sy > 1.0) _ddy /= _sy;',
            '    vec4 texelColor = textureGrad(map, _aUv, _ddx, _ddy);',
            '  #else',
            '    vec4 texelColor = texture2D(map, _aUv);',
            '  #endif',
            '  texelColor = mapTexelToLinear(texelColor);',
            '  diffuseColor *= texelColor;',
            '#endif'
          ].join('\n'));
      };
    }
    if (m.roughnessMap) m.roughnessMap.dispose();
    if (m.normalMap) m.normalMap.dispose();
    if (m.metalnessMap) m.metalnessMap.dispose();
    if (m.aoMap) m.aoMap.dispose();
    if (m.emissiveMap) m.emissiveMap.dispose();
    m.dispose();
    return lm;
  }

  // Cache local (IndexedDB) dos chunks atlasados da cidade
  const MAP_CACHE_DB_NAME = 'brasilrp_map_cache_v2_atlas';
  const MAP_CACHE_STORE = 'chunks';
  const MAP_CACHE_FLAG = 'brasilrp_map_cached_v2_atlas';
  try { if (window.indexedDB) indexedDB.deleteDatabase('brasilrp_map_cache_v1'); } catch (e) {}
  let mapCacheDbPromise = null;

  function openMapCacheDB() {
    if (mapCacheDbPromise) return mapCacheDbPromise;
    if (!window.indexedDB) return Promise.resolve(null);
    mapCacheDbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(MAP_CACHE_DB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(MAP_CACHE_STORE)) {
            db.createObjectStore(MAP_CACHE_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
    return mapCacheDbPromise;
  }

  async function getCachedChunkBuffer(key) {
    const db = await openMapCacheDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(MAP_CACHE_STORE, 'readonly');
        const req = tx.objectStore(MAP_CACHE_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function putCachedChunkBuffer(key, buf) {
    const db = await openMapCacheDB();
    if (!db || !buf) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(MAP_CACHE_STORE, 'readwrite');
        tx.objectStore(MAP_CACHE_STORE).put(buf, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  function processLoadedGLTF(gltf, isMapChunk) {
    const mapRecvShadow = Boolean(gfxQualities[currentGfxQuality]?.shadows);
    gltf.scene.traverse((obj) => {
      if (obj.isMesh) {
        if (isMapChunk) {
          // Otimização de mapa: sem castShadow em prédios/árvores estáticos e conversão direta para MeshLambertMaterial
          obj.castShadow = false;
          obj.receiveShadow = mapRecvShadow;
          obj.matrixAutoUpdate = false;
          obj.updateMatrix();
          if (obj.material) {
            const isArr = Array.isArray(obj.material);
            const mats = isArr ? obj.material : [obj.material];
            const fastMats = mats.map((mat) => convertToFastMapMaterial(mat, obj));
            obj.material = isArr ? fastMats : fastMats[0];
          }
        } else {
          obj.castShadow = true;
          obj.receiveShadow = true;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (!m) return;
            if (m.map) m.map.anisotropy = maxAniso;
            if (m.roughnessMap) m.roughnessMap.anisotropy = maxAniso;
            if (m.normalMap) m.normalMap.anisotropy = maxAniso;
            if (m.isMeshStandardMaterial) {
              if (m.metalness > 0.35 || m.roughness < 0.28) {
                m.envMapIntensity = Math.max(m.envMapIntensity || 1.0, 1.4);
              } else {
                m.envMapIntensity = Math.min(m.envMapIntensity || 1.0, 0.72);
              }
            }
          });
        }
      }
    });
    gltf.scene.userData._animations = gltf.animations || [];
    return gltf.scene;
  }

  async function loadGLB(url) {
    const isMapChunk = url.includes('/map/') || url.includes('chunk_');
    if (isMapChunk) {
      let buf = await getCachedChunkBuffer(url);
      if (!buf) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        buf = await res.arrayBuffer();
        putCachedChunkBuffer(url, buf);
      }
      return new Promise((resolve, reject) => {
        const basePath = url.substring(0, url.lastIndexOf('/') + 1);
        gltfLoader.parse(buf, basePath, (gltf) => {
          resolve(processLoadedGLTF(gltf, true));
        }, reject);
      });
    }
    return new Promise((resolve, reject) => {
      gltfLoader.load(url, (gltf) => {
        resolve(processLoadedGLTF(gltf, false));
      }, undefined, reject);
    });
  }

  let mapManifest = null;
  const loadedChunks = new Map();
  const pendingChunkWarmups = [];
  const pendingDisposals = [];
  let activeChunkLoads = 0;
  const qualityLevels = [
    { label: 'Curta', radius: 90 },
    { label: 'Média', radius: 120 },
    { label: 'Longa', radius: 165 }
  ];
  let qualityIdx = 1;

  function disposeSingleMesh(obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  }

  function disposeObject3D(root, staggered = false) {
    if (!root) return;
    if (staggered) {
      root.traverse((obj) => {
        if (obj.isMesh) pendingDisposals.push(obj);
      });
      return;
    }
    root.traverse(disposeSingleMesh);
  }

  function stepChunkWarmups() {
    // Descarga gradual para evitar engasgos de Garbage Collection
    for (let d = 0; d < 6 && pendingDisposals.length > 0; d++) {
      disposeSingleMesh(pendingDisposals.pop());
    }

    if (pendingChunkWarmups.length === 0) return;
    const item = pendingChunkWarmups[0];

    // Fase 1: Pré-upload de texturas para GPU (1 por frame) antes de exibir o chunk
    if (item.texCursor < item.textures.length) {
      renderer.initTexture(item.textures[item.texCursor]);
      item.texCursor++;
      return;
    }

    // Fase 2: Adiciona à cena e revela meshes em lotes pequenos (4 por frame)
    if (!item.added) {
      item.added = true;
      const pCur = player.inCar ? player.inCar.pos : player.pos;
      const rad = qualityLevels[qualityIdx].radius;
      const visRadSq = (rad + 25) * (rad + 25);
      // Encontra posição do chunk se existir
      item.group.visible = true;
      scene.add(item.group);
    }
    const meshes = item.meshes;
    const end = Math.min(meshes.length, item.cursor + 4);
    for (let i = item.cursor; i < end; i++) {
      meshes[i].visible = true;
    }
    item.cursor = end;
    if (item.cursor >= meshes.length) {
      const pCur = player.inCar ? player.inCar.pos : player.pos;
      updateChunkStreaming(pCur.x, pCur.z);
      pendingChunkWarmups.shift();
    }
  }

  let mapPreloaded = false;
  function hydrateRemainingChunksFromCache(chunks, radSq, px, pz) {
    let idx = 0;
    function next() {
      if (idx >= chunks.length) return;
      const c = chunks[idx++];
      if (loadedChunks.has(c.file)) { setTimeout(next, 16); return; }
      loadGLB('models/map/' + c.file)
        .then((grp) => {
          const pCur = player.inCar ? player.inCar.pos : player.pos;
          const dx = c.cx - pCur.x;
          const dz = c.cz - pCur.z;
          const shouldShow = (dx * dx + dz * dz <= radSq);
          grp.visible = false;
          grp.matrixAutoUpdate = false;
          grp.updateMatrix();
          const textures = [];
          const meshes = [];
          grp.traverse((o) => {
            if (o.isMesh) {
              o.visible = false;
              meshes.push(o);
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              mats.forEach((m) => { if (m && m.map && !textures.includes(m.map)) textures.push(m.map); });
            }
          });
          loadedChunks.set(c.file, { cx: c.cx, cz: c.cz, group: grp, loading: false, targetVisible: shouldShow });
          pendingChunkWarmups.push({ group: grp, textures, meshes, texCursor: 0, cursor: 0, added: false });
        })
        .catch(() => {})
        .finally(() => {
          const fastMoving = player.inCar && Math.abs(player.inCar.speed) > 12;
          setTimeout(next, fastMoving ? 450 : 240);
        });
    }
    setTimeout(next, 800);
  }

  async function preloadAllMapChunks(px, pz) {
    if (!mapManifest || mapPreloaded) return;
    mapPreloaded = true;
    const chunks = mapManifest.chunks.slice().sort((a, b) => {
      const da = (a.cx - px) ** 2 + (a.cz - pz) ** 2;
      const db = (b.cx - px) ** 2 + (b.cz - pz) ** 2;
      return da - db;
    });
    const rad = qualityLevels[qualityIdx].radius;
    const radSq = (rad + 25) * (rad + 25);
    const hasLocalCache = localStorage.getItem(MAP_CACHE_FLAG) === '1';

    if (hasLocalCache) {
      // Cache local ativo: carrega só os chunks próximos do spawn no boot e hidrata o resto em background
      const nearChunks = chunks.filter((c) => ((c.cx - px) ** 2 + (c.cz - pz) ** 2) <= radSq);
      const restChunks = chunks.filter((c) => ((c.cx - px) ** 2 + (c.cz - pz) ** 2) > radSq);
      const totalNear = Math.max(1, nearChunks.length);
      let done = 0;
      for (let i = 0; i < nearChunks.length; i += 6) {
        const slice = nearChunks.slice(i, i + 6);
        await Promise.all(slice.map((c) =>
          loadGLB('models/map/' + c.file)
            .then((grp) => {
              grp.visible = true;
              grp.matrixAutoUpdate = false;
              grp.updateMatrix();
              scene.add(grp);
              loadedChunks.set(c.file, { cx: c.cx, cz: c.cz, group: grp, loading: false });
            })
            .catch(() => {})
            .finally(() => {
              done++;
              if (ui.loadStatus) ui.loadStatus.textContent = `Abrindo cidade do cache local (${done}/${totalNear})...`;
              if (ui.loadFill) ui.loadFill.style.width = `${55 + Math.round((done / totalNear) * 35)}%`;
            })
        ));
      }
      try { renderer.compile(scene, camera); } catch (e) {}
      hydrateRemainingChunksFromCache(restChunks, radSq, px, pz);
      return;
    }

    const total = chunks.length;
    let done = 0;
    for (let i = 0; i < total; i += 6) {
      const slice = chunks.slice(i, i + 6);
      await Promise.all(slice.map((c) =>
        loadGLB('models/map/' + c.file)
          .then((grp) => {
            const dx = c.cx - px;
            const dz = c.cz - pz;
            grp.visible = (dx * dx + dz * dz <= radSq);
            grp.matrixAutoUpdate = false;
            grp.updateMatrix();
            scene.add(grp);
            loadedChunks.set(c.file, { cx: c.cx, cz: c.cz, group: grp, loading: false });
          })
          .catch(() => {})
          .finally(() => {
            done++;
            if (ui.loadStatus) ui.loadStatus.textContent = `Carregando cidade completa (${done}/${total})...`;
            if (ui.loadFill) ui.loadFill.style.width = `${55 + Math.round((done / total) * 35)}%`;
          })
      ));
    }
    try { localStorage.setItem(MAP_CACHE_FLAG, '1'); } catch (e) {}
    try { renderer.compile(scene, camera); } catch (e) {}
  }

  async function updateChunkStreaming(px, pz) {
    if (!mapManifest) return;
    const rad = qualityLevels[qualityIdx].radius;
    const visRadSq = (rad + 25) * (rad + 25);
    for (const entry of loadedChunks.values()) {
      if (!entry.group) continue;
      const dx = entry.cx - px;
      const dz = entry.cz - pz;
      entry.group.visible = (dx * dx + dz * dz <= visRadSq);
    }
  }

  // --- Colisão & Altura O(1) + Minimapa IA & Roteamento GPS ---
  let colMeta = null;
  let colGrid = null;
  // Camada extra (collision_floor.bin): por célula [piso inferior transitável (cm), início do obstáculo acima (cm)]
  // Permite passar embaixo de viadutos, passarelas, marquises e copas de árvores sem paredes invisíveis
  let colFloor = null;
  const mapAiImage = new Image();
  let mapAiReady = false;
  mapAiImage.onload = () => { mapAiReady = true; };
  // Vista de cima REAL renderizada da geometria/texturas do mapa (tools/render_minimap.py); fallback na antiga
  mapAiImage.onerror = () => {
    if (!mapAiImage.src.includes('minimap_ai.jpg')) mapAiImage.src = 'images/minimap_ai.jpg';
  };
  mapAiImage.src = 'images/minimap_real.jpg';

  let fullMapZoom = 1.0;
  let fullMapPanX = 0;
  let fullMapPanY = 0;

  const gpsRoute = {
    active: false,
    target: new THREE.Vector3(),
    waypoints: [],
    beacon: null
  };

  function buildRealMapTexture() {
    // Mapa visual agora usa a textura de satélite/GPS gerada por IA (images/minimap_ai.jpg)
  }

  const trafficLights = [];
  const crosswalks = [];
  let trafficPhaseTimer = 0;

  const mcBuildings = [];
  const driveThrus = [];
  const extraSolidBoxes = [];

  function isOutsideIsland(x, z) {
    return x < -924 || x > 788 || z < -1416 || z > 190;
  }

  const trafficLightGroups = { nsMats: null, ewMats: null };

  const streetLampState = {
    bulbMat: new THREE.MeshBasicMaterial({ color: 0x3a3f47, toneMapped: false }),
    haloMat: new THREE.MeshBasicMaterial({
      color: 0xffd27d,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    }),
    nightFactor: 0
  };

  async function setupTrafficLightsAndCrosswalks() {
    let nativeLights = [];
    try {
      const res = await fetch('models/map/traffic_lights.json');
      if (res.ok) nativeLights = await res.json();
    } catch (e) {
      console.warn('Falha ao carregar traffic_lights.json:', e);
    }
    if (!Array.isArray(nativeLights)) nativeLights = [];

    const nsMats = {
      r: new THREE.MeshBasicMaterial({ color: 0xff2244, toneMapped: false }),
      y: new THREE.MeshBasicMaterial({ color: 0x1a1500, toneMapped: false }),
      g: new THREE.MeshBasicMaterial({ color: 0x021a0c, toneMapped: false })
    };
    const ewMats = {
      r: new THREE.MeshBasicMaterial({ color: 0x180507, toneMapped: false }),
      y: new THREE.MeshBasicMaterial({ color: 0x1a1500, toneMapped: false }),
      g: new THREE.MeshBasicMaterial({ color: 0x00ff88, toneMapped: false })
    };
    trafficLightGroups.nsMats = nsMats;
    trafficLightGroups.ewMats = ewMats;

    const nsLights = nativeLights.filter((l) => l.axis === 'NS');
    const ewLights = nativeLights.filter((l) => l.axis === 'EW');
    const lensGeo = new THREE.SphereGeometry(0.135, 10, 8);
    const offsetsX = [-0.25, 0.25];
    const offsetsZ = [-0.155, 0.155];

    const buildInstancedLenses = (list, mats) => {
      if (list.length === 0) return;
      const total = list.length * 4;
      const rMesh = new THREE.InstancedMesh(lensGeo, mats.r, total);
      const yMesh = new THREE.InstancedMesh(lensGeo, mats.y, total);
      const gMesh = new THREE.InstancedMesh(lensGeo, mats.g, total);
      rMesh.frustumCulled = false;
      yMesh.frustumCulled = false;
      gMesh.frustumCulled = false;
      const dummy = new THREE.Object3D();
      let idx = 0;
      for (const tl of list) {
        const cosR = Math.cos(tl.ry);
        const sinR = Math.sin(tl.ry);
        for (const lx of offsetsX) {
          for (const lz of offsetsZ) {
            const wx = tl.x + lx * cosR + lz * sinR;
            const wz = tl.z - lx * sinR + lz * cosR;
            dummy.position.set(wx, tl.y + 0.175, wz);
            dummy.updateMatrix();
            rMesh.setMatrixAt(idx, dummy.matrix);

            dummy.position.set(wx, tl.y, wz);
            dummy.updateMatrix();
            yMesh.setMatrixAt(idx, dummy.matrix);

            dummy.position.set(wx, tl.y - 0.175, wz);
            dummy.updateMatrix();
            gMesh.setMatrixAt(idx, dummy.matrix);
            idx++;
          }
        }
        trafficLights.push({ x: tl.x, y: tl.y, z: tl.z, axis: tl.axis, state: 'RED' });
        crosswalks.push({ x: tl.x, z: tl.z, axis: tl.axis });
      }
      rMesh.instanceMatrix.needsUpdate = true;
      yMesh.instanceMatrix.needsUpdate = true;
      gMesh.instanceMatrix.needsUpdate = true;
      scene.add(rMesh, yMesh, gMesh);
    };

    buildInstancedLenses(nsLights, nsMats);
    buildInstancedLenses(ewLights, ewMats);

    initDestructibleProps(nativeLights);
  }

  // --- Postes, Placas, Hidrantes e Cones Destrutíveis (Física GTA) ---
  const destructibleProps = [];
  function initDestructibleProps(nativeLights) {
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 4.4, 6);
    poleGeo.translate(0, 2.2, 0);
    const armGeo = new THREE.BoxGeometry(0.95, 0.12, 0.16);
    armGeo.translate(0.45, 4.25, 0);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x5f6b7a });
    const lampMat = streetLampState.bulbMat;
    const lampHaloGeo = new THREE.ConeGeometry(1.85, 4.15, 10, 1, true);
    lampHaloGeo.translate(0, -2.075, 0);
    const lampPoolGeo = new THREE.CircleGeometry(2.6, 12);
    lampPoolGeo.rotateX(-Math.PI / 2);

    const coneGeo = new THREE.ConeGeometry(0.24, 0.72, 7);
    coneGeo.translate(0, 0.36, 0);
    const coneMat = new THREE.MeshLambertMaterial({ color: 0xff6d00 });

    const hydrantGeo = new THREE.CylinderGeometry(0.16, 0.19, 0.85, 7);
    hydrantGeo.translate(0, 0.425, 0);
    const hydrantMat = new THREE.MeshLambertMaterial({ color: 0xd50000 });

    const signPoleGeo = new THREE.CylinderGeometry(0.045, 0.055, 2.5, 6);
    signPoleGeo.translate(0, 1.25, 0);
    const signBoardGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.05, 8);
    const signMat = new THREE.MeshLambertMaterial({ color: 0xe53935 });

    const placed = [];
    const farEnough = (x, z, minD) => {
      for (let i = 0; i < placed.length; i++) {
        const dx = placed[i].x - x;
        const dz = placed[i].z - z;
        if (dx * dx + dz * dz < minD * minD) return false;
      }
      return true;
    };

    const spawnProp = (kind, x, z, yaw = 0) => {
      const gy = getGroundHeight(x, z);
      if (gy === null || gy < -28 || gy > 70) return;
      const grp = new THREE.Group();
      grp.position.set(x, gy, z);
      grp.rotation.y = yaw;
      grp.visible = false;

      if (kind === 'pole') {
        grp.add(new THREE.Mesh(poleGeo, poleMat));
        const arm = new THREE.Mesh(armGeo, poleMat);
        grp.add(arm);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.16), lampMat);
        bulb.position.set(0.75, 4.18, 0);
        grp.add(bulb);
        const beam = new THREE.Mesh(lampHaloGeo, streetLampState.haloMat);
        beam.position.set(0.75, 4.16, 0);
        beam.name = 'PoleLightBeam';
        grp.add(beam);
        const pool = new THREE.Mesh(lampPoolGeo, streetLampState.haloMat);
        pool.position.set(0.75, 0.06, 0);
        pool.name = 'PoleLightPool';
        grp.add(pool);
      } else if (kind === 'cone') {
        grp.add(new THREE.Mesh(coneGeo, coneMat));
      } else if (kind === 'hydrant') {
        grp.add(new THREE.Mesh(hydrantGeo, hydrantMat));
      } else {
        grp.add(new THREE.Mesh(signPoleGeo, poleMat));
        const sb = new THREE.Mesh(signBoardGeo, signMat);
        sb.rotation.x = Math.PI * 0.5;
        sb.position.set(0, 2.25, 0);
        grp.add(sb);
      }

      scene.add(grp);
      placed.push({ x, z });
      destructibleProps.push({
        kind,
        mesh: grp,
        homeX: x,
        homeY: gy,
        homeZ: z,
        homeYaw: yaw,
        pos: new THREE.Vector3(x, gy, z),
        vel: new THREE.Vector3(),
        fallAxis: new THREE.Vector3(1, 0, 0),
        fallAngle: 0,
        fallSpeed: 0,
        state: 'intact', // 'intact' | 'falling' | 'fallen'
        resetTimer: 0,
        radius: kind === 'pole' ? 0.55 : 0.45,
        massFactor: kind === 'pole' ? 0.94 : 0.985
      });
    };

    // 1. Postes/placas nas esquinas dos semáforos
    for (let i = 0; i < nativeLights.length; i++) {
      const tl = nativeLights[i];
      const ox = tl.x + (i % 2 === 0 ? 1.8 : -1.8);
      const oz = tl.z + (i % 3 === 0 ? 1.8 : -1.8);
      if (!isOutsideIsland(ox, oz) && farEnough(ox, oz, 10)) {
        spawnProp(i % 4 === 0 ? 'sign' : 'pole', ox, oz, tl.ry || 0);
      }
    }

    // 2. Postes, hidrantes e cones ao longo das calçadas das avenidas
    if (colMeta && roadGrid) {
      const step = 14;
      for (let x = -720; x <= 620 && destructibleProps.length < 340; x += step) {
        for (let z = -1250; z <= 140 && destructibleProps.length < 340; z += step) {
          if (isOutsideIsland(x, z)) continue;
          const c = getRoadCellAt(x, z);
          if (c !== 2) continue;
          const nearRoad =
            getRoadCellAt(x + 3.2, z) === 1 ||
            getRoadCellAt(x - 3.2, z) === 1 ||
            getRoadCellAt(x, z + 3.2) === 1 ||
            getRoadCellAt(x, z - 3.2) === 1;
          if (!nearRoad || !farEnough(x, z, 22)) continue;
          const r = Math.abs((x * 73 + z * 37) % 10);
          const kind = r < 5 ? 'pole' : (r < 7 ? 'sign' : (r < 9 ? 'cone' : 'hydrant'));
          spawnProp(kind, x, z, (r * 0.6));
        }
      }
    }
  }

  function updateDestructibleProps(dt) {
    if (destructibleProps.length === 0) return;
    const refPos = player.inCar ? player.inCar.pos : player.pos;
    const activeCars = [];
    for (const v of vehicles) activeCars.push({ pos: v.pos, vel: v.vel, rad: 1.55 });
    for (const tc of trafficCars) {
      if (Math.abs(tc.pos.x - refPos.x) < 90 && Math.abs(tc.pos.z - refPos.z) < 90) {
        const vx = Math.sin(tc.yaw) * tc.speed;
        const vz = Math.cos(tc.yaw) * tc.speed;
        activeCars.push({ pos: tc.pos, vel: new THREE.Vector3(vx, 0, vz), rad: tc.radius || 1.4 });
      }
    }

    for (let i = 0; i < destructibleProps.length; i++) {
      const p = destructibleProps[i];
      const dxR = p.pos.x - refPos.x;
      const dzR = p.pos.z - refPos.z;
      const distSq = dxR * dxR + dzR * dzR;

      if (distSq > 95 * 95) {
        if (p.mesh.visible) p.mesh.visible = false;
        if (p.state !== 'intact' && distSq > 125 * 125) {
          p.state = 'intact';
          p.pos.set(p.homeX, p.homeY, p.homeZ);
          p.vel.set(0, 0, 0);
          p.fallAngle = 0;
          p.fallSpeed = 0;
          p.mesh.position.copy(p.pos);
          p.mesh.quaternion.setFromEuler(new THREE.Euler(0, p.homeYaw, 0));
        }
        continue;
      }
      if (!p.mesh.visible) p.mesh.visible = true;

      if (p.state === 'intact') {
        for (let ci = 0; ci < activeCars.length; ci++) {
          const c = activeCars[ci];
          const dx = p.pos.x - c.pos.x;
          const dz = p.pos.z - c.pos.z;
          const hitR = p.radius + c.rad;
          if (dx * dx + dz * dz < hitR * hitR && Math.abs(p.pos.y - c.pos.y) < 3.5) {
            const spd = Math.hypot(c.vel.x, c.vel.z);
            if (spd < 1.2 && p.kind === 'pole') continue;
            p.state = 'falling';
            p.resetTimer = 18.0;
            const dirX = spd > 0.5 ? c.vel.x / spd : (dx || 0.01);
            const dirZ = spd > 0.5 ? c.vel.z / spd : (dz || 0.01);
            const len = Math.hypot(dirX, dirZ) || 1;
            const nx = dirX / len;
            const nz = dirZ / len;
            const launch = Math.max(4.5, Math.min(22, spd * 0.85));
            p.vel.set(nx * launch, p.kind === 'cone' ? 4.8 : 2.8, nz * launch);
            p.fallAxis.set(nz, 0, -nx).normalize();
            p.fallSpeed = Math.min(9.5, 3.2 + spd * 0.35);
            c.vel.multiplyScalar(p.massFactor);
            if (player.inCar && c.pos === player.inCar.pos) {
              AudioFX.crash();
              vibrate(35);
            }
            break;
          }
        }
      } else if (p.state === 'falling') {
        p.vel.y -= 20 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const gy = getGroundHeight(p.pos.x, p.pos.z) ?? p.homeY;
        if (p.pos.y <= gy) {
          p.pos.y = gy;
          p.vel.x *= 0.65;
          p.vel.z *= 0.65;
          if (Math.abs(p.vel.y) > 2.2) {
            p.vel.y = -p.vel.y * 0.32;
          } else {
            p.vel.y = 0;
          }
        }
        p.fallAngle = Math.min(Math.PI * 0.52, p.fallAngle + p.fallSpeed * dt);
        p.mesh.position.copy(p.pos);
        const qBase = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.homeYaw, 0));
        const qFall = new THREE.Quaternion().setFromAxisAngle(p.fallAxis, p.fallAngle);
        p.mesh.quaternion.copy(qFall).multiply(qBase);

        if (p.fallAngle >= Math.PI * 0.5 && p.vel.lengthSq() < 0.25) {
          p.state = 'fallen';
        }
      } else if (p.state === 'fallen') {
        p.resetTimer -= dt;
        if (p.resetTimer <= 0 && distSq > 45 * 45) {
          p.state = 'intact';
          p.pos.set(p.homeX, p.homeY, p.homeZ);
          p.fallAngle = 0;
          p.mesh.position.copy(p.pos);
          p.mesh.quaternion.setFromEuler(new THREE.Euler(0, p.homeYaw, 0));
        }
      }
    }
  }

  function updateTrafficLights(dt) {
    trafficPhaseTimer = (trafficPhaseTimer + dt) % 24.0;
    // 0..9: NS Verde / EW Vermelho | 9..12: NS Amarelo | 12..21: NS Vermelho / EW Verde | 21..24: EW Amarelo
    let nsState = 'RED', ewState = 'RED';
    if (trafficPhaseTimer < 9.0) { nsState = 'GREEN'; ewState = 'RED'; }
    else if (trafficPhaseTimer < 12.0) { nsState = 'YELLOW'; ewState = 'RED'; }
    else if (trafficPhaseTimer < 21.0) { nsState = 'RED'; ewState = 'GREEN'; }
    else { nsState = 'RED'; ewState = 'YELLOW'; }

    if (trafficLightGroups.nsMats) {
      trafficLightGroups.nsMats.r.color.setHex(nsState === 'RED' ? 0xff2244 : 0x1a0608);
      trafficLightGroups.nsMats.y.color.setHex(nsState === 'YELLOW' ? 0xffbe00 : 0x1f1700);
      trafficLightGroups.nsMats.g.color.setHex(nsState === 'GREEN' ? 0x00ff88 : 0x031c0e);
    }
    if (trafficLightGroups.ewMats) {
      trafficLightGroups.ewMats.r.color.setHex(ewState === 'RED' ? 0xff2244 : 0x1a0608);
      trafficLightGroups.ewMats.y.color.setHex(ewState === 'YELLOW' ? 0xffbe00 : 0x1f1700);
      trafficLightGroups.ewMats.g.color.setHex(ewState === 'GREEN' ? 0x00ff88 : 0x031c0e);
    }
    for (const tl of trafficLights) {
      tl.state = tl.axis === 'NS' ? nsState : ewState;
    }
  }

  let roadGrid = null;
  let roadGridN = 1024;

  function getRoadCellAt(wx, wz) {
    if (!colMeta || !roadGrid) return 2;
    const N = roadGridN;
    const worldW = colMeta.W * colMeta.step;
    const worldH = colMeta.H * colMeta.step;
    const gx = Math.floor(((wx - colMeta.minX) / worldW) * N);
    const gy = Math.floor((1.0 - (-wz - colMeta.minY) / worldH) * N);
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return 0;
    return roadGrid[gy * N + gx];
  }

  function snapNodeToNearestRoad(gx0, gy0, N, maxR = 75) {
    if (roadGrid[gy0 * N + gx0] === 1) return [gx0, gy0];
    let best = null;
    let bestD2 = 1e9;
    for (let r = 1; r <= maxR; r++) {
      const yMin = Math.max(0, gy0 - r), yMax = Math.min(N - 1, gy0 + r);
      const xMin = Math.max(0, gx0 - r), xMax = Math.min(N - 1, gx0 + r);
      for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
          if (y !== yMin && y !== yMax && x !== xMin && x !== xMax) continue;
          if (roadGrid[y * N + x] === 1) {
            const d2 = (x - gx0) * (x - gx0) + (y - gy0) * (y - gy0);
            if (d2 < bestD2) { bestD2 = d2; best = [x, y]; }
          }
        }
      }
      if (best) return best;
    }
    return [gx0, gy0];
  }

  function computeGpsRoute(startX, startZ, endX, endZ) {
    if (!colMeta || !roadGrid) return [{ x: startX, z: startZ }, { x: endX, z: endZ }];
    const N = roadGridN;
    const worldW = colMeta.W * colMeta.step;
    const worldH = colMeta.H * colMeta.step;

    const toNode = (wx, wz) => {
      const gx = Math.floor(((wx - colMeta.minX) / worldW) * N);
      const gy = Math.floor((1.0 - (-wz - colMeta.minY) / worldH) * N);
      return [Math.max(0, Math.min(N - 1, gx)), Math.max(0, Math.min(N - 1, gy))];
    };
    const toWorld = (gx, gy) => ({
      x: colMeta.minX + ((gx + 0.5) / N) * worldW,
      z: -(colMeta.minY + (1.0 - (gy + 0.5) / N) * worldH)
    });

    const rawStart = toNode(startX, startZ);
    const rawEnd = toNode(endX, endZ);
    const [sx, sy] = snapNodeToNearestRoad(rawStart[0], rawStart[1], N, 75);
    const [tx, ty] = snapNodeToNearestRoad(rawEnd[0], rawEnd[1], N, 75);
    const startIdx = sy * N + sx;
    const targetIdx = ty * N + tx;
    if (startIdx === targetIdx) return [{ x: startX, z: startZ }, { x: endX, z: endZ }];

    const total = N * N;
    const gScore = new Float32Array(total).fill(1e9);
    const prev = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    gScore[startIdx] = 0;

    const heapIdx = [startIdx];
    const heapF = [Math.hypot(tx - sx, ty - sy)];
    const pushHeap = (node, f) => {
      heapIdx.push(node); heapF.push(f);
      let i = heapIdx.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapF[p] <= heapF[i]) break;
        [heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]];
        [heapF[p], heapF[i]] = [heapF[i], heapF[p]];
        i = p;
      }
    };
    const popHeap = () => {
      const top = heapIdx[0];
      const lastI = heapIdx.pop();
      const lastF = heapF.pop();
      if (heapIdx.length > 0) {
        heapIdx[0] = lastI; heapF[0] = lastF;
        let i = 0, n = heapIdx.length;
        while (true) {
          let l = i * 2 + 1, r = l + 1, s = i;
          if (l < n && heapF[l] < heapF[s]) s = l;
          if (r < n && heapF[r] < heapF[s]) s = r;
          if (s === i) break;
          [heapIdx[i], heapIdx[s]] = [heapIdx[s], heapIdx[i]];
          [heapF[i], heapF[s]] = [heapF[s], heapF[i]];
          i = s;
        }
      }
      return top;
    };

    const dxs = [1, -1, 0, 0, 1, 1, -1, -1];
    const dys = [0, 0, 1, -1, 1, -1, 1, -1];
    const dcost = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];
    let found = false;
    let iters = 0;

    while (heapIdx.length > 0 && iters < 320000) {
      iters++;
      const cur = popHeap();
      if (cur === targetIdx) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % N;
      const cy = (cur / N) | 0;
      for (let i = 0; i < 8; i++) {
        const nx = cx + dxs[i];
        const ny = cy + dys[i];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const nxt = ny * N + nx;
        if (closed[nxt]) continue;
        const cell = roadGrid[nxt];
        if (cell !== 1 && nxt !== targetIdx) {
          if (cell !== 2) continue;
        }
        // Prioriza estritamente o miolo asfaltado das ruas (driveableGrid===2 -> custo 1.0, borda rua -> 1.8, calçada -> 28)
        const isCore = driveableGrid && driveableGrid[nxt] === 2;
        const stepMult = cell === 1 ? (isCore ? 1.0 : 1.8) : 28.0;
        const tentG = gScore[cur] + dcost[i] * stepMult;
        if (tentG < gScore[nxt]) {
          gScore[nxt] = tentG;
          prev[nxt] = cur;
          pushHeap(nxt, tentG + Math.hypot(tx - nx, ty - ny) * 1.05);
        }
      }
    }

    if (!found) return [{ x: startX, z: startZ }, { x: endX, z: endZ }];

    const rawNodes = [];
    let cur = targetIdx;
    while (cur !== -1) {
      rawNodes.push([cur % N, (cur / N) | 0]);
      cur = prev[cur];
    }
    rawNodes.reverse();

    // Suavização estrita dentro do asfalto (jamais atravessa quarteirão ou calçada)
    const hasRoadLOS = (a, b) => {
      const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2;
      if (steps <= 1) return true;
      for (let s = 1; s < steps; s++) {
        const x = Math.round(a[0] + ((b[0] - a[0]) * s) / steps);
        const y = Math.round(a[1] + ((b[1] - a[1]) * s) / steps);
        if (roadGrid[y * N + x] !== 1) return false;
      }
      return true;
    };

    const smoothed = [rawNodes[0]];
    let anchor = 0;
    while (anchor < rawNodes.length - 1) {
      let far = Math.min(rawNodes.length - 1, anchor + 10);
      while (far > anchor + 1 && !hasRoadLOS(rawNodes[anchor], rawNodes[far])) far--;
      smoothed.push(rawNodes[far]);
      anchor = far;
    }

    const pts = [];
    const firstRoad = toWorld(smoothed[0][0], smoothed[0][1]);
    if (Math.hypot(firstRoad.x - startX, firstRoad.z - startZ) > 3.0) {
      pts.push({ x: startX, z: startZ });
    }
    for (let i = 0; i < smoothed.length; i++) {
      pts.push(toWorld(smoothed[i][0], smoothed[i][1]));
    }
    const lastPt = pts[pts.length - 1];
    if (!lastPt || Math.hypot(lastPt.x - endX, lastPt.z - endZ) > 2.5) {
      pts.push({ x: endX, z: endZ });
    }
    return pts;
  }

  const GPS_CHEVRON_MAX = 22;
  let gpsChevronInst = null;
  let gpsChevronMat = null;
  function ensureGpsChevronMesh() {
    if (gpsChevronInst) return;
    // Geometria em formato de seta/chevron (>) apontando para +Z
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.95);
    shape.lineTo(0.85, -0.45);
    shape.lineTo(0.42, -0.45);
    shape.lineTo(0, 0.25);
    shape.lineTo(-0.42, -0.45);
    shape.lineTo(-0.85, -0.45);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    gpsChevronMat = new THREE.MeshBasicMaterial({
      color: 0xd500f9,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    gpsChevronInst = new THREE.InstancedMesh(geo, gpsChevronMat, GPS_CHEVRON_MAX);
    gpsChevronInst.frustumCulled = false;
    gpsChevronInst.visible = false;
    scene.add(gpsChevronInst);
  }

  function updateGpsRoadIndicators() {
    const banner = el('gpsHudBanner');
    if (!gpsRoute.active || !gpsRoute.waypoints || gpsRoute.waypoints.length < 2) {
      if (gpsChevronInst) gpsChevronInst.visible = false;
      if (banner) banner.classList.add('hidden');
      return;
    }
    ensureGpsChevronMesh();
    const refPos = player.inCar ? player.inCar.pos : player.pos;
    const wps = gpsRoute.waypoints;

    // Acha o segmento mais próximo do jogador na rota
    let bestSeg = 0;
    let bestDistSq = 1e12;
    let bestT = 0;
    for (let i = 0; i < wps.length - 1; i++) {
      const ax = wps[i].x, az = wps[i].z;
      const bx = wps[i + 1].x, bz = wps[i + 1].z;
      const vx = bx - ax, vz = bz - az;
      const lenSq = vx * vx + vz * vz || 1e-6;
      const t = Math.max(0, Math.min(1, ((refPos.x - ax) * vx + (refPos.z - az) * vz) / lenSq));
      const px = ax + vx * t, pz = az + vz * t;
      const dSq = (refPos.x - px) * (refPos.x - px) + (refPos.z - pz) * (refPos.z - pz);
      if (dSq < bestDistSq) { bestDistSq = dSq; bestSeg = i; bestT = t; }
    }

    // Calcula distância restante total rua por rua e próxima curva
    let remDist = Math.hypot(
      wps[bestSeg + 1].x - (wps[bestSeg].x + (wps[bestSeg + 1].x - wps[bestSeg].x) * bestT),
      wps[bestSeg + 1].z - (wps[bestSeg].z + (wps[bestSeg + 1].z - wps[bestSeg].z) * bestT)
    );
    for (let i = bestSeg + 1; i < wps.length - 1; i++) {
      remDist += Math.hypot(wps[i + 1].x - wps[i].x, wps[i + 1].z - wps[i].z);
    }

    let turnIcon = '⬆';
    if (bestSeg + 2 < wps.length) {
      const d1x = wps[bestSeg + 1].x - wps[bestSeg].x;
      const d1z = wps[bestSeg + 1].z - wps[bestSeg].z;
      const distToCorner = Math.hypot(wps[bestSeg + 1].x - refPos.x, wps[bestSeg + 1].z - refPos.z);
      if (distToCorner < 48) {
        const d2x = wps[bestSeg + 2].x - wps[bestSeg + 1].x;
        const d2z = wps[bestSeg + 2].z - wps[bestSeg + 1].z;
        const a1 = Math.atan2(d1x, d1z);
        const a2 = Math.atan2(d2x, d2z);
        let da = a2 - a1;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (da > 0.42) turnIcon = '↰';
        else if (da < -0.42) turnIcon = '↱';
      }
    }

    if (banner) {
      banner.classList.remove('hidden');
      const lblEl = el('gpsHudLabel');
      const dstEl = el('gpsHudDist');
      const arrEl = el('gpsTurnArrow');
      if (lblEl) lblEl.textContent = gpsRoute.label || 'Destino GPS';
      if (dstEl) dstEl.textContent = remDist >= 1000 ? (remDist / 1000).toFixed(2) + ' km' : Math.round(remDist) + ' m';
      if (arrEl) arrEl.textContent = turnIcon;
    }

    // Posiciona 22 chevrons animados ao longo dos próximos ~95m da rota sobre o asfalto!
    const dummy = new THREE.Object3D();
    const pulseShift = ((performance.now() * 0.0045) % 1.0) * 4.2;
    let segIdx = bestSeg;
    let segX = wps[bestSeg].x + (wps[bestSeg + 1].x - wps[bestSeg].x) * bestT;
    let segZ = wps[bestSeg].z + (wps[bestSeg + 1].z - wps[bestSeg].z) * bestT;
    let stepNeeded = 3.5 + pulseShift;
    let count = 0;

    while (segIdx < wps.length - 1 && count < GPS_CHEVRON_MAX) {
      const bx = wps[segIdx + 1].x, bz = wps[segIdx + 1].z;
      const dx = bx - segX, dz = bz - segZ;
      const segRem = Math.hypot(dx, dz);
      if (segRem >= stepNeeded && segRem > 0.01) {
        const r = stepNeeded / segRem;
        segX += dx * r;
        segZ += dz * r;
        const gy = getWalkableGround(segX, segZ, refPos.y, 3.5) ?? refPos.y;
        const yaw = Math.atan2(dx, dz);
        dummy.position.set(segX, gy + 0.11, segZ);
        dummy.rotation.set(0, yaw, 0);
        const sc = player.inCar ? 1.15 : 0.82;
        dummy.scale.set(sc, 1, sc);
        dummy.updateMatrix();
        gpsChevronInst.setMatrixAt(count, dummy.matrix);
        count++;
        stepNeeded = 4.4;
      } else {
        stepNeeded -= segRem;
        segIdx++;
        if (segIdx < wps.length - 1) {
          segX = wps[segIdx].x;
          segZ = wps[segIdx].z;
        }
      }
    }
    gpsChevronInst.count = count;
    gpsChevronInst.visible = count > 0;
    if (count > 0) {
      gpsChevronMat.color.setHex(player.inCar ? 0x00e5ff : 0xd500f9);
      gpsChevronInst.instanceMatrix.needsUpdate = true;
    }
  }

  function setGpsDestination(wx, wz, label = 'Destino GPS') {
    const gy = getWalkableGround(wx, wz, player.pos.y, 25.0) ?? getGroundHeight(wx, wz) ?? player.pos.y;
    gpsRoute.active = true;
    gpsRoute.label = label;
    gpsRoute.target.set(wx, gy, wz);
    const refP = player.inCar ? player.inCar.pos : player.pos;
    gpsRoute.waypoints = computeGpsRoute(refP.x, refP.z, wx, wz);
    if (!gpsRoute.beacon) {
      gpsRoute.beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 1.8, 30, 14, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xd500f9, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      scene.add(gpsRoute.beacon);
    }
    gpsRoute.beacon.position.set(wx, gy + 14, wz);
    gpsRoute.beacon.visible = true;
    updateGpsRoadIndicators();
    showToast(`📍 ${label} marcado no GPS!`);
  }

  function clearGpsDestination() {
    gpsRoute.active = false;
    gpsRoute.waypoints = [];
    if (gpsRoute.beacon) gpsRoute.beacon.visible = false;
    if (gpsChevronInst) gpsChevronInst.visible = false;
    if (el('gpsHudBanner')) el('gpsHudBanner').classList.add('hidden');
  }

  function getCellRaw(ix, iy) {
    if (!colMeta || !colGrid) return -32768;
    if (ix < 0 || iy < 0 || ix >= colMeta.W || iy >= colMeta.H) return -32768;
    return colGrid[iy * colMeta.W + ix];
  }

  function getGroundHeight(x, z) {
    if (!colMeta || !colGrid) return null;
    const by = -z;
    const ix = Math.floor((x - colMeta.minX) / colMeta.step);
    const iy = Math.floor((by - colMeta.minY) / colMeta.step);
    const raw = getCellRaw(ix, iy);
    if (raw === -32768 || raw >= 29500) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const r2 = getCellRaw(ix + dx, iy + dy);
          if (r2 !== -32768 && r2 < 29500) return r2 * 0.01;
        }
      }
      return null;
    }
    return raw * 0.01;
  }

  // Piso inferior com vão livre (embaixo de viaduto/marquise/árvore) acessível a partir da altura posY
  function getUnderFloorAt(ix, iy, posY, maxStep, clearance = 1.9) {
    if (!colFloor || !colMeta) return null;
    if (ix < 0 || iy < 0 || ix >= colMeta.W || iy >= colMeta.H) return null;
    const i = (iy * colMeta.W + ix) * 2;
    const f = colFloor[i];
    if (f === -32768) return null;
    const fy = f * 0.01;
    const cy = colFloor[i + 1] * 0.01;
    if (cy - fy < clearance) return null;
    if (fy - posY > maxStep) return null;      // piso alto demais para subir
    if (posY > cy - 0.4) return null;          // já está acima da cobertura (em cima do viaduto)
    return fy;
  }

  function getUnderFloorWorld(x, z, posY, maxStep, clearance = 1.9) {
    if (!colMeta) return null;
    const ix = Math.floor((x - colMeta.minX) / colMeta.step);
    const iy = Math.floor((-z - colMeta.minY) / colMeta.step);
    return getUnderFloorAt(ix, iy, posY, maxStep, clearance);
  }

  function isRealWallCell(ix, iy, raw, posY, maxStep, cellCenterX, cellCenterZ) {
    // Frestas de raycast (-32768) nunca devem virar paredes invisíveis
    if (raw === -32768) return false;

    const onRoad = getRoadCellAt(cellCenterX, cellCenterZ) === 1;
    // Em ruas marcadas, ignora pórticos, placas aéreas, postes e tetos
    if (onRoad && (raw >= 29500 || (raw * 0.01) - posY > 2.2)) return false;

    const isHigh = (raw >= 29500) || ((raw * 0.01) - posY > maxStep);
    if (!isHigh) return false;

    // Embaixo de viaduto, passarela, marquise ou copa de árvore com vão livre real: não é parede
    if (getUnderFloorAt(ix, iy, posY, maxStep) !== null) return false;

    // Verifica vizinhos para distinguir prédios/muros/muretas costeiras de postes, árvores, escadarias e arcos de pontes
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let walkableNeighbors = 0;
    let highNeighbors = 0;
    let seaNeighbors = 0;
    let stairBridgeNeighbor = false;
    const cellH = raw < 29500 ? raw * 0.01 : 999;
    for (let i = 0; i < 4; i++) {
      const nr = getCellRaw(ix + dirs[i][0], iy + dirs[i][1]);
      if (nr === -32768) {
        seaNeighbors++;
      } else if (nr < 29500) {
        const nh = nr * 0.01;
        if (nh - posY <= maxStep + 0.85) walkableNeighbors++;
        if (nh - posY > maxStep) highNeighbors++;
        // Escadaria / rampa contínua: vizinho intermediário entre posY e cellH com degrau suave
        if (cellH < 900 && nh >= posY - 0.45 && nh < cellH - 0.18 && (cellH - nh) <= 1.25) {
          stairBridgeNeighbor = true;
        }
      } else {
        highNeighbors++;
      }
    }

    // Mureta costeira na beira do mar/canal: sempre bloqueia para não cair na água
    if (seaNeighbors >= 1 && walkableNeighbors >= 1 && raw < 29500 && (cellH - posY) > maxStep) {
      return true;
    }

    // Degraus de escadaria / rampa íngreme contínua (até 1.48m de desnível sobre célula adjacente, sem ser beira de mar)
    if (seaNeighbors === 0 && raw < 29500 && (cellH - posY) <= 1.48 && stairBridgeNeighbor) {
      return false;
    }

    // Arco de ponte, pórtico, poste ou árvore isolada sobre piso/ponte transitável
    if (walkableNeighbors >= 2 && highNeighbors <= 2) return false;
    if (raw >= 29500 && highNeighbors < 2) return false;

    return true;
  }

  function isSolidMapCell(x, z, posY, maxStep = 1.15) {
    if (!colMeta || !colGrid || isOutsideIsland(x, z)) return false;
    const s = colMeta.step;
    const ix = Math.floor((x - colMeta.minX) / s);
    const iy = Math.floor((-z - colMeta.minY) / s);
    const raw = getCellRaw(ix, iy);
    return isRealWallCell(ix, iy, raw, posY, maxStep, x, z);
  }

  function resolveMapWallCollision(pos, radius, vel = null, maxStep = 1.15) {
    if (!colMeta || !colGrid) return false;
    const s = colMeta.step;
    const minIx = Math.floor((pos.x - radius - colMeta.minX) / s);
    const maxIx = Math.floor((pos.x + radius - colMeta.minX) / s);
    const minIy = Math.floor((-pos.z - radius - colMeta.minY) / s);
    const maxIy = Math.floor((-pos.z + radius - colMeta.minY) / s);

    let hitWall = false;
    for (let iy = minIy; iy <= maxIy; iy++) {
      for (let ix = minIx; ix <= maxIx; ix++) {
        const raw = getCellRaw(ix, iy);
        if (raw === -32768) continue;
        const cMinX = colMeta.minX + ix * s;
        const cMaxX = cMinX + s;
        const cMaxZ = -(colMeta.minY + iy * s);
        const cMinZ = cMaxZ - s;
        const cellCenterX = (cMinX + cMaxX) * 0.5;
        const cellCenterZ = (cMinZ + cMaxZ) * 0.5;
        if (isOutsideIsland(cellCenterX, cellCenterZ)) continue;

        if (!isRealWallCell(ix, iy, raw, pos.y, maxStep, cellCenterX, cellCenterZ)) continue;

        const closestX = Math.max(cMinX, Math.min(pos.x, cMaxX));
        const closestZ = Math.max(cMinZ, Math.min(pos.z, cMaxZ));
        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          const nx = dist > 0.0001 ? dx / dist : 1;
          const nz = dist > 0.0001 ? dz / dist : 0;
          const pen = radius - dist;
          pos.x += nx * pen;
          pos.z += nz * pen;
          if (vel) {
            const vn = vel.x * nx + vel.z * nz;
            if (vn < 0) {
              vel.x -= nx * vn * 1.15;
              vel.z -= nz * vn * 1.15;
            }
          }
          hitWall = true;
        }
      }
    }
    for (let bi = 0; bi < extraSolidBoxes.length; bi++) {
      const b = extraSolidBoxes[bi];
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        const nx = dist > 0.0001 ? dx / dist : 1;
        const nz = dist > 0.0001 ? dz / dist : 0;
        const pen = radius - dist;
        pos.x += nx * pen;
        pos.z += nz * pen;
        if (vel) {
          const vn = vel.x * nx + vel.z * nz;
          if (vn < 0) {
            vel.x -= nx * vn * 1.15;
            vel.z -= nz * vn * 1.15;
          }
        }
        hitWall = true;
      }
    }
    return hitWall;
  }

  function resolveVehicleMapCollision(car, dt, forwardDir) {
    if (!car.lastSafePos) car.lastSafePos = car.pos.clone();
    const prevX = car.pos.x;
    const prevZ = car.pos.z;
    const moveDist = Math.hypot(car.vel.x * dt, car.vel.z * dt);
    const steps = Math.min(6, Math.max(1, Math.ceil(moveDist / 0.65)));
    const subDt = dt / steps;
    const probeOffset = 1.35;
    const probePos = new THREE.Vector3();
    let anyHit = false;

    const pitchSin = Math.sin(car.slopePitch || 0) * (car.forwardSign || 1);
    const stepLim = Math.abs(car.slopePitch || 0) > 0.12 ? 1.32 : 1.05;

    for (let s = 0; s < steps; s++) {
      car.pos.addScaledVector(car.vel, subDt);
      // Testa 3 círculos ao longo do chassi acompanhando a inclinação real em escadas/rampas
      if (resolveMapWallCollision(car.pos, 1.15, car.vel, stepLim)) anyHit = true;

      for (const sign of [1, -1]) {
        probePos.set(
          car.pos.x + forwardDir.x * probeOffset * sign,
          car.pos.y - sign * probeOffset * pitchSin,
          car.pos.z + forwardDir.z * probeOffset * sign
        );
        const beforeX = probePos.x;
        const beforeZ = probePos.z;
        if (resolveMapWallCollision(probePos, 1.02, car.vel, stepLim)) {
          car.pos.x += (probePos.x - beforeX);
          car.pos.z += (probePos.z - beforeZ);
          anyHit = true;
        }
      }
    }

    // Se mesmo após sub-stepping o carro entrou em célula sólida/mureta, reverte para posição segura anterior
    if (isSolidMapCell(car.pos.x, car.pos.z, car.pos.y, stepLim)) {
      car.pos.x = prevX;
      car.pos.z = prevZ;
      if (isSolidMapCell(car.pos.x, car.pos.z, car.pos.y, stepLim)) {
        car.pos.x = car.lastSafePos.x;
        car.pos.z = car.lastSafePos.z;
      }
      car.vel.multiplyScalar(-0.22);
      anyHit = true;
    } else if (!anyHit) {
      car.lastSafePos.x = car.pos.x;
      car.lastSafePos.z = car.pos.z;
    }
    return anyHit;
  }

  // Amostragem bilinear contínua do terreno/escadarias para eliminar flutuação em rampas e degraus
  function sampleCellWalkableH(ix, iy, curY, maxStep) {
    if (!colMeta) return null;
    const uf = getUnderFloorAt(ix, iy, curY, maxStep);
    const raw = getCellRaw(ix, iy);
    const topH = (raw !== -32768 && raw < 29500) ? raw * 0.01 : null;
    if (topH !== null && topH - curY <= maxStep) {
      if (uf !== null && Math.abs(uf - curY) < Math.abs(topH - curY) - 0.35) return uf;
      return topH;
    }
    if (uf !== null) return uf;
    return null;
  }

  function getWalkableGround(x, z, curY, maxStep = 1.25) {
    if (!colMeta || !colGrid) return null;
    const fx = (x - colMeta.minX) / colMeta.step - 0.5;
    const fy = (-z - colMeta.minY) / colMeta.step - 0.5;
    const ix0 = Math.floor(fx);
    const iy0 = Math.floor(fy);
    const tx = fx - ix0;
    const ty = fy - iy0;
    const h00 = sampleCellWalkableH(ix0, iy0, curY, maxStep);
    const h10 = sampleCellWalkableH(ix0 + 1, iy0, curY, maxStep);
    const h01 = sampleCellWalkableH(ix0, iy0 + 1, curY, maxStep);
    const h11 = sampleCellWalkableH(ix0 + 1, iy0 + 1, curY, maxStep);
    if (h00 !== null && h10 !== null && h01 !== null && h11 !== null) {
      const maxH = Math.max(h00, h10, h01, h11);
      const minH = Math.min(h00, h10, h01, h11);
      if (maxH - minH <= 1.45) {
        const hx0 = h00 + (h10 - h00) * tx;
        const hx1 = h01 + (h11 - h01) * tx;
        return hx0 + (hx1 - hx0) * ty;
      }
    }

    const ix = Math.floor((x - colMeta.minX) / colMeta.step);
    const iy = Math.floor((-z - colMeta.minY) / colMeta.step);
    const exactH = sampleCellWalkableH(ix, iy, curY, maxStep);
    if (exactH !== null) return exactH;

    const raw = getCellRaw(ix, iy);
    if (raw === -32768) {
      // Apenas costura micro-frestas de 1 célula se >= 2 vizinhos cardinais tiverem piso real próximo de curY;
      // no mar/canal ou fora da borda retorna null para a gravidade atuar (nunca cria piso invisível no ar!)
      const cDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let sum = 0;
      let cnt = 0;
      for (let i = 0; i < 4; i++) {
        const nh = sampleCellWalkableH(ix + cDirs[i][0], iy + cDirs[i][1], curY, maxStep);
        if (nh !== null && Math.abs(nh - curY) <= maxStep + 0.65) {
          sum += nh;
          cnt++;
        }
      }
      return cnt >= 2 ? (sum / cnt) : null;
    }

    // Encostou na borda de parede/pilar/pórtico: usa o piso transitável real mais próximo na vizinhança imediata
    const searchR = getRoadCellAt(x, z) >= 1 ? 2 : 1;
    let bestH = null;
    let bestDiff = maxStep + 0.85;
    for (let dy = -searchR; dy <= searchR; dy++) {
      for (let dx = -searchR; dx <= searchR; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nh = sampleCellWalkableH(ix + dx, iy + dy, curY, maxStep);
        if (nh !== null) {
          const d = Math.abs(nh - curY);
          if (d < bestDiff) {
            bestDiff = d;
            bestH = nh;
          }
        }
      }
    }
    return bestH;
  }

  // Escolhe o piso real ao spawnar carros/NPCs respeitando a elevação local da região (-28m a +75m)
  function getSafeGroundForSpawn(x, z, fallbackY = 0.05) {
    const refY = Number.isFinite(fallbackY) ? fallbackY : 0.05;
    const top = getGroundHeight(x, z);
    const uf = getUnderFloorWorld(x, z, refY, 65.0, 2.0);
    if (top !== null && uf !== null) {
      // Se o piso superior está perto da altura de referência e o inferior é um túnel profundo (> 6m abaixo), fica na rua da superfície
      if (Math.abs(top - refY) <= 4.5 && (top - uf) > 6.0) return top;
      // Se o topo é viaduto/marquise alta acima da referência, usa o piso inferior
      if (top - refY > 4.5) return uf;
      return Math.abs(uf - refY) < Math.abs(top - refY) ? uf : top;
    }
    if (top !== null && top < 80) return top;
    if (uf !== null) return uf;
    return refY;
  }

  // --- Patch Local de Triângulos 3D para Raycast Milimétrico de Degraus de Escadas e Meio-Fios ---
  // Extrai apenas os triângulos horizontais/inclinados da malha 3D real dentro de 14m×14m ao redor do carro (custo ~0.015ms/roda)
  const localMeshPatch = { cx: 1e9, cz: 1e9, chunkCount: -1, data: new Float32Array(0), count: 0 };
  function ensureLocalMeshPatch(wx, wz) {
    const dx = wx - localMeshPatch.cx;
    const dz = wz - localMeshPatch.cz;
    if (dx * dx + dz * dz < 14.0 && localMeshPatch.chunkCount === loadedChunks.size && localMeshPatch.count > 0) return;

    const halfBox = 8.5;
    const minX = wx - halfBox, maxX = wx + halfBox;
    const minZ = wz - halfBox, maxZ = wz + halfBox;
    const tmp = [];

    for (const entry of loadedChunks.values()) {
      if (!entry.group || !entry.group.visible) continue;
      if (Math.abs(entry.cx - wx) > 135 || Math.abs(entry.cz - wz) > 135) continue;
      entry.group.traverse((obj) => {
        if (!obj.isMesh || !obj.geometry || !obj.geometry.attributes || !obj.geometry.attributes.position) return;
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        const isCutout = mat && (mat.alphaTest > 0.05 || (mat.name && mat.name.includes('Cutout')));
        const posAttr = obj.geometry.attributes.position;
        const pArr = posAttr.array;
        const idxAttr = obj.geometry.index;
        const iArr = idxAttr ? idxAttr.array : null;
        const triCount = iArr ? (iArr.length / 3) : (posAttr.count / 3);
        for (let t = 0; t < triCount; t++) {
          const i0 = (iArr ? iArr[t * 3] : t * 3) * 3;
          const i1 = (iArr ? iArr[t * 3 + 1] : t * 3 + 1) * 3;
          const i2 = (iArr ? iArr[t * 3 + 2] : t * 3 + 2) * 3;
          const ax = pArr[i0], bx = pArr[i1], cx = pArr[i2];
          if ((ax < minX && bx < minX && cx < minX) || (ax > maxX && bx > maxX && cx > maxX)) continue;
          const az = pArr[i0 + 2], bz = pArr[i1 + 2], cz = pArr[i2 + 2];
          if ((az < minZ && bz < minZ && cz < minZ) || (az > maxZ && bz > maxZ && cz > maxZ)) continue;
          const ay = pArr[i0 + 1], by = pArr[i1 + 1], cy = pArr[i2 + 1];
          const ux = bx - ax, uy = by - ay, uz = bz - az;
          const vx = cx - ax, vy = cy - ay, vz = cz - az;
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          const nl = Math.hypot(nx, ny, nz);
          if (nl < 1e-6) continue;
          const absNy = Math.abs(ny / nl);
          // Cutout: só grelhas metálicas grandes horizontais de pontes; Opaco: pisos, degraus, meio-fios e rampas
          if (isCutout ? (absNy < 0.88 || nl * 0.5 < 1.2) : (absNy < 0.52)) continue;
          const tMinX = ax < bx ? (ax < cx ? ax : cx) : (bx < cx ? bx : cx);
          const tMaxX = ax > bx ? (ax > cx ? ax : cx) : (bx > cx ? bx : cx);
          const tMinZ = az < bz ? (az < cz ? az : cz) : (bz < cz ? bz : cz);
          const tMaxZ = az > bz ? (az > cz ? az : cz) : (bz > cz ? bz : cz);
          tmp.push(tMinX, tMaxX, tMinZ, tMaxZ, ax, ay, az, bx, by, bz, cx, cy, cz);
        }
      });
    }
    localMeshPatch.cx = wx;
    localMeshPatch.cz = wz;
    localMeshPatch.chunkCount = loadedChunks.size;
    localMeshPatch.data = Float32Array.from(tmp);
    localMeshPatch.count = tmp.length / 13;
  }

  function sampleExactMeshGround(wx, wz, refY, maxUp = 0.55, maxDown = 1.8) {
    const n = localMeshPatch.count;
    if (n === 0) return null;
    const d = localMeshPatch.data;
    let bestY = null;
    let bestDist = 1e9;
    const minY = refY - maxDown;
    const maxY = refY + maxUp;
    for (let i = 0; i < n; i++) {
      const o = i * 13;
      if (wx < d[o] || wx > d[o + 1] || wz < d[o + 2] || wz > d[o + 3]) continue;
      const ax = d[o + 4], ay = d[o + 5], az = d[o + 6];
      const bx = d[o + 7], by = d[o + 8], bz = d[o + 9];
      const cx = d[o + 10], cy = d[o + 11], cz = d[o + 12];
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (den > -1e-7 && den < 1e-7) continue;
      const invDen = 1.0 / den;
      const w0 = ((bz - cz) * (wx - cx) + (cx - bx) * (wz - cz)) * invDen;
      if (w0 < -0.002) continue;
      const w1 = ((cz - az) * (wx - cx) + (ax - cx) * (wz - cz)) * invDen;
      if (w1 < -0.002 || w0 + w1 > 1.002) continue;
      const w2 = 1.0 - w0 - w1;
      const hy = w0 * ay + w1 * by + w2 * cy;
      if (hy >= minY && hy <= maxY) {
        // Escolhe sempre a superfície mais próxima da altura atual do pneu (nunca salta para muretas/corrimãos acima!)
        const dist = Math.abs(hy - refY) + (hy > refY + 0.35 ? 0.45 : 0);
        if (dist < bestDist) {
          bestDist = dist;
          bestY = hy;
        }
      }
    }
    return bestY;
  }

  // Perfil circular do pneu (R≈0.34m): rola suavemente sobre quinas de degraus e meio-fios sem saltos quadrados!
  function sampleCircularWheelGround(wx, wz, fwdX, fwdZ, refY) {
    const h0 = sampleExactMeshGround(wx, wz, refY, 0.55, 1.8);
    const hF = sampleExactMeshGround(wx + fwdX * 0.24, wz + fwdZ * 0.24, refY, 0.55, 1.8);
    const hB = sampleExactMeshGround(wx - fwdX * 0.24, wz - fwdZ * 0.24, refY, 0.55, 1.8);
    let best = h0;
    if (hF !== null) {
      const liftedF = hF - 0.105; // curvatura circular do pneu a ±24cm do eixo (R - sqrt(R² - 0.24²) ≈ 0.105m)
      if (best === null || liftedF > best) best = liftedF;
    }
    if (hB !== null) {
      const liftedB = hB - 0.105;
      if (best === null || liftedB > best) best = liftedB;
    }
    return best;
  }

  // --- Partículas de Fumaça Drift & Motor Danificado ---
  const SMOKE_COUNT = 110;
  const smokePositions = new Float32Array(SMOKE_COUNT * 3);
  const smokeVel = [];
  const smokeLife = new Float32Array(SMOKE_COUNT);
  for (let i = 0; i < SMOKE_COUNT; i++) {
    smokePositions[i * 3 + 1] = -999;
    smokeVel.push(new THREE.Vector3());
    smokeLife[i] = 0;
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
  const smokeMat = new THREE.PointsMaterial({ color: 0xd8e4f0, size: 1.3, transparent: true, opacity: 0.42, depthWrite: false });
  const smokePoints = new THREE.Points(smokeGeo, smokeMat);
  scene.add(smokePoints);
  let smokeCursor = 0;

  const activeExplosions = [];
  let camShakeTimer = 0;
  let camShakePower = 0;

  function triggerCarExplosion(car) {
    if (!car || car.exploded) return;
    car.exploded = true;
    car.broken = true;
    car.burning = false;
    car.nitroActive = false;

    const exPos = car.pos.clone();
    exPos.y += 0.85;

    AudioFX.explosion();
    vibrate(200);
    camShakeTimer = 0.65;
    camShakePower = 0.65;

    // Salto físico do carro explodido + escurecer lataria
    car.velY = 5.4;
    car.vel.y = 0;
    car.roll = 0.16;
    if (car.mesh) {
      car.mesh.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          const ms = Array.isArray(obj.material) ? obj.material : [obj.material];
          ms.forEach((m) => {
            if (m && m.color) m.color.multiplyScalar(0.28);
          });
        }
      });
    }

    // Bola de fogo + núcleo + onda de choque estilo GTA
    const fireMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.92 })
    );
    fireMesh.position.copy(exPos);

    const coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffee55, transparent: true, opacity: 0.95 })
    );
    coreMesh.position.copy(exPos);

    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.3, 24),
      new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ringMesh.rotation.x = -Math.PI * 0.5;
    ringMesh.position.set(car.pos.x, car.pos.y + 0.12, car.pos.z);

    const flashLight = new THREE.PointLight(0xff7722, 6.0, 26);
    flashLight.position.copy(exPos);

    scene.add(fireMesh, coreMesh, ringMesh, flashLight);
    activeExplosions.push({ fireMesh, coreMesh, ringMesh, flashLight, age: 0, maxAge: 0.85 });

    // Rajada de fumaça escura ao redor
    for (let i = 0; i < 20; i++) {
      const sp = new THREE.Vector3(
        car.pos.x + (Math.random() - 0.5) * 2.2,
        car.pos.y + 0.5 + Math.random() * 1.4,
        car.pos.z + (Math.random() - 0.5) * 2.2
      );
      const sv = new THREE.Vector3((Math.random() - 0.5) * 8, 2.5 + Math.random() * 4, (Math.random() - 0.5) * 8);
      spawnSmoke(sp, sv);
    }

    if (player.inCar === car) {
      exitVehicle();
      player.hp = Math.max(15, player.hp - 35);
      ui.hpFill.style.width = player.hp + '%';
    }
    showToast('💥 BOOM! Veículo explodiu! Chame outro no celular!', 3600);
  }

  function updateExplosions(dt) {
    if (camShakeTimer > 0) camShakeTimer = Math.max(0, camShakeTimer - dt);
    for (let i = activeExplosions.length - 1; i >= 0; i--) {
      const ex = activeExplosions[i];
      ex.age += dt;
      const t = Math.min(1, ex.age / ex.maxAge);
      const fireScale = 0.8 + Math.sin(t * Math.PI * 0.75) * 6.2;
      ex.fireMesh.scale.setScalar(fireScale);
      ex.fireMesh.material.opacity = Math.max(0, (1 - t) * 0.9);
      ex.coreMesh.scale.setScalar(0.5 + t * 4.2);
      ex.coreMesh.material.opacity = Math.max(0, (1 - t * 1.35) * 0.95);
      ex.ringMesh.scale.setScalar(1 + t * 8.5);
      ex.ringMesh.material.opacity = Math.max(0, (1 - t) * 0.8);
      ex.flashLight.intensity = Math.max(0, (1 - t * 1.6) * 6.5);
      if (ex.age >= ex.maxAge) {
        scene.remove(ex.fireMesh, ex.coreMesh, ex.ringMesh, ex.flashLight);
        ex.fireMesh.geometry.dispose(); ex.fireMesh.material.dispose();
        ex.coreMesh.geometry.dispose(); ex.coreMesh.material.dispose();
        ex.ringMesh.geometry.dispose(); ex.ringMesh.material.dispose();
        activeExplosions.splice(i, 1);
      }
    }
  }

  function spawnSmoke(pos, carVel) {
    const i = smokeCursor;
    smokeCursor = (smokeCursor + 1) % SMOKE_COUNT;
    smokePositions[i * 3] = pos.x + (Math.random() - 0.5) * 0.25;
    smokePositions[i * 3 + 1] = pos.y + 0.18;
    smokePositions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.25;
    smokeVel[i].set(carVel.x * 0.15 + (Math.random() - 0.5) * 1.4, 0.8 + Math.random() * 0.9, carVel.z * 0.15 + (Math.random() - 0.5) * 1.4);
    smokeLife[i] = 0.65;
  }

  function updateSmoke(dt) {
    let dirty = false;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      if (smokeLife[i] > 0) {
        smokeLife[i] -= dt;
        smokePositions[i * 3] += smokeVel[i].x * dt;
        smokePositions[i * 3 + 1] += smokeVel[i].y * dt;
        smokePositions[i * 3 + 2] += smokeVel[i].z * dt;
        if (smokeLife[i] <= 0) smokePositions[i * 3 + 1] = -999;
        dirty = true;
      }
    }
    if (dirty) smokeGeo.attributes.position.needsUpdate = true;
  }

  // --- Entidades do Jogo ---
  const player = {
    mesh: null,
    parts: {},
    bones: {},
    boneInitQ: {},
    pos: new THREE.Vector3(-180, 1, -179),
    velY: 0,
    yaw: 0,
    grounded: false,
    hp: 100,
    stamina: 100,
    wanted: 0,
    wantedTimer: 0,
    walkPhase: 0,
    phase: 0,
    springPos: 0,
    springVel: 0,
    hairSway: 0,
    hairVel: 0,
    blinkTimer: 2.5,
    crouchTimer: 0,
    prevVelY: 0,
    isDoa: false,
    inCar: null,
    firstPersonCar: false,
    firstPersonFoot: false,
    spin360Mode: false
  };

  const vehicles = [];
  const trafficCars = [];
  const npcs = [];
  const rpProps = [];
  let jobNpcRef = null;
  let jobNpcSwapFn = null;
  let jobNpcShiftTimer = 0;
  let vehicleTemplates = {};
  let citizenTemplates = [];
  let trafficTemplates = [];
  let roadCells = [];
  let driveableGrid = null;
  let npcTemplate = null;
  let npcJobTemplate = null;
  let npcDoaTemplate = null;

  const delivery = { active: false, targetPos: new THREE.Vector3(), reward: 0, beacon: null };

  function createDeliveryBeacon() {
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 32, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00e676, transparent: true, opacity: 0.42, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    scene.add(m);
    return m;
  }

  // Extrai portas articuladas (DoorL / DoorR) automaticamente da carroceria de modelos sem portas separadas (Mustang, Gol, PM)
  function ensureArticulatedCarDoors(carRoot) {
    if (!carRoot || carRoot.userData._doorsExtracted) return;
    carRoot.userData._doorsExtracted = true;
    let hasDoorL = false, hasDoorR = false;
    carRoot.traverse((n) => {
      if (n.name === 'DoorL') hasDoorL = true;
      if (n.name === 'DoorR') hasDoorR = true;
    });
    if (hasDoorL && hasDoorR) return;

    carRoot.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(carRoot.matrixWorld).invert();
    const chassisNode = carRoot.getObjectByName('Chassis') || carRoot;
    chassisNode.updateMatrixWorld(true);

    const hingeZ = 0.68;
    const rearZ = -0.66;
    const minY = 0.26;
    const maxY = 1.24;
    const minOuterX = 0.58;

    const pivotL = new THREE.Group();
    pivotL.name = 'DoorL';
    pivotL.position.set(0.86, 0.65, hingeZ);
    const pivotR = new THREE.Group();
    pivotR.name = 'DoorR';
    pivotR.position.set(-0.86, 0.65, hingeZ);
    carRoot.add(pivotL, pivotR);
    carRoot.updateMatrixWorld(true);
    const invL = new THREE.Matrix4().copy(pivotL.matrixWorld).invert();
    const invR = new THREE.Matrix4().copy(pivotR.matrixWorld).invert();

    const candidateMeshes = [];
    carRoot.traverse((m) => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      const nm = (m.name || '').toLowerCase();
      if (nm.includes('wheel') || nm.includes('rim') || nm.includes('steer') || nm.includes('int_') ||
          nm.includes('head') || nm.includes('tail') || nm.includes('bumper') || nm.includes('plate') ||
          nm.includes('siren') || nm.includes('light') || nm.includes('windshield')) return;
      candidateMeshes.push(m);
    });

    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
    let countL = 0, countR = 0;

    candidateMeshes.forEach((mesh) => {
      const geo = mesh.geometry;
      const posAttr = geo.attributes.position;
      const normAttr = geo.attributes.normal;
      const uvAttr = geo.attributes.uv;
      const idxAttr = geo.index;
      const triCount = idxAttr ? (idxAttr.count / 3) : (posAttr.count / 3);
      if (triCount < 2) return;

      const toRoot = new THREE.Matrix4().multiplyMatrices(invRoot, mesh.matrixWorld);
      const keepTris = [];
      const leftTris = [];
      const rightTris = [];

      for (let t = 0; t < triCount; t++) {
        const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
        const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
        const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;
        vA.fromBufferAttribute(posAttr, i0).applyMatrix4(toRoot);
        vB.fromBufferAttribute(posAttr, i1).applyMatrix4(toRoot);
        vC.fromBufferAttribute(posAttr, i2).applyMatrix4(toRoot);
        const cx = (vA.x + vB.x + vC.x) / 3;
        const cy = (vA.y + vB.y + vC.y) / 3;
        const cz = (vA.z + vB.z + vC.z) / 3;
        const spanZ = Math.max(vA.z, vB.z, vC.z) - Math.min(vA.z, vB.z, vC.z);
        if (cz >= rearZ && cz <= hingeZ && cy >= minY && cy <= maxY && Math.abs(cx) >= minOuterX && spanZ < 1.65) {
          if (cx > 0) leftTris.push([i0, i1, i2]);
          else rightTris.push([i0, i1, i2]);
        } else {
          keepTris.push([i0, i1, i2]);
        }
      }

      if (leftTris.length === 0 && rightTris.length === 0) return;

      const buildSubGeo = (tris, xform) => {
        const n = tris.length * 3;
        const pArr = new Float32Array(n * 3);
        const nArr = normAttr ? new Float32Array(n * 3) : null;
        const uArr = uvAttr ? new Float32Array(n * 2) : null;
        const nMat = xform ? new THREE.Matrix3().getNormalMatrix(xform) : null;
        const tv = new THREE.Vector3();
        let o = 0;
        for (let i = 0; i < tris.length; i++) {
          for (let k = 0; k < 3; k++) {
            const vi = tris[i][k];
            tv.fromBufferAttribute(posAttr, vi);
            if (xform) tv.applyMatrix4(xform);
            pArr[o * 3] = tv.x; pArr[o * 3 + 1] = tv.y; pArr[o * 3 + 2] = tv.z;
            if (nArr) {
              tv.fromBufferAttribute(normAttr, vi);
              if (nMat) tv.applyMatrix3(nMat).normalize();
              nArr[o * 3] = tv.x; nArr[o * 3 + 1] = tv.y; nArr[o * 3 + 2] = tv.z;
            }
            if (uArr) {
              uArr[o * 2] = uvAttr.getX(vi);
              uArr[o * 2 + 1] = uvAttr.getY(vi);
            }
            o++;
          }
        }
        const ng = new THREE.BufferGeometry();
        ng.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
        if (nArr) ng.setAttribute('normal', new THREE.BufferAttribute(nArr, 3));
        else ng.computeVertexNormals();
        if (uArr) ng.setAttribute('uv', new THREE.BufferAttribute(uArr, 2));
        return ng;
      };

      if (leftTris.length > 0) {
        const mToL = new THREE.Matrix4().multiplyMatrices(invL, mesh.matrixWorld);
        pivotL.add(new THREE.Mesh(buildSubGeo(leftTris, mToL), mesh.material));
        countL += leftTris.length;
      }
      if (rightTris.length > 0) {
        const mToR = new THREE.Matrix4().multiplyMatrices(invR, mesh.matrixWorld);
        pivotR.add(new THREE.Mesh(buildSubGeo(rightTris, mToR), mesh.material));
        countR += rightTris.length;
      }
      if (keepTris.length > 0) {
        mesh.geometry = buildSubGeo(keepTris, null);
      } else {
        mesh.visible = false;
      }
    });

    // Painel escuro interno da soleira/porta para não ver vazio quando a porta abrir
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x14171f, side: THREE.DoubleSide });
    if (countL > 0) {
      const innerL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 1.24), trimMat);
      innerL.position.set(-0.04, -0.10, -0.64);
      pivotL.add(innerL);
    }
    if (countR > 0) {
      const innerR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 1.24), trimMat);
      innerR.position.set(0.04, -0.10, -0.64);
      pivotR.add(innerR);
    }
  }

  let _headBeamGeo = null;
  let _flareQuadGeo = null;
  function setupCarHierarchy(carObj, forwardPlusZ) {
    const parts = {
      chassis: null, doorL: null, doorR: null, steeringWheel: null,
      doorLSign: -1, doorRSign: 1,
      wheels: [], lightB: null, lightR: null,
      headMats: [], tailMats: [], intLightMats: [], paintMats: [],
      headLightGroup: new THREE.Group(),
      tailLightGroup: new THREE.Group(),
      tailMat: null,
      driverSeatOffset: new THREE.Vector3(0.36, 0.12, -0.05)
    };

    carObj.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(carObj.matrixWorld).invert();
    // Bounding box estritamente no ESPAÇO LOCAL do veículo (nunca em coordenadas de mundo!)
    const localBox = new THREE.Box3();
    const _meshBox = new THREE.Box3();
    const _toLocal = new THREE.Matrix4();
    carObj.traverse((m) => {
      if (m.isMesh && m.geometry) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        if (m.geometry.boundingBox) {
          _toLocal.multiplyMatrices(invRoot, m.matrixWorld);
          _meshBox.copy(m.geometry.boundingBox).applyMatrix4(_toLocal);
          localBox.union(_meshBox);
        }
      }
    });
    if (localBox.isEmpty()) {
      localBox.min.set(-0.98, 0, -2.25);
      localBox.max.set(0.98, 1.32, 2.25);
    }
    const headPositions = [];
    const tailPositions = [];
    const _wp = new THREE.Vector3();

    const wheelNodes = [];
    carObj.traverse((c) => {
      if (c.name === 'Chassis') parts.chassis = c;
      if (c.name === 'DoorL') parts.doorL = c;
      if (c.name === 'DoorR') parts.doorR = c;
      if (c.name === 'SteeringWheel' || /^STEER_HR/i.test(c.name)) {
        if (!parts.steeringWheel) {
          parts.steeringWheel = c;
          parts.steeringInitQ = c.quaternion.clone();
        }
      }
      if (c.name === 'LightBlue') parts.lightB = c;
      if (c.name === 'LightRed') parts.lightR = c;
      if (['WheelFL', 'WheelFR', 'WheelRL', 'WheelRR'].includes(c.name)) wheelNodes.push(c);

      if (c.name === 'HeadL' || c.name === 'HeadR') {
        c.getWorldPosition(_wp); _wp.applyMatrix4(invRoot);
        headPositions.push(_wp.clone());
      }
      if (c.name === 'TailL' || c.name === 'TailR') {
        c.getWorldPosition(_wp); _wp.applyMatrix4(invRoot);
        tailPositions.push(_wp.clone());
      }

      if (c.isMesh && c.material) {
        const isArr = Array.isArray(c.material);
        const mats = isArr ? c.material : [c.material];
        const newMats = mats.map((m) => {
          if (!m) return m;
          const mn = (m.name || '').toLowerCase();
          if (mn.includes('headlight') || mn.includes('vehiclelight')) {
            const hm = m.clone();
            if (hm.emissive) hm.emissive.setHex(0xfff4d2);
            parts.headMats.push(hm);
            return hm;
          }
          if (mn.includes('taillight') || mn.includes('red_glass') || mn.includes('light_glass_red')) {
            const tm = m.clone();
            if (tm.emissive) tm.emissive.setHex(0xff1a1a);
            parts.tailMats.push(tm);
            return tm;
          }
          if (mn.includes('interiorlight')) {
            const im = m.clone();
            if (im.emissive) im.emissive.setHex(0xffe4a8);
            parts.intLightMats.push(im);
            return im;
          }
          if (m.name.includes('SaveiroPaintMat') || m.name.includes('MustangPaintMat') || m.name.includes('CarBody')) {
            const cloned = m.clone();
            parts.paintMats.push(cloned);
            return cloned;
          }
          return m;
        });
        c.material = isArr ? newMats : newMats[0];
      }
    });

    // Calcula sinal automático de abertura para FORA de DoorL e DoorR (funciona em todos os 5 carros!)
    const computeOutwardSign = (doorObj) => {
      if (!doorObj) return 0;
      const db = new THREE.Box3().setFromObject(doorObj);
      const dc = new THREE.Vector3();
      db.getCenter(dc); dc.applyMatrix4(invRoot);
      const dp = new THREE.Vector3();
      doorObj.getWorldPosition(dp); dp.applyMatrix4(invRoot);
      const dz = dc.z - dp.z; // normalmente < 0 (dobradiça na frente, porta vai para trás)
      const sideX = dc.x >= 0 ? 1 : -1;
      // x' = x + z * sin(ry) => para |x'| crescer no sinal sideX, sin(ry) deve ter sinal = sideX * sign(dz)
      return (dz <= 0 ? -sideX : sideX);
    };
    if (parts.doorL) parts.doorLSign = computeOutwardSign(parts.doorL);
    if (parts.doorR) parts.doorRSign = computeOutwardSign(parts.doorR);

    // Determina posição exata do assento do motorista DENTRO da cabine (abaixo do teto!) e qual porta é a do motorista
    const roofY = Math.max(1.18, localBox.max.y);
    const seatCharHeight = 1.68 * 0.76; // 1.277m da base dos pés ao topo da cabeça com escala 0.76
    const maxSeatOriginY = (roofY - 0.18) - seatCharHeight;
    if (parts.steeringWheel) {
      parts.steeringWheel.getWorldPosition(_wp);
      _wp.applyMatrix4(invRoot);
      const idealY = Math.min(_wp.y - 1.06, maxSeatOriginY);
      parts.driverSeatOffset.set(_wp.x, idealY, _wp.z - 0.48);
    } else {
      parts.driverSeatOffset.set(0.35, Math.min(-0.30, maxSeatOriginY), -0.22);
    }
    parts.driverIsLeftNode = true;
    if (parts.doorL && parts.doorR) {
      const pL = new THREE.Vector3(), pR = new THREE.Vector3();
      parts.doorL.getWorldPosition(pL); pL.applyMatrix4(invRoot);
      parts.doorR.getWorldPosition(pR); pR.applyMatrix4(invRoot);
      parts.driverIsLeftNode = Math.abs(pL.x - parts.driverSeatOffset.x) <= Math.abs(pR.x - parts.driverSeatOffset.x);
    }

    // Posições locais exatas das 2 lentes dos faróis dianteiros (+Z) e 2 lanternas traseiras (-Z)
    const fSign = forwardPlusZ ? 1 : -1;
    const frontZ = (fSign > 0 ? localBox.max.z : localBox.min.z) - fSign * 0.14;
    const rearZ = (fSign > 0 ? localBox.min.z : localBox.max.z) + fSign * 0.05;
    const halfW = Math.max(0.54, (localBox.max.x - localBox.min.x) * 0.35);
    const headY = Math.max(0.48, Math.min(0.68, roofY * 0.45));
    const tailY = Math.max(0.56, Math.min(0.80, roofY * 0.56));
    const hL = headPositions.length >= 2 ? headPositions[0] : new THREE.Vector3(halfW, headY, frontZ);
    const hR = headPositions.length >= 2 ? headPositions[1] : new THREE.Vector3(-halfW, headY, frontZ);
    const tL = tailPositions.length >= 2 ? tailPositions[0] : new THREE.Vector3(halfW, tailY, rearZ);
    const tR = tailPositions.length >= 2 ? tailPositions[1] : new THREE.Vector3(-halfW, tailY, rearZ);
    parts.headMidLocal = new THREE.Vector3((hL.x + hR.x) * 0.5, (hL.y + hR.y) * 0.5, (hL.z + hR.z) * 0.5);

    if (!_headBeamGeo) {
      _headBeamGeo = new THREE.ConeGeometry(0.42, 4.8, 16, 1, true);
      // Ápice (r=0) na lente do farol (0,0,0), abrindo suavemente para FRENTE (+Z = +4.8m)
      _headBeamGeo.translate(0, -2.4, 0);
      _headBeamGeo.rotateX(-Math.PI / 2);
      _flareQuadGeo = new THREE.CircleGeometry(0.14, 12);
    }
    const headBeamMat = new THREE.MeshBasicMaterial({
      color: 0xfff6dc,
      transparent: true,
      opacity: 0.075,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    parts.headBeamMat = headBeamMat;
    const headFlareMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    parts.tailMat = new THREE.MeshBasicMaterial({
      color: 0xff1722,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });

    [hL, hR].forEach((hp) => {
      const beam = new THREE.Mesh(_headBeamGeo, headBeamMat);
      beam.position.copy(hp);
      beam.rotation.x = 0.09 * fSign;
      if (fSign < 0) beam.rotation.y = Math.PI;
      parts.headLightGroup.add(beam);
    });

    carObj.rotation.order = 'YXZ';
    carObj.updateMatrixWorld(true);

    // 1. Re-ancora as 4 rodas diretamente em carObj (com curso independente de suspensão vertical!)
    const wheelPivotsSet = new Set();
    let minWZ = 1e9, maxWZ = -1e9, minWX = 1e9, maxWX = -1e9;
    wheelNodes.forEach((wn) => {
      const parent = wn.parent;
      const steerPivot = new THREE.Group();
      steerPivot.name = wn.name + '_SuspPivot';
      steerPivot.rotation.order = 'YXZ';
      steerPivot.position.copy(wn.position);
      parent.add(steerPivot);
      parent.remove(wn);

      const spinGroup = new THREE.Group();
      spinGroup.position.set(0, 0, 0);
      steerPivot.add(spinGroup);

      wn.position.set(0, 0, 0);
      // Preserva a rotação/orientação original do GLB na roda (não zera wn.rotation!)
      spinGroup.add(wn);

      // Anexa steerPivot direto na raiz do veículo para que carroceria/portas balancem na suspensão sem descolar as rodas
      steerPivot.updateMatrixWorld(true);
      if (steerPivot.parent !== carObj) {
        carObj.attach(steerPivot);
      }
      wheelPivotsSet.add(steerPivot);

      const lx = steerPivot.position.x;
      const ly = steerPivot.position.y;
      const lz = steerPivot.position.z;
      if (lz < minWZ) minWZ = lz;
      if (lz > maxWZ) maxWZ = lz;
      if (lx < minWX) minWX = lx;
      if (lx > maxWX) maxWX = lx;

      parts.wheels.push({
        steerPivot,
        spinObj: spinGroup,
        name: wn.name,
        front: wn.name === 'WheelFL' || wn.name === 'WheelFR',
        localX: lx,
        localZ: lz,
        baseY: ly,
        suspY: 0,
        suspVel: 0
      });
    });

    parts.wheelBase = (maxWZ > minWZ && maxWZ - minWZ > 1.2) ? (maxWZ - minWZ) : 2.68;
    parts.trackWidth = (maxWX > minWX && maxWX - minWX > 0.8) ? (maxWX - minWX) : 1.56;

    // 2. Agrupa TODA a carroceria, cabine, portas, volante e para-choques em um único bodyGroup suspenso
    // Assim portas, faróis e cabine balançam juntos na suspensão e NUNCA descolam em escadas/rampas!
    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'CarBodySuspension';
    const nonWheelChildren = carObj.children.filter((ch) => !wheelPivotsSet.has(ch));
    carObj.add(bodyGroup);
    nonWheelChildren.forEach((ch) => bodyGroup.add(ch));
    bodyGroup.add(parts.headLightGroup);
    bodyGroup.add(parts.tailLightGroup);
    parts.chassis = bodyGroup;

    // Luzes compartilhadas globais (evita 10+ SpotLights/PointLights simultâneas na cena e recompilação de shaders)
    if (!window._sharedCarHeadSpot) {
      const hs = new THREE.SpotLight(0xfff4d8, 0.0, 62, Math.PI / 4.8, 0.45, 1.2);
      scene.add(hs);
      scene.add(hs.target);
      window._sharedCarHeadSpot = hs;
    }
    if (!window._sharedCarDomeLight) {
      const dl = new THREE.PointLight(0xffe6b0, 0.0, 4.5);
      scene.add(dl);
      window._sharedCarDomeLight = dl;
    }

    return parts;
  }

  function paintVehicle(car, hexColor) {
    if (!car || !car.parts.paintMats) return;
    car.parts.paintMats.forEach((m) => {
      if (m.color) { m.color.set(hexColor); m.needsUpdate = true; }
    });
  }

  // Mescla sub-meshes estáticos que compartilham o mesmo material para cortar draw calls de veículos (0% perda visual)
  function mergeStaticMeshesByMaterial(root, skipNames) {
    if (!root) return;
    root.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map();

    function collect(node) {
      if (node !== root && skipNames && skipNames.has(node.name)) return;
      if (node.isMesh && !node.isSkinnedMesh && node.geometry && node.material && !Array.isArray(node.material)) {
        const g = node.geometry;
        if (g.attributes && g.attributes.position && g.attributes.normal) {
          const hasUv = Boolean(g.attributes.uv);
          const hasUv2 = Boolean(g.attributes.uv2);
          const key = node.material.uuid + '|' + (hasUv ? 1 : 0) + '|' + (hasUv2 ? 1 : 0);
          if (!groups.has(key)) groups.set(key, { mat: node.material, hasUv, hasUv2, meshes: [] });
          groups.get(key).meshes.push(node);
        }
      }
      const children = node.children ? node.children.slice() : [];
      for (const ch of children) collect(ch);
    }
    collect(root);

    const relMat = new THREE.Matrix4();
    const normalMat = new THREE.Matrix3();
    const tmpV = new THREE.Vector3();
    const tmpN = new THREE.Vector3();

    groups.forEach(({ mat, hasUv, hasUv2, meshes }) => {
      if (meshes.length < 2) return;
      let totalVerts = 0;
      let totalIdx = 0;
      for (const m of meshes) {
        const g = m.geometry;
        totalVerts += g.attributes.position.count;
        totalIdx += g.index ? g.index.count : g.attributes.position.count;
      }
      const posArr = new Float32Array(totalVerts * 3);
      const nrmArr = new Float32Array(totalVerts * 3);
      const uvArr = hasUv ? new Float32Array(totalVerts * 2) : null;
      const uv2Arr = hasUv2 ? new Float32Array(totalVerts * 2) : null;
      const idxArr = totalVerts > 65535 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx);

      let vOff = 0;
      let iOff = 0;
      for (const m of meshes) {
        const g = m.geometry;
        const p = g.attributes.position;
        const n = g.attributes.normal;
        const uv = hasUv ? g.attributes.uv : null;
        const uv2 = hasUv2 ? g.attributes.uv2 : null;
        relMat.multiplyMatrices(invRoot, m.matrixWorld);
        normalMat.getNormalMatrix(relMat);
        for (let i = 0; i < p.count; i++) {
          tmpV.fromBufferAttribute(p, i).applyMatrix4(relMat);
          posArr[(vOff + i) * 3] = tmpV.x;
          posArr[(vOff + i) * 3 + 1] = tmpV.y;
          posArr[(vOff + i) * 3 + 2] = tmpV.z;
          tmpN.fromBufferAttribute(n, i).applyMatrix3(normalMat).normalize();
          nrmArr[(vOff + i) * 3] = tmpN.x;
          nrmArr[(vOff + i) * 3 + 1] = tmpN.y;
          nrmArr[(vOff + i) * 3 + 2] = tmpN.z;
          if (uvArr && uv) {
            uvArr[(vOff + i) * 2] = uv.getX(i);
            uvArr[(vOff + i) * 2 + 1] = uv.getY(i);
          }
          if (uv2Arr && uv2) {
            uv2Arr[(vOff + i) * 2] = uv2.getX(i);
            uv2Arr[(vOff + i) * 2 + 1] = uv2.getY(i);
          }
        }
        if (g.index) {
          const gi = g.index;
          for (let i = 0; i < gi.count; i++) idxArr[iOff + i] = vOff + gi.getX(i);
          iOff += gi.count;
        } else {
          for (let i = 0; i < p.count; i++) idxArr[iOff + i] = vOff + i;
          iOff += p.count;
        }
        vOff += p.count;
        if (m.parent) m.parent.remove(m);
      }

      const mergedGeo = new THREE.BufferGeometry();
      mergedGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      mergedGeo.setAttribute('normal', new THREE.BufferAttribute(nrmArr, 3));
      if (uvArr) mergedGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
      if (uv2Arr) mergedGeo.setAttribute('uv2', new THREE.BufferAttribute(uv2Arr, 2));
      mergedGeo.setIndex(new THREE.BufferAttribute(idxArr, 1));
      mergedGeo.computeBoundingSphere();

      const mergedMesh = new THREE.Mesh(mergedGeo, mat);
      mergedMesh.castShadow = true;
      mergedMesh.receiveShadow = true;
      root.add(mergedMesh);
    });
  }

  function normalizeApexVehicleScene(root, targetLen = 4.55) {
    const wrapper = new THREE.Group();
    const chassis = new THREE.Group();
    chassis.name = 'Chassis';
    const box = new THREE.Box3().setFromObject(root);
    const sz = new THREE.Vector3();
    box.getSize(sz);
    const maxHoriz = Math.max(sz.x, sz.z, 0.001);
    const s = targetLen / maxHoriz;
    root.scale.multiplyScalar(s);
    root.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;
    chassis.add(root);
    chassis.updateMatrixWorld(true);

    // Re-ancora rodas e portas de modelos Assetto Corsa / Sketchfab (ex: Lexus LC 500 Wald)
    const partRules = [
      { re: /^WHEEL_LF/i, target: 'WheelFL', mode: 'wheel' },
      { re: /^WHEEL_RF/i, target: 'WheelFR', mode: 'wheel' },
      { re: /^WHEEL_LR/i, target: 'WheelRL', mode: 'wheel' },
      { re: /^WHEEL_RR/i, target: 'WheelRR', mode: 'wheel' },
      { re: /^L_Door/i, target: 'DoorL', mode: 'door' },
      { re: /^R_door/i, target: 'DoorR', mode: 'door' }
    ];
    const matched = new Map();
    root.traverse((obj) => {
      if (!obj.name) return;
      for (const rule of partRules) {
        if (!matched.has(rule.target) && rule.re.test(obj.name)) {
          matched.set(rule.target, { obj, mode: rule.mode });
        }
      }
    });
    const pBox = new THREE.Box3();
    const pCenter = new THREE.Vector3();
    matched.forEach(({ obj, mode }, targetName) => {
      pBox.setFromObject(obj);
      if (pBox.isEmpty()) return;
      pBox.getCenter(pCenter);
      const pivotWorld = pCenter.clone();
      if (mode === 'door') {
        pivotWorld.x = pCenter.x >= 0 ? pBox.max.x : pBox.min.x;
        pivotWorld.z = pBox.max.z;
      }
      const pivot = new THREE.Group();
      pivot.name = targetName;
      chassis.worldToLocal(pivotWorld);
      pivot.position.copy(pivotWorld);
      chassis.add(pivot);
      pivot.updateMatrixWorld(true);
      pivot.attach(obj);
    });

    wrapper.add(chassis);
    const keepSeparate = new Set(['WheelFL', 'WheelFR', 'WheelRL', 'WheelRR', 'DoorL', 'DoorR', 'SteeringWheel', 'LightBlue', 'LightRed']);
    mergeStaticMeshesByMaterial(chassis, keepSeparate);
    matched.forEach((_, targetName) => {
      const partObj = chassis.getObjectByName(targetName);
      if (partObj) mergeStaticMeshesByMaterial(partObj, null);
    });
    return wrapper;
  }

  function spawnVehicle(typeKey, x, y, z, yaw = 0) {
    const tpl = vehicleTemplates[typeKey];
    if (!tpl) return null;
    const mesh = tpl.clone(true);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);

    const isSaveiro = typeKey === 'volkswagen_saveiro';
    const isSaveiroBrasil = typeKey === 'saveiro_brasil';
    const isMustang = typeKey === 'ford_mustang_gtd';
    const isLexus = typeKey === 'lexus_lc_500_wald';
    // Todos os 6 veículos têm a frente real em +Z!
    const forwardPlusZ = true;
    const parts = setupCarHierarchy(mesh, forwardPlusZ);

    const isLexusSpec = isLexus || isSaveiro || isSaveiroBrasil;
    const v = {
      type: typeKey,
      forwardSign: forwardPlusZ ? 1 : -1,
      name: isLexus ? 'Lexus LC 500 Wald' : isMustang ? 'Ford Mustang GTD' : isSaveiroBrasil ? 'Saveiro Cross Brasil' : isSaveiro ? 'VW Pickup Azul' : typeKey === 'car_pm' ? 'Viatura PM-BR' : 'Gol Quadrado',
      mesh,
      parts,
      pos: mesh.position,
      vel: new THREE.Vector3(),
      velY: 0,
      grounded: true,
      yaw,
      speed: 0,
      steerAngle: 0,
      roll: 0,
      pitch: 0,
      rollVel: 0,
      pitchVel: 0,
      angVel: 0,
      mass: isLexusSpec ? 1.40 : isMustang ? 1.35 : typeKey === 'car_pm' ? 1.45 : 1.08,
      hp: 100,
      broken: false,
      nitro: 100,
      nitroActive: false,
      doorsOpen: false,
      doorAngle: 0,
      doorAutoTimer: 0,
      lightsOn: true,
      sirenOn: false,
      reverseHoldTimer: 0,
      inReverseGear: false,
      // Mobilidade calibrada e realista nas ruas (controle progressivo sem disparar excessivamente)
      maxTopSpeedMs: isMustang ? (190 / 3.6) : isLexusSpec ? (175 / 3.6) : typeKey === 'car_pm' ? (168 / 3.6) : (145 / 3.6),
      accelPower: isMustang ? 19.0 : isLexusSpec ? 17.5 : typeKey === 'car_pm' ? 16.5 : 14.5,
      turnRate: isLexusSpec ? 1.92 : 1.98,
      soundProfile: isLexusSpec ? 'v8_muscle' : null
    };
    if (isMustang) paintVehicle(v, save.paint);
    vehicles.push(v);
    return v;
  }

  function cloneSkinnedObject(source) {
    const sourceLookup = new Map();
    const cloneLookup = new Map();
    const clone = source.clone();

    const parallelTraverse = (a, b) => {
      sourceLookup.set(a, b);
      cloneLookup.set(b, a);
      for (let i = 0; i < a.children.length; i++) {
        parallelTraverse(a.children[i], b.children[i]);
      }
    };
    parallelTraverse(source, clone);

    clone.traverse((node) => {
      if (!node.isSkinnedMesh) return;
      const srcMesh = cloneLookup.get(node);
      const srcSkel = srcMesh.skeleton;
      const newBones = srcSkel.bones.map((bone) => sourceLookup.get(bone));
      node.skeleton = new THREE.Skeleton(newBones, srcSkel.boneInverses.map((m) => m.clone()));
      node.bindMatrix.copy(srcMesh.bindMatrix);
      node.bindMatrixInverse.copy(srcMesh.bindMatrixInverse);
      node.frustumCulled = false;
    });
    return clone;
  }

  function optimizeStaticMaterial(mat) {
    if (!mat) return mat;
    if (mat.map) {
      mat.map.encoding = THREE.sRGBEncoding;
      mat.map.anisotropy = 2;
    }
    const hasAlpha = (mat.alphaTest > 0 || mat.transparent);
    const lm = new THREE.MeshLambertMaterial({
      map: mat.map || null,
      color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
      alphaTest: hasAlpha ? 0.45 : 0,
      transparent: false,
      side: (hasAlpha || mat.side === THREE.DoubleSide) ? THREE.DoubleSide : THREE.FrontSide
    });
    return lm;
  }

  function buildCitizenTemplates(packScene) {
    const templates = [];
    if (!packScene) return templates;
    packScene.updateMatrixWorld(true);
    const citizenNodes = [];
    packScene.traverse((obj) => {
      if (obj.name && /^Citizen_\d+$/i.test(obj.name) && obj.children && obj.children.length > 0 && !obj.isMesh) {
        citizenNodes.push(obj);
      }
    });
    const _wScale = new THREE.Vector3();
    const _wQuat = new THREE.Quaternion();
    const _box = new THREE.Box3();
    const _center = new THREE.Vector3();
    const _size = new THREE.Vector3();
    const _mat4 = new THREE.Matrix4();

    citizenNodes.forEach((cn) => {
      // Verifica se o cidadão já vem rigado no GLB com SkinnedMesh (21 ossos igual à NPC 1)
      let hasSkinned = false;
      cn.traverse((m) => { if (m.isSkinnedMesh) hasSkinned = true; });

      const fixMat = (mt) => {
        if (!mt) return mt;
        const c = mt.clone();
        if (c.map) { c.map.encoding = THREE.sRGBEncoding; c.map.anisotropy = 2; c.map.needsUpdate = true; }
        if (c.roughness !== undefined) c.roughness = 0.85;
        if (c.metalness !== undefined) c.metalness = 0.0;
        if (c.envMapIntensity !== undefined) c.envMapIntensity = 0.35;
        c.side = THREE.DoubleSide;
        c.transparent = false;
        c.alphaTest = 0;
        c.needsUpdate = true;
        return c;
      };

      if (hasSkinned) {
        const wrapper = new THREE.Group();
        const animRoot = new THREE.Group();
        animRoot.name = 'CitizenAnimRoot';
        animRoot.rotation.y = Math.PI; // Citizen olha para +Z -> gira PI para andar de frente em -Z
        const cloned = cloneSkinnedObject(cn);
        cloned.position.set(0, 0, 0);
        cloned.rotation.set(0, 0, 0);
        cloned.scale.set(1, 1, 1);
        cloned.traverse((m) => {
          if (m.isMesh) {
            m.frustumCulled = false;
            m.visible = true;
            if (m.material) {
              m.material = Array.isArray(m.material) ? m.material.map(fixMat) : fixMat(m.material);
            }
          }
        });
        animRoot.add(cloned);
        wrapper.add(animRoot);
        wrapper.userData.isCitizen = true;
        wrapper.userData.isSkinnedCitizen = true;
        templates.push(wrapper);
        return;
      }

      cn.getWorldScale(_wScale);
      cn.getWorldQuaternion(_wQuat);

      // Mede primeiro no espaço com escala/rotação mundial (sem offset da grade do pack)
      const measureGrp = new THREE.Group();
      measureGrp.scale.copy(_wScale);
      measureGrp.quaternion.copy(_wQuat);
      const rawMeshes = [];
      cn.children.forEach((child) => {
        child.traverse((m) => {
          if (m.isMesh && m.geometry) rawMeshes.push({ mesh: m, isBody: /body/i.test(child.name || m.name) });
        });
      });
      if (rawMeshes.length === 0) return;

      rawMeshes.forEach(({ mesh }) => {
        const tmp = new THREE.Mesh(mesh.geometry);
        measureGrp.add(tmp);
      });
      measureGrp.updateMatrixWorld(true);
      _box.setFromObject(measureGrp);
      _box.getSize(_size);
      const normScale = _size.y > 0.1 ? (1.76 / _size.y) : 1.0;
      const finalScale = _wScale.clone().multiplyScalar(normScale);
      measureGrp.scale.copy(finalScale);
      measureGrp.updateMatrixWorld(true);
      _box.setFromObject(measureGrp);
      _box.getCenter(_center);

      // Faz BAKE da escala e centralização direto na geometria (scale = 1,1,1 em metros reais!)
      _mat4.compose(
        new THREE.Vector3(-_center.x, -_box.min.y, -_center.z),
        _wQuat,
        finalScale
      );

      const wrapper = new THREE.Group();
      const animRoot = new THREE.Group();
      animRoot.name = 'CitizenAnimRoot';
      animRoot.rotation.y = Math.PI; // Citizen olha para +Z -> gira PI para andar de frente em -Z

      rawMeshes.forEach(({ mesh, isBody }) => {
        const geo = mesh.geometry.clone();
        geo.applyMatrix4(_mat4);
        geo.computeBoundingBox();
        geo.computeBoundingSphere();

        // Preserva o material original do GLB (textura 100% garantida no WebGL Android!)
        const origMat = mesh.material;
        const mat = Array.isArray(origMat) ? origMat.map(fixMat) : fixMat(origMat);
        const bakedMesh = new THREE.Mesh(geo, mat);
        bakedMesh.frustumCulled = false;
        bakedMesh.name = isBody ? 'CitizenBody' : 'CitizenHead';
        animRoot.add(bakedMesh);
      });

      wrapper.add(animRoot);
      wrapper.userData.isCitizen = true;
      templates.push(wrapper);
    });
    return templates;
  }

  function wrapDoaNpcScene(doaScene) {
    if (!doaScene) return null;
    const wrapper = new THREE.Group();
    const root = new THREE.Group();
    // doa_npc_fighter.glb já nasce em pé (+Y cima, +Z frente); NÃO aplicar rotação X!
    root.add(doaScene);
    wrapper.add(root);

    doaScene.traverse((c) => {
      if (c.isMesh) {
        c.frustumCulled = false;
        c.visible = true;
        if (c.name.includes('Icosphere')) c.visible = false;
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          if (!m) return;
          if (m.map) { m.map.encoding = THREE.sRGBEncoding; m.map.anisotropy = 2; }
          if (m.roughness !== undefined) m.roughness = Math.max(0.55, m.roughness);
          if (m.envMapIntensity !== undefined) m.envMapIntensity = 0.65;
          m.needsUpdate = true;
        });
      }
    });

    wrapper.updateMatrixWorld(true);
    const _v = new THREE.Vector3();
    let minFootY = 999;
    doaScene.traverse((c) => {
      if (c.isBone && (c.name.includes('toes') || c.name.includes('ankle'))) {
        c.getWorldPosition(_v);
        if (_v.y < minFootY) minFootY = _v.y;
      }
    });
    if (minFootY < 900) {
      // Ajusta altura para a sola das botas tocar exatamente Y = 0
      root.position.y -= (minFootY - 0.04);
      wrapper.updateMatrixWorld(true);
    }
    wrapper.userData.doaRoot = root;
    wrapper.userData.doaBaseY = root.position.y;
    return wrapper;
  }

  function buildTrafficTemplates(packScene) {
    const list = [];
    if (!packScene) return list;
    packScene.updateMatrixWorld(true);
    const vehNodes = [];
    packScene.traverse((obj) => {
      if (obj.name && /^AI_.*_High$/i.test(obj.name)) vehNodes.push(obj);
    });
    const _box = new THREE.Box3();
    const _center = new THREE.Vector3();
    const _size = new THREE.Vector3();
    const _wScale = new THREE.Vector3();
    const _wQuat = new THREE.Quaternion();

    vehNodes.forEach((vn) => {
      vn.getWorldScale(_wScale);
      vn.getWorldQuaternion(_wQuat);
      const bodyHolder = new THREE.Group();
      bodyHolder.scale.copy(_wScale);
      bodyHolder.quaternion.copy(_wQuat);

      const wheelGroups = [];
      vn.children.forEach((ch) => {
        const cloned = ch.clone(true);
        cloned.traverse((m) => {
          if (m.isMesh && m.material) {
            const isArr = Array.isArray(m.material);
            const mats = isArr ? m.material : [m.material];
            const fast = mats.map(optimizeStaticMaterial);
            m.material = isArr ? fast : fast[0];
          }
        });
        bodyHolder.add(cloned);
      });

      bodyHolder.updateMatrixWorld(true);
      _box.setFromObject(bodyHolder);
      _box.getSize(_size);
      // Padroniza escala para o tamanho real do mapa (Saveiro ~4.4m, carros ~4.1-5.2m, caminhões ~8-9.5m)
      const isHeavyTruck = _size.z > 12.0;
      const scaleFactor = isHeavyTruck ? 0.56 : 0.68;

      const wrapper = new THREE.Group();
      bodyHolder.scale.multiplyScalar(scaleFactor);
      bodyHolder.updateMatrixWorld(true);
      _box.setFromObject(bodyHolder);
      _box.getCenter(_center);
      _box.getSize(_size);
      bodyHolder.position.set(-_center.x, -_box.min.y, -_center.z);
      wrapper.add(bodyHolder);
      wrapper.updateMatrixWorld(true);

      // Re-ancora rodas no próprio centro para girarem no eixo X durante o tráfego
      const wheelTargets = [];
      bodyHolder.traverse((obj) => {
        if (obj.isMesh && /teker|wheel/i.test(obj.name)) wheelTargets.push(obj);
      });
      wheelTargets.forEach((wm) => {
        const parent = wm.parent;
        if (!parent) return;
        const wBox = new THREE.Box3().setFromObject(wm);
        const wCenterWorld = new THREE.Vector3();
        wBox.getCenter(wCenterWorld);
        const pivot = new THREE.Group();
        parent.worldToLocal(wCenterWorld);
        pivot.position.copy(wCenterWorld);
        parent.add(pivot);
        const meshWorldPos = new THREE.Vector3();
        wm.getWorldPosition(meshWorldPos);
        pivot.add(wm);
        pivot.updateMatrixWorld(true);
        pivot.worldToLocal(meshWorldPos);
        wm.position.copy(meshWorldPos);
        pivot.name = 'TrafficWheel';
        wheelGroups.push(pivot);
      });

      list.push({
        name: vn.name,
        mesh: wrapper,
        length: _size.z,
        width: _size.x,
        radius: Math.max(1.4, _size.z * 0.42),
        isHeavy: isHeavyTruck
      });
    });
    return list;
  }

  function spawnNPC(x, y, z, isJobNpc = false, familyConfig = null) {
    const useDoa = isJobNpc && familyConfig && familyConfig.doa && npcDoaTemplate;
    let tpl = null;
    if (useDoa) {
      tpl = npcDoaTemplate;
    } else if (isJobNpc) {
      tpl = npcJobTemplate || npcTemplate;
    } else if (citizenTemplates.length > 0) {
      tpl = citizenTemplates[Math.floor(Math.random() * citizenTemplates.length)];
    } else {
      tpl = npcTemplate;
    }
    if (!tpl) return null;
    // Usa o template direto quando for única instância de Job/DOA; cidadãos rigados usam cloneSkinnedObject para clonar o esqueleto!
    const mesh = isJobNpc
      ? tpl
      : (tpl.userData && tpl.userData.isSkinnedCitizen ? cloneSkinnedObject(tpl) : tpl.clone(true));
    mesh.position.set(x, y, z);
    if (familyConfig && familyConfig.scale) {
      mesh.scale.setScalar(familyConfig.scale);
    }
    scene.add(mesh);
    mesh.updateMatrixWorld(true);
    const parts = {};
    const bones = {};
    const boneInitQ = {};
    const boneWorldInitQ = {};
    const skirtInfo = {};
    const skirtBones = [];
    let animRoot = null;
    let citizenHead = null;
    const invMeshQ = mesh.quaternion.clone().invert();
    const _wq = new THREE.Quaternion();
    const _wp = new THREE.Vector3();
    const _hipCenter = new THREE.Vector3();
    let hasHipCenter = false;

    let hasVisibleMesh = false;
    mesh.traverse((c) => {
      if (['LegL', 'LegR', 'ArmL', 'ArmR'].includes(c.name)) parts[c.name] = c;
      if (c.name === 'CitizenAnimRoot') animRoot = c;
      if (c.name === 'CitizenHead') citizenHead = c;
      if (c.isMesh && c.name.includes('Icosphere')) c.visible = false;
      if (c.isMesh) {
        c.frustumCulled = false;
        if (c.visible && c.geometry && c.geometry.attributes && c.geometry.attributes.position && c.geometry.attributes.position.count > 0) {
          hasVisibleMesh = true;
        }
      }
      if (c.isBone) {
        bones[c.name] = c;
        boneInitQ[c.name] = c.quaternion.clone();
        c.getWorldQuaternion(_wq);
        boneWorldInitQ[c.name] = invMeshQ.clone().multiply(_wq);
        if (c.name === 'pelvis_07' || c.name === 'Hips') {
          c.getWorldPosition(_hipCenter);
          _hipCenter.sub(mesh.position);
          hasHipCenter = true;
        }
        if (c.name.startsWith('skirt_') && (c.name.includes('a_') || c.name.includes('b_') || c.name.includes('c_') || c.name.includes('d_') || c.name.includes('1s_'))) {
          skirtBones.push(c.name);
        }
      }
    });
    if (!hasVisibleMesh) {
      scene.remove(mesh);
      return null;
    }
    // Remove automaticamente qualquer NPC que esteja de cabeça para baixo (cabeça abaixo ou no nível dos pés)
    let headWorldY = -Infinity;
    let footWorldY = Infinity;
    const _chkPos = new THREE.Vector3();
    Object.keys(bones).forEach((bn) => {
      const ln = bn.toLowerCase();
      bones[bn].getWorldPosition(_chkPos);
      if (ln.includes('head') && !ln.includes('end') && _chkPos.y > headWorldY) headWorldY = _chkPos.y;
      if ((ln.includes('foot') || ln.includes('toe') || ln.includes('shin') || ln.includes('calf') || ln.includes('ankle')) && _chkPos.y < footWorldY) footWorldY = _chkPos.y;
    });
    if (headWorldY > -1e6 && footWorldY < 1e6 && headWorldY <= footWorldY + 0.25) {
      scene.remove(mesh);
      return null;
    }
    if (skirtBones.length > 0) {
      skirtBones.forEach((sb) => {
        bones[sb].getWorldPosition(_wp);
        _wp.sub(mesh.position);
        const dx = hasHipCenter ? (_wp.x - _hipCenter.x) : _wp.x;
        const dz = hasHipCenter ? (_wp.z - _hipCenter.z) : _wp.z;
        skirtInfo[sb] = { dx, dz };
      });
    }
    const roles = ['worker', 'tourist', 'jogger', 'shopper'];
    const role = (familyConfig && familyConfig.role) ? familyConfig.role : roles[Math.floor(Math.random() * roles.length)];
    const baseSpeed = role === 'jogger' ? (2.8 + Math.random() * 0.8) : role === 'shopper' ? (1.15 + Math.random() * 0.35) : (1.55 + Math.random() * 0.55);
    const npc = {
      mesh, parts, bones, boneInitQ, boneWorldInitQ, skirtBones, skirtInfo,
      animRoot, citizenHead, isCitizen: Boolean(mesh.userData && mesh.userData.isCitizen || animRoot),
      doaRoot: mesh.userData ? mesh.userData.doaRoot : null,
      doaBaseY: mesh.userData ? (mesh.userData.doaBaseY || 0) : 0,
      isDoa: Boolean(useDoa), pos: mesh.position, homePos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(), velY: 0,
      yaw: Math.random() * Math.PI * 2, phase: Math.random() * 6.28,
      turnTimer: 1.5 + Math.random() * 4.5, isJobNpc, knockTimer: 0, hp: 100, dead: false,
      summoned: false, walkTarget: new THREE.Vector3(),
      springPos: 0, springVel: 0, hairSway: 0, hairVel: 0, blinkTimer: 1.2 + Math.random() * 3.0,
      armRestZ: isJobNpc ? 0.38 : 0.48,
      role, baseSpeed,
      aiState: Math.random() < 0.25 ? 'idle_look' : 'walk',
      aiTimer: 1.0 + Math.random() * 5.0,
      familyLeader: familyConfig ? familyConfig.leader : null,
      familyOffset: familyConfig ? familyConfig.offset : 0.75
    };
    npcs.push(npc);
    if (isJobNpc) jobNpcRef = npc;
    return npc;
  }

  // --- Controles & Inputs ---
  const input = {
    joyX: 0, joyY: 0, sprint: false, jumpPressed: false,
    left: false, right: false, gas: false, brake: false, drift: false, nitro: false,
    gyroSteer: 0, gyroTarget: 0, lastOrientTs: 0,
    camYaw: 0, camPitch: 0.24, camZoomOffset: 0, interiorYaw: 0, interiorPitch: -0.10
  };

  const joyZone = el('joystickZone');
  const joyKnob = el('joystickKnob');
  let joyTouchId = null;
  let joyOrigin = { x: 0, y: 0 };

  joyZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    AudioFX.resume();
    if (joyTouchId === null && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      joyTouchId = t.identifier;
      const rect = joyZone.getBoundingClientRect();
      joyOrigin.x = rect.left + rect.width / 2;
      joyOrigin.y = rect.top + rect.height / 2;
      updateJoystick(t.clientX, t.clientY);
    }
  }, { passive: false });

  joyZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === joyTouchId) updateJoystick(t.clientX, t.clientY);
  }, { passive: false });

  function resetJoystick(e) {
    if (e && e.changedTouches) {
      let found = false;
      for (const t of e.changedTouches) if (t.identifier === joyTouchId) { found = true; break; }
      if (!found) return;
    }
    joyTouchId = null; input.joyX = 0; input.joyY = 0;
    joyKnob.style.transform = 'translate(-50%, -50%)';
  }
  joyZone.addEventListener('touchend', resetJoystick);
  joyZone.addEventListener('touchcancel', resetJoystick);

  function updateJoystick(cx, cy) {
    const maxR = 44;
    let dx = cx - joyOrigin.x;
    let dy = cy - joyOrigin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
    input.joyX = dx / maxR;
    input.joyY = dy / maxR;
    joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  let camTouchId = null;
  let camManualTimer = 0;
  let lastCamPos = { x: 0, y: 0 };
  let pinchStartDist = 0;
  let pinchStartZoom = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (gameMode !== 'loading') e.preventDefault();
    AudioFX.resume();
    if (e.targetTouches.length === 2) {
      pinchStartDist = Math.hypot(
        e.targetTouches[0].clientX - e.targetTouches[1].clientX,
        e.targetTouches[0].clientY - e.targetTouches[1].clientY
      );
      pinchStartZoom = input.camZoomOffset;
      camTouchId = null;
      return;
    }
    if (camTouchId === null) {
      for (const t of e.changedTouches) {
        if (t.clientX >= window.innerWidth * 0.28 || e.targetTouches.length === 1) {
          camTouchId = t.identifier;
          lastCamPos.x = t.clientX;
          lastCamPos.y = t.clientY;
          break;
        }
      }
    }
  }, { passive: false });

  function setSpin360Mode(enabled) {
    player.spin360Mode = Boolean(enabled);
    if (ui.btnSpinPlayer) {
      ui.btnSpinPlayer.classList.toggle('active', player.spin360Mode);
      ui.btnSpinPlayer.textContent = player.spin360Mode ? '🔒 CENÁRIO' : '🔄 360°';
    }
  }

  function applyLookDelta(dxNorm, dyNorm, setManualTimer) {
    if (gameMode === 'playing' && !player.inCar && !player.firstPersonFoot && player.spin360Mode) {
      player.yaw += dxNorm * 1.9;
      return;
    }
    if (setManualTimer) camManualTimer = 4.5;
    input.camYaw -= dxNorm;
    // Permite olhar de perto na altura da roda/placa (-0.22) até visão superior (1.15) sem bloqueio
    input.camPitch = Math.max(-0.22, Math.min(1.15, input.camPitch + dyNorm));
    if (player.inCar && player.firstPersonCar) {
      input.interiorYaw -= dxNorm * 1.05;
      input.interiorPitch = Math.max(-0.85, Math.min(0.85, input.interiorPitch - dyNorm * 1.07));
    }
  }

  canvas.addEventListener('touchmove', (e) => {
    if (gameMode !== 'loading') e.preventDefault();
    if (e.targetTouches.length === 2 && pinchStartDist > 10) {
      const curDist = Math.hypot(
        e.targetTouches[0].clientX - e.targetTouches[1].clientX,
        e.targetTouches[0].clientY - e.targetTouches[1].clientY
      );
      const delta = (pinchStartDist - curDist) * 0.025;
      input.camZoomOffset = Math.max(-4.15, Math.min(8.5, pinchStartZoom + delta));
      return;
    }
    if (camTouchId === null && e.targetTouches.length === 1) {
      const t0 = e.targetTouches[0];
      camTouchId = t0.identifier;
      lastCamPos.x = t0.clientX;
      lastCamPos.y = t0.clientY;
      return;
    }
    for (const t of e.changedTouches) {
      if (t.identifier === camTouchId) {
        const dx = t.clientX - lastCamPos.x;
        const dy = t.clientY - lastCamPos.y;
        lastCamPos.x = t.clientX;
        lastCamPos.y = t.clientY;
        const sens = save.camSens || 1.0;
        const yawScale = (!player.inCar && !player.firstPersonFoot) ? 0.0095 : 0.0065;
        applyLookDelta(dx * yawScale * sens, dy * 0.0048 * sens, true);
      }
    }
  }, { passive: false });

  function releaseCamTouch(e) {
    if (e.targetTouches && e.targetTouches.length < 2) pinchStartDist = 0;
    if (e.changedTouches) {
      for (const t of e.changedTouches) {
        if (t.identifier === camTouchId) camTouchId = null;
      }
    } else {
      camTouchId = null;
    }
  }
  canvas.addEventListener('touchend', releaseCamTouch, { passive: false });
  canvas.addEventListener('touchcancel', releaseCamTouch, { passive: false });
  window.addEventListener('touchcancel', () => { camTouchId = null; pinchStartDist = 0; });

  // Suporte a arraste com mouse (PC / Emulador / DeX)
  let mouseDragging = false;
  let lastMousePos = { x: 0, y: 0 };
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    mouseDragging = true;
    lastMousePos.x = e.clientX;
    lastMousePos.y = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDragging) return;
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    lastMousePos.x = e.clientX;
    lastMousePos.y = e.clientY;
    const sens = save.camSens || 1.0;
    const yawScale = (!player.inCar && !player.firstPersonFoot) ? 0.0095 : 0.0065;
    applyLookDelta(dx * yawScale * sens, dy * 0.0048 * sens, true);
  });
  window.addEventListener('mouseup', () => { mouseDragging = false; });
  canvas.addEventListener('wheel', (e) => {
    input.camZoomOffset = Math.max(-2.55, Math.min(7.5, input.camZoomOffset + e.deltaY * 0.004));
  }, { passive: true });

  el('btnSprint').addEventListener('touchstart', (e) => {
    e.preventDefault(); input.sprint = !input.sprint;
    ui.btnSprint.classList.toggle('active', input.sprint);
  });
  el('btnJump').addEventListener('touchstart', (e) => { e.preventDefault(); input.jumpPressed = true; });

  function bindHold(btnId, key) {
    const b = el(btnId);
    const activeTouches = new Set();
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      AudioFX.resume();
      for (const t of e.changedTouches) activeTouches.add(t.identifier);
      input[key] = true;
    }, { passive: false });
    const release = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) activeTouches.delete(t.identifier);
      if (activeTouches.size === 0) input[key] = false;
    };
    b.addEventListener('touchend', release, { passive: false });
    b.addEventListener('touchcancel', release, { passive: false });
  }
  bindHold('btnLeft', 'left');
  bindHold('btnRight', 'right');
  bindHold('btnGas', 'gas');
  bindHold('btnBrake', 'brake');
  bindHold('btnDrift', 'drift');
  bindHold('btnNitro', 'nitro');

  ui.btnCarDoors.onclick = () => {
    const c = player.inCar;
    if (!c) return;
    c.doorsOpen = !c.doorsOpen;
    c.doorAutoTimer = 0;
    ui.btnCarDoors.classList.toggle('on', c.doorsOpen);
    showToast(c.doorsOpen ? '🚪 Portas abertas (Luz interna ON)' : '🚪 Portas fechadas');
  };

  ui.btnCarLights.onclick = () => {
    const c = player.inCar;
    if (!c) return;
    c.lightsOn = !c.lightsOn;
    ui.btnCarLights.classList.toggle('on', c.lightsOn);
    showToast(c.lightsOn ? '💡 Faróis acesos' : '💡 Luzes apagadas');
  };

  ui.btnCarCam.onclick = () => {
    player.firstPersonCar = !player.firstPersonCar;
    if (player.firstPersonCar) {
      input.interiorYaw = 0;
      input.interiorPitch = -0.10;
    }
    if (player.inCar && player.mesh) player.mesh.visible = !player.firstPersonCar;
    ui.btnCarCam.classList.toggle('on', player.firstPersonCar);
    showToast(player.firstPersonCar ? '📷 Câmera: Interior 360° (arraste para olhar)' : '📷 Câmera: Externa');
  };

  let nearestCar = null;
  let nearestProp = null;

  const carAccessAnim = {
    active: false,
    mode: 'enter', // 'enter' | 'exit'
    car: null,
    t: 0,
    dur: 1.28,
    startX: 0,
    startY: 0,
    startZ: 0,
    startYaw: 0,
    latchPlayed: false,
    slamPlayed: false
  };

  function enterVehicle(car) {
    if (carAccessAnim.active) return;
    player.inCar = car;
    setSpin360Mode(false);
    if (ui.btnSpinPlayer) ui.btnSpinPlayer.classList.add('hidden');
    if (ui.btnFrontCam) ui.btnFrontCam.classList.add('hidden');
    if (player.mesh) player.mesh.visible = true;

    car.doorsOpen = false;
    car.doorAutoTimer = 0;
    car.driverDoorAnimAngle = 0;

    carAccessAnim.active = true;
    carAccessAnim.mode = 'enter';
    carAccessAnim.car = car;
    carAccessAnim.t = 0;
    carAccessAnim.dur = 1.28;
    carAccessAnim.startX = player.pos.x;
    carAccessAnim.startY = player.pos.y;
    carAccessAnim.startZ = player.pos.z;
    carAccessAnim.startYaw = player.mesh ? player.mesh.rotation.y : (player.yaw + Math.PI);
    carAccessAnim.latchPlayed = false;
    carAccessAnim.slamPlayed = false;

    ui.footControls.classList.add('hidden');
    ui.carControls.classList.remove('hidden');
    ui.speedBox.classList.remove('hidden');
    ui.btnCarLights.classList.toggle('on', car.lightsOn);
    ui.btnCarDoors.classList.remove('on');
    ui.btnCarCam.classList.toggle('on', player.firstPersonCar);
    input.camYaw = car.forwardSign > 0 ? (car.yaw + Math.PI) : car.yaw;
    vibrate(30);
    showToast(`Entrando em: ${car.name}`);
  }

  function exitVehicle() {
    const car = player.inCar;
    if (!car || carAccessAnim.active) return;
    GtaRadio.stop(true);
    player.firstPersonCar = false;
    ui.screenFx.classList.remove('nitro-active');
    AudioFX.updateEngine(false, 0);

    car.doorsOpen = false;
    car.doorAutoTimer = 0;
    car.speed *= 0.25;
    car.vel.multiplyScalar(0.25);

    carAccessAnim.active = true;
    carAccessAnim.mode = 'exit';
    carAccessAnim.car = car;
    carAccessAnim.t = 0;
    carAccessAnim.dur = 1.08;
    carAccessAnim.latchPlayed = true;
    carAccessAnim.slamPlayed = false;
    AudioFX.doorLatch();

    ui.carControls.classList.add('hidden');
    ui.footControls.classList.remove('hidden');
    ui.speedBox.classList.add('hidden');
    if (ui.btnSpinPlayer) ui.btnSpinPlayer.classList.remove('hidden');
    if (ui.btnFrontCam) ui.btnFrontCam.classList.remove('hidden');
    vibrate(25);
  }

  el('btnEnterCar').onclick = () => { if (nearestCar && !player.inCar) enterVehicle(nearestCar); };
  el('btnExitCar').onclick = exitVehicle;

  el('btnInteract').onclick = () => {
    if (nearestProp && nearestProp.type === 'job_npc') {
      const n = nearestProp.npc;
      if (n.velY === 0 && (n.crouchTimer || 0) <= 0) {
        n.crouchTimer = 0.18; // flexiona joelhos antes de pular!
      }
      n.hairVel += 2.6;
      AudioFX.beep(720, 0.08, 'sine', 0.08);
      return;
    }
    if (!nearestProp) return;
    if (nearestProp.type === 'atm') {
      refreshMoneyUI();
      el('bankModal').classList.remove('hidden');
    } else if (nearestProp.type === 'job') {
      el('jobModal').classList.remove('hidden');
    } else if (nearestProp.type === 'safehouse') {
      el('safehouseModal').classList.remove('hidden');
    } else if (nearestProp.type === 'mcdonalds') {
      if (save.cash >= 25) {
        save.cash -= 25;
        player.hp = Math.min(100, player.hp + 50);
        ui.hpFill.style.width = player.hp + '%';
        persistSave(); refreshMoneyUI();
        AudioFX.coin();
        showToast('🍔 Big Mac servido no balcão! -R$ 25 | +50% HP');
      } else {
        showToast('Sem dinheiro (R$ 25) para o lanche!');
      }
    }
  };

  // --- LOBBY 3D SHOWROOM & CONFIGURAÇÕES ---
  function setActivePill(containerSelector, activeEl) {
    document.querySelectorAll(containerSelector + ' .pill-btn').forEach((b) => b.classList.remove('active'));
    activeEl.classList.add('active');
  }

  // --- CICLO AUTOMÁTICO DE ILUMINAÇÃO 24H (MANHÃ, DIA, TARDE & NOITE) ---
  let gameClockHours = 8.5; // começa às 08:30 da manhã
  let envMode = 'auto';
  const _cSkyA = new THREE.Color(), _cSkyB = new THREE.Color();
  const _cSunA = new THREE.Color(), _cSunB = new THREE.Color();

  const DAY_KEYFRAMES = [
    { h: 0.0,  sky: 0x070c18, sun: 0x6b8cff, hemi: 0.36, sunI: 0.28, exp: 0.98, night: 1.0 },
    { h: 5.2,  sky: 0x16223d, sun: 0x8fa8ff, hemi: 0.42, sunI: 0.35, exp: 1.00, night: 0.85 },
    { h: 6.8,  sky: 0xe89b72, sun: 0xffb878, hemi: 0.62, sunI: 0.92, exp: 1.08, night: 0.15 },
    { h: 9.0,  sky: 0x6db3f2, sun: 0xfff6e5, hemi: 0.66, sunI: 1.18, exp: 1.06, night: 0.0 },
    { h: 15.8, sky: 0x6db3f2, sun: 0xfff4de, hemi: 0.66, sunI: 1.16, exp: 1.06, night: 0.0 },
    { h: 17.8, sky: 0xd97a54, sun: 0xff8c42, hemi: 0.70, sunI: 1.08, exp: 1.12, night: 0.35 },
    { h: 19.3, sky: 0x182038, sun: 0x7c98ff, hemi: 0.44, sunI: 0.38, exp: 1.02, night: 0.92 },
    { h: 24.0, sky: 0x070c18, sun: 0x6b8cff, hemi: 0.36, sunI: 0.28, exp: 0.98, night: 1.0 }
  ];

  function applyLightingForHour(hr) {
    const h = ((hr % 24) + 24) % 24;
    let k0 = DAY_KEYFRAMES[0], k1 = DAY_KEYFRAMES[1];
    for (let i = 0; i < DAY_KEYFRAMES.length - 1; i++) {
      if (h >= DAY_KEYFRAMES[i].h && h <= DAY_KEYFRAMES[i + 1].h) {
        k0 = DAY_KEYFRAMES[i];
        k1 = DAY_KEYFRAMES[i + 1];
        break;
      }
    }
    const span = Math.max(0.001, k1.h - k0.h);
    const t = Math.max(0, Math.min(1, (h - k0.h) / span));
    _cSkyA.setHex(k0.sky); _cSkyB.setHex(k1.sky);
    _cSkyA.lerp(_cSkyB, t);
    scene.background.copy(_cSkyA);
    scene.fog.color.copy(_cSkyA);

    _cSunA.setHex(k0.sun); _cSunB.setHex(k1.sun);
    sunLight.color.copy(_cSunA.lerp(_cSunB, t));
    hemiLight.intensity = k0.hemi + (k1.hemi - k0.hemi) * t;
    sunLight.intensity = k0.sunI + (k1.sunI - k0.sunI) * t;
    renderer.toneMappingExposure = k0.exp + (k1.exp - k0.exp) * t;

    const nf = k0.night + (k1.night - k0.night) * t;
    streetLampState.nightFactor = nf;
    if (nf > 0.08) {
      streetLampState.bulbMat.color.setHex(0xffe9a6);
      streetLampState.haloMat.opacity = 0.26 * nf;
    } else {
      streetLampState.bulbMat.color.setHex(0x464d57);
      streetLampState.haloMat.opacity = 0.0;
    }

    const hh = String(Math.floor(h)).padStart(2, '0');
    const mm = String(Math.floor((h % 1) * 60)).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    if (ui.clockText && ui.clockText.textContent !== timeStr) {
      ui.clockText.textContent = timeStr;
      const pt = el('phoneTime');
      if (pt) pt.textContent = timeStr;
      const wIco = el('phWeatherIco');
      const wLbl = el('phWeatherLbl');
      if (wIco && wLbl) {
        if (h >= 5.5 && h < 9.0) { wIco.textContent = '🌅'; wLbl.textContent = 'Manhã'; }
        else if (h >= 9.0 && h < 16.2) { wIco.textContent = '☀️'; wLbl.textContent = 'Dia Limpo'; }
        else if (h >= 16.2 && h < 19.0) { wIco.textContent = '🌇'; wLbl.textContent = 'Fim de Tarde'; }
        else { wIco.textContent = '🌙'; wLbl.textContent = 'Noite'; }
      }
    }
  }

  function applyEnv(env) {
    envMode = env || 'auto';
    if (envMode === 'night') gameClockHours = 22.5;
    else if (envMode === 'sunset') gameClockHours = 17.75;
    else if (envMode === 'morning') gameClockHours = 7.5;
    else if (envMode === 'day') gameClockHours = 12.0;
    applyLightingForHour(gameClockHours);
  }

  function updateDayNightCycle(dt) {
    if (envMode === 'auto') {
      // 1 hora do jogo a cada 18s reais (~7.2 min para 24h completas)
      gameClockHours = (gameClockHours + dt / 18.0) % 24.0;
      applyLightingForHour(gameClockHours);
    }
  }

  document.querySelectorAll('#env-pills .pill-btn').forEach((btn) => {
    btn.onclick = () => {
      setActivePill('#env-pills', btn);
      save.env = btn.dataset.env;
      persistSave();
      applyEnv(save.env);
    };
  });
  document.querySelectorAll('#gfx-quality-pills .pill-btn').forEach((btn) => {
    btn.onclick = () => {
      setActivePill('#gfx-quality-pills', btn);
      save.gfxQuality = btn.dataset.quality;
      persistSave();
      applyGfxQuality(save.gfxQuality);
      showToast(`🎨 Qualidade: ${btn.textContent}`);
    };
  });
  document.querySelectorAll('#fps-pills .pill-btn').forEach((btn) => {
    btn.onclick = () => {
      setActivePill('#fps-pills', btn);
      save.targetFps = parseInt(btn.dataset.fps, 10) || 90;
      persistSave();
      applyTargetFps(save.targetFps);
      showToast(`⚡ Limite: ${btn.textContent}`);
    };
  });
  if (el('btnCarHorn')) el('btnCarHorn').onclick = () => AudioFX.horn();
  if (el('btnCarRadio')) el('btnCarRadio').onclick = () => GtaRadio.next();
  document.querySelectorAll('#dist-pills .pill-btn').forEach((btn) => {
    btn.onclick = () => {
      setActivePill('#dist-pills', btn);
      qualityIdx = parseInt(btn.dataset.dist, 10) || 1;
      save.dist = qualityIdx;
      persistSave();
      updateChunkStreaming(player.pos.x, player.pos.z);
    };
  });

  function getScreenOrientAngle() {
    if (screen && screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    if (typeof window.orientation === 'number') return window.orientation;
    return 90;
  }

  function updateGyroTiltDeg(tiltDeg) {
    const dz = 3.2;
    const maxDeg = 26.0;
    const sens = Math.max(0.65, Math.min(1.8, save.camSens || 1.0));
    const absD = Math.abs(tiltDeg);
    if (absD <= dz) {
      input.gyroTarget = 0;
    } else {
      const norm = Math.min(1, (absD - dz) / (maxDeg - dz));
      // Curva suave (quadrática leve + linear) para controle fino no centro e firme nas curvas
      const curved = norm * (0.65 + 0.35 * norm);
      input.gyroTarget = Math.max(-1, Math.min(1, Math.sign(tiltDeg) * curved * sens));
    }
  }

  window.addEventListener('deviceorientation', (e) => {
    if (save.steerMode !== 'gyro') return;
    if (typeof e.beta !== 'number' && typeof e.gamma !== 'number') return;
    input.lastOrientTs = performance.now();
    const ang = getScreenOrientAngle();
    let tiltDeg = 0;
    if (ang === 90) {
      // Paisagem padrão Android (topo do celular à esquerda): inclinar p/ esquerda -> beta < 0 -> steer +1 (esquerda)
      tiltDeg = -(e.beta || 0);
    } else if (ang === 270 || ang === -90) {
      // Paisagem invertida (topo do celular à direita)
      tiltDeg = (e.beta || 0);
    } else {
      // Retrato
      tiltDeg = -(e.gamma || 0);
    }
    updateGyroTiltDeg(tiltDeg);
  }, { passive: true });

  window.addEventListener('devicemotion', (e) => {
    if (save.steerMode !== 'gyro') return;
    if (performance.now() - (input.lastOrientTs || 0) < 900) return; // já está usando deviceorientation
    const acc = e.accelerationIncludingGravity;
    if (!acc || typeof acc.y !== 'number') return;
    const ang = getScreenOrientAngle();
    let deg = 0;
    if (ang === 90) deg = -Math.atan2(acc.y, 9.81) * 57.2958;
    else if (ang === 270 || ang === -90) deg = Math.atan2(acc.y, 9.81) * 57.2958;
    else deg = Math.atan2(acc.x || 0, 9.81) * 57.2958;
    updateGyroTiltDeg(deg);
  }, { passive: true });

  function applySteerMode(mode, notify) {
    const isGyro = mode === 'gyro';
    save.steerMode = isGyro ? 'gyro' : 'buttons';
    persistSave();
    document.body.classList.toggle('gyro-mode', isGyro);
    if (!isGyro) { input.gyroTarget = 0; input.gyroSteer = 0; }
    const pill = document.querySelector(`#steer-mode-pills .pill-btn[data-steer="${save.steerMode}"]`);
    if (pill) setActivePill('#steer-mode-pills', pill);
    const btnGyro = el('btnCarGyro');
    if (btnGyro) btnGyro.classList.toggle('on', isGyro);
    if (isGyro && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
    if (notify) {
      showToast(isGyro ? '📱 Giroscópio ATIVADO (Freio à esquerda • Acelerador à direita)' : '🎮 Direção por Botões ativada', 2800);
    }
  }

  document.querySelectorAll('#steer-mode-pills .pill-btn').forEach((btn) => {
    btn.onclick = () => applySteerMode(btn.dataset.steer, true);
  });
  if (el('btnCarGyro')) {
    el('btnCarGyro').onclick = () => {
      AudioFX.beep(720, 0.06, 'triangle', 0.08);
      applySteerMode(save.steerMode === 'gyro' ? 'buttons' : 'gyro', true);
    };
  }

  // Restaura preferências salvas ao iniciar
  (function restoreSavedSettings() {
    const envVal = (!save.env || save.env === 'day') ? 'auto' : save.env;
    const envBtn = document.querySelector(`#env-pills .pill-btn[data-env="${envVal}"]`);
    if (envBtn) setActivePill('#env-pills', envBtn);
    applyEnv(envVal);

    const qBtn = document.querySelector(`#gfx-quality-pills .pill-btn[data-quality="${save.gfxQuality || 'medium'}"]`);
    if (qBtn) setActivePill('#gfx-quality-pills', qBtn);
    applyGfxQuality(save.gfxQuality || 'medium');
    applySteerMode(save.steerMode || 'buttons', false);

    const fpsBtn = document.querySelector(`#fps-pills .pill-btn[data-fps="${save.targetFps || 90}"]`);
    if (fpsBtn) setActivePill('#fps-pills', fpsBtn);
    applyTargetFps(save.targetFps || 90);

    const distVal = typeof save.dist === 'number' ? save.dist : 1;
    qualityIdx = Math.max(0, Math.min(2, distVal));
    const dBtn = document.querySelector(`#dist-pills .pill-btn[data-dist="${qualityIdx}"]`);
    if (dBtn) setActivePill('#dist-pills', dBtn);

    if (el('lobby-audio-btn')) {
      el('lobby-audio-btn').classList.toggle('active', soundEnabled);
      el('lobby-audio-btn').textContent = soundEnabled ? 'ÁUDIO: ON' : 'ÁUDIO: OFF';
    }
  })();

  // --- Seletor de Personagens Jogáveis no Lobby 3D (somente Cool Man disponível ao jogador) ---
  const PLAYABLE_CHARS = {
    cool_man: { label: 'Cool Man', path: 'models/chars/cool_man.glb', kind: 'custom' }
  };
  const playableCharCache = {};
  let playerCharLoading = false;

  function findBoneByPatterns(bonesMap, patterns) {
    if (!bonesMap) return null;
    const keys = Object.keys(bonesMap);
    for (const pat of patterns) {
      const low = pat.toLowerCase();
      // 1ª passada: ignora ossos auxiliares e controles (twist / sharebone / ctrl / ik / fk / pole / helper)
      for (const k of keys) {
        const lk = k.toLowerCase();
        if (
          lk.includes('twist') || lk.includes('sharebone') ||
          lk.includes('ctrl_') || lk.includes('_ik_') || lk.includes('_fk_') ||
          lk.includes('pole') || lk.includes('helper') || lk.includes('target')
        ) continue;
        if (lk.includes(low)) return k;
      }
      // 2ª passada: fallback caso o nome legítimo tenha twist (ex: necktwist01)
      for (const k of keys) {
        const lk = k.toLowerCase();
        if (lk.includes('ctrl_') || lk.includes('_ik_') || lk.includes('_fk_')) continue;
        if (lk.includes(low)) return k;
      }
    }
    return null;
  }

  function normalizeCustomCharScene(rawScene, targetHeight) {
    const wrapper = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(rawScene);
    wrapper.add(inner);

    // Remove malhas auxiliares (como Icosphere de raio 1m) ANTES de medir!
    const toRemove = [];
    rawScene.traverse((c) => {
      if (c.isMesh) {
        if (c.name && c.name.toLowerCase().includes('icosphere')) {
          toRemove.push(c);
          return;
        }
        c.frustumCulled = false;
        c.visible = true;
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          if (!m) return;
          const mn = (m.name || '').toLowerCase();
          if (m.map) { m.map.encoding = THREE.sRGBEncoding; m.map.needsUpdate = true; }
          if (mn.includes('eye_occlusion') || mn.includes('tearline') || mn.includes('cornea')) {
            m.transparent = true;
            m.opacity = 0.0;
            m.depthWrite = false;
            return;
          }
          if (mn.includes('eyelash') || mn.includes('brow')) {
            m.transparent = true;
            m.alphaTest = 0.25;
            m.depthWrite = false;
            m.side = THREE.DoubleSide;
            return;
          }
          if (mn.includes('glasses') || mn.includes('lens')) {
            m.transparent = true;
            m.opacity = 0.34;
            m.depthWrite = false;
            return;
          }
          if (m.transparent && m.opacity === 0) m.opacity = 1;
        });
      }
    });
    toRemove.forEach((m) => { if (m.parent) m.parent.remove(m); });

    wrapper.updateMatrixWorld(true);

    // Alinha qualquer pose inicial do GLB (T-pose da Office, passo congelado da Cat Woman, mão na cintura da Lily)
    // para uma pose neutra anatômica em pé (pernas retas no chão + braços relaxados ao lado do corpo),
    // garantindo que boneInitQ/boneWorldInitQ e as articulações de cotovelo/joelho funcionem sem torção!
    (function neutralizeCustomCharPose() {
      const bMap = {};
      rawScene.traverse((c) => { if (c.isBone) bMap[c.name] = c; });
      if (Object.keys(bMap).length < 8) return;

      const _pA = new THREE.Vector3();
      const _pB = new THREE.Vector3();
      const _curDir = new THREE.Vector3();
      const _tgtDir = new THREE.Vector3();
      const _deltaWQ = new THREE.Quaternion();
      const _parentWQ = new THREE.Quaternion();
      const _boneWQ = new THREE.Quaternion();

      function alignBoneToDir(boneName, childName, tx, ty, tz) {
        if (!boneName || !childName) return;
        const bone = bMap[boneName];
        const child = bMap[childName];
        if (!bone || !child || !bone.parent) return;
        wrapper.updateMatrixWorld(true);
        bone.getWorldPosition(_pA);
        child.getWorldPosition(_pB);
        _curDir.subVectors(_pB, _pA);
        if (_curDir.lengthSq() < 1e-8) return;
        _curDir.normalize();
        _tgtDir.set(tx, ty, tz).normalize();
        if (_curDir.dot(_tgtDir) < -0.999) return;
        _deltaWQ.setFromUnitVectors(_curDir, _tgtDir);
        bone.parent.getWorldQuaternion(_parentWQ);
        bone.getWorldQuaternion(_boneWQ);
        // newWorldQ = deltaWQ * boneWQ  =>  newLocalQ = inv(parentWQ) * deltaWQ * boneWQ
        _boneWQ.premultiply(_deltaWQ);
        bone.quaternion.copy(_parentWQ).invert().multiply(_boneWQ);
        bone.updateMatrixWorld(true);
      }

      const thighL = findBoneByPatterns(bMap, ['cc_base_l_thigh', 'leftupleg', 'l_thigh', 'thigh_l']);
      const thighR = findBoneByPatterns(bMap, ['cc_base_r_thigh', 'rightupleg', 'r_thigh', 'thigh_r']);
      const calfL  = findBoneByPatterns(bMap, ['cc_base_l_calf', 'leftleg', 'l_calf', 'calf_l', 'shin_l']);
      const calfR  = findBoneByPatterns(bMap, ['cc_base_r_calf', 'rightleg', 'r_calf', 'calf_r', 'shin_r']);
      const footL  = findBoneByPatterns(bMap, ['cc_base_l_foot', 'leftfoot', 'l_foot', 'foot_l']);
      const footR  = findBoneByPatterns(bMap, ['cc_base_r_foot', 'rightfoot', 'r_foot', 'foot_r']);
      const toeL   = findBoneByPatterns(bMap, ['cc_base_l_toebase', 'lefttoebase', 'l_toe', 'toe_l']);
      const toeR   = findBoneByPatterns(bMap, ['cc_base_r_toebase', 'righttoebase', 'r_toe', 'toe_r']);
      const armL   = findBoneByPatterns(bMap, ['cc_base_l_upperarm', 'leftarm_0', 'leftarm', 'l_upperarm', 'upperarm_l']);
      const armR   = findBoneByPatterns(bMap, ['cc_base_r_upperarm', 'rightarm_0', 'rightarm', 'r_upperarm', 'upperarm_r']);
      const foreL  = findBoneByPatterns(bMap, ['cc_base_l_forearm_', 'cc_base_l_forearm', 'leftforearm_0', 'leftforearm', 'l_forearm', 'forearm_l']);
      const foreR  = findBoneByPatterns(bMap, ['cc_base_r_forearm_', 'cc_base_r_forearm', 'rightforearm_0', 'rightforearm', 'r_forearm', 'forearm_r']);
      const handL  = findBoneByPatterns(bMap, ['cc_base_l_hand', 'lefthand_0', 'lefthand', 'l_hand', 'hand_l']);
      const handR  = findBoneByPatterns(bMap, ['cc_base_r_hand', 'righthand_0', 'righthand', 'r_hand', 'hand_r']);

      function alignFootLevel(boneName, childName) {
        if (!boneName || !childName) return;
        const bone = bMap[boneName];
        const child = bMap[childName];
        if (!bone || !child || !bone.parent) return;
        wrapper.updateMatrixWorld(true);
        bone.getWorldPosition(_pA);
        child.getWorldPosition(_pB);
        _curDir.subVectors(_pB, _pA);
        if (_curDir.lengthSq() < 1e-8) return;
        _curDir.normalize();
        // Preserva a inclinação anatômica natural tornozelo->dedos (sola plana no chão!), zerando apenas desvio lateral
        const tgtY = _curDir.y < -0.15 ? _curDir.y : -0.58;
        const tgtZ = _curDir.z > 0.15 ? _curDir.z : 0.81;
        alignBoneToDir(boneName, childName, 0.0, tgtY, tgtZ);
      }

      // Pernas alinhadas verticalmente (pai -> filho) e pés nivelados com sola plana no chão
      alignBoneToDir(thighL, calfL, 0.0, -1.0, 0.0);
      alignBoneToDir(calfL,  footL, 0.0, -1.0, 0.0);
      alignFootLevel(footL, toeL);

      alignBoneToDir(thighR, calfR, 0.0, -1.0, 0.0);
      alignBoneToDir(calfR,  footR, 0.0, -1.0, 0.0);
      alignFootLevel(footR, toeR);

      // Braços relaxados naturalmente ao lado do corpo (~10° afastados do quadril) e antebraços neutros
      alignBoneToDir(armL,  foreL,  0.18, -0.984, 0.0);
      alignBoneToDir(foreL, handL,  0.08, -0.992, 0.10);

      alignBoneToDir(armR,  foreR, -0.18, -0.984, 0.0);
      alignBoneToDir(foreR, handR, -0.08, -0.992, 0.10);

      wrapper.updateMatrixWorld(true);
    })();

    // Para SkinnedMesh (Cat Woman, Lily, Office), mede pela posição REAL dos ossos (evita bug do Box3 em SkinnedMesh que escala 90x!)
    const _bp = new THREE.Vector3();
    let headY = -Infinity;
    let footY = Infinity;
    let hipX = 0, hipZ = 0, hasHip = false;
    let boneCount = 0;

    rawScene.traverse((c) => {
      if (!c.isBone) return;
      const ln = c.name.toLowerCase();
      if (ln.includes('ctrl_') || ln.includes('_ik_') || ln.includes('_fk_') || ln.includes('pole') || ln.includes('helper')) return;
      boneCount++;
      c.getWorldPosition(_bp);
      if ((ln.includes('eye') || (ln.includes('head') && !ln.includes('end'))) && _bp.y > 0.2) {
        if (_bp.y > headY) headY = _bp.y;
      }
      if (ln.includes('toe') || ln.includes('foot') || ln.includes('ankle') || ln.includes('calf')) {
        if (_bp.y < footY) footY = _bp.y;
      }
      if (!hasHip && (ln.includes('pelvis') || ln.includes('hip'))) {
        hipX = _bp.x;
        hipZ = _bp.z;
        hasHip = true;
      }
    });

    if (boneCount > 6 && headY > -1e6 && footY < 1e6 && (headY - footY) > 0.2) {
      // Olhos/cabeça ficam a ~92% da altura total do personagem
      const estHeight = (headY - footY) / 0.92;
      const s = (targetHeight || 1.68) / estHeight;
      inner.scale.setScalar(s);
      wrapper.updateMatrixWorld(true);

      // Recalcula pés e quadril após escala para pousar exatamente em Y = 0
      let newFootY = Infinity;
      let newHipX = 0, newHipZ = 0, newHasHip = false;
      rawScene.traverse((c) => {
        if (!c.isBone) return;
        c.getWorldPosition(_bp);
        const ln = c.name.toLowerCase();
        if (ln.includes('toe') || ln.includes('foot') || ln.includes('ankle')) {
          if (_bp.y < newFootY) newFootY = _bp.y;
        }
        if (!newHasHip && (ln.includes('pelvis') || ln.includes('hip'))) {
          newHipX = _bp.x;
          newHipZ = _bp.z;
          newHasHip = true;
        }
      });
      if (newHasHip) {
        inner.position.x -= newHipX;
        inner.position.z -= newHipZ;
      }
      if (newFootY < 1e6) {
        inner.position.y -= (newFootY - 0.04);
      }
    } else {
      const box = new THREE.Box3().setFromObject(inner);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      if (size.z > size.y * 1.35 && size.z > 0.01) {
        inner.rotation.x = -Math.PI / 2;
        wrapper.updateMatrixWorld(true);
        box.setFromObject(inner);
        box.getSize(size);
        box.getCenter(center);
      }

      const h = Math.max(size.y, 0.001);
      const s = (targetHeight || 1.68) / h;
      inner.scale.setScalar(s);
      wrapper.updateMatrixWorld(true);
      box.setFromObject(inner);
      box.getCenter(center);
      inner.position.x -= center.x;
      inner.position.z -= center.z;
      inner.position.y -= box.min.y;
    }

    wrapper.updateMatrixWorld(true);
    wrapper.userData.customRoot = inner;
    wrapper.userData.customBaseY = inner.position.y;
    wrapper.userData._animations = rawScene.userData._animations || [];
    return wrapper;
  }

  function applyPlayerMeshObject(charId, meshObj) {
    const info = PLAYABLE_CHARS[charId] || PLAYABLE_CHARS.npc1;
    const prevVisible = player.mesh ? player.mesh.visible : true;
    if (player.mesh && player.mesh.parent) {
      scene.remove(player.mesh);
    }

    player.mesh = meshObj;
    player.charId = charId;
    player.isDoa = (info.kind === 'npc2');
    player.isCustomChar = (info.kind === 'custom');
    player.armRestZ = (info.armRestZ !== undefined) ? info.armRestZ : 0.38;
    player.customRoot = meshObj.userData && meshObj.userData.customRoot ? meshObj.userData.customRoot : null;
    player.customBaseY = (meshObj.userData && meshObj.userData.customBaseY !== undefined) ? meshObj.userData.customBaseY : 0;
    player.doaRoot = meshObj.userData && meshObj.userData.doaRoot ? meshObj.userData.doaRoot : null;
    player.doaBaseY = (meshObj.userData && meshObj.userData.doaBaseY !== undefined) ? meshObj.userData.doaBaseY : 0;
    player.hipsInitY = undefined;
    player.parts = {};
    player.bones = {};
    player.boneInitQ = {};
    player.boneWorldInitQ = {};
    player.customRig = null;
    if (player.mixer) {
      try { player.mixer.stopAllAction(); } catch (_) {}
      player.mixer = null;
      player.mixerAction = null;
    }

    // Captura pose de repouso limpa (sem rotação global do player!) apenas na 1ª vez que o mesh é carregado
    if (!meshObj.userData._cachedRigInit) {
      meshObj.position.set(0, 0, 0);
      meshObj.rotation.set(0, 0, 0);
      meshObj.updateMatrixWorld(true);
      const cachedInitQ = {};
      const cachedWorldInitQ = {};
      meshObj.traverse((c) => {
        if (c.isBone) {
          cachedInitQ[c.name] = c.quaternion.clone();
          const wq = new THREE.Quaternion();
          c.getWorldQuaternion(wq);
          cachedWorldInitQ[c.name] = wq;
        }
      });
      meshObj.userData._cachedRigInit = { initQ: cachedInitQ, worldInitQ: cachedWorldInitQ };
    }

    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.yaw + Math.PI;
    player.mesh.visible = prevVisible;
    scene.add(player.mesh);
    player.mesh.updateMatrixWorld(true);

    const rigCache = meshObj.userData._cachedRigInit;
    player.skirtBones = [];
    player.skirtInfo = {};
    const _invQ = player.mesh.quaternion.clone().invert();
    const _wp = new THREE.Vector3();
    let _pelvisPos = null;

    player.mesh.traverse((c) => {
      if (['LegL', 'LegR', 'ArmL', 'ArmR', 'Torso'].includes(c.name)) player.parts[c.name] = c;
      if (c.isMesh && c.name && c.name.toLowerCase().includes('icosphere')) c.visible = false;
      if (c.isMesh) c.frustumCulled = false;
      if (c.isBone) {
        player.bones[c.name] = c;
        player.boneInitQ[c.name] = rigCache.initQ[c.name] ? rigCache.initQ[c.name].clone() : c.quaternion.clone();
        player.boneWorldInitQ[c.name] = rigCache.worldInitQ[c.name] ? rigCache.worldInitQ[c.name].clone() : new THREE.Quaternion();
        if (c.name.includes('skirt') && !c.name.includes('root')) player.skirtBones.push(c.name);
      }
    });

    if (player.skirtBones.length > 0 && player.bones['pelvis_07']) {
      _pelvisPos = new THREE.Vector3();
      player.bones['pelvis_07'].getWorldPosition(_pelvisPos);
      player.skirtBones.forEach((sb) => {
        player.bones[sb].getWorldPosition(_wp);
        _wp.sub(_pelvisPos).applyQuaternion(_invQ);
        player.skirtInfo[sb] = { dx: _wp.x, dz: _wp.z };
      });
    }

    if (player.isCustomChar && Object.keys(player.bones).length > 4) {
      const extraHair = Object.keys(player.bones).filter((k) => {
        const lk = k.toLowerCase();
        return lk.includes('hair') || lk.includes('cat_ears') || lk.includes('ponytail') || lk.includes('skirt') || lk.includes('ribbon');
      });
      player.customRig = {
        hips: findBoneByPatterns(player.bones, ['cc_base_pelvis', 'cc_base_hip', 'hips_01', 'hips']),
        spine: findBoneByPatterns(player.bones, ['cc_base_spine01', 'cc_base_waist', 'spine_02', 'spine1', 'spine']),
        chest: findBoneByPatterns(player.bones, ['cc_base_spine02', 'spine2_04', 'spine2', 'chest']),
        neck: findBoneByPatterns(player.bones, ['cc_base_necktwist01', 'neck_05', 'neck']),
        head: findBoneByPatterns(player.bones, ['cc_base_head', 'head_08', 'head']),
        eyeL: findBoneByPatterns(player.bones, ['cc_base_l_eye', 'lefteye', 'l_eye', 'eye_l']),
        eyeR: findBoneByPatterns(player.bones, ['cc_base_r_eye', 'righteye', 'r_eye', 'eye_r']),
        bustL: findBoneByPatterns(player.bones, ['cc_base_l_breast', 'l_breast', 'breast_l', 'bustl']),
        bustR: findBoneByPatterns(player.bones, ['cc_base_r_breast', 'r_breast', 'breast_r', 'bustr']),
        thighL: findBoneByPatterns(player.bones, ['cc_base_l_thigh', 'leftupleg', 'l_thigh', 'thigh_l']),
        thighR: findBoneByPatterns(player.bones, ['cc_base_r_thigh', 'rightupleg', 'r_thigh', 'thigh_r']),
        calfL: findBoneByPatterns(player.bones, ['cc_base_l_calf', 'leftleg', 'l_calf', 'calf_l', 'shin_l']),
        calfR: findBoneByPatterns(player.bones, ['cc_base_r_calf', 'rightleg', 'r_calf', 'calf_r', 'shin_r']),
        footL: findBoneByPatterns(player.bones, ['cc_base_l_foot', 'leftfoot', 'l_foot', 'foot_l']),
        footR: findBoneByPatterns(player.bones, ['cc_base_r_foot', 'rightfoot', 'r_foot', 'foot_r']),
        armL: findBoneByPatterns(player.bones, ['cc_base_l_upperarm', 'leftarm_0', 'leftarm', 'l_upperarm', 'upperarm_l']),
        armR: findBoneByPatterns(player.bones, ['cc_base_r_upperarm', 'rightarm_0', 'rightarm', 'r_upperarm', 'upperarm_r']),
        foreL: findBoneByPatterns(player.bones, ['cc_base_l_forearm_', 'cc_base_l_forearm', 'leftforearm_0', 'leftforearm', 'l_forearm', 'forearm_l']),
        foreR: findBoneByPatterns(player.bones, ['cc_base_r_forearm_', 'cc_base_r_forearm', 'rightforearm_0', 'rightforearm', 'r_forearm', 'forearm_r']),
        extraHair,
        armDownZ: (info.armDownZ !== undefined) ? info.armDownZ : 0.62
      };
    }
  }

  const CHAR_PREVIEW_STYLE = {
    npc1: { bg1: '#23334d', bg2: '#0f172a', skin: '#f0c4a0', hair: '#4a2c1d', top: '#e2e8f0', accent: '#38bdf8', hairStyle: 'long' },
    npc2: { bg1: '#3b1d36', bg2: '#130b1a', skin: '#f5cbb0', hair: '#2a1815', top: '#dc2626', accent: '#facc15', hairStyle: 'long' },
    woman_walking: { bg1: '#1e3a3a', bg2: '#0c181a', skin: '#e8b996', hair: '#231c1a', top: '#3b82f6', accent: '#93c5fd', hairStyle: 'bob' },
    indian_office_woman: { bg1: '#2e294e', bg2: '#121024', skin: '#c68b59', hair: '#18181b', top: '#1e293b', accent: '#f8fafc', hairStyle: 'long' },
    cat_woman: { bg1: '#2a183b', bg2: '#09090b', skin: '#f3cfb6', hair: '#111827', top: '#18181b', accent: '#ec4899', hairStyle: 'cat' },
    lily: { bg1: '#154252', bg2: '#081b26', skin: '#f2c6a7', hair: '#6b2d22', top: '#f8fafc', accent: '#fb7185', hairStyle: 'bob' },
    cool_man: { bg1: '#1f2937', bg2: '#090d16', skin: '#dfb18d', hair: '#1c1917', top: '#111827', accent: '#f59e0b', hairStyle: 'man' }
  };

  function buildCharFallbackThumb(charId) {
    const st = CHAR_PREVIEW_STYLE[charId] || CHAR_PREVIEW_STYLE.npc1;
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 160;
    const ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, st.bg1);
    grad.addColorStop(1, st.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 160);

    // Brilho suave atrás do personagem
    const rad = ctx.createRadialGradient(64, 62, 6, 64, 62, 58);
    rad.addColorStop(0, 'rgba(255,255,255,0.18)');
    rad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, 128, 160);

    // Cabelo de trás (se longo)
    ctx.fillStyle = st.hair;
    if (st.hairStyle === 'long') {
      ctx.beginPath();
      ctx.ellipse(64, 70, 29, 44, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (st.hairStyle === 'bob') {
      ctx.beginPath();
      ctx.ellipse(64, 56, 27, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tronco / roupa
    ctx.fillStyle = st.top;
    ctx.beginPath();
    ctx.moveTo(22, 160);
    ctx.quadraticCurveTo(24, 102, 48, 98);
    ctx.lineTo(80, 98);
    ctx.quadraticCurveTo(104, 102, 106, 160);
    ctx.closePath();
    ctx.fill();

    // Detalhe / gola da roupa
    ctx.fillStyle = st.accent;
    ctx.beginPath();
    ctx.moveTo(50, 98);
    ctx.lineTo(64, 124);
    ctx.lineTo(78, 98);
    ctx.closePath();
    ctx.fill();

    // Pescoço
    ctx.fillStyle = st.skin;
    ctx.fillRect(56, 78, 16, 24);

    // Cabeça
    ctx.beginPath();
    ctx.ellipse(64, 58, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Orelhas de gato (Cat Woman)
    if (st.hairStyle === 'cat') {
      ctx.fillStyle = st.top;
      ctx.beginPath();
      ctx.moveTo(44, 44); ctx.lineTo(40, 18); ctx.lineTo(56, 36); ctx.closePath();
      ctx.moveTo(84, 44); ctx.lineTo(88, 18); ctx.lineTo(72, 36); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = st.accent;
      ctx.beginPath();
      ctx.moveTo(45, 40); ctx.lineTo(43, 24); ctx.lineTo(53, 36); ctx.closePath();
      ctx.moveTo(83, 40); ctx.lineTo(85, 24); ctx.lineTo(75, 36); ctx.closePath();
      ctx.fill();
    }

    // Cabelo frontal / topo
    ctx.fillStyle = st.hair;
    ctx.beginPath();
    if (st.hairStyle === 'man') {
      ctx.arc(64, 48, 21, Math.PI, 0);
      ctx.lineTo(84, 52);
      ctx.quadraticCurveTo(64, 38, 44, 52);
    } else {
      ctx.arc(64, 50, 21, Math.PI * 0.92, Math.PI * 0.08);
      ctx.quadraticCurveTo(64, 36, 44, 54);
    }
    ctx.fill();

    // Olhos / óculos
    if (st.hairStyle === 'man') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(46, 53, 15, 7);
      ctx.fillRect(67, 53, 15, 7);
      ctx.fillRect(61, 55, 6, 2);
    } else if (st.hairStyle === 'cat') {
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.roundRect(43, 49, 42, 13, 6);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(54, 56, 3.5, 2.2, 0, 0, Math.PI * 2);
      ctx.ellipse(74, 56, 3.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(55, 57, 2.4, 0, Math.PI * 2);
      ctx.arc(73, 57, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boca suave
    ctx.strokeStyle = 'rgba(120, 45, 45, 0.7)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(64, 68, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    return cv.toDataURL('image/png');
  }

  function initCharPreviews() {
    document.querySelectorAll('#char-pills .char-card').forEach((card) => {
      const cid = card.dataset.char;
      const img = card.querySelector('.char-thumb');
      if (!img || !cid) return;
      let cached = null;
      try { cached = localStorage.getItem('brasilrp_char_thumb_v1_' + cid); } catch (_) {}
      img.src = cached || buildCharFallbackThumb(cid);
    });
  }
  initCharPreviews();

  let _thumbRT = null;
  let _thumbCam = null;
  function captureChar3DThumb(charId) {
    if (!renderer || !scene || !player.mesh) return;
    try {
      const w = 128, h = 160;
      if (!_thumbRT) _thumbRT = new THREE.WebGLRenderTarget(w, h);
      if (!_thumbCam) _thumbCam = new THREE.PerspectiveCamera(32, w / h, 0.1, 40);

      // Posiciona câmera de retrato olhando de frente (+leve ângulo) para o rosto/tronco do personagem
      const targetY = player.pos.y + 1.24;
      const fwdAngle = player.yaw;
      const camAngle = fwdAngle + 0.22;
      _thumbCam.position.set(
        player.pos.x + Math.sin(camAngle) * 1.35,
        player.pos.y + 1.32,
        player.pos.z + Math.cos(camAngle) * 1.35
      );
      _thumbCam.lookAt(player.pos.x, targetY, player.pos.z);

      const prevTarget = renderer.getRenderTarget();
      const prevVis = player.mesh.visible;
      player.mesh.visible = true;
      player.mesh.updateMatrixWorld(true);

      renderer.setRenderTarget(_thumbRT);
      renderer.clear();
      renderer.render(scene, _thumbCam);

      const buf = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(_thumbRT, 0, 0, w, h, buf);
      renderer.setRenderTarget(prevTarget);
      player.mesh.visible = prevVis;

      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      const imgData = ctx.createImageData(w, h);
      // WebGL lê de baixo para cima -> inverte Y
      for (let y = 0; y < h; y++) {
        const srcRow = (h - 1 - y) * w * 4;
        const dstRow = y * w * 4;
        for (let x = 0; x < w * 4; x++) {
          imgData.data[dstRow + x] = buf[srcRow + x];
        }
      }
      ctx.putImageData(imgData, 0, 0);
      const url = cv.toDataURL('image/jpeg', 0.86);
      const card = document.querySelector(`#char-pills .char-card[data-char="${charId}"] .char-thumb`);
      if (card) card.src = url;
      try { localStorage.setItem('brasilrp_char_thumb_v1_' + charId, url); } catch (_) {}
    } catch (_) {}
  }

  async function selectPlayableCharacter(charId, silent) {
    charId = 'cool_man';
    const info = PLAYABLE_CHARS.cool_man;
    if (playerCharLoading) return;
    save.playerChar = charId;
    persistSave();
    document.querySelectorAll('#char-pills .char-card').forEach((b) => {
      b.classList.toggle('active', b.dataset.char === charId);
    });

    if (playableCharCache[charId]) {
      applyPlayerMeshObject(charId, playableCharCache[charId]);
      requestAnimationFrame(() => captureChar3DThumb(charId));
      if (!silent) showToast('👤 Personagem: ' + info.label);
      return;
    }

    playerCharLoading = true;
    if (!silent) showToast('⏳ Carregando ' + info.label + '...');
    try {
      const raw = await loadGLB(info.path);
      let built;
      if (info.kind === 'npc1') {
        built = raw;
      } else if (info.kind === 'npc2') {
        built = wrapDoaNpcScene(raw);
      } else {
        built = normalizeCustomCharScene(raw, 1.68);
      }
      playableCharCache[charId] = built;
      applyPlayerMeshObject(charId, built);
      requestAnimationFrame(() => captureChar3DThumb(charId));
      if (!silent) showToast('✅ Personagem: ' + info.label);
    } catch (err) {
      console.error(err);
      showToast('❌ Erro ao carregar ' + info.label);
    } finally {
      playerCharLoading = false;
    }
  }

  document.querySelectorAll('#char-pills .char-card').forEach((btn) => {
    btn.onclick = () => {
      AudioFX.beep(700, 0.08, 'triangle', 0.09);
      selectPlayableCharacter(btn.dataset.char, false);
    };
  });

  document.querySelectorAll('#car-pills .pill-btn').forEach((btn) => {
    btn.onclick = () => {
      setActivePill('#car-pills', btn);
      const key = btn.dataset.car;
      save.starterCar = key;
      persistSave();
      if (vehicles.length > 0 && !player.inCar) {
        const first = vehicles[0];
        const p = first.pos.clone();
        const y = first.yaw;
        scene.remove(first.mesh);
        vehicles.shift();
        const nv = spawnVehicle(key, p.x, p.y, p.z, y);
        if (nv) { vehicles.pop(); vehicles.unshift(nv); }
      }
      AudioFX.beep(660, 0.08, 'triangle', 0.1);
    };
  });

  document.querySelectorAll('#paint-swatches .color-swatch').forEach((sw) => {
    sw.onclick = () => {
      document.querySelectorAll('#paint-swatches .color-swatch').forEach((s) => s.classList.remove('active'));
      sw.classList.add('active');
      save.paint = sw.dataset.color;
      persistSave();
      if (vehicles[0]) paintVehicle(vehicles[0], save.paint);
    };
  });

  el('lobby-audio-btn').onclick = () => {
    soundEnabled = !soundEnabled;
    save.soundEnabled = soundEnabled;
    persistSave();
    el('lobby-audio-btn').classList.toggle('active', soundEnabled);
    el('lobby-audio-btn').textContent = soundEnabled ? 'ÁUDIO: ON' : 'ÁUDIO: OFF';
    if (!soundEnabled) {
      AudioFX.updateEngine(false, 0);
      GtaRadio.stop(true);
    }
  };
  el('lobby-doors-btn').onclick = () => {
    if (vehicles[0]) { vehicles[0].doorsOpen = !vehicles[0].doorsOpen; vehicles[0].doorAutoTimer = 0; el('lobby-doors-btn').classList.toggle('active', vehicles[0].doorsOpen); }
  };
  el('lobby-lights-btn').onclick = () => {
    if (vehicles[0]) { vehicles[0].lightsOn = !vehicles[0].lightsOn; el('lobby-lights-btn').classList.toggle('active', vehicles[0].lightsOn); }
  };

  // Sliders de sensibilidade (Toque & Controle Bluetooth)
  const camSensSlider = el('camSensSlider');
  const camSensVal = el('camSensVal');
  const padSensSlider = el('padSensSlider');
  const padSensVal = el('padSensVal');
  if (camSensSlider) {
    camSensSlider.value = save.camSens || 1.0;
    camSensVal.textContent = Number(camSensSlider.value).toFixed(1) + 'x';
    camSensSlider.oninput = () => {
      save.camSens = parseFloat(camSensSlider.value) || 1.0;
      camSensVal.textContent = save.camSens.toFixed(1) + 'x';
      persistSave();
    };
  }
  if (padSensSlider) {
    padSensSlider.value = save.padSens || 1.0;
    padSensVal.textContent = Number(padSensSlider.value).toFixed(1) + 'x';
    padSensSlider.oninput = () => {
      save.padSens = parseFloat(padSensSlider.value) || 1.0;
      padSensVal.textContent = save.padSens.toFixed(1) + 'x';
      persistSave();
    };
  }

  // --- Suporte Completo a Controles / Joystick Bluetooth (Gamepad API) ---
  const padState = {
    prevBtns: [],
    joyX: 0,
    joyY: 0,
    gas: false,
    brake: false,
    drift: false,
    nitro: false,
    steer: 0,
    active: false,
    touchOverride: false,
    menuFocusEl: null,
    navCooldown: 0
  };

  function setGamepadUiMode(enabled) {
    if (enabled) {
      document.body.classList.add('gamepad-mode');
    } else {
      document.body.classList.remove('gamepad-mode');
      if (padState.menuFocusEl) {
        padState.menuFocusEl.classList.remove('gp-focus');
        padState.menuFocusEl = null;
      }
    }
  }

  // Ao tocar na tela touch mesmo com controle Bluetooth conectado, libera os controles touch imediatamente!
  window.addEventListener('touchstart', () => {
    if (document.body.classList.contains('gamepad-mode') || !padState.touchOverride) {
      if (padState.active || document.body.classList.contains('gamepad-mode')) {
        padState.touchOverride = true;
        padState.joyX = 0; padState.joyY = 0;
        padState.gas = false; padState.gasAmount = 0; padState.brake = false;
        padState.drift = false; padState.nitro = false; padState.steer = 0;
        setGamepadUiMode(false);
      }
    }
  }, { passive: true, capture: true });

  window.addEventListener('gamepadconnected', (e) => {
    padState.touchOverride = false;
    setGamepadUiMode(true);
    showToast(`🎮 Controle conectado: ${e.gamepad.id.slice(0, 26)} (Toque na tela para liberar controles touch)`, 3400);
  });
  window.addEventListener('gamepaddisconnected', () => {
    padState.active = false; padState.touchOverride = false; padState.joyX = 0; padState.joyY = 0;
    padState.gas = false; padState.gasAmount = 0; padState.brake = false; padState.drift = false; padState.nitro = false; padState.steer = 0;
    setGamepadUiMode(false);
    showToast('🎮 Controle desconectado');
  });

  function getActiveMenuContainer() {
    const isOpen = (id) => {
      const m = el(id);
      return m && !m.classList.contains('hidden');
    };
    if (isOpen('updateModal')) return { el: el('updateModal'), closeBtn: el('btnCloseUpdate') };
    if (isOpen('pauseModal')) return { el: el('pauseModal'), closeBtn: el('btnPauseResume') };
    if (isOpen('creditsModal')) return { el: el('creditsModal'), closeBtn: el('btnCloseCredits') };
    if (isOpen('bankModal')) return { el: el('bankModal'), closeBtn: el('btnCloseBank') };
    if (isOpen('jobModal')) return { el: el('jobModal'), closeBtn: el('btnCloseJob') };
    if (isOpen('safehouseModal')) return { el: el('safehouseModal'), closeBtn: el('btnCloseSafehouse') };
    if (isOpen('phoneModal')) return { el: el('phoneModal'), closeBtn: el('btnClosePhone') };
    if (isOpen('fullMapModal')) return { el: el('fullMapModal'), closeBtn: el('btnCloseFullMap'), isMap: true };
    if (isOpen('modal-overlay')) return { el: el('modal-overlay'), closeBtn: el('btnCloseSettings') };
    if (gameMode === 'lobby') {
      if (isOpen('lobbyGarageDrawer')) return { el: el('lobbyGarageDrawer'), closeBtn: el('btnLobbyGarage') };
      if (isOpen('lobby3d')) return { el: el('lobby3d'), closeBtn: null, isLobby: true };
    }
    return null;
  }

  function updateGamepadMenuNav(dt, lx, ly, btn, justPressed, menuCtx) {
    if (padState.navCooldown > 0) padState.navCooldown -= dt;

    const candidates = Array.from(
      menuCtx.el.querySelectorAll('button, .pill-btn, .char-card, .color-swatch, .lobby-sq-btn, .lobby-play-gta, .phone-app, .phone-close')
    ).filter((node) => {
      if (node.disabled) return false;
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(node).visibility !== 'hidden';
    });

    if (candidates.length === 0) return;

    if (!padState.menuFocusEl || !candidates.includes(padState.menuFocusEl)) {
      if (padState.menuFocusEl) padState.menuFocusEl.classList.remove('gp-focus');
      padState.menuFocusEl = menuCtx.isLobby ? (el('btn-start-game') || candidates[0]) : candidates[0];
      padState.menuFocusEl.classList.add('gp-focus');
    }

    let dirX = 0, dirY = 0;
    if (justPressed(12)) dirY = -1;
    else if (justPressed(13)) dirY = 1;
    else if (justPressed(14)) dirX = -1;
    else if (justPressed(15)) dirX = 1;
    else if (padState.navCooldown <= 0) {
      if (Math.abs(lx) > 0.55 || Math.abs(ly) > 0.55) {
        if (Math.abs(lx) >= Math.abs(ly)) dirX = lx > 0 ? 1 : -1;
        else dirY = ly > 0 ? 1 : -1;
        padState.navCooldown = 0.22;
      }
    }

    if (dirX !== 0 || dirY !== 0) {
      const curRect = padState.menuFocusEl.getBoundingClientRect();
      const cx = curRect.left + curRect.width * 0.5;
      const cy = curRect.top + curRect.height * 0.5;
      let best = null;
      let bestScore = Infinity;

      for (const cand of candidates) {
        if (cand === padState.menuFocusEl) continue;
        const r = cand.getBoundingClientRect();
        const nx = r.left + r.width * 0.5;
        const ny = r.top + r.height * 0.5;
        const dx = nx - cx;
        const dy = ny - cy;
        if (dirX !== 0 && dx * dirX <= 6) continue;
        if (dirY !== 0 && dy * dirY <= 6) continue;
        const primary = dirX !== 0 ? Math.abs(dx) : Math.abs(dy);
        const secondary = dirX !== 0 ? Math.abs(dy) : Math.abs(dx);
        const score = primary + secondary * 2.4;
        if (score < bestScore) {
          bestScore = score;
          best = cand;
        }
      }

      if (!best) {
        const idx = candidates.indexOf(padState.menuFocusEl);
        const step = (dirX > 0 || dirY > 0) ? 1 : -1;
        best = candidates[(idx + step + candidates.length) % candidates.length];
      }

      if (best) {
        padState.menuFocusEl.classList.remove('gp-focus');
        padState.menuFocusEl = best;
        padState.menuFocusEl.classList.add('gp-focus');
        padState.menuFocusEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        AudioFX.beep(520, 0.04, 'triangle', 0.05);
      }
    }

    if (menuCtx.isMap) {
      if (justPressed(4) && el('btnMapZoomOut')) el('btnMapZoomOut').click();
      if (justPressed(5) && el('btnMapZoomIn')) el('btnMapZoomIn').click();
    }

    // Botão A (0) = Confirmar/Selecionar | Botão B (1) = Voltar/Fechar | Start (9) = Jogar/Fechar
    if (justPressed(0) && padState.menuFocusEl) {
      padState.menuFocusEl.click();
    } else if (justPressed(1)) {
      if (menuCtx.closeBtn) menuCtx.closeBtn.click();
      else if (menuCtx.isLobby && el('btn-start-game')) el('btn-start-game').click();
    } else if (justPressed(9)) {
      if (menuCtx.isLobby && el('btn-start-game')) el('btn-start-game').click();
      else if (menuCtx.closeBtn) menuCtx.closeBtn.click();
    }
  }

  function pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { gp = pads[i]; break; } }
    if (!gp) {
      if (padState.active) { padState.active = false; padState.touchOverride = false; setGamepadUiMode(false); }
      return;
    }
    if (!padState.active && !padState.touchOverride) setGamepadUiMode(true);
    padState.active = true;

    const pSens = save.padSens || 1.0;
    const dz = (v) => Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84;
    const lx = dz(gp.axes[0] || 0);
    const ly = dz(gp.axes[1] || 0);
    const rx = dz(gp.axes[2] || 0);
    const ry = dz(gp.axes[3] || 0);

    const btn = (i) => gp.buttons[i] ? gp.buttons[i].pressed : false;
    const val = (i) => gp.buttons[i] ? gp.buttons[i].value : 0;
    const justPressed = (i) => btn(i) && !padState.prevBtns[i];

    // Se o jogador voltou a usar o controle Bluetooth após ter tocado na tela, reativa o modo tela limpa
    const anyPadInput = lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0 ||
      gp.buttons.some((b) => b && (b.pressed || b.value > 0.2));
    if (padState.touchOverride) {
      if (anyPadInput) {
        padState.touchOverride = false;
        setGamepadUiMode(true);
      } else {
        padState.prevBtns = gp.buttons.map((b) => b.pressed);
        return;
      }
    }

    // Se houver algum menu/modal ou lobby aberto, os botões de navegação operam no menu
    const menuCtx = getActiveMenuContainer();
    if (menuCtx) {
      padState.joyX = 0; padState.joyY = 0;
      padState.gas = false; padState.brake = false; padState.drift = false; padState.nitro = false; padState.steer = 0;
      input.sprint = false;
      updateGamepadMenuNav(dt, lx, ly, btn, justPressed, menuCtx);
      padState.prevBtns = gp.buttons.map((b) => b.pressed);
      return;
    }

    if (padState.menuFocusEl) {
      padState.menuFocusEl.classList.remove('gp-focus');
      padState.menuFocusEl = null;
    }

    // Analógico direito: câmera livre 360° completa (inclusive com veículo em movimento!) e interior
    if (rx !== 0 || ry !== 0) {
      applyLookDelta(rx * 3.4 * pSens * dt, ry * 2.1 * pSens * dt, true);
    }

    // Start (9) = Menu/Lobby | Select/Back (8) = Mapa Completo
    if (justPressed(9)) window.togglePauseMenu();
    if (justPressed(8) && el('minimapBtn')) el('minimapBtn').click();

    if (gameMode === 'playing') {
      if (!player.inCar) {
        padState.joyX = lx * Math.min(1.2, pSens);
        padState.joyY = ly * Math.min(1.2, pSens);
        input.sprint = btn(1) || btn(5);
        if (justPressed(0)) input.jumpPressed = true; // A = Pular
        if (justPressed(2) || val(7) > 0.65 && !padState.prevBtns[7]) { // X / RT = Soco / Ação
          if (el('btnPunch')) el('btnPunch').click();
        }
        if (justPressed(3)) { // Y = Entrar no carro ou Interagir
          if (nearestCar) enterVehicle(nearestCar);
          else if (nearestProp && el('btnInteract')) el('btnInteract').click();
        }
        if (btn(4)) input.camZoomOffset = Math.max(-1.8, input.camZoomOffset - 3.5 * dt); // LB = Zoom Perto
        if (btn(6)) input.camZoomOffset = Math.min(7.0, input.camZoomOffset + 3.5 * dt); // LT = Zoom Longe
        if (justPressed(10) && el('btnFrontCam')) el('btnFrontCam').click(); // L3 = Câmera Frontal
        if (justPressed(11) && el('btnCamMode')) el('btnCamMode').click(); // R3 = 1ª/3ª Pessoa
        if (justPressed(12) && el('btnPhone')) el('btnPhone').click(); // D-Pad Cima = Celular
        if (justPressed(13) && el('btnChatToggle')) el('btnChatToggle').click(); // D-Pad Baixo = Chat
        if (justPressed(14) && el('btnVoice')) el('btnVoice').click(); // D-Pad Esq = Voz
        if (justPressed(15) && el('btnWeaponHud')) el('btnWeaponHud').click(); // D-Pad Dir = Equipamento
      } else {
        padState.steer = Math.max(-1, Math.min(1, lx * pSens));
        const rtVal = val(7);
        const stickGas = ly < -0.28 ? Math.min(1, (-ly - 0.28) / 0.72) : 0;
        padState.gasAmount = Math.max(rtVal > 0.12 ? rtVal : 0, stickGas);
        padState.gas = padState.gasAmount > 0.05; // RT progressivo ou Analógico Cima = Acelerar
        padState.brake = val(6) > 0.15 || ly > 0.35; // LT ou Analógico Baixo = Freio/Ré
        padState.drift = btn(0); // A = Freio de mão / Drift
        padState.nitro = btn(1) || btn(5); // B / RB = Nitro
        if (justPressed(2) && ui.btnCarCam) ui.btnCarCam.click(); // X = Câmera do carro
        if (justPressed(3)) exitVehicle(); // Y = Sair do carro
        if (justPressed(4) || justPressed(10)) { AudioFX.horn(); } // LB / L3 = Buzina
        if (justPressed(11)) { // R3 = Alternar Zoom Detalhe Perto / Normal / Longe
          const zoomLevels = [-3.8, -2.5, -1.2, 0, 2.8, 5.5];
          const curIdx = zoomLevels.findIndex((z) => Math.abs(input.camZoomOffset - z) < 0.65);
          input.camZoomOffset = zoomLevels[(curIdx + 1) % zoomLevels.length];
        }
        if (justPressed(12) && ui.btnCarLights) ui.btnCarLights.click(); // D-Pad Cima = Faróis
        if (justPressed(13) && ui.btnCarDoors) ui.btnCarDoors.click(); // D-Pad Baixo = Portas
        if (justPressed(14)) GtaRadio.next(); // D-Pad Esq = Trocar Rádio GTA
        if (justPressed(15) && el('btnPhone')) el('btnPhone').click(); // D-Pad Dir = Celular RP
      }
    }
    padState.prevBtns = gp.buttons.map((b) => b.pressed);
  }

  el('btnLobbySettings').onclick = () => ui.modalOverlay.classList.remove('hidden');
  el('btnCloseSettings').onclick = () => {
    ui.modalOverlay.classList.add('hidden');
    if (gameMode === 'playing' && isPaused) setGamePaused(false);
  };
  el('btn-cfg-play').onclick = () => {
    ui.modalOverlay.classList.add('hidden');
    if (gameMode === 'playing') {
      setGamePaused(false);
    } else {
      el('btn-start-game').click();
    }
  };

  // --- Sistema de Atualização Online do App ---
  let pendingUpdateInfo = null;
  const updModal = el('updateModal');
  const updVersionTag = el('updVersionTag');
  const updChangelog = el('updChangelog');
  const updProgressWrap = el('updProgressWrap');
  const updBarFill = el('updBarFill');
  const updProgressText = el('updProgressText');
  const btnDoUpdate = el('btnDoUpdate');
  const btnCloseUpdate = el('btnCloseUpdate');

  if (el('btn-check-update')) {
    el('btn-check-update').onclick = () => {
      if (window.BrasilNative && typeof window.BrasilNative.checkUpdate === 'function') {
        showToast('🔄 Verificando atualizações online...', 2400);
        window.BrasilNative.checkUpdate();
      } else {
        showToast('Verificação de atualização disponível apenas no APK Android.');
      }
    };
  }
  if (btnCloseUpdate) {
    btnCloseUpdate.onclick = () => updModal.classList.add('hidden');
  }
  if (btnDoUpdate) {
    btnDoUpdate.onclick = () => {
      if (!pendingUpdateInfo) return;
      if (pendingUpdateInfo.mode !== 'ota' && !pendingUpdateInfo.apkUrl) return;
      btnDoUpdate.disabled = true;
      btnDoUpdate.textContent = 'ATUALIZANDO...';
      updProgressWrap.classList.remove('hidden');
      updBarFill.style.width = '2%';
      updProgressText.textContent = 'Iniciando atualização...';
      if (pendingUpdateInfo.mode === 'ota' && window.BrasilNative && typeof window.BrasilNative.startOtaUpdate === 'function') {
        window.BrasilNative.startOtaUpdate();
      } else if (window.BrasilNative && typeof window.BrasilNative.startUpdate === 'function') {
        window.BrasilNative.startUpdate(pendingUpdateInfo.apkUrl);
      }
    };
  }
  window.onAppUpdateAvailable = (info) => {
    if (!info || !updModal) return;
    pendingUpdateInfo = info;
    const isOta = info.mode === 'ota';
    const updTitle = el('updModalTitle');
    if (updTitle) updTitle.textContent = isOta ? '⚡ ATUALIZANDO JOGO (OTA)' : '🚀 NOVA ATUALIZAÇÃO (APK)';
    const curVer = (window.BrasilNative && window.BrasilNative.getAppVersion) ? window.BrasilNative.getAppVersion() : '';
    let tagText = `VERSÃO ${info.versionName || 'NOVA'}` + (curVer ? ` (ATUAL: ${curVer})` : '');
    if (isOta && info.otaSizeBytes > 0) {
      const sizeStr = info.otaSizeBytes >= 1048576
        ? (info.otaSizeBytes / 1048576).toFixed(1) + ' MB'
        : Math.max(1, Math.round(info.otaSizeBytes / 1024)) + ' KB';
      tagText += ` • ${sizeStr} (${info.otaFileCount || 1} arq.)`;
    }
    updVersionTag.textContent = tagText;
    updChangelog.textContent = info.changelog || 'Nova versão do Brasil RP disponível!';
    if (isOta && window.BrasilNative && typeof window.BrasilNative.startOtaUpdate === 'function') {
      // Patch OTA é leve e obrigatório: aplica automaticamente sem perguntar
      btnDoUpdate.classList.add('hidden');
      btnCloseUpdate.classList.add('hidden');
      updProgressWrap.classList.remove('hidden');
      updBarFill.style.width = '2%';
      updProgressText.textContent = 'Baixando atualização automática...';
      updModal.classList.remove('hidden');
      window.BrasilNative.startOtaUpdate();
      return;
    }
    updProgressWrap.classList.add('hidden');
    btnDoUpdate.classList.remove('hidden');
    btnDoUpdate.disabled = false;
    btnDoUpdate.textContent = 'ATUALIZAR AGORA ⬇';
    btnCloseUpdate.textContent = 'DEPOIS';
    btnCloseUpdate.classList.toggle('hidden', Boolean(info.mandatory));
    updModal.classList.remove('hidden');
  };
  window.onAppOtaComplete = () => {
    showToast('✅ Atualização aplicada! Reiniciando...', 2500);
    setTimeout(() => { location.reload(); }, 650);
  };
  window.onAppUpdateProgress = (pct, dlMb, totMb, customMsg) => {
    if (!updProgressWrap) return;
    updProgressWrap.classList.remove('hidden');
    updBarFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (customMsg) {
      updProgressText.textContent = customMsg;
    } else if (totMb > 0) {
      updProgressText.textContent = `Baixando ${pct}% (${dlMb.toFixed(1)} MB / ${totMb.toFixed(1)} MB)`;
    } else {
      updProgressText.textContent = `Baixando ${pct}%...`;
    }
  };
  window.onAppUpdateError = (msg) => {
    if (btnDoUpdate) {
      btnDoUpdate.disabled = false;
      btnDoUpdate.textContent = 'TENTAR NOVAMENTE';
    }
    if (updProgressText && updModal && !updModal.classList.contains('hidden')) {
      updProgressText.textContent = msg;
    }
    showToast('⚠️ ' + msg, 3600);
  };
  window.onAppUpdateUpToDate = (ver) => {
    const msg = `✅ Seu Brasil RP já está atualizado (v${ver || ''})!`;
    showToast(msg, 3400);
    if (updModal) {
      const updTitle = el('updModalTitle');
      if (updTitle) updTitle.textContent = '✅ APP ATUALIZADO';
      if (updVersionTag) updVersionTag.textContent = `VERSÃO ATUAL: v${ver || ''}`;
      if (updChangelog) updChangelog.textContent = 'Você já está utilizando a versão mais recente do Brasil RP.';
      if (updProgressWrap) updProgressWrap.classList.add('hidden');
      if (btnDoUpdate) btnDoUpdate.classList.add('hidden');
      if (btnCloseUpdate) {
        btnCloseUpdate.classList.remove('hidden');
        btnCloseUpdate.textContent = 'OK';
      }
      updModal.classList.remove('hidden');
    }
  };
  el('btn-lobby-respawn').onclick = () => {
    if (player.inCar) exitVehicle();
    const sp = mapManifest.spawn;
    player.pos.set(sp.x, sp.y + 0.5, sp.z);
    if (vehicles[0]) { vehicles[0].pos.set(sp.x + 4.5, (getGroundHeight(sp.x + 4.5, sp.z + 6.5) ?? sp.y) + 0.1, sp.z + 6.5); vehicles[0].vel.set(0, 0, 0); }
    showToast('Spawn reposicionado!');
  };

  const btnLobbyGarage = el('btnLobbyGarage');
  const lobbyGarageDrawer = el('lobbyGarageDrawer');
  if (btnLobbyGarage && lobbyGarageDrawer) {
    btnLobbyGarage.onclick = () => {
      AudioFX.beep(680, 0.07, 'triangle', 0.08);
      lobbyGarageDrawer.classList.toggle('hidden');
    };
  }

  let isPaused = false;
  function setGamePaused(paused) {
    isPaused = Boolean(paused);
    const pm = el('pauseModal');
    if (pm) pm.classList.toggle('hidden', !isPaused);
    if (isPaused) {
      GtaRadio.stop(false);
      AudioFX.updateEngine(false, 0);
      if (AudioFX.ctx && AudioFX.ctx.state === 'running') AudioFX.ctx.suspend().catch(() => {});
      if (window.BrasilAudio && window.BrasilAudio.setPaused) window.BrasilAudio.setPaused(true);
    } else {
      lastTime = performance.now();
      if (soundEnabled && AudioFX.ctx && AudioFX.ctx.state === 'suspended') AudioFX.ctx.resume().catch(() => {});
      if (window.BrasilAudio && window.BrasilAudio.setPaused) window.BrasilAudio.setPaused(false);
      if (player.inCar && gameMode === 'playing') setTimeout(() => { if (player.inCar && !isPaused) GtaRadio.start(); }, 100);
    }
  }

  window.onAppBackground = () => {
    GtaRadio.stop(false);
    AudioFX.updateEngine(false, 0);
    if (AudioFX.ctx && AudioFX.ctx.state === 'running') AudioFX.ctx.suspend().catch(() => {});
    if (window.BrasilAudio && window.BrasilAudio.setPaused) window.BrasilAudio.setPaused(true);
    if (gameMode === 'playing' && !isPaused) {
      setGamePaused(true);
    }
  };
  window.onAppForeground = () => {
    if (!isPaused && soundEnabled) {
      if (AudioFX.ctx && AudioFX.ctx.state === 'suspended') AudioFX.ctx.resume().catch(() => {});
      if (window.BrasilAudio && window.BrasilAudio.setPaused) window.BrasilAudio.setPaused(false);
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.onAppBackground();
  });
  window.addEventListener('blur', () => {
    if (gameMode === 'playing') window.onAppBackground();
  });

  if (el('btnLobbyCredits') && el('creditsModal')) {
    el('btnLobbyCredits').onclick = () => el('creditsModal').classList.remove('hidden');
  }
  if (el('btnCloseCredits') && el('creditsModal')) {
    el('btnCloseCredits').onclick = () => el('creditsModal').classList.add('hidden');
  }
  if (el('btnPauseResume')) el('btnPauseResume').onclick = () => setGamePaused(false);
  if (el('btnPauseSettings')) {
    el('btnPauseSettings').onclick = () => {
      el('pauseModal').classList.add('hidden');
      ui.modalOverlay.classList.remove('hidden');
    };
  }
  if (el('btnPauseLobby')) {
    el('btnPauseLobby').onclick = () => {
      setGamePaused(false);
      if (player.inCar) exitVehicle();
      gameMode = 'lobby';
      ui.hud.classList.add('hidden');
      ui.lobby3d.classList.remove('hidden');
      refreshMoneyUI();
    };
  }

  el('btn-start-game').onclick = () => {
    AudioFX.resume();
    if (window.BrasilAudio && window.BrasilAudio.setPaused) window.BrasilAudio.setPaused(false);
    isPaused = false;
    if (el('pauseModal')) el('pauseModal').classList.add('hidden');
    gameMode = 'playing';
    ui.lobby3d.classList.add('hidden');
    if (lobbyGarageDrawer) lobbyGarageDrawer.classList.add('hidden');
    ui.modalOverlay.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    showToast('🇧🇷 Bem-vindo! VW Pickup Azul e Mustang GTD na rua!', 3200);
  };

  window.togglePauseMenu = () => {
    if (gameMode === 'playing') {
      setGamePaused(!isPaused);
    } else if (gameMode === 'lobby') {
      el('btn-start-game').click();
    }
  };
  el('btnMenu').onclick = window.togglePauseMenu;

  // --- TELEFONE BRASIL RP ---
  function openPhoneHome() {
    document.querySelectorAll('#phoneModal .ifruit-screen').forEach((s) => s.classList.add('hidden'));
    if (el('phScreenHome')) el('phScreenHome').classList.remove('hidden');
    if (el('phBankBal')) el('phBankBal').textContent = Math.round(save.bank || 0).toLocaleString('pt-BR');
    if (el('phCashBal')) el('phCashBal').textContent = Math.round(save.cash || 0).toLocaleString('pt-BR');
  }

  el('btnPhone').onclick = () => {
    AudioFX.ring();
    openPhoneHome();
    el('phoneModal').classList.remove('hidden');
  };
  el('btnCamMode').onclick = () => {
    if (player.inCar) {
      ui.btnCarCam.click();
      return;
    }
    player.firstPersonFoot = !player.firstPersonFoot;
    if (player.firstPersonFoot && player.spin360Mode) setSpin360Mode(false);
    if (player.mesh) player.mesh.visible = !player.firstPersonFoot;
    el('btnCamMode').textContent = player.firstPersonFoot ? '1ª' : '👁️';
    showToast(player.firstPersonFoot ? '👁️ Visão: 1ª Pessoa' : '👁️ Visão: 3ª Pessoa');
  };
  // --- Efeitos Visuais de Impacto de Soco / Combate ---
  const punchFxList = [];
  const punchRingGeo = new THREE.RingGeometry(0.08, 0.34, 12);
  function spawnPunchImpact(x, y, z, isKnockout) {
    const mat = new THREE.MeshBasicMaterial({
      color: isKnockout ? 0xff2a2a : 0xffd54f,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const m = new THREE.Mesh(punchRingGeo, mat);
    m.position.set(x, y, z);
    m.lookAt(camera.position);
    scene.add(m);
    punchFxList.push({ mesh: m, mat, life: 0.28, maxLife: 0.28, ko: isKnockout });
  }
  function updatePunchFx(dt) {
    for (let i = punchFxList.length - 1; i >= 0; i--) {
      const fx = punchFxList[i];
      fx.life -= dt;
      if (fx.life <= 0) {
        scene.remove(fx.mesh);
        fx.mat.dispose();
        punchFxList.splice(i, 1);
        continue;
      }
      const p = 1.0 - fx.life / fx.maxLife;
      const sc = 1.0 + p * (fx.ko ? 2.6 : 1.7);
      fx.mesh.scale.setScalar(sc);
      fx.mesh.lookAt(camera.position);
      fx.mat.opacity = (1.0 - p) * 0.9;
    }
  }

  if (el('btnPunch')) {
    let lastPunchMs = 0;
    let comboStep = 0;
    el('btnPunch').onclick = () => {
      if (player.inCar || gameMode !== 'playing') return;
      const now = performance.now();
      if (now - lastPunchMs < 250) return;
      if (now - lastPunchMs > 1200) comboStep = 0;
      else comboStep = (comboStep + 1) % 3;
      lastPunchMs = now;

      player.punchCombo = comboStep; // 0 = Jab Dir, 1 = Direto Esq, 2 = Gancho Forte!
      player.punchAnim = comboStep === 2 ? 0.34 : 0.26;
      vibrate(comboStep === 2 ? 40 : 22);
      AudioFX.beep(comboStep === 2 ? 140 : 190, 0.06, 'triangle', 0.14);

      // Em player.mesh, a frente real do deslocamento é (-sin(player.yaw), -cos(player.yaw))!
      const fwdX = -Math.sin(player.yaw);
      const fwdZ = -Math.cos(player.yaw);
      // Leve avanço físico no golpe (lunge estilo GTA)
      player.velX = (player.velX || 0) + fwdX * (comboStep === 2 ? 3.2 : 1.8);
      player.velZ = (player.velZ || 0) + fwdZ * (comboStep === 2 ? 3.2 : 1.8);

      let hitSomething = false;

      // 1. Dano, stagger, fuga/revide e nocaute em NPCs à frente
      for (const n of npcs) {
        if (n.dead) continue;
        const dx = n.pos.x - player.pos.x;
        const dz = n.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 2.45 || Math.abs(n.pos.y - player.pos.y) > 2.0) continue;
        const dot = d > 0.01 ? (dx * fwdX + dz * fwdZ) / d : 1;
        if (d > 0.95 && dot < 0.15) continue;

        if (n.isJobNpc) {
          n.springVel = (n.springVel || 0) + 1.8;
          showToast('💃 Ei! Cuidado onde bate!');
          hitSomething = true;
          continue;
        }

        const nx = d > 0.01 ? dx / d : fwdX;
        const nz = d > 0.01 ? dz / d : fwdZ;
        const dmg = comboStep === 2 ? 48 : 32;
        n.hp = Math.max(0, n.hp - dmg);
        const isKo = n.hp <= 0;
        spawnPunchImpact(n.pos.x - nx * 0.25, n.pos.y + 1.25, n.pos.z - nz * 0.25, isKo);

        if (isKo) {
          n.dead = true;
          n.vel.set(nx * 6.8, 0, nz * 6.8);
          n.velY = 2.6;
          n.knockTimer = 9.5;
          const loot = 25 + Math.floor(Math.random() * 50);
          save.cash += loot; persistSave(); refreshMoneyUI();
          player.wanted = Math.min(5, player.wanted + 1);
          player.wantedTimer = 25;
          camShakeTimer = 0.22; camShakePower = 0.18;
          showToast(`💥 NOCAUTE! +R$ ${loot} | Procurado!`, 2400);
        } else {
          // Stagger realista + reação (foge assustado ou parte pra briga!)
          n.vel.set(nx * (comboStep === 2 ? 5.2 : 3.4), 0, nz * (comboStep === 2 ? 5.2 : 3.4));
          n.velY = comboStep === 2 ? 1.6 : 0.6;
          n.knockTimer = comboStep === 2 ? 0.95 : 0.42;
          n.hitStagger = 0.55;
          if (n.hostileToPlayer === undefined) n.hostileToPlayer = Math.random() < 0.35;
          if (!n.hostileToPlayer) {
            n.aiState = 'flee';
            n.aiTimer = 5.5;
            n.yaw = Math.atan2(-nx, -nz);
          }
          camShakeTimer = 0.12; camShakePower = 0.09;
          showToast(`${comboStep === 2 ? '💥 Gancho!' : '👊 Soco!'} HP: ${Math.round(n.hp)}% ${n.hostileToPlayer ? '⚠️ Vai revidar!' : '🏃 Fugindo!'}`, 1300);
        }
        hitSomething = true;
        break;
      }

      // 2. Dano e impacto em carros estacionados próximos
      if (!hitSomething) {
        for (const v of vehicles) {
          const dx = v.pos.x - player.pos.x;
          const dz = v.pos.z - player.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 2.85 && Math.abs(v.pos.y - player.pos.y) < 2.2) {
            v.hp = Math.max(0, v.hp - (comboStep === 2 ? 12 : 7));
            v.roll = (v.roll || 0) + (comboStep === 1 ? -0.07 : 0.07);
            spawnPunchImpact(player.pos.x + fwdX * 1.1, player.pos.y + 1.0, player.pos.z + fwdZ * 1.1, false);
            hitSomething = true;
            showToast(`👊 Lataria atingida! (${Math.round(v.hp)}%)`, 1200);
            break;
          }
        }
      }

      // 3. Derrubar cones/placas próximos no soco
      if (!hitSomething && typeof destructibleProps !== 'undefined') {
        for (const p of destructibleProps) {
          if (p.state !== 'intact' || p.kind === 'pole') continue;
          const dx = p.pos.x - player.pos.x;
          const dz = p.pos.z - player.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 2.2 && Math.abs(p.pos.y - player.pos.y) < 2.2) {
            const nx = d > 0.01 ? dx / d : fwdX;
            const nz = d > 0.01 ? dz / d : fwdZ;
            p.state = 'falling';
            p.resetTimer = 18.0;
            p.vel.set(nx * 5.6, 2.6, nz * 5.6);
            p.fallAxis.set(nz, 0, -nx).normalize();
            p.fallSpeed = 4.8;
            spawnPunchImpact(p.pos.x, p.pos.y + 0.9, p.pos.z, false);
            hitSomething = true;
            break;
          }
        }
      }

      if (hitSomething) {
        AudioFX.crash();
        vibrate(comboStep === 2 ? 70 : 45);
      }
    };
  }
  if (el('btnWeaponHud')) {
    el('btnWeaponHud').onclick = () => {
      AudioFX.beep(520, 0.06, 'sine', 0.08);
      showToast('🔫 Slot de Equipamento RP');
    };
  }
  function ensureThirdPersonFoot() {
    if (player.firstPersonFoot) {
      player.firstPersonFoot = false;
      if (player.mesh) player.mesh.visible = true;
      el('btnCamMode').textContent = '👁️';
    }
  }
  if (ui.btnFrontCam) {
    ui.btnFrontCam.onclick = () => {
      if (player.inCar) {
        player.firstPersonCar = false;
        const fSign = player.inCar.forwardSign || 1;
        const frontYaw = fSign > 0 ? player.inCar.yaw : (player.inCar.yaw + Math.PI);
        const rearYaw = frontYaw + Math.PI;
        let diff = frontYaw - input.camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        camManualTimer = 10.0;
        if (Math.abs(diff) < 0.5) {
          input.camYaw = rearYaw;
          input.camPitch = 0.22;
          showToast('🎥 Câmera: Traseira do veículo');
        } else {
          input.camYaw = frontYaw;
          input.camPitch = 0.10;
          showToast('🚘 Câmera: Frente / Detalhes do veículo');
        }
        return;
      }
      ensureThirdPersonFoot();
      const frontYaw = player.yaw + Math.PI;
      let diff = frontYaw - input.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.45) {
        input.camYaw = player.yaw;
        input.camPitch = 0.24;
        showToast('🎥 Câmera: Costas do protagonista');
      } else {
        input.camYaw = frontYaw;
        input.camPitch = 0.14;
        showToast('👤 Câmera: De frente para o protagonista!');
      }
    };
  }
  if (ui.btnSpinPlayer) {
    ui.btnSpinPlayer.onclick = () => {
      if (player.inCar) {
        player.firstPersonCar = false;
        player.carFreeCam360 = !player.carFreeCam360;
        if (player.carFreeCam360 && input.camZoomOffset > -1.0) input.camZoomOffset = -2.2;
        showToast(
          player.carFreeCam360
            ? '🔄 Câmera 360° Livre ativada no veículo (sem puxar câmera ao andar; faça pinça para focar nos detalhes)'
            : '🎥 Câmera automática atrás do veículo reativada'
        );
        return;
      }
      ensureThirdPersonFoot();
      setSpin360Mode(!player.spin360Mode);
      showToast(
        player.spin360Mode
          ? '🔄 Cenário travado! Arraste para girar só o protagonista 360°'
          : '🎥 Câmera livre 360° ao redor do protagonista'
      );
    };
  }
  el('btnClosePhone').onclick = () => el('phoneModal').classList.add('hidden');

  el('phSummonNpc').onclick = () => {
    el('phoneModal').classList.add('hidden');
    // Encontrar a NPC do Job (garota) mais próxima do jogador
    const candidates = npcs.filter((n) => n.isJobNpc && !n.dead);
    if (candidates.length === 0) {
      showToast('Nenhuma garota do Job disponível no momento!');
      return;
    }
    candidates.forEach((c) => { c.followingPlayer = false; c.summoned = false; });
    candidates.sort((a, b) =>
      Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z) -
      Math.hypot(b.pos.x - player.pos.x, b.pos.z - player.pos.z)
    );
    const chosen = candidates[0];
    const dist = Math.hypot(chosen.pos.x - player.pos.x, chosen.pos.z - player.pos.z);
    // Se a mais próxima estiver muito longe (>80m), aproxima para uma rua a ~28m para vir andando
    if (dist > 80) {
      for (let t = 0; t < 20; t++) {
        const ang = Math.random() * Math.PI * 2;
        const rx = player.pos.x + Math.cos(ang) * 26;
        const rz = player.pos.z + Math.sin(ang) * 26;
        if (getRoadCellAt(rx, rz) < 1) continue;
        const rgy = getSafeGroundForSpawn(rx, rz, player.pos.y);
        if (rgy !== null && Math.abs(rgy - player.pos.y) <= 12.0) {
          chosen.pos.set(rx, rgy, rz);
          break;
        }
      }
    }
    chosen.routeWaypoints = computeGpsRoute(chosen.pos.x, chosen.pos.z, player.pos.x, player.pos.z);
    chosen.routeIdx = 1;
    chosen.routeTimer = 0;
    chosen.summoned = true;
    chosen.followingPlayer = false;
    jobNpcRef = chosen;
    AudioFX.ring();
    showToast('💃 Chamando a garota do Job mais próxima! Ela está indo até você.', 3200);
  };

  const SAFEHOUSE_POS = { x: -135.0, y: 0.02, z: -182.0, carX: -129.2, carZ: -182.0 };

  function deliverPhoneCar(typeKey, label) {
    el('phoneModal').classList.add('hidden');
    const refP = player.inCar ? player.inCar.pos : player.pos;
    // Busca ponto asfaltado mais próximo para o carro nunca nascer em parede/escadaria/flutuando
    let sx = refP.x - Math.sin(input.camYaw) * 5.2;
    let sz = refP.z - Math.cos(input.camYaw) * 5.2;
    if (colMeta && roadGrid) {
      const N = roadGridN;
      const worldW = colMeta.W * colMeta.step, worldH = colMeta.H * colMeta.step;
      const gx0 = Math.max(0, Math.min(N - 1, Math.floor(((sx - colMeta.minX) / worldW) * N)));
      const gy0 = Math.max(0, Math.min(N - 1, Math.floor((1.0 - (-sz - colMeta.minY) / worldH) * N)));
      const [rx, ry] = snapNodeToNearestRoad(gx0, gy0, N, 28);
      sx = colMeta.minX + ((rx + 0.5) / N) * worldW;
      sz = -(colMeta.minY + (1.0 - (ry + 0.5) / N) * worldH);
    }
    const gy = getSafeGroundForSpawn(sx, sz, refP.y);
    spawnVehicle(typeKey, sx, gy + 0.04, sz, input.camYaw + Math.PI);
    AudioFX.beep(540, 0.12);
    showToast(`${label} entregue na via!`);
  }

  // Navegação interna de telas do Smartphone iFruit
  document.querySelectorAll('#phoneModal [data-open]').forEach((btn) => {
    btn.onclick = () => {
      const targetId = btn.getAttribute('data-open');
      document.querySelectorAll('#phoneModal .ifruit-screen').forEach((s) => s.classList.add('hidden'));
      if (el(targetId)) el(targetId).classList.remove('hidden');
      if (targetId === 'phScreenMissions' && window.BrasilMissions) window.BrasilMissions.renderPhoneUI();
      AudioFX.beep(680, 0.05, 'sine', 0.07);
    };
  });
  document.querySelectorAll('#phoneModal [data-back]').forEach((btn) => {
    btn.onclick = () => {
      openPhoneHome();
      AudioFX.beep(520, 0.05, 'sine', 0.07);
    };
  });
  document.querySelectorAll('#phoneModal [data-set-env]').forEach((btn) => {
    btn.onclick = () => {
      const mode = btn.getAttribute('data-set-env');
      save.env = mode;
      persistSave();
      applyEnv(mode);
      const pill = document.querySelector(`#env-pills .pill-btn[data-env="${mode}"]`);
      if (pill) setActivePill('#env-pills', pill);
      el('phoneModal').classList.add('hidden');
      showToast(`🌤️ Iluminação: ${btn.querySelector('b') ? btn.querySelector('b').textContent : mode}`);
    };
  });

  if (el('phCallMustang')) el('phCallMustang').onclick = () => deliverPhoneCar('ford_mustang_gtd', '🏎️ Ford Mustang GTD');
  if (el('phCallLexus')) el('phCallLexus').onclick = () => deliverPhoneCar('lexus_lc_500_wald', '🏁 Lexus LC 500 Wald');
  if (el('phCallSaveiro')) el('phCallSaveiro').onclick = () => deliverPhoneCar('volkswagen_saveiro', '🛻 VW Pickup Azul');
  if (el('phCallSaveiroBrasil')) el('phCallSaveiroBrasil').onclick = () => deliverPhoneCar('saveiro_brasil', '🇧🇷 Saveiro Cross Brasil');
  if (el('phCallGol')) el('phCallGol').onclick = () => deliverPhoneCar('car_gol', '🚗 VW Gol Quadrado');
  if (el('phCallPm')) el('phCallPm').onclick = () => deliverPhoneCar('car_pm', '🚓 Viatura PM-BR');

  if (el('phGoHomeQuick')) {
    el('phGoHomeQuick').onclick = () => {
      el('phoneModal').classList.add('hidden');
      setGpsDestination(SAFEHOUSE_POS.x, SAFEHOUSE_POS.z, '🏠 Minha Casa');
      AudioFX.coin();
    };
  }
  if (el('phGpsHome')) {
    el('phGpsHome').onclick = () => {
      el('phoneModal').classList.add('hidden');
      setGpsDestination(SAFEHOUSE_POS.x, SAFEHOUSE_POS.z, '🏠 Minha Casa');
      AudioFX.coin();
    };
  }
  if (el('phGpsBank')) {
    el('phGpsBank').onclick = () => {
      el('phoneModal').classList.add('hidden');
      setGpsDestination(-177.2, -173.0, '🏧 Caixa Banco 24h');
      AudioFX.coin();
    };
  }
  if (el('phGpsJob')) {
    el('phGpsJob').onclick = () => {
      el('phoneModal').classList.add('hidden');
      setGpsDestination(-177.2, -185.0, '📦 Central Delivery');
      AudioFX.coin();
    };
  }
  if (el('phGoMcEnter')) {
    el('phGoMcEnter').onclick = () => {
      el('phoneModal').classList.add('hidden');
      setGpsDestination(-53.1, 17.2, "McDonald's (Salão)");
      AudioFX.coin();
    };
  }
  if (el('phGoMcDrive')) {
    el('phGoMcDrive').onclick = () => {
      el('phoneModal').classList.add('hidden');
      setGpsDestination(-41.0, 30.0, "McDonald's Drive-Thru");
      AudioFX.coin();
    };
  }
  if (el('phGpsStadium')) {
    el('phGpsStadium').onclick = () => {
      el('phoneModal').classList.add('hidden');
      setGpsDestination(-52.0, -750.0, '🏟️ Estádio Memorial');
      AudioFX.coin();
    };
  }
  if (el('phGpsAirport')) {
    el('phGpsAirport').onclick = () => {
      el('phoneModal').classList.add('hidden');
      setGpsDestination(-560.0, -360.0, '✈️ Aeroporto Internacional');
      AudioFX.coin();
    };
  }
  if (el('phOpenFullMap')) {
    el('phOpenFullMap').onclick = () => {
      el('phoneModal').classList.add('hidden');
      el('minimapBtn').click();
    };
  }
  if (el('phOpenJobApp')) {
    el('phOpenJobApp').onclick = () => {
      el('phoneModal').classList.add('hidden');
      el('jobModal').classList.remove('hidden');
    };
  }

  el('phOpenBank').onclick = () => {
    el('phoneModal').classList.add('hidden');
    refreshMoneyUI();
    el('bankModal').classList.remove('hidden');
  };

  // --- Interações da Casa Própria (Safehouse) ---
  if (el('btnCloseSafehouse')) el('btnCloseSafehouse').onclick = () => el('safehouseModal').classList.add('hidden');
  if (el('btnHouseSleep')) {
    el('btnHouseSleep').onclick = () => {
      player.hp = 100;
      player.stamina = 100;
      player.wanted = 0;
      player.wantedTimer = 0;
      ui.hpFill.style.width = '100%';
      ui.stamFill.style.width = '100%';
      gameClockHours = (gameClockHours + 6.0) % 24.0;
      applyLightingForHour(gameClockHours);
      el('safehouseModal').classList.add('hidden');
      AudioFX.coin();
      showToast('🛏️ Descansou em casa! Vida 100%, Procurado limpo e +6h no relógio.');
    };
  }
  if (el('btnHouseWardrobe')) {
    el('btnHouseWardrobe').onclick = () => {
      selectPlayableCharacter('cool_man', false);
    };
  }
  if (el('btnHouseSpawnCar')) {
    el('btnHouseSpawnCar').onclick = () => {
      const key = save.starterCar || 'lexus_lc_500_wald';
      const gy = getSafeGroundForSpawn(SAFEHOUSE_POS.carX, SAFEHOUSE_POS.carZ, SAFEHOUSE_POS.y);
      spawnVehicle(key, SAFEHOUSE_POS.carX, gy + 0.04, SAFEHOUSE_POS.carZ, 0);
      el('safehouseModal').classList.add('hidden');
      AudioFX.beep(580, 0.12);
      showToast('🚗 Seu veículo foi estacionado na porta de casa!');
    };
  }
  if (el('btnHouseBank')) {
    el('btnHouseBank').onclick = () => {
      el('safehouseModal').classList.add('hidden');
      refreshMoneyUI();
      el('bankModal').classList.remove('hidden');
    };
  }

  // Modais Banco & Delivery
  el('btnCloseBank').onclick = () => el('bankModal').classList.add('hidden');
  el('btnDep500').onclick = () => {
    if (save.cash >= 500) { save.cash -= 500; save.bank += 500; persistSave(); refreshMoneyUI(); AudioFX.coin(); showToast('Depositado R$ 500'); }
    else showToast('Sem dinheiro na carteira!');
  };
  el('btnWith500').onclick = () => {
    if (save.bank >= 500) { save.bank -= 500; save.cash += 500; persistSave(); refreshMoneyUI(); AudioFX.coin(); showToast('Sacado R$ 500'); }
    else showToast('Saldo insuficiente no banco!');
  };
  el('btnDepAll').onclick = () => {
    if (save.cash > 0) { save.bank += save.cash; save.cash = 0; persistSave(); refreshMoneyUI(); AudioFX.coin(); showToast('Tudo depositado!'); }
  };

  el('btnCloseJob').onclick = () => el('jobModal').classList.add('hidden');
  el('btnStartDelivery').onclick = () => { el('jobModal').classList.add('hidden'); startDeliveryMission(); };
  el('btnCancelDelivery').onclick = () => {
    delivery.active = false; delivery.beacon.visible = false;
    ui.missionBanner.classList.add('hidden'); el('jobModal').classList.add('hidden');
    showToast('Entrega cancelada');
  };

  function startDeliveryMission() {
    let found = null;
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 110 + Math.random() * 180;
      const tx = player.pos.x + Math.cos(ang) * dist;
      const tz = player.pos.z + Math.sin(ang) * dist;
      if (getRoadCellAt(tx, tz) < 1) continue;
      const gy = getSafeGroundForSpawn(tx, tz, player.pos.y);
      if (gy !== null && gy >= -26 && gy <= 65) { found = new THREE.Vector3(tx, gy, tz); break; }
    }
    if (!found) found = new THREE.Vector3(player.pos.x + 120, player.pos.y, player.pos.z - 80);
    delivery.active = true;
    delivery.targetPos.copy(found);
    delivery.reward = 500 + Math.floor(Math.random() * 450);
    delivery.beacon.position.set(found.x, found.y + 15, found.z);
    delivery.beacon.visible = true;
    setGpsDestination(found.x, found.z, 'Entrega Delivery');
    ui.missionBanner.classList.remove('hidden');
    ui.missionText.textContent = `Entregue no ponto verde (+R$ ${delivery.reward})`;
    showToast(`📦 Entrega iniciada! Siga o marcador verde no radar!`);
  }

  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyF' || e.code === 'KeyE') { if (player.inCar) exitVehicle(); else if (nearestCar) enterVehicle(nearestCar); }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // --- Inicialização Principal ---
  async function initGame() {
    GtaRadio.loadApiStations();
    try {
      ui.loadStatus.textContent = 'Carregando mapa & sistema de colisão...';
      ui.loadFill.style.width = '18%';

      const [manRes, metaRes, binRes, roadRes] = await Promise.all([
        fetch('models/map/manifest.json'),
        fetch('models/map/collision_meta.json'),
        fetch('models/map/collision_map.bin'),
        fetch('models/map/road_grid.bin')
      ]);
      mapManifest = await manRes.json();
      colMeta = await metaRes.json();
      colGrid = new Int16Array(await binRes.arrayBuffer());
      roadGrid = new Uint8Array(await roadRes.arrayBuffer());
      roadGridN = Math.round(Math.sqrt(roadGrid.length)) || 1024;
      try {
        const floorRes = await fetch('models/map/collision_floor.bin');
        if (floorRes.ok) {
          const fl = new Int16Array(await floorRes.arrayBuffer());
          if (fl.length === colMeta.W * colMeta.H * 2) colFloor = fl;
        }
      } catch (e) {
        console.warn('collision_floor.bin indisponível:', e);
      }
      buildRealMapTexture();

      ui.loadStatus.textContent = 'Carregando Veículos, Personagens e Tráfego...';
      ui.loadFill.style.width = '45%';

      const [coolManScene, npcJobScene, npcDoaScene, trafficPackScene, saveiroScene, saveiroBrasilScene, mustangScene, lexusScene, golScene, pmScene, atmScene, jobScene] = await Promise.all([
        loadGLB('models/chars/cool_man.glb'),
        loadGLB('models/chars/npc_outer_plane.glb'),
        loadGLB('models/chars/doa_npc_fighter.glb'),
        loadGLB('models/vehicles/traffic_rider_npc_vehicles.glb'),
        loadGLB('models/vehicles/vw_pickup_azul.glb'),
        loadGLB('models/vehicles/saveiro_brasil.glb'),
        loadGLB('models/vehicles/ford_mustang_gtd.glb'),
        loadGLB('models/vehicles/lexus_lc_500_wald.glb'),
        loadGLB('models/vehicles/car_gol.glb'),
        loadGLB('models/vehicles/car_pm.glb'),
        loadGLB('models/props/prop_atm.glb'),
        loadGLB('models/props/prop_job.glb')
      ]);

      const carKeep = new Set(['WheelFL', 'WheelFR', 'WheelRL', 'WheelRR', 'DoorL', 'DoorR', 'SteeringWheel', 'LightBlue', 'LightRed', 'HeadL', 'HeadR', 'TailL', 'TailR']);
      // Separa portas articuladas (DoorL e DoorR) no Mustang, Gol e Viatura PM antes de otimizar draw calls!
      ensureArticulatedCarDoors(mustangScene);
      ensureArticulatedCarDoors(golScene);
      ensureArticulatedCarDoors(pmScene);
      mergeStaticMeshesByMaterial(saveiroScene, carKeep);
      mergeStaticMeshesByMaterial(saveiroBrasilScene, carKeep);
      mergeStaticMeshesByMaterial(mustangScene, carKeep);
      mergeStaticMeshesByMaterial(golScene, carKeep);
      mergeStaticMeshesByMaterial(pmScene, carKeep);

      // Desativa castShadow nas NPCs do Job para economizar draw calls no shadow map
      npcJobScene.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      npcDoaScene.traverse((o) => { if (o.isMesh) o.castShadow = false; });

      vehicleTemplates = {
        volkswagen_saveiro: saveiroScene,
        saveiro_brasil: saveiroBrasilScene,
        ford_mustang_gtd: mustangScene,
        lexus_lc_500_wald: normalizeApexVehicleScene(lexusScene, 4.55),
        car_gol: golScene,
        car_pm: pmScene
      };
      citizenTemplates = [];
      trafficTemplates = buildTrafficTemplates(trafficPackScene);
      trafficTemplates.forEach((tt) => {
        if (tt && tt.mesh) tt.mesh.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      });
      npcTemplate = null;
      // NPC 1 (npc_outer_plane.glb) e NPC 2 (doa_npc_fighter.glb) revezam no posto do Job!
      npcJobTemplate = npcJobScene;
      npcDoaTemplate = wrapDoaNpcScene(npcDoaScene);
      buildRoadCells();

      // Personagem Principal fixo no Cool Man (demais personagens ocultos do jogador)
      const coolManBuilt = normalizeCustomCharScene(coolManScene, 1.68);
      playableCharCache.cool_man = coolManBuilt;
      const sp = mapManifest.spawn;
      const groundY = getGroundHeight(sp.x, sp.z) ?? sp.y;
      player.pos.set(sp.x, groundY + 0.1, sp.z);
      applyPlayerMeshObject('cool_man', coolManBuilt);
      requestAnimationFrame(() => captureChar3DThumb('cool_man'));

      ui.loadStatus.textContent = 'Carregando cidade completa (0/' + mapManifest.chunks.length + ')...';
      ui.loadFill.style.width = '55%';
      await preloadAllMapChunks(sp.x, sp.z);
      updateChunkStreaming(sp.x, sp.z);

      // Caixa 24h e Central Delivery reposicionados em cima da CALÇADA real (fora da rua!) virados para a avenida
      const atmX = -177.2, atmZ = -173.0;
      const atmY = getSafeGroundForSpawn(atmX, atmZ, groundY);
      atmScene.position.set(atmX, atmY, atmZ);
      atmScene.rotation.y = Math.PI * 0.5;
      scene.add(atmScene);
      rpProps.push({ type: 'atm', label: 'Banco 24h', pos: atmScene.position, mesh: atmScene });
      extraSolidBoxes.push({ minX: atmX - 0.75, maxX: atmX + 0.75, minZ: atmZ - 0.75, maxZ: atmZ + 0.75 });

      const jobX = -177.2, jobZ = -185.0;
      const jobY = getSafeGroundForSpawn(jobX, jobZ, groundY);
      jobScene.position.set(jobX, jobY, jobZ);
      jobScene.rotation.y = Math.PI * 0.5;
      scene.add(jobScene);
      rpProps.push({ type: 'job', label: 'Central Delivery NPC', pos: jobScene.position, mesh: jobScene });
      extraSolidBoxes.push({ minX: jobX - 0.85, maxX: jobX + 0.85, minZ: jobZ - 0.85, maxZ: jobZ + 0.85 });

      // Casa Própria do Protagonista (Safehouse RP com pórtico iluminado e vaga de garagem na frente!)
      (function buildPlayerSafehouse() {
        const hx = SAFEHOUSE_POS.x, hz = SAFEHOUSE_POS.z;
        const hy = getSafeGroundForSpawn(hx, hz, groundY);
        SAFEHOUSE_POS.y = hy;
        const hGrp = new THREE.Group();
        hGrp.position.set(hx, hy, hz);
        const markerMat = new THREE.MeshBasicMaterial({
          color: 0xffca28,
          transparent: true,
          opacity: 0.52,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 2.4, 18, 1, true), markerMat);
        ring.position.y = 1.2;
        hGrp.add(ring);
        const pad = new THREE.Mesh(
          new THREE.CircleGeometry(1.4, 20).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0xffee58, transparent: true, opacity: 0.75, depthWrite: false })
        );
        pad.position.y = 0.05;
        hGrp.add(pad);
        scene.add(hGrp);
        rpProps.push({ type: 'safehouse', label: 'Minha Casa', pos: hGrp.position, mesh: hGrp });
      })();

      // McDonald's Drive-Thru real em terreno plano aberto ao lado do meio-fio da Av. Sul (-45, 30)
      (function buildMcDonalds() {
        const mcOx = -45.0, mcOz = 30.0;
        const mcScaleXZ = 1.35, mcScaleY = 1.55;
        loadGLB('models/props/mcdonalds_drivethru.glb').then((mcScene) => {
          const mcY = getSafeGroundForSpawn(-53.3, 30.5, groundY);
          mcScene.position.set(mcOx, mcY, mcOz);
          // Rotaciona 180° para entrada do Drive-Thru e placa McDonald's ficarem voltadas para a Av. Sul (Z=14.5)
          mcScene.rotation.y = Math.PI;
          // Escala real para carros de 2.0m passarem folgados na pista (3.9m largura x 2.53m altura livre sob o toldo)
          mcScene.scale.set(mcScaleXZ, mcScaleY, mcScaleXZ);
          mcScene.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = false;
              o.receiveShadow = true;
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              for (const mat of mats) {
                if (!mat) continue;
                // Corrige Z-sorting bugado do EngadineMaccas.002 (alphaMode BLEND deixava paredes invertidas/transparentes)
                if (mat.transparent) {
                  mat.transparent = false;
                  mat.depthWrite = true;
                  mat.alphaTest = 0.25;
                }
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              }
            }
          });
          scene.add(mcScene);
          mcBuildings.push({ mesh: mcScene, x: -53.3, z: 30.5 });
          // Balcão de atendimento a pé (fachada frontal voltada para o meio-fio da avenida)
          const counterPos = new THREE.Vector3(-53.1, getSafeGroundForSpawn(-53.1, 17.2, mcY), 17.2);
          rpProps.push({ type: 'mcdonalds', label: "McDonald's", pos: counterPos, mesh: mcScene });
          // Janela/pista do Drive-Thru (corredor largo de ~3.9m entre os totens de pedido)
          const dtY = getSafeGroundForSpawn(-41.0, 30.0, mcY);
          driveThrus.push({
            pos: new THREE.Vector3(-41.0, dtY, 30.0),
            label: "McDonald's Drive-Thru",
            cooldown: 0
          });
          // Marcação luminosa no chão da pista do Drive-Thru
          const dtRing = new THREE.Mesh(
            new THREE.RingGeometry(1.9, 2.35, 28),
            new THREE.MeshBasicMaterial({ color: 0xffd41f, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
          );
          dtRing.rotation.x = -Math.PI / 2;
          dtRing.position.set(-41.0, dtY + 0.09, 30.0);
          scene.add(dtRing);
        }).catch((e) => console.warn("McDonald's GLB indisponível:", e));
      })();

      // Revezamento automático da NPC do Job na Central Delivery entre NPC 1 (npc_outer_plane) e NPC 2 (doa_npc_fighter)
      jobNpcSwapFn = (turn) => {
        if (jobNpcRef) {
          if (jobNpcRef.mesh && jobNpcRef.mesh.parent) jobNpcRef.mesh.parent.remove(jobNpcRef.mesh);
          const idx = npcs.indexOf(jobNpcRef);
          if (idx >= 0) npcs.splice(idx, 1);
          jobNpcRef = null;
        }
        const useDoa = (turn === 2);
        const spawned = spawnNPC(jobX + 0.4, jobY, jobZ + 2.4, true, { doa: useDoa });
        if (spawned) {
          spawned.yaw = Math.PI * 0.5;
          spawned.mesh.rotation.y = spawned.yaw;
        }
      };
      save.jobNpcTurn = (save.jobNpcTurn === 1 ? 2 : 1);
      persistSave();
      jobNpcSwapFn(save.jobNpcTurn);

      // Sincroniza pills do Lobby com o save
      document.querySelectorAll('#car-pills .pill-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.car === (save.starterCar || 'volkswagen_saveiro'));
      });
      document.querySelectorAll('#paint-swatches .color-swatch').forEach((s) => {
        s.classList.toggle('active', s.dataset.color === (save.paint || '#ffffff'));
      });

      // Veículos alinhados ordenadamente nas faixas de estacionamento da avenida real (sem flutuar!)
      spawnVehicle(save.starterCar || 'volkswagen_saveiro', -172.0, getSafeGroundForSpawn(-172.0, -173.0, groundY) + 0.03, -173.0, 0.0);
      if ((save.starterCar || 'volkswagen_saveiro') !== 'saveiro_brasil') {
        spawnVehicle('saveiro_brasil', -172.0, getSafeGroundForSpawn(-172.0, -165.5, groundY) + 0.03, -165.5, 0.0);
      } else {
        spawnVehicle('volkswagen_saveiro', -172.0, getSafeGroundForSpawn(-172.0, -165.5, groundY) + 0.03, -165.5, 0.0);
      }
      spawnVehicle('ford_mustang_gtd', -172.0, getSafeGroundForSpawn(-172.0, -180.5, groundY) + 0.03, -180.5, 0.0);
      spawnVehicle('lexus_lc_500_wald', -172.0, getSafeGroundForSpawn(-172.0, -188.0, groundY) + 0.03, -188.0, 0.0);
      spawnVehicle('car_pm', -172.0, getSafeGroundForSpawn(-172.0, -195.5, groundY) + 0.03, -195.5, 0.0);

      // Semáforos nativos do mapa funcionando + Tráfego de veículos
      await setupTrafficLightsAndCrosswalks();
      setupTrafficSystem(sp.x, sp.z);

      delivery.beacon = createDeliveryBeacon();
      refreshMoneyUI();
      window.BrasilRPBridge = {
        scene,
        player,
        npcs,
        vehicles,
        trafficCars,
        save,
        persistSave,
        refreshMoneyUI,
        AudioFX,
        vibrate,
        spawnVehicle,
        paintVehicle,
        spawnNPC,
        getSafeGroundForSpawn,
        getRoadCellAt,
        applyEnv,
        roadCells,
        getGameMode: () => gameMode,
        getSoundEnabled: () => soundEnabled,
        showToast,
        setGpsDestination,
        clearGpsDestination,
        createRemoteCharVisual: () => {
          if (!playableCharCache.npc1) return null;
          const mesh = cloneSkinnedObject(playableCharCache.npc1);
          const bones = {};
          const boneInitQ = {};
          mesh.position.set(0, 0, 0);
          mesh.rotation.set(0, 0, 0);
          mesh.updateMatrixWorld(true);
          mesh.traverse((c) => {
            if (c.isMesh) { c.frustumCulled = false; c.castShadow = false; }
            if (c.isBone) {
              bones[c.name] = c;
              boneInitQ[c.name] = c.quaternion.clone();
            }
          });
          return {
            mesh,
            bones,
            boneInitQ,
            phase: Math.random() * 6.28,
            moveBlend: 0,
            airBlend: 0,
            springPos: 0,
            springVel: 0,
            hairSway: 0,
            hairVel: 0,
            blinkTimer: 2.0,
            grounded: true,
            velY: 0,
            armRestZ: 0.38
          };
        },
        animateRemoteChar: (st, dt, walking, sprinting) => {
          if (!st || !st.bones) return;
          st.sprintBlend = sprinting ? 1.0 : 0.0;
          animateJobNpcBones(st, dt, walking);
        },
        createRemoteCarVisual: (idNum) => {
          const keys = ['lexus_lc_500_wald', 'ford_mustang_gtd', 'volkswagen_saveiro', 'car_gol', 'car_pm'];
          const k = keys[Math.abs(idNum || 0) % keys.length];
          const tpl = vehicleTemplates[k];
          if (!tpl) return null;
          const m = tpl.clone(true);
          const wheels = [];
          m.traverse((c) => {
            if (c.isMesh) c.castShadow = false;
            if (['WheelFL', 'WheelFR', 'WheelRL', 'WheelRR'].includes(c.name)) wheels.push(c);
          });
          return { mesh: m, wheels };
        }
      };

      ui.loadFill.style.width = '100%';
      ui.loadStatus.textContent = 'Pronto!';
      setTimeout(() => {
        ui.splash.classList.add('hide');
        setTimeout(() => { ui.splash.style.display = 'none'; }, 550);
        gameMode = 'lobby';
        ui.lobby3d.classList.remove('hidden');
        requestAnimationFrame(loop);
      }, 350);
    } catch (err) {
      ui.loadStatus.textContent = 'Erro: ' + err.message;
      console.error(err);
    }
  }

  let lastTime = performance.now();
  let streamTimer = 0;
  let fpsCount = 0;
  let fpsTimer = 0;
  let lobbyAngle = 0;

  let minimapTimer = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const rawElapsed = now - lastTime;
    if (targetFrameMs > 0 && rawElapsed < targetFrameMs * 0.85) return;
    const dt = Math.min(0.05, rawElapsed / 1000);
    lastTime = now;
    if (oceanWarnCooldown > 0) oceanWarnCooldown -= dt;
    pollGamepad(dt);
    if (window.BrasilAudio && window.BrasilAudio.tick) window.BrasilAudio.tick(dt);
    if (window.BrasilMP && window.BrasilMP.tick) window.BrasilMP.tick(dt);

    fpsCount++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      const dc = renderer.info && renderer.info.render ? renderer.info.render.calls : 0;
      ui.fpsText.textContent = `${Math.round(fpsCount / fpsTimer)} FPS • ${dc} DC`;
      fpsCount = 0;
      fpsTimer = 0;
    }

    stepChunkWarmups();
    updateDestructibleProps(dt);
    updateExplosions(dt);
    streamTimer += dt;
    if (streamTimer > 0.45) {
      streamTimer = 0;
      const px = player.inCar ? player.inCar.pos.x : player.pos.x;
      const pz = player.inCar ? player.inCar.pos.z : player.pos.z;
      updateChunkStreaming(px, pz);
      for (const mb of mcBuildings) {
        mb.mesh.visible = ((mb.x - px) ** 2 + (mb.z - pz) ** 2) < (240 * 240);
      }
      if (jobNpcSwapFn && gameMode === 'playing') {
        jobNpcShiftTimer += 0.45;
        if (jobNpcShiftTimer >= 75 && jobNpcRef && Math.hypot(px - jobNpcRef.homePos.x, pz - jobNpcRef.homePos.z) > 22) {
          jobNpcShiftTimer = 0;
          save.jobNpcTurn = (save.jobNpcTurn === 1 ? 2 : 1);
          persistSave();
          jobNpcSwapFn(save.jobNpcTurn);
        }
      }
    }

    if (gameMode === 'lobby') {
      if (camTouchId === null) lobbyAngle += dt * 0.18;
      const focus = vehicles[0] ? vehicles[0].pos : player.pos;
      const yaw = lobbyAngle + input.camYaw;
      const lDist = Math.max(2.6, 4.8 + input.camZoomOffset);
      camera.position.set(
        focus.x + Math.sin(yaw) * lDist,
        focus.y + 1.65 + input.camPitch * 1.2,
        focus.z + Math.cos(yaw) * lDist
      );
      camera.lookAt(focus.x, focus.y + 0.72, focus.z);
      if (player.mesh && !player.inCar) {
        player.mesh.visible = true;
        player.mesh.position.set(focus.x - 1.75, focus.y, focus.z + 0.85);
        player.mesh.rotation.y = 0.35;
        animateJobNpcBones(player, dt, false);
      }
      updateNPCs(dt);
      updateTraffic(dt);
      updateTrafficLights(dt);
      updateVehiclesVisuals(dt);
      renderer.render(scene, camera);
      return;
    }

    if (isPaused) {
      renderer.render(scene, camera);
      return;
    }

    let jx = input.joyX + (padState.active ? padState.joyX : 0);
    let jy = input.joyY + (padState.active ? padState.joyY : 0);
    if (keys['KeyA']) jx -= 1;
    if (keys['KeyD']) jx += 1;
    if (keys['KeyW']) jy -= 1;
    if (keys['KeyS']) jy += 1;

    updateDayNightCycle(dt);
    const lockFootForAnim = carAccessAnim.active && carAccessAnim.mode === 'exit' && (carAccessAnim.t / carAccessAnim.dur) < 0.72;
    const lockDriveForAnim = carAccessAnim.active && carAccessAnim.mode === 'enter' && (carAccessAnim.t / carAccessAnim.dur) < 0.78;
    if (!player.inCar) {
      if (!lockFootForAnim) updatePlayer(dt, jx, jy);
    } else if (!lockDriveForAnim) {
      updateDrivingApex(dt);
    } else {
      player.inCar.vel.multiplyScalar(0.85);
      player.inCar.speed *= 0.85;
      player.pos.copy(player.inCar.pos);
    }

    updateNPCs(dt);
    updateTraffic(dt);
    updateTrafficLights(dt);
    updateCarAccessAndDriver(dt);
    updateVehiclesVisuals(dt);
    updatePunchFx(dt);
    updateGpsRoadIndicators();
    updateSmoke(dt);
    updateWaterWaves(now * 0.001);
    updateCamera(dt);
    updateDelivery(dt);
    if (window.BrasilMissions && window.BrasilMissions.tick) window.BrasilMissions.tick(dt);
    updateWanted(dt);
    minimapTimer += dt;
    if (minimapTimer >= 0.16) {
      minimapTimer = 0;
      drawMinimap();
    }

    // Atualiza sombra solar acompanhando o jogador
    const spFocus = player.inCar ? player.inCar.pos : player.pos;
    sunLight.position.set(spFocus.x + 48, 78, spFocus.z + 32);
    sunLight.target.position.set(spFocus.x, 0, spFocus.z);

    renderer.render(scene, camera);
  }

  function smoothStep01(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-5, b - a)));
    return t * t * (3 - 2 * t);
  }

  function lerpAngleRad(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function applyDriverPoseBlend(sitBlend, duckBlend, reachHandle, pullDoor, sideSign, steerAngle) {
    const s = Math.max(0, Math.min(1, sitBlend));
    const st = (steerAngle || 0) * 0.45 * s;
    const duck = duckBlend * 0.36;
    const doorLeftArm = sideSign > 0; // LHD (+X) usa braço esquerdo para puxar a porta; RHD (-X) usa direito
    const reachL = doorLeftArm ? (reachHandle * 0.95 + pullDoor * 0.75) : 0;
    const reachR = !doorLeftArm ? (reachHandle * 0.95 + pullDoor * 0.75) : 0;
    const pullSpreadL = doorLeftArm ? pullDoor * 0.65 : 0;
    const pullSpreadR = !doorLeftArm ? pullDoor * 0.65 : 0;

    if (player.isDoa && player.bones && player.bones['pelvis_07']) {
      setBoneWorldDelta(player, 'spine_upper_025', duck, 0, 0);
      setBoneWorldDelta(player, 'leg_left_thigh_08', -1.46 * s, 0, -0.18);
      setBoneWorldDelta(player, 'leg_right_thigh_015', -1.46 * s, 0, 0.18);
      setBoneWorldDelta(player, 'leg_left_knee_09', 1.48 * s, 0, 0);
      setBoneWorldDelta(player, 'leg_right_knee_016', 1.48 * s, 0, 0);
      setBoneWorldDelta(player, 'arm_left_shoulder_2_0266', (-0.88 + st) * s - reachL, 0, -0.52 - pullSpreadL);
      setBoneWorldDelta(player, 'arm_right_shoulder_2_0292', (-0.88 - st) * s - reachR, 0, 0.52 + pullSpreadR);
      setBoneWorldDelta(player, 'arm_left_elbow_0267', -0.48 * s - reachL * 0.35, 0, 0);
      setBoneWorldDelta(player, 'arm_right_elbow_0293', -0.48 * s - reachR * 0.35, 0, 0);
    } else if (player.isCustomChar && player.customRig) {
      const r = player.customRig;
      if (r.spine) setBoneWorldDelta(player, r.spine, duck * 0.6, 0, 0);
      if (r.chest) setBoneWorldDelta(player, r.chest, duck * 0.5, 0, 0);
      if (r.thighL) setBoneWorldDelta(player, r.thighL, -1.46 * s, 0, 0);
      if (r.thighR) setBoneWorldDelta(player, r.thighR, -1.46 * s, 0, 0);
      if (r.calfL) setBoneWorldDelta(player, r.calfL, 1.48 * s, 0, 0);
      if (r.calfR) setBoneWorldDelta(player, r.calfR, 1.48 * s, 0, 0);
      if (r.armL) setBoneWorldDelta(player, r.armL, (-0.86 + st) * s - reachL, 0, 0.12 + pullSpreadL);
      if (r.armR) setBoneWorldDelta(player, r.armR, (-0.86 - st) * s - reachR, 0, -0.12 - pullSpreadR);
      if (r.foreL) setBoneWorldDelta(player, r.foreL, -0.46 * s - reachL * 0.3, 0, 0);
      if (r.foreR) setBoneWorldDelta(player, r.foreR, -0.46 * s - reachR * 0.3, 0, 0);
    } else if (player.bones && player.bones.Hips) {
      setBoneDelta(player, 'Spine', duck * 0.55, 0, 0);
      setBoneDelta(player, 'Chest', duck * 0.45, 0, 0);
      setBoneDelta(player, 'ThighL', -1.46 * s, 0, 0);
      setBoneDelta(player, 'ThighR', -1.46 * s, 0, 0);
      setBoneDelta(player, 'ShinL', 1.48 * s, 0, 0);
      setBoneDelta(player, 'ShinR', 1.48 * s, 0, 0);
      setBoneDelta(player, 'UpperArmL', (-0.88 + st) * s - reachL, 0, 0.22 + pullSpreadL);
      setBoneDelta(player, 'UpperArmR', (-0.88 - st) * s - reachR, 0, -0.22 - pullSpreadR);
      setBoneDelta(player, 'ForeArmL', -0.46 * s - reachL * 0.3, 0, 0.15);
      setBoneDelta(player, 'ForeArmR', -0.46 * s - reachR * 0.3, 0, -0.15);
    }
  }

  // Animação completa de Entrar no Carro + Fechar a Porta / Sair do Carro + Fechar a Porta + Motorista ao Volante
  function updateCarAccessAndDriver(dt) {
    if (carAccessAnim.active && carAccessAnim.car) {
      const ca = carAccessAnim;
      const car = ca.car;
      ca.t += dt;
      const u = Math.min(1, ca.t / ca.dur);

      const seat = (car.parts && car.parts.driverSeatOffset) ? car.parts.driverSeatOffset : { x: 0.36, y: 0.12, z: -0.05 };
      const sideSign = seat.x >= 0 ? 1 : -1;
      const sinY = Math.sin(car.yaw), cosY = Math.cos(car.yaw);

      const seatWX = car.pos.x + seat.x * cosY + seat.z * sinY;
      const seatWY = car.pos.y + seat.y;
      const seatWZ = car.pos.z - seat.x * sinY + seat.z * cosY;

      const standLocalX = sideSign * 1.44;
      const standLocalZ = seat.z - 0.05;
      const standWX = car.pos.x + standLocalX * cosY + standLocalZ * sinY;
      const standWZ = car.pos.z - standLocalX * sinY + standLocalZ * cosY;
      const standWY = getWalkableGround(standWX, standWZ, car.pos.y, 1.5) ?? car.pos.y;
      const faceDoorYaw = car.yaw - sideSign * (Math.PI * 0.5);

      if (ca.mode === 'enter') {
        if (u >= 0.08 && !ca.latchPlayed) {
          ca.latchPlayed = true;
          AudioFX.doorLatch();
        }
        // Curva da porta: abre (0.08..0.34), mantém aberta p/ entrar (0.34..0.70), puxa fechando (0.70..0.95)
        let dAng = 0;
        if (u < 0.34) {
          dAng = smoothStep01(0.08, 0.34, u) * 1.08;
        } else if (u < 0.70) {
          dAng = 1.08;
        } else if (u < 0.95) {
          const k = (u - 0.70) / 0.25;
          dAng = (1.0 - k * k) * 1.08;
        } else {
          dAng = 0;
          if (!ca.slamPlayed) {
            ca.slamPlayed = true;
            AudioFX.doorSlam();
            car.roll = (car.roll || 0) - sideSign * 0.042;
            vibrate(38);
            GtaRadio.showBanner();
            if (!isPaused) GtaRadio.start();
          }
        }
        car.driverDoorAnimAngle = dAng;

        if (player.mesh) {
          player.mesh.visible = !player.firstPersonCar || u < 0.68;
          if (u < 0.28) {
            // Fase 1: aproxima da porta caminhando e estica a mão na maçaneta
            const w = smoothStep01(0.0, 0.28, u);
            const px = ca.startX + (standWX - ca.startX) * w;
            const py = ca.startY + (standWY - ca.startY) * w;
            const pz = ca.startZ + (standWZ - ca.startZ) * w;
            player.mesh.scale.setScalar(1.0);
            player.mesh.position.set(px, py, pz);
            player.mesh.rotation.set(0, lerpAngleRad(ca.startYaw, faceDoorYaw, w), 0);
            const distMove = Math.hypot(standWX - ca.startX, standWZ - ca.startZ);
            if (distMove > 0.25 && u < 0.20) {
              animateJobNpcBones(player, dt * 1.4, true);
            } else {
              applyDriverPoseBlend(0, 0, smoothStep01(0.08, 0.26, u), 0, sideSign, 0);
            }
          } else {
            // Fase 2 & 3: abaixa a cabeça sob o teto, entra deslizando para o assento e puxa a porta fechando
            const enterW = smoothStep01(0.28, 0.70, u);
            const duck = Math.sin(enterW * Math.PI);
            const px = standWX + (seatWX - standWX) * enterW;
            const py = standWY + (seatWY - standWY) * enterW - duck * 0.14;
            const pz = standWZ + (seatWZ - standWZ) * enterW;
            const sc = 1.0 + (0.76 - 1.0) * enterW;
            player.mesh.scale.setScalar(sc);
            player.mesh.position.set(px, py, pz);
            const bodyYaw = lerpAngleRad(faceDoorYaw, car.yaw, smoothStep01(0.34, 0.72, u));
            player.mesh.rotation.set((car.pitch || 0) * enterW, bodyYaw, -(car.roll || 0) * enterW);

            const pullBlend = (u >= 0.68 && u < 0.95) ? Math.sin(((u - 0.68) / 0.27) * Math.PI) : 0;
            applyDriverPoseBlend(enterW, duck, 0, pullBlend, sideSign, car.steerAngle);
          }
        }

        if (u >= 1.0) {
          ca.active = false;
          car.driverDoorAnimAngle = 0;
        }
        return;
      } else {
        // MODO SAIR DO CARRO: abre a porta (0..0.24), sai do banco p/ calçada (0.24..0.70), bate a porta fechando (0.70..0.96)
        let dAng = 0;
        if (u < 0.24) {
          dAng = smoothStep01(0.0, 0.24, u) * 1.06;
        } else if (u < 0.70) {
          dAng = 1.06;
        } else if (u < 0.96) {
          const k = (u - 0.70) / 0.26;
          dAng = (1.0 - k * k) * 1.06;
        } else {
          dAng = 0;
          if (!ca.slamPlayed) {
            ca.slamPlayed = true;
            AudioFX.doorSlam();
            car.roll = (car.roll || 0) + sideSign * 0.036;
            vibrate(32);
          }
        }
        car.driverDoorAnimAngle = dAng;

        const outW = smoothStep01(0.20, 0.68, u);
        const sitBlend = 1.0 - outW;
        const duck = Math.sin(outW * Math.PI);

        if (u >= 0.70 && player.inCar === car) {
          player.inCar = null;
          player.pos.set(standWX, standWY + 0.05, standWZ);
          player.yaw = car.yaw + Math.PI;
          resolveMapWallCollision(player.pos, 0.55);
        }

        if (player.mesh && player.inCar === car) {
          player.mesh.visible = true;
          const px = seatWX + (standWX - seatWX) * outW;
          const py = seatWY + (standWY - seatWY) * outW - duck * 0.13;
          const pz = seatWZ + (standWZ - seatWZ) * outW;
          player.mesh.scale.setScalar(0.76 + (1.0 - 0.76) * outW);
          player.mesh.position.set(px, py, pz);
          const outYaw = lerpAngleRad(car.yaw, faceDoorYaw + Math.PI, outW);
          player.mesh.rotation.set(0, outYaw, 0);
          const pushDoor = u < 0.26 ? smoothStep01(0.0, 0.24, u) : 0;
          applyDriverPoseBlend(sitBlend, duck, 0, pushDoor, sideSign, 0);
        } else if (player.mesh && u < 0.95) {
          player.mesh.scale.setScalar(1.0);
          // Empurra brevemente a porta para fechar antes de liberar pose normal
          const pushBack = Math.sin(((u - 0.70) / 0.25) * Math.PI);
          applyDriverPoseBlend(0, 0, pushBack * 0.55, 0, sideSign, 0);
        }

        if (u >= 1.0) {
          ca.active = false;
          car.driverDoorAnimAngle = 0;
          if (player.mesh) player.mesh.scale.setScalar(1.0);
        }
        return;
      }
    }

    const car = player.inCar;
    if (!car || !player.mesh) return;
    player.mesh.visible = !player.firstPersonCar;
    if (!player.mesh.visible) return;
    const seat = (car.parts && car.parts.driverSeatOffset) ? car.parts.driverSeatOffset : { x: 0.35, y: -0.31, z: -0.22 };
    car.mesh.updateMatrixWorld(true);
    const bodyRef = (car.parts && car.parts.chassis) ? car.parts.chassis : car.mesh;
    if (!window._seatWorldPos) {
      window._seatWorldPos = new THREE.Vector3();
      window._seatWorldQuat = new THREE.Quaternion();
    }
    window._seatWorldPos.set(seat.x, seat.y, seat.z).applyMatrix4(bodyRef.matrixWorld);
    bodyRef.getWorldQuaternion(window._seatWorldQuat);
    player.mesh.scale.setScalar(0.76);
    player.mesh.position.copy(window._seatWorldPos);
    player.mesh.quaternion.copy(window._seatWorldQuat);
    applyDriverPoseBlend(1.0, 0, 0, 0, seat.x >= 0 ? 1 : -1, car.steerAngle);
  }

  // Colisão OBB retangular orientada (impede atravessar capô, portas e porta-malas de veículos!)
  function resolveEntityCarOBB(pos, radius, carPos, carYaw, halfW = 1.00, halfL = 2.28) {
    if (Math.abs(pos.y - carPos.y) > 2.2) return false;
    const dx = pos.x - carPos.x;
    const dz = pos.z - carPos.z;
    if (dx * dx + dz * dz > (halfL + radius + 0.6) * (halfL + radius + 0.6)) return false;
    const cosY = Math.cos(carYaw), sinY = Math.sin(carYaw);
    // Projeta no espaço local do carro (lx = lateral, lz = longitudinal)
    const lx = dx * cosY - dz * sinY;
    const lz = dx * sinY + dz * cosY;
    const clx = Math.max(-halfW, Math.min(halfW, lx));
    const clz = Math.max(-halfL, Math.min(halfL, lz));
    let ox = lx - clx;
    let oz = lz - clz;
    const distSq = ox * ox + oz * oz;
    if (distSq >= radius * radius) return false;
    let nlx, nlz, pen;
    if (distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      nlx = ox / dist;
      nlz = oz / dist;
      pen = radius - dist;
    } else {
      const penX = halfW - Math.abs(lx) + radius;
      const penZ = halfL - Math.abs(lz) + radius;
      if (penX < penZ) { nlx = lx >= 0 ? 1 : -1; nlz = 0; pen = penX; }
      else { nlx = 0; nlz = lz >= 0 ? 1 : -1; pen = penZ; }
    }
    const wx = nlx * cosY + nlz * sinY;
    const wz = -nlx * sinY + nlz * cosY;
    pos.x += wx * pen;
    pos.z += wz * pen;
    return true;
  }
  function updateWaterWaves(timeSec) {
    seaTex.offset.x = (timeSec * 0.022) % 1;
    seaTex.offset.y = (timeSec * 0.015) % 1;
    seaNormalTex.offset.x = (timeSec * -0.031) % 1;
    seaNormalTex.offset.y = (timeSec * 0.024) % 1;
    for (const sm of seaMeshes) {
      sm.mesh.position.y = WATER_Y + Math.sin(timeSec * 1.4) * 0.10;
    }
  }

  function respawnAtHospital(reason = 'Atendido no Hospital!') {
    if (player.inCar) exitVehicle();
    player.hp = 100;
    player.stamina = 100;
    player.wanted = 0;
    player.velX = 0;
    player.velZ = 0;
    player.velY = 0;
    player.waterTimer = 0;
    ui.hpFill.style.width = '100%';
    ui.stamFill.style.width = '100%';
    const sp = mapManifest ? mapManifest.spawn : { x: -180, y: 1, z: -179 };
    const gy = getGroundHeight(sp.x, sp.z) ?? sp.y;
    player.pos.set(sp.x, gy + 0.25, sp.z);
    if (vehicles[0]) {
      const carGy = getGroundHeight(sp.x + 3.2, sp.z + 6.0) ?? gy;
      vehicles[0].pos.set(sp.x + 3.2, carGy + 0.08, sp.z + 6.0);
      vehicles[0].vel.set(0, 0, 0);
      vehicles[0].velY = 0;
      vehicles[0].speed = 0;
      vehicles[0].hp = 100;
      vehicles[0].broken = false;
      vehicles[0].burning = false;
      vehicles[0].exploded = false;
      vehicles[0].waterTimer = 0;
      vehicles[0].lastSafePos = vehicles[0].pos.clone();
    }
    const fee = Math.min(save.cash, 50);
    save.cash -= fee;
    persistSave();
    refreshMoneyUI();
    AudioFX.ring();
    vibrate(80);
    showToast(`🏥 ${reason} Spawn no Hospital! (-R$ ${fee})`, 3400);
  }

  const GTA = {
    walkSpeed: 1.7,      // joystick pouco inclinado
    runSpeed: 3.8,       // joystick no máximo (corrida padrão, como no GTA)
    sprintSpeed: 5.6,    // botão de sprint
    walkStick: 0.45,     // inclinação em que chega na velocidade de andar
    runStick: 0.85,      // inclinação em que chega na velocidade de corrida
    strideBase: 1.3,     // passos: maior = passos mais lentos e longos
    stridePerMs: 0.45,   // o comprimento do passo cresce com a velocidade
    camFollowRate: 9,    // câmera: menor = mais atraso e mais peso
    camFollowRateY: 6,   // atraso vertical (pulos e degraus)
    sprintFovBoost: 8,   // graus de FOV extra no sprint (0 desliga)
  };

  function updatePlayer(dt, jx, jy) {
    const mag = Math.min(1, Math.hypot(jx, jy));
    const isSprinting = (input.sprint || keys['ShiftLeft']) && player.stamina > 5 && mag > 0.2;
    let speed;
    if (isSprinting) speed = GTA.sprintSpeed * Math.max(0.6, mag);
    else if (mag < GTA.walkStick) speed = GTA.walkSpeed * (mag / GTA.walkStick);
    else {
      const t = Math.min(1, (mag - GTA.walkStick) / (GTA.runStick - GTA.walkStick));
      speed = GTA.walkSpeed + (GTA.runSpeed - GTA.walkSpeed) * (t * t * (3 - 2 * t));
    }

    if (isSprinting) player.stamina = Math.max(0, player.stamina - 18 * dt);
    else player.stamina = Math.min(100, player.stamina + 14 * dt);
    const stamInt = Math.round(player.stamina);
    if (stamInt !== ui._lastStamInt) {
      ui._lastStamInt = stamInt;
      ui.stamFill.style.width = stamInt + '%';
    }

    if (player.velX === undefined) { player.velX = 0; player.velZ = 0; player.turnLean = 0; player.sprintBlend = 0; }
    player.sprintBlend += ((isSprinting ? 1 : 0) - player.sprintBlend) * Math.min(1, dt * 8.0);

    let targetVx = 0, targetVz = 0;
    let yawDiffForLean = 0;
    if (mag > 0.08) {
      const moveAngle = Math.atan2(-jx, -jy) + input.camYaw;
      const dirX = -Math.sin(moveAngle);
      const dirZ = -Math.cos(moveAngle);
      targetVx = dirX * speed;
      targetVz = dirZ * speed;

      let diff = moveAngle - player.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yawDiffForLean = diff;
      const turnRate = isSprinting ? 7.2 : 9.8;
      player.yaw += diff * Math.min(1, dt * turnRate);
    } else if (player.firstPersonFoot) {
      let diff = input.camYaw - player.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.yaw += diff * Math.min(1, dt * 12);
    }

    // Física estilo GTA 5: aceleração responsiva e desaceleração com peso/inércia
    const rate = mag > 0.08 ? 13.5 : 9.5;
    player.velX += (targetVx - player.velX) * Math.min(1, dt * rate);
    player.velZ += (targetVz - player.velZ) * Math.min(1, dt * rate);
    const curHorizSpeed = Math.hypot(player.velX, player.velZ);

    if (curHorizSpeed > 0.02) {
      player.pos.x += player.velX * dt;
      player.pos.z += player.velZ * dt;
      resolveMapWallCollision(player.pos, 0.65);
    }

    const targetLean = Math.max(-0.18, Math.min(0.18, yawDiffForLean * Math.min(1, curHorizSpeed / 8.0) * 0.25));
    player.turnLean += (targetLean - player.turnLean) * Math.min(1, dt * 10.0);

    if (curHorizSpeed > 0.35) {
      player.walkPhase += dt * (3.2 + curHorizSpeed * 0.85);
      const swing = Math.sin(player.walkPhase) * (0.42 + player.sprintBlend * 0.33);
      if (player.parts.LegL) player.parts.LegL.rotation.x = swing;
      if (player.parts.LegR) player.parts.LegR.rotation.x = -swing;
      if (player.parts.ArmL) player.parts.ArmL.rotation.x = -swing * 0.85;
      if (player.parts.ArmR) player.parts.ArmR.rotation.x = swing * 0.85;
    } else {
      ['LegL', 'LegR', 'ArmL', 'ArmR'].forEach((k) => { if (player.parts[k]) player.parts[k].rotation.x *= 0.82; });
    }

    if (player.punchAnim && player.punchAnim > 0) {
      const maxDur = player.punchCombo === 2 ? 0.34 : 0.26;
      player.punchAnim = Math.max(0, player.punchAnim - dt);
      const pT = Math.sin((player.punchAnim / maxDur) * Math.PI);
      const isLeft = player.punchCombo === 1;
      if (player.parts.ArmR && !isLeft) player.parts.ArmR.rotation.x = -1.75 * pT;
      if (player.parts.ArmL && isLeft) player.parts.ArmL.rotation.x = -1.75 * pT;
    }

    for (const n of npcs) {
      const dx = player.pos.x - n.pos.x;
      const dz = player.pos.z - n.pos.z;
      const d = Math.hypot(dx, dz);
      const minD = 0.85;
      if (d > 0.001 && d < minD) {
        const push = minD - d;
        player.pos.x += (dx / d) * push * 0.65;
        player.pos.z += (dz / d) * push * 0.65;
        if (!n.isJobNpc) { n.pos.x -= (dx / d) * push * 0.35; n.pos.z -= (dz / d) * push * 0.35; }
      }
    }

    for (const v of vehicles) {
      resolveEntityCarOBB(player.pos, 0.46, v.pos, v.yaw, 0.98, 2.28);
    }

    for (const tc of trafficCars) {
      if (resolveEntityCarOBB(player.pos, 0.46, tc.pos, tc.yaw, 0.98, Math.max(2.1, tc.radius * 1.15))) {
        if (tc.speed > 5.0) tc.speed *= 0.2;
      }
    }

    if ((input.jumpPressed || keys['Space']) && player.grounded) { player.velY = 8.2; player.grounded = false; }
    input.jumpPressed = false;

    const gy = getWalkableGround(player.pos.x, player.pos.z, player.pos.y);
    const inWater = isOutsideIsland(player.pos.x, player.pos.z) && player.pos.y <= WATER_Y + 0.35;

    if (inWater) {
      const waveH = Math.sin(player.pos.x * 0.025 + performance.now() * 0.0018) * 0.14 + Math.cos(player.pos.z * 0.028 + performance.now() * 0.0014) * 0.12;
      const surfY = WATER_Y + waveH - 0.52;
      player.velY += (surfY - player.pos.y) * 12 * dt;
      player.velY *= 0.84;
      player.pos.y += player.velY * dt;
      player.grounded = true;
      player.mesh.rotation.x = mag > 0.08 ? 0.36 : 0.0;
      if (mag > 0.08) {
        const swimSwing = Math.sin(player.walkPhase * 1.3) * 0.95;
        if (player.parts.ArmL) player.parts.ArmL.rotation.x = -1.35 + swimSwing;
        if (player.parts.ArmR) player.parts.ArmR.rotation.x = -1.35 - swimSwing;
        if (player.parts.LegL) player.parts.LegL.rotation.x = -swimSwing * 0.65;
        if (player.parts.LegR) player.parts.LegR.rotation.x = swimSwing * 0.65;
      } else {
        if (player.parts.ArmL) player.parts.ArmL.rotation.x = -0.35 + Math.sin(performance.now() * 0.003) * 0.15;
        if (player.parts.ArmR) player.parts.ArmR.rotation.x = -0.35 - Math.sin(performance.now() * 0.003) * 0.15;
      }
      clampOceanBounds(player.pos);
      player.waterTimer = (player.waterTimer || 0) + dt;
      if (player.waterTimer > 1.8) {
        respawnAtHospital('Caiu no mar!');
        return;
      }
    } else {
      player.waterTimer = 0;
      player.mesh.rotation.x = 0;
      clampOceanBounds(player.pos);
      player.velY -= 22 * dt;
      player.pos.y += player.velY * dt;

      if (gy !== null && player.pos.y <= gy + 0.08 && player.velY <= 0) {
        if (player.velY < -14) {
          const fallDmg = Math.min(80, Math.round((Math.abs(player.velY) - 13) * 6));
          player.hp = Math.max(0, player.hp - fallDmg);
          ui.hpFill.style.width = player.hp + '%';
          vibrate(70);
          if (player.hp <= 0) {
            respawnAtHospital('Você morreu na queda!');
            return;
          }
        }
        player.pos.y = gy; player.velY = 0; player.grounded = true;
      } else if (gy === null && player.pos.y < -15.5) {
        respawnAtHospital('Caiu no mar!');
        return;
      } else if (player.pos.y < -36) {
        respawnAtHospital('Caiu fora do mapa!');
        return;
      }
    }

    player.mesh.position.copy(player.pos);
    // npc_outer_plane.glb tem o rosto voltado para +Z em Three.js, então somamos Math.PI para andar sempre de frente!
    player.mesh.rotation.y = player.yaw + Math.PI;
    player.mesh.rotation.z = inWater ? 0 : (player.turnLean || 0);
    const phaseRate = (Math.PI * 2 * curHorizSpeed) / (GTA.strideBase + GTA.stridePerMs * curHorizSpeed);
    const animTimeScale = curHorizSpeed > 0.35 ? Math.max(0.6, phaseRate / 6.4) : 1.0;
    animateJobNpcBones(player, dt * animTimeScale, curHorizSpeed > 0.35);

    nearestCar = null;
    let bestCDist = 4.3;
    for (const v of vehicles) {
      const d = v.pos.distanceTo(player.pos);
      if (d < bestCDist) { bestCDist = d; nearestCar = v; }
    }
    ui.btnEnterCar.classList.toggle('hidden', !nearestCar);

    nearestProp = null;
    let bestPDist = 3.8;
    for (const p of rpProps) {
      const d = p.pos.distanceTo(player.pos);
      if (d < bestPDist) { bestPDist = d; nearestProp = p; }
    }
    if (jobNpcRef && jobNpcRef.followingPlayer && !jobNpcRef.dead) {
      const dn = jobNpcRef.pos.distanceTo(player.pos);
      if (dn < 4.5) {
        nearestProp = { type: 'job_npc', npc: jobNpcRef };
      }
    }
    ui.btnInteract.classList.toggle('hidden', !nearestProp);
  }

  function updateDrivingApex(dt) {
    const car = player.inCar;
    const fSign = car.forwardSign || -1;
    const gas = input.gas || padState.gas || keys['KeyW'] || keys['ArrowUp'];
    const brake = input.brake || padState.brake || keys['KeyS'] || keys['ArrowDown'];
    const left = input.left || keys['KeyA'] || keys['ArrowLeft'];
    const right = input.right || keys['KeyD'] || keys['ArrowRight'];
    const drift = input.drift || padState.drift || keys['Space'];
    const nitroBtn = input.nitro || padState.nitro || keys['ShiftLeft'];

    if (save.steerMode === 'gyro') {
      input.gyroSteer += (input.gyroTarget - input.gyroSteer) * Math.min(1, dt * 14.0);
    } else {
      input.gyroSteer = 0;
    }
    const targetSteer = padState.active && Math.abs(padState.steer) > 0.05
      ? -padState.steer
      : (save.steerMode === 'gyro'
          ? Math.max(-1, Math.min(1, input.gyroSteer + (left ? 1 : 0) - (right ? 1 : 0)))
          : ((left ? 1 : 0) - (right ? 1 : 0)));
    car.steerAngle += (targetSteer - car.steerAngle) * Math.min(1, dt * 11.0);

    const forwardDir = new THREE.Vector3(Math.sin(car.yaw) * fSign, 0, Math.cos(car.yaw) * fSign);
    const rightDir = new THREE.Vector3(forwardDir.z, 0, -forwardDir.x);

    const forwardSpeed = car.vel.dot(forwardDir);
    const lateralSpeed = car.vel.dot(rightDir);
    const speedKmh = Math.abs(forwardSpeed) * 3.6;

    // Nitro igual ao Apex Overdrive 3D
    car.nitroActive = Boolean(nitroBtn && car.nitro > 1.0 && gas && forwardSpeed > 3.0);
    if (car.nitroActive) {
      car.nitro = Math.max(0, car.nitro - 24.0 * dt);
      if (Math.random() < 0.35) vibrate(12);
    } else {
      car.nitro = Math.min(100, car.nitro + (4.0 + Math.abs(lateralSpeed) * 0.45) * dt);
    }
    ui.screenFx.classList.toggle('nitro-active', car.nitroActive);

    const topMs = car.nitroActive ? car.maxTopSpeedMs * 1.22 : car.maxTopSpeedMs;
    const throttleAmt = (padState.active && padState.gasAmount > 0.05 && !input.gas && !keys['KeyW'] && !keys['ArrowUp'])
      ? padState.gasAmount
      : (gas ? 1.0 : 0.0);
    let accelForce = 0;
    let holdStopped = false;
    if (!car.broken) {
      if (gas) {
        car.inReverseGear = false;
        car.reverseHoldTimer = 0;
        if (forwardSpeed < -0.3) {
          // Estava dando ré: freia a ré primeiro antes de ir pra frente
          accelForce = 32.0;
        } else {
          const speedRatio = Math.min(1, Math.max(0, forwardSpeed / topMs));
          accelForce = car.accelPower * throttleAmt * (1.0 - speedRatio * 0.68) * (car.nitroActive ? 1.48 : 1.0);
        }
      } else if (brake) {
        if (forwardSpeed > 0.38) {
          // Indo para frente: FREIA ATÉ PARAR (sem engatar ré automaticamente!)
          car.inReverseGear = false;
          car.reverseHoldTimer = 0;
          accelForce = -34.0;
          if (forwardSpeed + accelForce * dt <= 0.12) {
            car.vel.set(0, 0, 0);
            accelForce = 0;
            holdStopped = true;
          }
        } else if (!car.inReverseGear) {
          // Carro parou: segura 100% parado por 0.55s antes de engatar a marcha à ré!
          car.vel.set(0, 0, 0);
          accelForce = 0;
          holdStopped = true;
          car.reverseHoldTimer = (car.reverseHoldTimer || 0) + dt;
          if (car.reverseHoldTimer >= 0.55) {
            car.inReverseGear = true;
          }
        } else {
          // Marcha à ré engatada de forma suave e controlada (~40 km/h máx)
          const maxRevMs = 11.2;
          const revRatio = Math.min(1, Math.max(0, -forwardSpeed / maxRevMs));
          accelForce = -11.0 * (1.0 - revRatio * 0.85);
        }
      } else {
        // Sem gás nem freio: se estiver parado, deixa pronto para engatar ré rápido num segundo toque
        if (Math.abs(forwardSpeed) <= 0.45) {
          car.reverseHoldTimer = 0.40;
          if (Math.abs(forwardSpeed) < 0.12) car.vel.set(0, 0, 0);
        } else {
          car.reverseHoldTimer = 0;
          if (forwardSpeed > 0.5) car.inReverseGear = false;
        }
      }
    }
    if (drift && forwardSpeed > 6.0) accelForce -= 12.0;

    // Gravidade longitudinal suave em ladeiras/escadas (não puxa quando segurando o freio parado!)
    if (!holdStopped && car.grounded && Math.abs(car.slopePitch || 0) > 0.04) {
      accelForce += Math.sin(car.slopePitch) * fSign * 5.2;
    }

    if (!holdStopped) {
      car.vel.addScaledVector(forwardDir, accelForce * dt);
      const drag = 0.0052 * car.vel.length() + 0.22;
      car.vel.multiplyScalar(Math.max(0, 1.0 - drag * dt));
    }

    const steerSensitivity = Math.abs(forwardSpeed) < 0.25 ? 0 : Math.min(1.0, Math.abs(forwardSpeed) / 2.2);
    const driftMultiplier = drift ? 1.48 : 1.0;
    const turnRate = (car.turnRate || 2.15) * (1.0 / (1.0 + speedKmh * 0.0055)) * driftMultiplier;
    const dirSign = forwardSpeed >= -0.25 ? 1.0 : -1.0;

    car.yaw += car.steerAngle * turnRate * steerSensitivity * dirSign * dt;

    forwardDir.set(Math.sin(car.yaw) * fSign, 0, Math.cos(car.yaw) * fSign);
    rightDir.set(forwardDir.z, 0, -forwardDir.x);

    const newForwardSpeed = car.vel.dot(forwardDir);
    const newLateralSpeed = car.vel.dot(rightDir);
    const lateralGrip = drift ? 3.2 : 16.5;
    const dampedLateral = newLateralSpeed * Math.max(0, 1.0 - lateralGrip * dt);

    car.vel.copy(forwardDir).multiplyScalar(newForwardSpeed).addScaledVector(rightDir, dampedLateral);
    const hitMapWall = resolveVehicleMapCollision(car, dt, forwardDir);
    car.speed = car.vel.dot(forwardDir);

    // Fumaça de pneu no drift ou fumaça do motor se danificado
    const slipFactor = Math.abs(dampedLateral) / (Math.abs(newForwardSpeed) + 4.0);
    if ((slipFactor > 0.24 || (drift && speedKmh > 30)) && speedKmh > 25) {
      const rearL = new THREE.Vector3().copy(car.pos).addScaledVector(forwardDir, -1.35).addScaledVector(rightDir, -0.75);
      const rearR = new THREE.Vector3().copy(car.pos).addScaledVector(forwardDir, -1.35).addScaledVector(rightDir, 0.75);
      spawnSmoke(rearL, car.vel);
      spawnSmoke(rearR, car.vel);
    }
    if (car.dmgCooldown > 0) car.dmgCooldown = Math.max(0, car.dmgCooldown - dt);
    if (car.hp < 50 && !car.exploded && Math.random() < (car.hp < 22 ? 0.65 : 0.32)) {
      const hoodPos = new THREE.Vector3().copy(car.pos).addScaledVector(forwardDir, 1.4).add(new THREE.Vector3(0, 0.75, 0));
      spawnSmoke(hoodPos, car.vel);
    }

    function applyCarDamage(impactKmh) {
      if (impactKmh < 32 || car.broken || car.burning || car.dmgCooldown > 0) return;
      car.dmgCooldown = 0.45;
      const dmg = Math.min(14, (impactKmh - 28) * 0.14);
      car.hp = Math.max(0, car.hp - dmg);
      if (car.hp <= 0 && !car.burning && !car.exploded) {
        car.burning = true;
        car.burnTimer = 1.6;
        car.nitroActive = false;
        showToast('🔥 Motor pegando fogo! Saia do carro!', 2200);
      }
    }

    if (hitMapWall) {
      if (speedKmh > 26) {
        AudioFX.crash(); vibrate(55);
        applyCarDamage(speedKmh);
        car.pitchVel = (car.pitchVel || 0) + Math.min(1.8, speedKmh * 0.015);
        camShakeTimer = Math.max(camShakeTimer, 0.28);
        camShakePower = Math.max(camShakePower, Math.min(0.45, speedKmh * 0.004));
      }
      car.vel.multiplyScalar(0.76);
    }
    clampOceanBounds(car.pos, car.vel);

    // Sistema Drive-Thru McDonald's
    for (const dtz of driveThrus) {
      if (dtz.cooldown > 0) dtz.cooldown -= dt;
      if (dtz.cooldown <= 0 && speedKmh < 30 && Math.hypot(car.pos.x - dtz.pos.x, car.pos.z - dtz.pos.z) < 6.5) {
        dtz.cooldown = 16.0;
        if (save.cash >= 30) {
          save.cash -= 30;
          player.hp = 100;
          ui.hpFill.style.width = '100%';
          persistSave(); refreshMoneyUI();
          AudioFX.coin();
          showToast(`🚗🍔 ${dtz.label}: Combo entregue na janela! -R$ 30 | HP 100%`, 3200);
        } else {
          showToast(`🚗🍔 ${dtz.label}: Combo custa R$ 30!`);
        }
      }
    }

    // Física real de colisão entre veículos dirigíveis (conservação de momento + empurrão + torque)
    const carMass = car.mass || 1.35;
    const invM1 = 1.0 / carMass;
    for (const other of vehicles) {
      if (other === car) continue;
      if (Math.abs(car.pos.y - other.pos.y) > 2.6) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      const minD = 3.05;
      if (d > 0.01 && d < minD) {
        const nx = dx / d, nz = dz / d, pen = minD - d;
        const invM2 = 1.0 / (other.mass || 1.35);
        const invSum = invM1 + invM2;
        // Separação proporcional às massas
        car.pos.x -= nx * pen * (invM1 / invSum);
        car.pos.z -= nz * pen * (invM1 / invSum);
        other.pos.x += nx * pen * (invM2 / invSum);
        other.pos.z += nz * pen * (invM2 / invSum);

        const relVn = (car.vel.x - other.vel.x) * nx + (car.vel.z - other.vel.z) * nz;
        if (relVn > 0) {
          const j = (1.22 * relVn) / invSum;
          car.vel.x -= nx * j * invM1 * 0.80;
          car.vel.z -= nz * j * invM1 * 0.80;
          other.vel.x += nx * j * invM2 * 1.15;
          other.vel.z += nz * j * invM2 * 1.15;
          // Torque rotacional ao acertar fora do centro do outro carro
          const ofX = Math.sin(other.yaw), ofZ = Math.cos(other.yaw);
          const sideHit = nx * ofZ - nz * ofX;
          other.angVel = (other.angVel || 0) + sideHit * Math.min(3.5, relVn * 0.14);
          other.rollVel = (other.rollVel || 0) - sideHit * Math.min(2.2, relVn * 0.12);
          car.pitchVel = (car.pitchVel || 0) + Math.min(1.5, relVn * 0.09);
          if (relVn > 6.5) {
            AudioFX.crash(); vibrate(50);
            applyCarDamage(relVn * 3.2);
            other.hp = Math.max(0, other.hp - Math.min(12, (relVn - 5.5) * 0.6));
          }
        }
        // Empurrão contínuo quando o jogador acelera encostado no outro carro
        if (gas) {
          other.vel.x += forwardDir.x * 9.5 * dt;
          other.vel.z += forwardDir.z * 9.5 * dt;
        }
      }
    }

    // Física real de impacto e empurrão em carros aleatórios do tráfego (impulso, derrapagem, spin e dominó!)
    for (const tc of trafficCars) {
      if (Math.abs(car.pos.y - tc.pos.y) > 2.8) continue;
      const dx = tc.pos.x - car.pos.x;
      const dz = tc.pos.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      const minD = tc.radius + 1.50;
      if (d > 0.01 && d < minD) {
        const nx = dx / d, nz = dz / d, pen = minD - d;
        const tcMass = tc.mass || 1.15;
        const invM2 = 1.0 / tcMass;
        const invSum = invM1 + invM2;

        // Separação proporcional às massas (carro leve do tráfego cede muito mais espaço ao ser empurrado!)
        car.pos.x -= nx * pen * (invM1 / invSum) * 0.65;
        car.pos.z -= nz * pen * (invM1 / invSum) * 0.65;
        tc.pos.x += nx * pen * (invM2 / invSum) * 1.18;
        tc.pos.z += nz * pen * (invM2 / invSum) * 1.18;

        const tcVx = tc.knockTimer > 0 ? tc.physVel.x : Math.sin(tc.yaw) * tc.speed;
        const tcVz = tc.knockTimer > 0 ? tc.physVel.z : Math.cos(tc.yaw) * tc.speed;
        const relVn = (car.vel.x - tcVx) * nx + (car.vel.z - tcVz) * nz;

        if (tc.knockTimer <= 0) {
          tc.physVel.set(tcVx, 0, tcVz);
        }

        if (relVn > 0.15) {
          const j = (1.26 * relVn) / invSum;
          // Carro do jogador retém boa parte do embalo ao empurrar tráfego leve; carros pesados (caminhões) oferecem mais resistência
          car.vel.x -= nx * j * invM1 * 0.68;
          car.vel.z -= nz * j * invM1 * 0.68;
          tc.physVel.x += nx * j * invM2 * 1.32;
          tc.physVel.z += nz * j * invM2 * 1.32;
          // Leve impulso vertical em pancadas fortes
          if (relVn > 11.0) tc.physVelY = Math.min(3.8, (relVn - 9.0) * 0.18);

          // Torque real (manobra PIT / cavalo-de-pau ao atingir a lateral ou quina do carro aleatório!)
          const tcFwdX = Math.sin(tc.yaw), tcFwdZ = Math.cos(tc.yaw);
          const hitOffX = (car.pos.x + nx * 1.3) - tc.pos.x;
          const hitOffZ = (car.pos.z + nz * 1.3) - tc.pos.z;
          const torqueCross = hitOffX * (nx * j) - hitOffZ * (nz * j);
          const sideFactor = (car.vel.x * tcFwdZ - car.vel.z * tcFwdX);
          tc.angVel = Math.max(-6.5, Math.min(6.5, (tc.angVel || 0) + (torqueCross * 0.11 + sideFactor * 0.08) * invM2));

          // Balanço físico de impacto na carroceria dos dois veículos
          const sideImpact = nx * tcFwdZ - nz * tcFwdX;
          tc.impactRoll = Math.max(-0.22, Math.min(0.22, (tc.impactRoll || 0) - sideImpact * Math.min(0.18, relVn * 0.012)));
          tc.impactPitch = Math.max(-0.18, Math.min(0.18, (tc.impactPitch || 0) + Math.min(0.15, relVn * 0.01)));
          car.pitchVel = (car.pitchVel || 0) + Math.min(2.1, relVn * 0.10);
          car.suspHeaveVel = (car.suspHeaveVel || 0) - Math.min(0.8, relVn * 0.035);

          tc.knockTimer = Math.max(tc.knockTimer || 0, Math.min(3.6, 1.35 + relVn * 0.11));
          tc.waitTimer = 0;

          if (relVn > 4.5) {
            AudioFX.crash();
            vibrate(Math.min(75, Math.round(22 + relVn * 2.4)));
            camShakeTimer = Math.max(camShakeTimer, 0.25);
            camShakePower = Math.max(camShakePower, Math.min(0.42, relVn * 0.018));
            if (relVn > 9.5) applyCarDamage(relVn * 2.6);
            if (!tc.hornCooldown || tc.hornCooldown <= 0) {
              tc.hornCooldown = 4.0;
              if (Math.random() < 0.65) setTimeout(() => AudioFX.horn(), 120);
            }
          }
        }

        // Empurrão contínuo real: se o jogador continuar acelerando encostado no carro aleatório, empurra ele pela rua!
        if (gas || Math.abs(forwardSpeed) > 1.0) {
          const pushPower = (gas ? (car.accelPower * 0.58) : 6.0) * invM2;
          tc.physVel.x += nx * pushPower * dt + forwardDir.x * (gas ? 5.5 : 0) * invM2 * dt;
          tc.physVel.z += nz * pushPower * dt + forwardDir.z * (gas ? 5.5 : 0) * invM2 * dt;
          tc.knockTimer = Math.max(tc.knockTimer || 0, 1.2);
          tc.waitTimer = 0;
        }
      }
    }

    for (const n of npcs) {
      const dx = n.pos.x - car.pos.x;
      const dz = n.pos.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      const minD = 1.65;
      if (d > 0.01 && d < minD) {
        const nx = dx / d, nz = dz / d, pen = minD - d;
        n.pos.x += nx * pen; n.pos.z += nz * pen;
        if (speedKmh > 16 && !n.isJobNpc && !n.dead) {
          n.hp = Math.max(0, n.hp - speedKmh * 2.1);
          n.knockTimer = n.hp <= 0 ? 10.0 : 3.2;
          n.vel.set(nx * 10 + car.vel.x * 0.55, 0, nz * 10 + car.vel.z * 0.55);
          n.velY = Math.min(6.5, 2.5 + speedKmh * 0.06);
          vibrate(60); AudioFX.crash();
          applyCarDamage(speedKmh * 0.5);
          if (n.hp <= 0 && !n.dead) {
            n.dead = true;
            const loot = 25 + Math.floor(Math.random() * 55);
            save.cash += loot; persistSave(); refreshMoneyUI();
            player.wanted = Math.min(5, player.wanted + 1);
            player.wantedTimer = 25;
            showToast(`🚨 Pedestre atropelado! +R$ ${loot} | Polícia acionada!`, 2500);
          }
        }
      }
    }

    // Transferência de peso real (molas de Roll e Pitch na suspensão da carroceria)
    const targetRoll = -car.steerAngle * Math.min(0.085, speedKmh * 0.00058) + dampedLateral * 0.0055;
    const targetPitch = brake ? 0.048 : (gas ? (car.nitroActive ? -0.052 : -0.032) : 0);
    car.rollVel = (car.rollVel || 0) + ((targetRoll - (car.roll || 0)) * 78 - (car.rollVel || 0) * 11.5) * dt;
    car.pitchVel = (car.pitchVel || 0) + ((targetPitch - (car.pitch || 0)) * 72 - (car.pitchVel || 0) * 11.0) * dt;
    car.roll = Math.max(-0.18, Math.min(0.18, (car.roll || 0) + car.rollVel * dt));
    car.pitch = Math.max(-0.15, Math.min(0.15, (car.pitch || 0) + car.pitchVel * dt));

    player.pos.copy(car.pos);
    const spdInt = Math.round(speedKmh);
    if (spdInt !== ui._lastSpeedInt) {
      ui._lastSpeedInt = spdInt;
      ui.speedVal.textContent = spdInt;
    }
    if (!ui.carHpVal) ui.carHpVal = el('carHpVal');
    if (ui.carHpVal) {
      const hpInt = Math.round(car.hp);
      if (hpInt !== ui._lastCarHpInt) {
        ui._lastCarHpInt = hpInt;
        ui.carHpVal.textContent = hpInt + '%';
        ui.carHpVal.style.color = hpInt > 50 ? '#00e676' : hpInt > 20 ? '#ffab00' : '#ff1744';
      }
    }
    AudioFX.updateEngine(!car.broken, Math.abs(car.speed));
  }

  const _steerWheelAxis = new THREE.Vector3(0, 0.3746, 0.9272);
  const _steerWheelQuat = new THREE.Quaternion();
  function updateVehiclesVisuals(dt) {
    const t = performance.now() * 0.008;
    let activeSpotUsed = false;
    let activeDomeUsed = false;
    for (const v of vehicles) {
      if (v.burning && !v.exploded) {
        v.burnTimer = (v.burnTimer || 0) - dt;
        if (Math.random() < 0.75) {
          const fYaw = v.yaw || 0;
          const fs = v.forwardSign || -1;
          const hood = new THREE.Vector3(v.pos.x + Math.sin(fYaw) * fs * 1.4, v.pos.y + 0.8, v.pos.z + Math.cos(fYaw) * fs * 1.4);
          spawnSmoke(hood, v.vel);
        }
        if (v.burnTimer <= 0) triggerCarExplosion(v);
      } else if (v.exploded && Math.random() < 0.25) {
        spawnSmoke(new THREE.Vector3(v.pos.x, v.pos.y + 0.65, v.pos.z), v.vel);
      }
      if (!v.lastSafePos) v.lastSafePos = v.pos.clone();
      const fs = v.forwardSign || 1;
      const sinY = Math.sin(v.yaw);
      const cosY = Math.cos(v.yaw);
      const wheelBase = (v.parts && v.parts.wheelBase) ? v.parts.wheelBase : 2.68;
      const trackWidth = (v.parts && v.parts.trackWidth) ? v.parts.trackWidth : 1.56;
      const halfWB = wheelBase * 0.5;
      const halfTW = trackWidth * 0.5;

      // Amostragem circular de pneu real nas 4 rodas + centro (rola suavemente sobre degraus e meio-fios sem teletransporte!)
      const useExactMesh = (v === player.inCar);
      if (useExactMesh) ensureLocalMeshPatch(v.pos.x, v.pos.z);

      const hCenterGrid = getWalkableGround(v.pos.x, v.pos.z, v.pos.y, 1.35);
      const hCenterExact = useExactMesh ? sampleExactMeshGround(v.pos.x, v.pos.z, v.pos.y, 0.58, 1.8) : null;
      const hCenter = hCenterExact !== null ? hCenterExact : hCenterGrid;
      const refY = v.grounded ? v.pos.y : (hCenter !== null ? hCenter : v.pos.y);
      const absSpd = Math.abs(v.speed || 0);
      const fwdX = sinY * fs;
      const fwdZ = cosY * fs;

      const sampleWheelG = (lx, lz) => {
        const wx = v.pos.x + lx * cosY + lz * sinY;
        const wz = v.pos.z - lx * sinY + lz * cosY;
        // Estima altura esperada da roda segundo a inclinação atual do carro para manter janela vertical justa
        const wheelRefY = refY - lz * Math.sin(v.slopePitch || 0) + lx * Math.sin(v.slopeRoll || 0);
        const exact = useExactMesh ? sampleCircularWheelGround(wx, wz, fwdX, fwdZ, wheelRefY) : null;
        let h = exact !== null ? exact : getWalkableGround(wx, wz, wheelRefY, 1.15);
        // Trava picos absurdos isolados de mureta/corrimão lateral para nunca arremessar o carro para cima
        if (h !== null && h - wheelRefY > 0.58) h = wheelRefY + 0.58;
        return { wx, wz, h, fromMesh: exact !== null };
      };

      let sumF = 0, cntF = 0, sumR = 0, cntR = 0;
      let sumPX = 0, cntPX = 0, sumMX = 0, cntMX = 0;
      let sumAll = 0, cntAll = 0;
      const wheelHits = [];
      const wheelRoadCells = [];
      let anyOnAsphalt = false, anyOnSidewalk = false;
      const wList = (v.parts && v.parts.wheels && v.parts.wheels.length >= 4) ? v.parts.wheels : null;

      if (wList) {
        for (let wi = 0; wi < wList.length; wi++) {
          const w = wList[wi];
          const s = sampleWheelG(w.localX, w.localZ);
          const rc = getRoadCellAt(s.wx, s.wz);
          wheelRoadCells.push(rc);
          if (rc === 1) anyOnAsphalt = true;
          else if (rc === 2) anyOnSidewalk = true;
          wheelHits.push(s);
        }
        // Meio-fio físico real: se parte do carro está na calçada (rc===2) e parte no asfalto (rc===1), garante degrau real de guia
        for (let wi = 0; wi < wList.length; wi++) {
          const w = wList[wi];
          const s = wheelHits[wi];
          const rc = wheelRoadCells[wi];
          let wh = s.h;
          if (wh !== null && anyOnAsphalt && anyOnSidewalk && rc === 2 && !s.fromMesh) {
            wh += 0.105;
          }
          // Detecta cruzamento de meio-fio (Asfalto <-> Calçada) por roda individual!
          if (v.grounded && w.lastRoadCell !== undefined && w.lastRoadCell !== rc) {
            const climbedCurb = (w.lastRoadCell === 1 && rc === 2);
            const droppedCurb = (w.lastRoadCell === 2 && rc === 1);
            if (climbedCurb || droppedCurb) {
              const kick = climbedCurb
                ? (1.35 + Math.min(2.1, absSpd * 0.13))
                : -(1.05 + Math.min(1.6, absSpd * 0.10));
              w.suspVel = (w.suspVel || 0) + kick;
              v.suspHeaveVel = (v.suspHeaveVel || 0) + kick * 0.16;
              v.rollVel = (v.rollVel || 0) + (w.localX >= 0 ? 1 : -1) * kick * 0.14;
              v.pitchVel = (v.pitchVel || 0) - (w.localZ >= 0 ? 1 : -1) * kick * 0.10;
              if (climbedCurb && absSpd > 1.2) {
                v.vel.multiplyScalar(0.965);
              }
              if (v === player.inCar && absSpd > 0.6) {
                AudioFX.curbThump(Math.min(1.0, (climbedCurb ? 0.45 : 0.30) + absSpd * 0.045));
                vibrate(climbedCurb ? 14 : 9);
              }
            }
          }
          w.lastRoadCell = rc;

          // Detecta impacto real de degrau de escada / desnível súbito na malha 3D sob esta roda!
          // Limiar 0.095m ignora micro-juntas de polígonos no asfalto para evitar trepidação ao andar na rua
          if (v.grounded && wh !== null && w.lastGroundY !== undefined && absSpd > 0.8) {
            const stepJump = wh - w.lastGroundY;
            if (Math.abs(stepJump) > 0.095 && Math.abs(stepJump) < 0.48) {
              w.suspVel = (w.suspVel || 0) + stepJump * 6.5;
              v.suspHeaveVel = (v.suspHeaveVel || 0) + stepJump * 0.95;
              if (v === player.inCar && absSpd > 1.8 && stepJump > 0.11) {
                AudioFX.curbThump(Math.min(0.75, 0.22 + stepJump * 1.8));
                vibrate(6);
              }
            }
          }
          if (wh !== null) w.lastGroundY = wh;

          s.h = wh;
          if (wh !== null) {
            sumAll += wh; cntAll++;
            if (w.localZ * fs >= 0) { sumF += wh; cntF++; } else { sumR += wh; cntR++; }
            if (w.localX >= 0) { sumPX += wh; cntPX++; } else { sumMX += wh; cntMX++; }
          }
        }
      } else {
        const hFL = sampleWheelG(halfTW, halfWB * fs).h;
        const hFR = sampleWheelG(-halfTW, halfWB * fs).h;
        const hRL = sampleWheelG(halfTW, -halfWB * fs).h;
        const hRR = sampleWheelG(-halfTW, -halfWB * fs).h;
        if (hFL !== null) { sumAll += hFL; cntAll++; sumF += hFL; cntF++; sumPX += hFL; cntPX++; }
        if (hFR !== null) { sumAll += hFR; cntAll++; sumF += hFR; cntF++; sumMX += hFR; cntMX++; }
        if (hRL !== null) { sumAll += hRL; cntAll++; sumR += hRL; cntR++; sumPX += hRL; cntPX++; }
        if (hRR !== null) { sumAll += hRR; cntAll++; sumR += hRR; cntR++; sumMX += hRR; cntMX++; }
      }

      const avg4 = cntAll > 0 ? (sumAll / cntAll) : hCenter;
      const hFront = cntF > 0 ? (sumF / cntF) : avg4;
      const hRear = cntR > 0 ? (sumR / cntR) : avg4;
      const hPlusX = cntPX > 0 ? (sumPX / cntPX) : avg4;
      const hMinusX = cntMX > 0 ? (sumMX / cntMX) : avg4;

      let slopeMag = 0;
      let targetSlopePitch = 0;
      let targetSlopeRoll = 0;
      if (avg4 !== null) {
        const dPitch = (hFront !== null && hRear !== null) ? (hFront - hRear) : 0;
        const dRoll = (hPlusX !== null && hMinusX !== null) ? (hPlusX - hMinusX) : 0;
        targetSlopePitch = Math.max(-0.54, Math.min(0.54, -Math.atan2(dPitch, wheelBase) * fs));
        targetSlopeRoll = Math.max(-0.38, Math.min(0.38, Math.atan2(dRoll, trackWidth)));
        slopeMag = Math.hypot(dPitch / wheelBase, dRoll / trackWidth);
      }

      // Se estamos usando raycast 3D exato dos degraus, não precisa de folga artificial grande; se grade 1.5m, aplica folga de crista
      const anyExact = wList && wheelHits.some((s) => s.fromMesh);
      const stepCrestLift = (!anyExact && slopeMag > 0.14) ? Math.min(0.11, (slopeMag - 0.14) * 0.24) : 0;
      let gy = null;
      if (avg4 !== null) {
        gy = avg4 + stepCrestLift;
        if (hCenter !== null && hCenter - 0.025 > gy) gy = hCenter - 0.025;
      } else {
        gy = hCenter;
      }

      // Física vertical contínua com mola-amortecedor no chassi (ZERO teletransporte em degraus/meio-fios!)
      const outside = isOutsideIsland(v.pos.x, v.pos.z);

      if (outside && v.pos.y < WATER_Y + 0.1) {
        // Empuxo & arrasto na água
        const floatY = WATER_Y - 0.65;
        v.velY += (floatY - v.pos.y) * 8.0 * dt;
        v.velY *= 0.88;
        v.pos.y += v.velY * dt;
        v.vel.multiplyScalar(0.92);
        v.speed *= 0.92;
        if (v === player.inCar) {
          v.waterTimer = (v.waterTimer || 0) + dt;
          if (v.waterTimer > 1.2) {
            respawnAtHospital('Carro caiu no mar!');
            return;
          }
        }
      } else if (gy !== null && (v.pos.y <= gy + (v.grounded ? 0.26 : 0.12))) {
        v.waterTimer = 0;
        if (!v.grounded && v.velY < -14 && v === player.inCar && !v.broken && !v.burning) {
          v.hp = Math.max(0, v.hp - Math.min(12, Math.abs(v.velY + 12) * 0.8));
          vibrate(45);
          if (v.hp <= 0) { v.burning = true; v.burnTimer = 1.6; showToast('🔥 Motor pegando fogo! Saia do carro!', 2200); }
        }
        // Impacto de pouso alimenta a mola vertical da carroceria
        if (!v.grounded && v.velY < -3.2) {
          v.suspHeaveVel = (v.suspHeaveVel || 0) + Math.max(-1.6, v.velY * 0.13);
          v.velY *= 0.25;
        }

        // Filtro passa-baixa suave em gy para eliminar micro-trepidação de juntas da malha no asfalto plano
        if (v.smoothGy === undefined || Math.abs(gy - v.smoothGy) > 0.45) {
          v.smoothGy = gy;
        } else {
          const alphaGy = 1.0 - Math.exp(-(Math.abs(gy - v.smoothGy) < 0.07 ? 14.0 : 28.0) * dt);
          v.smoothGy += (gy - v.smoothGy) * alphaGy;
        }
        const targetGy = v.smoothGy;

        // Mola-amortecedor super-amortecida: sobe degraus, escadas e meio-fios com fluidez real sem trepidar no asfalto!
        const errY = targetGy - v.pos.y;
        const springK = errY > 0 ? 62.0 : 72.0;
        const dampC = 19.5;
        v.velY += (errY * springK - v.velY * dampC) * dt;
        // Limita velocidade máxima de subida em degrau para manter movimento 100% orgânico e sedoso
        if (v.velY > 4.2) v.velY = 4.2;
        if (v.velY < -7.5) v.velY = -7.5;
        v.pos.y += v.velY * dt;

        // Batente mecânico inferior da suspensão (comprime até 16cm no máximo para o assoalho nunca entrar no chão)
        if (v.pos.y < targetGy - 0.16) {
          v.pos.y = targetGy - 0.16;
          if (v.velY < 0) v.velY = 0;
        }
        // Quando quase em repouso no plano, estabiliza sem micro-tremor
        if (Math.abs(targetGy - v.pos.y) < 0.008 && Math.abs(v.velY) < 0.04) {
          v.pos.y = targetGy;
          v.velY = 0;
        }

        v.grounded = true;
        if (!isSolidMapCell(v.pos.x, v.pos.z, v.pos.y, 1.65)) {
          v.lastSafePos.copy(v.pos);
        }
      } else {
        // No ar (salto/queda livre)
        v.velY -= 22 * dt;
        v.pos.y += v.velY * dt;
        if (gy === null && v.pos.y < -15.5) {
          if (v === player.inCar) {
            respawnAtHospital('Carro caiu no mar!');
            return;
          }
          v.pos.copy(v.lastSafePos);
          v.pos.y = getSafeGroundForSpawn(v.pos.x, v.pos.z, v.lastSafePos.y) + 0.12;
          v.velY = 0;
          v.vel.set(0, 0, 0);
          v.grounded = true;
        } else if (!outside && v.pos.y < -36.0) {
          v.pos.copy(v.lastSafePos);
          v.pos.y = getSafeGroundForSpawn(v.pos.x, v.pos.z, v.lastSafePos.y) + 0.15;
          v.velY = 0;
          v.vel.multiplyScalar(0.2);
          v.grounded = true;
        } else {
          v.grounded = false;
        }
      }
      if (v !== player.inCar) {
        if (v.vel.lengthSq() > 0.01) {
          v.pos.addScaledVector(v.vel, dt);
          v.vel.multiplyScalar(Math.max(0, 1 - dt * 3.8));
          resolveMapWallCollision(v.pos, 1.55, v.vel, 1.45);
        }
        if (Math.abs(v.angVel || 0) > 0.01) {
          v.yaw += v.angVel * dt;
          v.angVel *= Math.max(0, 1 - dt * 4.5);
        }
        // Amortecimento natural das molas de carroceria em veículos estacionados após empurrão
        v.rollVel = (v.rollVel || 0) + (-(v.roll || 0) * 65 - (v.rollVel || 0) * 10) * dt;
        v.pitchVel = (v.pitchVel || 0) + (-(v.pitch || 0) * 65 - (v.pitchVel || 0) * 10) * dt;
        v.roll = (v.roll || 0) + v.rollVel * dt;
        v.pitch = (v.pitch || 0) + v.pitchVel * dt;
      }

      // Inclinação 3D do veículo com mola-amortecedor super-amortecida (zero trepidação no asfalto!)
      if (v.grounded) {
        const cleanPitch = Math.abs(targetSlopePitch) < 0.018 ? 0 : targetSlopePitch;
        const cleanRoll = Math.abs(targetSlopeRoll) < 0.018 ? 0 : targetSlopeRoll;
        v.slopePitchVel = (v.slopePitchVel || 0) + ((cleanPitch - (v.slopePitch || 0)) * 44 - (v.slopePitchVel || 0) * 16.5) * dt;
        v.slopeRollVel = (v.slopeRollVel || 0) + ((cleanRoll - (v.slopeRoll || 0)) * 44 - (v.slopeRollVel || 0) * 16.5) * dt;
        v.slopePitch = Math.max(-0.56, Math.min(0.56, (v.slopePitch || 0) + v.slopePitchVel * dt));
        v.slopeRoll = Math.max(-0.40, Math.min(0.40, (v.slopeRoll || 0) + v.slopeRollVel * dt));
      } else {
        v.slopePitchVel = (v.slopePitchVel || 0) * Math.max(0, 1 - dt * 5);
        v.slopeRollVel = (v.slopeRollVel || 0) * Math.max(0, 1 - dt * 5);
        v.slopePitch = (v.slopePitch || 0) * Math.max(0, 1 - dt * 3.0);
        v.slopeRoll = (v.slopeRoll || 0) * Math.max(0, 1 - dt * 3.0);
      }
      v.mesh.rotation.order = 'YXZ';
      v.mesh.rotation.set(v.slopePitch || 0, v.yaw, v.slopeRoll || 0);

      // Suspensão independente por roda acompanhando degraus 3D reais e meio-fios (mola + amortecedor)
      const onStairs = v.grounded && slopeMag > 0.15;
      if (onStairs && absSpd > 0.35) {
        const prevSteps = Math.floor((v.stairDist || 0) / 0.42);
        v.stairDist = (v.stairDist || 0) + absSpd * dt;
        const curSteps = Math.floor(v.stairDist / 0.42);
        if (curSteps !== prevSteps && v === player.inCar && absSpd > 2.2) {
          vibrate(8);
        }
      }

      let meanWheelSusp = 0;
      let stairBodyPitch = 0;
      let stairBodyRoll = 0;
      if (wList) {
        const sinP = Math.sin(v.slopePitch || 0);
        const sinR = Math.sin(v.slopeRoll || 0);
        // Se já estamos amostrando degraus 3D exatos da malha, a onda complementar é mais sutil
        const stepAmp = onStairs ? Math.min(anyExact ? 0.032 : 0.068, (slopeMag - 0.12) * (anyExact ? 0.08 : 0.16)) * Math.min(1.0, absSpd / 3.0) : 0;
        const stepK = (Math.PI * 2) / 0.42;

        for (let wi = 0; wi < wList.length; wi++) {
          const w = wList[wi];
          let targetSusp = 0;
          if (v.grounded) {
            const wh = wheelHits[wi] ? wheelHits[wi].h : null;
            if (wh !== null) {
              const planeWY = v.pos.y - w.localZ * sinP + w.localX * sinR;
              targetSusp = wh - planeWY;
            }
            if (stepAmp > 0.002) {
              const wPhase = ((v.stairDist || 0) + w.localZ * 0.85 + w.localX * 0.35) * stepK;
              const crest = Math.max(0, Math.sin(wPhase));
              targetSusp += crest * stepAmp;
            }
            targetSusp = Math.max(-0.11, Math.min(0.13, targetSusp));
          } else {
            // No ar (salto): suspensão estende para baixo (droop realista)
            targetSusp = -0.095;
          }
          // Mola-amortecedor de roda (Hooke + Damping)
          w.suspVel = (w.suspVel || 0) + ((targetSusp - (w.suspY || 0)) * 185 - (w.suspVel || 0) * 17) * dt;
          w.suspY = Math.max(-0.12, Math.min(0.14, (w.suspY || 0) + w.suspVel * dt));
          w.steerPivot.position.y = w.baseY + w.suspY;
          meanWheelSusp += w.suspY;
          stairBodyPitch -= w.suspY * (w.localZ >= 0 ? 1 : -1) * 0.14;
          stairBodyRoll += w.suspY * (w.localX >= 0 ? 1 : -1) * 0.16;
        }
        meanWheelSusp /= wList.length;
      }

      // Mola vertical + balanço suave da carroceria (bodyGroup: inclui lataria, portas e cabine juntas)
      const targetHeave = Math.max(-0.06, Math.min(0.08, meanWheelSusp * 0.55));
      v.suspHeaveVel = (v.suspHeaveVel || 0) + ((targetHeave - (v.suspHeave || 0)) * 85 - (v.suspHeaveVel || 0) * 12) * dt;
      v.suspHeave = Math.max(-0.08, Math.min(0.09, (v.suspHeave || 0) + v.suspHeaveVel * dt));

      if (v.parts.chassis) {
        v.parts.chassis.position.y = v.suspHeave;
        v.parts.chassis.rotation.z = (v.roll || 0) + stairBodyRoll;
        v.parts.chassis.rotation.x = (v.pitch || 0) + stairBodyPitch;
      }

      if (v.doorAutoTimer > 0) {
        v.doorAutoTimer -= dt;
        if (v.doorAutoTimer <= 0) {
          v.doorsOpen = false;
          if (player.inCar === v) ui.btnCarDoors.classList.remove('on');
        }
      }
      const targetDoor = v.doorsOpen ? 1.05 : 0.0;
      v.doorAngle += (targetDoor - v.doorAngle) * Math.min(1, dt * 8.5);
      const drvAnimAng = v.driverDoorAnimAngle || 0;
      const dLeftIsDrv = v.parts.driverIsLeftNode !== false;
      const angL = dLeftIsDrv ? Math.max(v.doorAngle, drvAnimAng) : v.doorAngle;
      const angR = !dLeftIsDrv ? Math.max(v.doorAngle, drvAnimAng) : v.doorAngle;
      if (v.parts.doorL) v.parts.doorL.rotation.y = (v.parts.doorLSign || -1) * angL;
      if (v.parts.doorR) v.parts.doorR.rotation.y = (v.parts.doorRSign || 1) * angR;

      if (v.parts.steeringWheel) {
        _steerWheelQuat.setFromAxisAngle(_steerWheelAxis, v.steerAngle * 2.2);
        if (v.parts.steeringInitQ) {
          v.parts.steeringWheel.quaternion.copy(v.parts.steeringInitQ).multiply(_steerWheelQuat);
        } else {
          v.parts.steeringWheel.quaternion.copy(_steerWheelQuat);
        }
      }

      const wheelSpin = v.speed * dt * 2.9 * fs;
      v.parts.wheels.forEach((w) => {
        if (w.front) w.steerPivot.rotation.y = v.steerAngle * 0.34;
        w.spinObj.rotation.x = (w.spinObj.rotation.x + wheelSpin) % (Math.PI * 2);
      });

      const interiorLit = v.doorsOpen || (v.driverDoorAnimAngle > 0.06) || (v === player.inCar && v.lightsOn && v.doorsOpen);
      const braking = (v === player.inCar) && (input.brake || keys['KeyS'] || keys['ArrowDown']);
      if (v.parts.headLightGroup) {
        v.parts.headLightGroup.visible = Boolean(v.lightsOn);
        if (v.parts.headBeamMat) v.parts.headBeamMat.opacity = 0.02 + streetLampState.nightFactor * 0.075;
      }
      if (v.parts.tailLightGroup) {
        v.parts.tailLightGroup.visible = Boolean(v.lightsOn || braking);
        if (v.parts.tailMat) v.parts.tailMat.opacity = braking ? 0.98 : 0.58;
      }

      if (v === player.inCar && v.lightsOn && window._sharedCarHeadSpot) {
        activeSpotUsed = true;
        const hs = window._sharedCarHeadSpot;
        const hm = v.parts.headMidLocal || { x: 0, y: 0.68, z: 2.0 * fs };
        const hwx = v.pos.x + hm.x * cosY + hm.z * sinY;
        const hwz = v.pos.z - hm.x * sinY + hm.z * cosY;
        hs.position.set(hwx, v.pos.y + hm.y, hwz);
        hs.target.position.set(hwx + sinY * 24 * fs, v.pos.y - 0.15, hwz + cosY * 24 * fs);
        hs.intensity = 2.6 + streetLampState.nightFactor * 1.4;
      }
      if (interiorLit && (v === player.inCar || (gameMode === 'lobby' && v === vehicles[0])) && window._sharedCarDomeLight) {
        activeDomeUsed = true;
        const dl = window._sharedCarDomeLight;
        dl.position.set(v.pos.x + sinY * 0.15 * fs, v.pos.y + 1.15, v.pos.z + cosY * 0.15 * fs);
        dl.intensity = 1.6;
      }
      v.parts.headMats.forEach((m) => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = v.lightsOn ? 2.8 : 0.05; });
      v.parts.tailMats.forEach((m) => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = braking ? 4.5 : (v.lightsOn ? 1.8 : 0.1); });
      v.parts.intLightMats.forEach((m) => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = interiorLit ? 3.0 : 0.2; });

      if (v.type === 'car_pm' && v.parts.lightB && v.parts.lightR) {
        const blink = v.sirenOn ? Math.sin(t * 2.2) > 0 : false;
        v.parts.lightB.visible = !v.sirenOn || blink;
        v.parts.lightR.visible = !v.sirenOn || !blink;
      }
    }
    if (!activeSpotUsed && window._sharedCarHeadSpot) window._sharedCarHeadSpot.intensity = 0.0;
    if (!activeDomeUsed && window._sharedCarDomeLight) window._sharedCarDomeLight.intensity = 0.0;
  }

  const _tmpEuler = new THREE.Euler();
  const _tmpQuat = new THREE.Quaternion();
  const _tmpInvWQ = new THREE.Quaternion();
  const _tmpWorldQ = new THREE.Quaternion();
  function setBoneDelta(n, name, rx, ry, rz) {
    const bone = n.bones && n.bones[name];
    const initQ = n.boneInitQ && n.boneInitQ[name];
    if (!bone || !initQ) return;
    _tmpEuler.set(rx, ry, rz, 'XYZ');
    _tmpQuat.setFromEuler(_tmpEuler);
    bone.quaternion.copy(initQ).multiply(_tmpQuat);
  }

  // Aplica rotação desejada no espaço do personagem (+Y cima, +Z frente, +X esquerda), convertendo para o espaço local do osso
  function setBoneWorldDelta(n, name, wx, wy, wz) {
    const bone = n.bones && n.bones[name];
    const initQ = n.boneInitQ && n.boneInitQ[name];
    const wInitQ = n.boneWorldInitQ && n.boneWorldInitQ[name];
    if (!bone || !initQ || !wInitQ) return;
    _tmpEuler.set(wx, wy, wz, 'XYZ');
    _tmpWorldQ.setFromEuler(_tmpEuler);
    _tmpInvWQ.copy(wInitQ).invert();
    _tmpQuat.copy(_tmpInvWQ).multiply(_tmpWorldQ).multiply(wInitQ);
    bone.quaternion.copy(initQ).multiply(_tmpQuat);
  }

  function animateDoaNpcBones(n, dt, isWalking) {
    const t = performance.now() * 0.001;
    n.moveBlend = (n.moveBlend || 0) + ((isWalking ? 1 : 0) - (n.moveBlend || 0)) * Math.min(1, dt * 11);
    const isJumping = (n.grounded === false) || Math.abs(n.velY || 0) > 1.2;
    n.airBlend = (n.airBlend || 0) + ((isJumping ? 1 : 0) - (n.airBlend || 0)) * Math.min(1, dt * 12);
    const mb = n.moveBlend * (1 - n.airBlend);
    const ab = n.airBlend;
    const ib = (1 - n.moveBlend) * (1 - n.airBlend);

    n.phase += dt * (2.0 + n.moveBlend * 4.4);
    const s = Math.sin(n.phase);
    const c = Math.cos(n.phase);

    // Mesma física real de mola-amortecedor da protagonista (npc_outer_plane.glb)!
    const isCrouching = (n.crouchTimer || 0) > 0;
    const isAirborne = Math.abs(n.velY) > 0.15;
    let targetBounce = mb > 0.1 ? Math.abs(c) * 0.16 * mb : Math.sin(t * 2.2) * 0.025;
    if (isCrouching) targetBounce = -0.14;
    else if (isAirborne) targetBounce = Math.max(-0.32, Math.min(0.32, -n.velY * 0.055));

    n.springVel += ((targetBounce - n.springPos) * 46 - n.springVel * 4.6) * dt;
    n.springPos = Math.max(-0.38, Math.min(0.38, n.springPos + n.springVel * dt));

    const targetHair = (0.04 + Math.sin(t * 1.8) * 0.05) * (1 - mb) + (0.14 + s * 0.11) * mb;
    n.hairVel += ((targetHair - n.hairSway) * 32 - n.hairVel * 4.8 - n.velY * 0.05) * dt;
    n.hairSway = Math.max(-0.42, Math.min(0.42, n.hairSway + n.hairVel * dt));

    // Agachamento + bounce natural da passada no root
    if (n.doaRoot) {
      const stepBob = Math.abs(c) * 0.028 * mb;
      n.doaRoot.position.y = n.doaBaseY - (isCrouching ? 0.12 : 0) + stepBob;
    }
    setBoneWorldDelta(
      n, 'pelvis_07',
      (isCrouching ? 0.08 : 0) + ab * 0.10,
      s * 0.10 * mb,
      c * 0.045 * mb + Math.sin(t * 1.4) * 0.015 * ib
    );
    setBoneWorldDelta(
      n, 'spine_lower_0168',
      (isCrouching ? 0.12 : 0) + 0.06 * mb + Math.sin(t * 2.2) * 0.025 * ib + ab * 0.08,
      -s * 0.06 * mb,
      0
    );
    setBoneWorldDelta(n, 'spine_upper_0169', Math.sin(t * 2.4) * 0.028 * (1 - mb * 0.5) + 0.04 * mb, -s * 0.04 * mb, 0);

    // Seios & Glúteos com direção exata igual à protagonista (-wx levanta +Z para +Y)
    const bustL = n.springPos + (isWalking ? s * 0.04 : 0);
    const bustR = n.springPos - (isWalking ? s * 0.04 : 0);
    const bustRz = isWalking ? c * 0.04 : Math.sin(t * 2.1) * 0.015;
    ['breast_left_base_0317', 'breast_left_a_0319', 'breast_left_b_0300', 'breast_left_tip_0318'].forEach((bn, bi) => {
      const m = bi === 0 ? 1.0 : 0.35;
      setBoneWorldDelta(n, bn, -bustL * m, 0, bustRz * m);
    });
    ['breast_right_base_0323', 'breast_right_a_0325', 'breast_right_b_0326', 'breast_right_tip_0324'].forEach((bn, bi) => {
      const m = bi === 0 ? 1.0 : 0.35;
      setBoneWorldDelta(n, bn, -bustR * m, 0, -bustRz * m);
    });
    setBoneWorldDelta(n, 'leg_left_butt_ctr_022', (isWalking ? s * 0.12 : 0) - n.springPos * 0.65, 0, 0);
    setBoneWorldDelta(n, 'leg_right_butt_ctr_023', (isWalking ? -s * 0.12 : 0) - n.springPos * 0.65, 0, 0);

    // Física real da saia abrindo radialmente com pulo/vento/mola
    const skirtLift = isAirborne ? Math.max(-0.18, Math.min(0.45, n.velY * 0.055)) : (isCrouching ? 0.16 : 0);
    const skirtBounce = Math.abs(n.springPos) * 0.48;
    if (n.skirtBones) {
      for (const sb of n.skirtBones) {
        const info = (n.skirtInfo && n.skirtInfo[sb]) || { dx: 0, dz: 0 };
        const isFront = info.dz > 0.015 || sb.includes('front');
        const isBack = info.dz < -0.015 || sb.includes('back');
        const sideSign = info.dx >= 0 ? 1 : -1;
        const legPush = isWalking ? (isFront ? Math.max(0, s * 0.20) : (isBack ? Math.max(0, -s * 0.18) : 0)) : 0;
        const sideSway = isWalking ? c * 0.05 : Math.sin(t * 1.6 + (sideSign > 0 ? 0.5 : 0)) * 0.025;
        const flare = skirtLift + skirtBounce + legPush;
        const wx = isFront ? -flare * 0.72 : (isBack ? flare * 0.72 : 0);
        const wz = sideSign * flare * 0.42 + (sideSign > 0 ? sideSway : -sideSway);
        setBoneWorldDelta(n, sb, wx, 0, wz);
      }
    }

    // Cabelo longo balançando apenas para trás (nunca entra na cintura/corpo)
    const doaHairBack = -Math.max(0.08, Math.abs(n.hairSway) * 0.95);
    ['hair_root_tail_left_0234', 'hair_tail_left_a_0235', 'hair_tail_left_b_0236', 'hair_tail_left_c_0237'].forEach((hn, hi) => {
      const m = hi === 0 ? 0.9 : 0.4;
      setBoneWorldDelta(n, hn, doaHairBack * m, 0, (isWalking ? c * 0.07 : Math.sin(t * 1.4 + hi * 0.5) * 0.03) * m);
    });
    ['hair_root_tail_right_0249', 'hair_tail_right_a_0250', 'hair_tail_right_b_0251', 'hair_tail_right_c_0252'].forEach((hn, hi) => {
      const m = hi === 0 ? 0.9 : 0.4;
      setBoneWorldDelta(n, hn, doaHairBack * m, 0, (isWalking ? -s * 0.09 : Math.cos(t * 1.4 + hi * 0.5) * 0.04) * m);
    });

    // Pernas fechadas naturalmente (corrige A-pose 15° da DOA!) + joelhos, tornozelos, braços, cotovelos e pescoço articulados!
    const legCloseZ = 0.22;
    const armDownZ = 0.68;
    const headLookY = Math.sin(t * 1.1 + n.phase * 0.2) * 0.16;
    const headNodX = Math.sin(t * 1.6) * 0.06;
    const headTiltZ = Math.sin(t * 0.9) * 0.05;

    if (isCrouching) {
      setBoneWorldDelta(n, 'leg_left_thigh_08', -0.55, 0, -legCloseZ);
      setBoneWorldDelta(n, 'leg_right_thigh_015', -0.55, 0, legCloseZ);
      setBoneWorldDelta(n, 'leg_left_knee_09', 1.05, 0, 0);
      setBoneWorldDelta(n, 'leg_right_knee_016', 1.05, 0, 0);
      setBoneWorldDelta(n, 'leg_left_ankle_010', -0.35, 0, 0);
      setBoneWorldDelta(n, 'leg_right_ankle_017', -0.35, 0, 0);
      setBoneWorldDelta(n, 'arm_left_shoulder_2_0266', -0.22, 0, -armDownZ - 0.04);
      setBoneWorldDelta(n, 'arm_right_shoulder_2_0292', -0.22, 0, armDownZ + 0.04);
      setBoneWorldDelta(n, 'arm_left_elbow_0267', -0.65, 0, 0);
      setBoneWorldDelta(n, 'arm_right_elbow_0293', -0.65, 0, 0);
      setBoneWorldDelta(n, 'head_neck_lower_0170', -0.06, 0, 0);
      setBoneWorldDelta(n, 'head_neck_upper_0171', -0.08, 0, 0);
    } else {
      const kneeLWalk = Math.max(0, -c) * 0.85 + Math.max(0, s) * 0.22;
      const kneeRWalk = Math.max(0, c) * 0.85 + Math.max(0, -s) * 0.22;
      const footLWalk = Math.max(0, -s) * 0.16 - Math.max(0, c) * 0.06;
      const footRWalk = Math.max(0, s) * 0.16 - Math.max(0, -c) * 0.06;
      const g1 = Math.sin(t * 2.1 + n.phase * 0.5);
      const g2 = Math.cos(t * 1.7 + n.phase * 0.3);

      setBoneWorldDelta(n, 'leg_left_thigh_08', (-s * 0.52) * mb + (-0.42) * ab, 0, -legCloseZ);
      setBoneWorldDelta(n, 'leg_right_thigh_015', (s * 0.52) * mb + (0.18) * ab, 0, legCloseZ);
      setBoneWorldDelta(n, 'leg_left_knee_09', 0.05 * ib + kneeLWalk * mb + 0.85 * ab, 0, 0);
      setBoneWorldDelta(n, 'leg_right_knee_016', 0.05 * ib + kneeRWalk * mb + 0.45 * ab, 0, 0);
      setBoneWorldDelta(n, 'leg_left_ankle_010', footLWalk * mb + 0.18 * ab, 0, 0);
      setBoneWorldDelta(n, 'leg_right_ankle_017', footRWalk * mb + 0.15 * ab, 0, 0);
      setBoneWorldDelta(n, 'arm_left_shoulder_2_0266', (-0.14 + g1 * 0.10) * ib + (s * 0.44) * mb + (-0.55) * ab, 0, -armDownZ - g2 * 0.04 * ib + 0.28 * ab);
      setBoneWorldDelta(n, 'arm_right_shoulder_2_0292', (-0.12 - g2 * 0.09) * ib + (-s * 0.44) * mb + (-0.45) * ab, 0, armDownZ + g1 * 0.04 * ib - 0.28 * ab);
      setBoneWorldDelta(n, 'arm_left_elbow_0267', (-0.42 + g1 * 0.16) * ib + (-0.28 - Math.max(0, -s) * 0.52) * mb - 0.55 * ab, 0, 0);
      setBoneWorldDelta(n, 'arm_right_elbow_0293', (-0.40 - g2 * 0.15) * ib + (-0.28 - Math.max(0, s) * 0.52) * mb - 0.55 * ab, 0, 0);
      setBoneWorldDelta(n, 'head_neck_lower_0170', headNodX * 0.5 * ib + Math.abs(c) * 0.04 * mb, headLookY * (0.5 * ib + 0.4 * mb), headTiltZ * 0.4 * ib);
      setBoneWorldDelta(n, 'head_neck_upper_0171', headNodX * ib + (-0.03 + Math.abs(c) * 0.05) * mb, headLookY * (ib + 0.6 * mb), headTiltZ * (ib + 0.5 * mb));
    }

    // Piscar real das pálpebras e movimento suave dos globos oculares no espaço mundial
    n.blinkTimer -= dt;
    if (n.blinkTimer <= 0) n.blinkTimer = 2.2 + Math.random() * 1.8;
    const blinkAmt = n.blinkTimer < 0.18 ? Math.sin((n.blinkTimer / 0.18) * Math.PI) * 0.52 : 0.0;
    setBoneWorldDelta(n, 'head_eyelid_left_upper_01', blinkAmt, 0, 0);
    setBoneWorldDelta(n, 'head_eyelid_right_upper_0192', blinkAmt, 0, 0);
    const eyeYaw = Math.sin(t * 0.9) * 0.12;
    setBoneWorldDelta(n, 'head_eyeball_left_0180', 0, eyeYaw, 0);
    setBoneWorldDelta(n, 'head_eyeball_right_0213', 0, eyeYaw, 0);

    // Animação de Combo de Soco na Lutadora DOA (NPC 2)
    if (n === player && n.punchAnim && n.punchAnim > 0) {
      const maxDur = n.punchCombo === 2 ? 0.34 : 0.26;
      const pT = Math.sin((n.punchAnim / maxDur) * Math.PI);
      const isLeft = n.punchCombo === 1;
      setBoneWorldDelta(n, 'spine_upper_025', 0.16 * pT, (isLeft ? -0.45 : 0.45) * pT, 0);
      if (isLeft) {
        setBoneWorldDelta(n, 'arm_left_shoulder_2_0266', -1.52 * pT, 0.16 * pT, -0.25);
        setBoneWorldDelta(n, 'arm_left_elbow_0267', -0.22 * (1 - pT), 0, 0);
      } else {
        setBoneWorldDelta(n, 'arm_right_shoulder_2_0292', -1.58 * pT, -0.20 * pT, 0.25);
        setBoneWorldDelta(n, 'arm_right_elbow_0293', (n.punchCombo === 2 ? -0.58 : -0.18) * pT, 0, 0);
      }
    }
  }

  function animateJobNpcBones(n, dt, isWalking) {
    if (n.isDoa && n.bones && n.bones['pelvis_07']) {
      animateDoaNpcBones(n, dt, isWalking);
      return;
    }
    if (n.isCustomChar) {
      if (n.customRig) {
        const t = performance.now() * 0.001;
        n.moveBlend = (n.moveBlend || 0) + ((isWalking ? 1 : 0) - (n.moveBlend || 0)) * Math.min(1, dt * 11);
        const isJumping = (n.grounded === false) || Math.abs(n.velY || 0) > 1.2;
        n.airBlend = (n.airBlend || 0) + ((isJumping ? 1 : 0) - (n.airBlend || 0)) * Math.min(1, dt * 12);
        const mb = n.moveBlend * (1 - n.airBlend);
        const ab = n.airBlend;
        const ib = (1 - n.moveBlend) * (1 - n.airBlend);

        n.phase = (n.phase || 0) + dt * (2.0 + n.moveBlend * 4.4);
        const s = Math.sin(n.phase);
        const c = Math.cos(n.phase);
        const r = n.customRig;

        // Mesma física real de mola-amortecedor da NPC 1 (seios, cabelo/orelhas, agachamento, pulo e pouso!)
        const isCrouching = (n.crouchTimer || 0) > 0;
        const isAirborne = Math.abs(n.velY || 0) > 0.15;
        let targetBounce = mb > 0.1 ? Math.abs(c) * 0.16 * mb : Math.sin(t * 2.2) * 0.025;
        if (isCrouching) targetBounce = -0.14;
        else if (isAirborne) targetBounce = Math.max(-0.32, Math.min(0.32, -(n.velY || 0) * 0.055));

        n.springVel = (n.springVel || 0) + ((targetBounce - (n.springPos || 0)) * 46 - (n.springVel || 0) * 4.6) * dt;
        n.springPos = Math.max(-0.38, Math.min(0.38, (n.springPos || 0) + n.springVel * dt));

        const targetHair = (0.04 + Math.sin(t * 1.8) * 0.05) * (1 - mb) + (0.14 + s * 0.11) * mb;
        n.hairVel = (n.hairVel || 0) + ((targetHair - (n.hairSway || 0)) * 32 - (n.hairVel || 0) * 4.8 - (n.velY || 0) * 0.05) * dt;
        n.hairSway = Math.max(-0.42, Math.min(0.42, (n.hairSway || 0) + n.hairVel * dt));

        if (n.customRoot) {
          const stepBob = Math.abs(c) * 0.028 * mb;
          n.customRoot.position.y = n.customBaseY - (isCrouching ? 0.12 : 0) + stepBob;
        }

        const sb = (n.sprintBlend || 0) * mb;
        if (r.hips) setBoneWorldDelta(n, r.hips, (isCrouching ? 0.08 : 0) + ab * 0.12, s * (0.10 * mb + 0.05 * sb), c * 0.045 * mb + Math.sin(t * 1.4) * 0.015 * ib);
        if (r.spine) setBoneWorldDelta(n, r.spine, (isCrouching ? 0.12 : 0) + (0.04 * mb + 0.14 * sb) + Math.sin(t * 2.2) * 0.025 * ib + ab * 0.10, -s * (0.06 * mb + 0.04 * sb), 0);
        if (r.chest) setBoneWorldDelta(n, r.chest, Math.sin(t * 2.4) * 0.028 * (1 - mb * 0.5) + 0.04 * mb + 0.06 * sb, -s * 0.04 * mb, 0);

        // Física real de busto (CC_Base_L_Breast / CC_Base_R_Breast)
        const bustL = n.springPos + (isWalking ? s * 0.04 : 0);
        const bustR = n.springPos - (isWalking ? s * 0.04 : 0);
        const bustRz = isWalking ? c * 0.04 : Math.sin(t * 2.1) * 0.015;
        if (r.bustL) setBoneWorldDelta(n, r.bustL, -bustL, 0, bustRz);
        if (r.bustR) setBoneWorldDelta(n, r.bustR, -bustR, 0, -bustRz);

        // Cabelo / Orelhas / Saia extras balançando com mola
        if (r.extraHair && r.extraHair.length > 0) {
          for (let i = 0; i < r.extraHair.length; i++) {
            setBoneWorldDelta(n, r.extraHair[i], n.hairSway * 0.65, 0, (isWalking ? c * 0.07 : Math.sin(t * 1.6 + i) * 0.03));
          }
        }

        const headLookY = Math.sin(t * 1.1 + n.phase * 0.2) * 0.14;
        const headNodX = Math.sin(t * 1.5) * 0.05;
        const headTiltZ = Math.sin(t * 0.9) * 0.04;

        if (isCrouching) {
          if (r.thighL) setBoneWorldDelta(n, r.thighL, -0.52, 0, 0);
          if (r.thighR) setBoneWorldDelta(n, r.thighR, -0.52, 0, 0);
          if (r.calfL) setBoneWorldDelta(n, r.calfL, 0.98, 0, 0);
          if (r.calfR) setBoneWorldDelta(n, r.calfR, 0.98, 0, 0);
          if (r.footL) setBoneWorldDelta(n, r.footL, -0.32, 0, 0);
          if (r.footR) setBoneWorldDelta(n, r.footR, -0.32, 0, 0);
          if (r.armL) setBoneWorldDelta(n, r.armL, -0.22, 0, 0.05);
          if (r.armR) setBoneWorldDelta(n, r.armR, -0.22, 0, -0.05);
          if (r.foreL) setBoneWorldDelta(n, r.foreL, -0.65, 0, 0);
          if (r.foreR) setBoneWorldDelta(n, r.foreR, -0.65, 0, 0);
        } else {
          const strideAmp = 0.48 * mb + 0.24 * sb;
          const kneeAmp = 0.80 * mb + 0.35 * sb;
          const kneeLWalk = Math.max(0, -c) * kneeAmp + Math.max(0, s) * 0.20;
          const kneeRWalk = Math.max(0, c) * kneeAmp + Math.max(0, -s) * 0.20;
          const footLWalk = Math.max(0, -s) * 0.16 - Math.max(0, c) * 0.06;
          const footRWalk = Math.max(0, s) * 0.16 - Math.max(0, -c) * 0.06;
          const g1 = Math.sin(t * 2.1 + n.phase * 0.5);
          const g2 = Math.cos(t * 1.7 + n.phase * 0.3);

          if (r.thighL) setBoneWorldDelta(n, r.thighL, (-s * strideAmp) + (-0.75) * ab, 0, 0);
          if (r.thighR) setBoneWorldDelta(n, r.thighR, (s * strideAmp) + (0.20) * ab, 0, 0);
          if (r.calfL) setBoneWorldDelta(n, r.calfL, 0.05 * ib + kneeLWalk + 1.25 * ab, 0, 0);
          if (r.calfR) setBoneWorldDelta(n, r.calfR, 0.05 * ib + kneeRWalk + 0.55 * ab, 0, 0);
          if (r.footL) setBoneWorldDelta(n, r.footL, footLWalk * mb + 0.25 * ab, 0, 0);
          if (r.footR) setBoneWorldDelta(n, r.footR, footRWalk * mb + 0.20 * ab, 0, 0);
          const armSwing = 0.38 * mb + 0.28 * sb;
          const armClear = 0.11 * (1 - sb * 0.2) + 0.16 * sb;
          if (r.armL) setBoneWorldDelta(n, r.armL, (-0.06 + g1 * 0.06) * ib + (s * armSwing) + (-0.72) * ab, 0, (armClear + g2 * 0.03) * ib + armClear * mb + 0.34 * ab);
          if (r.armR) setBoneWorldDelta(n, r.armR, (-0.06 - g2 * 0.06) * ib + (-s * armSwing) + (-0.62) * ab, 0, (-armClear - g1 * 0.03) * ib - armClear * mb - 0.34 * ab);
          const idleBendL = 0.18 + Math.max(0, g1) * 0.10;
          const idleBendR = 0.18 + Math.max(0, -g2) * 0.10;
          const walkBendL = (0.24 * mb + 0.42 * sb) + Math.max(0, -s) * (0.48 * mb + 0.25 * sb);
          const walkBendR = (0.24 * mb + 0.42 * sb) + Math.max(0, s) * (0.48 * mb + 0.25 * sb);
          if (r.foreL) setBoneWorldDelta(n, r.foreL, -(idleBendL * ib + walkBendL + 0.65 * ab), 0, 0);
          if (r.foreR) setBoneWorldDelta(n, r.foreR, -(idleBendR * ib + walkBendR + 0.65 * ab), 0, 0);
          if (r.neck) setBoneWorldDelta(n, r.neck, headNodX * 0.45 * ib + Math.abs(c) * 0.03 * mb, headLookY * (0.45 * ib + 0.35 * mb), headTiltZ * 0.4 * ib);
          if (r.head) setBoneWorldDelta(n, r.head, headNodX * ib + (-0.02 + Math.abs(c) * 0.04) * mb, headLookY * (ib + 0.65 * mb), headTiltZ * (ib + 0.5 * mb));
        }

        // Olhos realistas + piscar natural igual à NPC 1
        n.blinkTimer = (n.blinkTimer || 2.5) - dt;
        if (n.blinkTimer <= 0) n.blinkTimer = 2.4 + Math.random() * 2.2;
        const eyeScaleY = n.blinkTimer < 0.14 ? 0.12 : 1.0;
        const eyeYaw = Math.sin(t * 0.9) * 0.10;
        if (r.eyeL && n.bones[r.eyeL]) {
          n.bones[r.eyeL].scale.y = eyeScaleY;
          setBoneWorldDelta(n, r.eyeL, 0, eyeYaw, 0);
        }
        if (r.eyeR && n.bones[r.eyeR]) {
          n.bones[r.eyeR].scale.y = eyeScaleY;
          setBoneWorldDelta(n, r.eyeR, 0, eyeYaw, 0);
        }
        // Animação de Combo de Soco nos ossos CustomRig (Cat Woman, Lily, Office, Cool Man)
        if (n === player && n.punchAnim && n.punchAnim > 0) {
          const maxDur = n.punchCombo === 2 ? 0.34 : 0.26;
          const pT = Math.sin((n.punchAnim / maxDur) * Math.PI);
          const isLeft = n.punchCombo === 1;
          if (r.chest) setBoneWorldDelta(n, r.chest, 0.15 * pT, (isLeft ? -0.42 : 0.42) * pT, 0);
          if (isLeft) {
            if (r.armL) setBoneWorldDelta(n, r.armL, -1.48 * pT, 0.18 * pT, 0.10);
            if (r.foreL) setBoneWorldDelta(n, r.foreL, -0.25 * (1 - pT), 0, 0);
          } else {
            if (r.armR) setBoneWorldDelta(n, r.armR, -1.55 * pT, -0.22 * pT, -0.10);
            if (r.foreR) setBoneWorldDelta(n, r.foreR, (n.punchCombo === 2 ? -0.55 : -0.18) * pT, 0, 0);
          }
        }
        return;
      }
      if (n.mixer) {
        n.mixer.update(dt * (isWalking ? 1.0 : 0.12));
        return;
      }
      return;
    }
    const b = n.bones;
    if (!b || !b.Hips) return;
    const t = performance.now() * 0.001;

    n.moveBlend = (n.moveBlend || 0) + ((isWalking ? 1 : 0) - (n.moveBlend || 0)) * Math.min(1, dt * 11);
    const isJumping = (n.grounded === false) || Math.abs(n.velY || 0) > 1.2;
    n.airBlend = (n.airBlend || 0) + ((isJumping ? 1 : 0) - (n.airBlend || 0)) * Math.min(1, dt * 12);
    const mb = n.moveBlend * (1 - n.airBlend);
    const ab = n.airBlend;
    const ib = (1 - n.moveBlend) * (1 - n.airBlend);

    n.phase += dt * (2.0 + n.moveBlend * 4.4);
    const s = Math.sin(n.phase);
    const c = Math.cos(n.phase);

    // Física real de mola-amortecedor
    const isCrouching = (n.crouchTimer || 0) > 0;
    const isAirborne = Math.abs(n.velY) > 0.15;
    let targetBounce = mb > 0.1 ? Math.abs(c) * 0.16 * mb : Math.sin(t * 2.2) * 0.025;
    if (isCrouching) targetBounce = -0.14;
    else if (isAirborne) targetBounce = Math.max(-0.32, Math.min(0.32, -n.velY * 0.055));

    n.springVel += ((targetBounce - n.springPos) * 46 - n.springVel * 4.6) * dt;
    n.springPos = Math.max(-0.38, Math.min(0.38, n.springPos + n.springVel * dt));

    const targetHair = (0.04 + Math.sin(t * 1.8) * 0.05) * (1 - mb) + (0.14 + s * 0.11) * mb;
    n.hairVel += ((targetHair - n.hairSway) * 32 - n.hairVel * 4.8 - n.velY * 0.05) * dt;
    n.hairSway = Math.max(-0.42, Math.min(0.42, n.hairSway + n.hairVel * dt));

    // Quadril, coluna e respiração fluidos (deltas suaves sobre a pose de repouso)
    if (b.Hips) {
      if (n.hipsInitY === undefined) n.hipsInitY = b.Hips.position.y;
      const stepBob = Math.abs(c) * 0.026 * mb;
      b.Hips.position.y = n.hipsInitY - (isCrouching ? 0.12 : 0) + stepBob;
    }
    setBoneDelta(
      n, 'Hips',
      (isCrouching ? 0.08 : 0) + ab * 0.08,
      s * 0.10 * mb,
      c * 0.045 * mb + Math.sin(t * 1.4) * 0.015 * ib
    );
    const sb = (n.sprintBlend || 0) * mb;
    setBoneDelta(
      n, 'Spine',
      (isCrouching ? 0.12 : 0) + (0.04 * mb + 0.12 * sb) + Math.sin(t * 2.2) * 0.025 * ib + ab * 0.06,
      -s * (0.06 * mb + 0.04 * sb),
      0
    );
    setBoneDelta(n, 'Chest', Math.sin(t * 2.4) * 0.028 * (1 - mb * 0.5) + 0.04 * mb + 0.06 * sb, -s * 0.04 * mb, 0);

    // Busto (seios) e Glúteos (bumbum) com física secundária realista
    const bustL = n.springPos + s * 0.04 * mb;
    const bustR = n.springPos - s * 0.04 * mb;
    setBoneDelta(n, 'BustL', bustL, 0, c * 0.04 * mb + Math.sin(t * 2.1) * 0.015 * ib);
    setBoneDelta(n, 'BustR', bustR, 0, -c * 0.04 * mb - Math.sin(t * 2.1) * 0.015 * ib);
    setBoneDelta(n, 'GluteL', s * 0.12 * mb - n.springPos * 0.65, 0, 0);
    setBoneDelta(n, 'GluteR', -s * 0.12 * mb - n.springPos * 0.65, 0, 0);

    // Cabelo longo balançando para trás (nunca atravessa as costas/cintura)
    const hairBack = -Math.max(0.06, Math.abs(n.hairSway) * 0.95);
    setBoneDelta(n, 'HairMid', hairBack, 0, c * 0.07 * mb + Math.sin(t * 1.4) * 0.03 * ib);
    setBoneDelta(n, 'HairTip', hairBack * 1.25, 0, -s * 0.09 * mb + Math.cos(t * 1.4) * 0.04 * ib);

    // Braços, joelhos, tornozelos e cabeça com transição suave (idle / caminhada / sprint / pulo)
    const armRestZ = (n.armRestZ !== undefined) ? n.armRestZ : 0.38;
    if (isCrouching) {
      setBoneDelta(n, 'ThighL', -0.45, 0, 0);
      setBoneDelta(n, 'ThighR', -0.45, 0, 0);
      setBoneDelta(n, 'ShinL', 0.85, 0, 0);
      setBoneDelta(n, 'ShinR', 0.85, 0, 0);
      setBoneDelta(n, 'UpperArmL', -0.18, 0, armRestZ + 0.08);
      setBoneDelta(n, 'UpperArmR', -0.18, 0, -armRestZ - 0.08);
      setBoneDelta(n, 'ForeArmL', -0.55, 0, 0.18);
      setBoneDelta(n, 'ForeArmR', -0.55, 0, -0.18);
    } else {
      const g1 = Math.sin(t * 2.1 + n.phase * 0.5);
      const g2 = Math.cos(t * 1.7 + n.phase * 0.3);
      const strideAmp = 0.46 * mb + 0.22 * sb;
      const kneeAmp = 0.60 * mb + 0.28 * sb;
      const kneeLWalk = Math.max(0, -c * kneeAmp) + Math.max(0, s) * 0.18;
      const kneeRWalk = Math.max(0, c * kneeAmp) + Math.max(0, -s) * 0.18;

      setBoneDelta(n, 'ThighL', s * strideAmp + (-0.38) * ab, 0, 0);
      setBoneDelta(n, 'ThighR', -s * strideAmp + (0.16) * ab, 0, 0);
      setBoneDelta(n, 'ShinL', 0.05 * ib + kneeLWalk + 0.78 * ab, 0, 0);
      setBoneDelta(n, 'ShinR', 0.05 * ib + kneeRWalk + 0.42 * ab, 0, 0);

      const armSwing = 0.32 * mb + 0.24 * sb;
      const elbowBase = 0.24 * mb + 0.38 * sb;
      setBoneDelta(n, 'UpperArmL', (-0.10 + g1 * 0.09) * ib + (-0.08 * mb - s * armSwing) + (-0.42) * ab, 0, armRestZ + g2 * 0.04 * ib + 0.24 * ab);
      setBoneDelta(n, 'UpperArmR', (-0.09 - g2 * 0.08) * ib + (-0.08 * mb + s * armSwing) + (-0.36) * ab, 0, -armRestZ - g1 * 0.04 * ib - 0.24 * ab);
      setBoneDelta(n, 'ForeArmL', (-0.36 + g1 * 0.14) * ib + (-elbowBase - Math.max(0, s) * (0.42 * mb + 0.24 * sb)) - 0.52 * ab, 0, 0.16);
      setBoneDelta(n, 'ForeArmR', (-0.34 - g2 * 0.12) * ib + (-elbowBase - Math.max(0, -s) * (0.42 * mb + 0.24 * sb)) - 0.52 * ab, 0, -0.16);
      setBoneDelta(n, 'Head', Math.sin(t * 1.5) * 0.05 * ib - 0.04 * mb - 0.06 * sb, Math.cos(t * 1.1) * 0.09 * ib + s * 0.03 * mb, Math.sin(t * 0.9) * 0.035 * ib);
    }

    // Animação de Combo de Soco nos ossos de 21-bones (NPC 1 / Walking)
    if (n === player && n.punchAnim && n.punchAnim > 0) {
      const maxDur = n.punchCombo === 2 ? 0.34 : 0.26;
      const pT = Math.sin((n.punchAnim / maxDur) * Math.PI);
      const isLeft = n.punchCombo === 1;
      setBoneDelta(n, 'Chest', 0.16 * pT, (isLeft ? -0.45 : 0.45) * pT, 0);
      if (isLeft) {
        setBoneDelta(n, 'UpperArmL', -1.52 * pT, 0.15 * pT, armRestZ * 0.4);
        setBoneDelta(n, 'ForeArmL', -0.22 * (1 - pT), 0, 0.12);
      } else {
        setBoneDelta(n, 'UpperArmR', -1.58 * pT, -0.18 * pT, -armRestZ * 0.4);
        setBoneDelta(n, 'ForeArmR', (n.punchCombo === 2 ? -0.58 : -0.20) * pT, 0, -0.12);
      }
    }

    // Olhos realistas + piscar sutil
    n.blinkTimer -= dt;
    if (n.blinkTimer <= 0) n.blinkTimer = 2.8 + Math.random() * 2.5;
    const eyeScaleY = n.blinkTimer < 0.12 ? 0.15 : 1.0;
    if (b.EyeL) b.EyeL.scale.y = eyeScaleY;
    if (b.EyeR) b.EyeR.scale.y = eyeScaleY;
    setBoneDelta(n, 'EyeL', 0, Math.sin(t * 0.9) * 0.05, 0);
    setBoneDelta(n, 'EyeR', 0, Math.sin(t * 0.9) * 0.05, 0);
  }

  function isNpcBlockedAt(x, z, curY, selfNpc) {
    if (colMeta && colGrid) {
      const ix = Math.floor((x - colMeta.minX) / colMeta.step);
      const iy = Math.floor((-z - colMeta.minY) / colMeta.step);
      const h = sampleCellWalkableH(ix, iy, curY, 1.15);
      if (h === null || curY - h > 1.65) return true;
    }
    for (const v of vehicles) {
      if (Math.hypot(x - v.pos.x, z - v.pos.z) < 2.35) return true;
    }
    for (const o of npcs) {
      if (o !== selfNpc && Math.hypot(x - o.pos.x, z - o.pos.z) < 0.95) return true;
    }
    return false;
  }

  function steerNpcSmart(n, desiredYaw, curY) {
    const offsets = [0, 0.6, -0.6, 1.25, -1.25, 2.0, -2.0, Math.PI];
    for (const off of offsets) {
      const testYaw = desiredYaw + off;
      const tx = n.pos.x - Math.sin(testYaw) * 1.9;
      const tz = n.pos.z - Math.cos(testYaw) * 1.9;
      if (!isNpcBlockedAt(tx, tz, curY, n)) return testYaw;
    }
    return desiredYaw + Math.PI * 0.75;
  }

  function updateNPCs(dt) {
    for (const n of npcs) {
      if (n.isJobNpc) {
        const dxP = player.pos.x - n.pos.x;
        const dzP = player.pos.z - n.pos.z;
        const distToPlayer = Math.hypot(dxP, dzP);
        let walking = false;

        if (n.knockTimer > 0) {
          n.knockTimer -= dt;
          n.pos.x += n.vel.x * dt; n.pos.z += n.vel.z * dt;
          n.velY -= 20 * dt;
          n.pos.y += n.velY * dt;
          n.vel.multiplyScalar(0.88);
          resolveMapWallCollision(n.pos, 0.5);
          n.mesh.rotation.x = (n.dead || n.knockTimer > 0.5) ? Math.PI * 0.48 : 0;
          const gyk = getWalkableGround(n.pos.x, n.pos.z, n.pos.y);
          if (gyk !== null && n.pos.y <= gyk) { n.pos.y = gyk; n.velY = 0; }
          continue;
        }
        n.mesh.rotation.x = 0;

        if (n.summoned) {
          // Segue rota real pelas ruas até chegar ao jogador
          n.routeTimer = (n.routeTimer || 0) + dt;
          if (n.routeTimer > 1.2 && distToPlayer > 5.0) {
            n.routeTimer = 0;
            n.routeWaypoints = computeGpsRoute(n.pos.x, n.pos.z, player.pos.x, player.pos.z);
            n.routeIdx = 1;
          }
          let tx = player.pos.x, tz = player.pos.z;
          if (n.routeWaypoints && n.routeIdx < n.routeWaypoints.length && distToPlayer > 5.0) {
            const wp = n.routeWaypoints[n.routeIdx];
            if (Math.hypot(wp.x - n.pos.x, wp.z - n.pos.z) < 2.2) n.routeIdx++;
            if (n.routeIdx < n.routeWaypoints.length) { tx = n.routeWaypoints[n.routeIdx].x; tz = n.routeWaypoints[n.routeIdx].z; }
          }
          if (distToPlayer > 1.85) {
            walking = true;
            const tdx = tx - n.pos.x, tdz = tz - n.pos.z;
            const td = Math.hypot(tdx, tdz) || 1;
            n.pos.x += (tdx / td) * 2.4 * dt;
            n.pos.z += (tdz / td) * 2.4 * dt;
            resolveMapWallCollision(n.pos, 0.5);
            n.mesh.rotation.y = Math.atan2(tdx, tdz);
          } else {
            n.summoned = false;
            n.followingPlayer = true;
            n.mesh.rotation.y = Math.atan2(dxP, dzP);
            AudioFX.coin();
            showToast('💃 Cheguei! Estou aqui do seu lado.', 2600);
          }
        } else if (n.followingPlayer) {
          // Fica parada no lugar; antes de pular, flexiona os joelhos (crouchTimer) e depois pula com altura natural!
          if (!player.grounded && player.velY > 5.5 && n.velY === 0 && (n.crouchTimer || 0) <= 0 && distToPlayer < 8.5) {
            n.crouchTimer = 0.18;
          }
          if ((n.crouchTimer || 0) > 0) {
            n.crouchTimer -= dt;
            if (n.crouchTimer <= 0) {
              n.crouchTimer = 0;
              n.velY = 5.1; // pulo realista natural
              n.hairVel += 2.2;
            }
          }
          if (distToPlayer > 18) {
            walking = true;
            n.pos.x += (dxP / distToPlayer) * 2.4 * dt;
            n.pos.z += (dzP / distToPlayer) * 2.4 * dt;
            resolveMapWallCollision(n.pos, 0.55);
            n.mesh.rotation.y = Math.atan2(dxP, dzP);
          }
        } else {
          // Fica visível perto da Central Delivery / Spawn (ronda num raio curto de 7m) e reage quando o jogador pula perto!
          if (!player.grounded && player.velY > 5.5 && n.velY === 0 && (n.crouchTimer || 0) <= 0 && distToPlayer < 8.5) {
            n.crouchTimer = 0.18;
          }
          if ((n.crouchTimer || 0) > 0) {
            n.crouchTimer -= dt;
            if (n.crouchTimer <= 0) {
              n.crouchTimer = 0;
              n.velY = 5.1;
              n.hairVel += 2.2;
            }
          }
          const distHome = Math.hypot(n.pos.x - n.homePos.x, n.pos.z - n.homePos.z);
          if (distToPlayer < 6.0) {
            // Quando o jogador chega perto, ela para e olha para ele gesticulando
            walking = false;
            n.mesh.rotation.y = Math.atan2(dxP, dzP);
          } else {
            walking = true;
            if (distHome > 6.5) {
              n.yaw = Math.atan2(-(n.homePos.x - n.pos.x), -(n.homePos.z - n.pos.z));
            } else {
              n.turnTimer -= dt;
              if (n.turnTimer <= 0) { n.yaw += (Math.random() - 0.5) * 1.4; n.turnTimer = 2.5 + Math.random() * 3.5; }
              n.yaw = steerNpcSmart(n, n.yaw, n.pos.y);
            }
            const dx = -Math.sin(n.yaw), dz = -Math.cos(n.yaw);
            n.pos.x += dx * 1.35 * dt; n.pos.z += dz * 1.35 * dt;
            if (resolveMapWallCollision(n.pos, 0.55)) n.yaw = steerNpcSmart(n, n.yaw + Math.PI * 0.5, n.pos.y);
            n.mesh.rotation.y = n.yaw + Math.PI;
          }
        }

        n.velY -= 20 * dt;
        n.pos.y += n.velY * dt;
        const gy = getWalkableGround(n.pos.x, n.pos.z, n.pos.y);
        if (gy !== null && n.pos.y <= gy) {
          if (n.velY < -1.8) n.springVel -= n.velY * 0.9; // impacto do pouso faz seios balançarem
          n.pos.y = gy;
          n.velY = 0;
        } else if (gy === null && !n.summoned && !n.followingPlayer) {
          n.yaw += Math.PI;
        }
        // Colisão sólida da NPC do Job com carros e pessoas
        for (const v of vehicles) {
          const vdx = n.pos.x - v.pos.x, vdz = n.pos.z - v.pos.z;
          const vd = Math.hypot(vdx, vdz);
          if (vd > 0.001 && vd < 1.85) { n.pos.x += (vdx / vd) * (1.85 - vd); n.pos.z += (vdz / vd) * (1.85 - vd); }
        }
        animateJobNpcBones(n, dt, walking);
        continue;
      }

      if (n.aiState === 'mc_worker' || n.aiState === 'mc_eater') {
        // Trabalhadores no balcão/cozinha e clientes nas mesas dentro do McDonald's
        const tMc = performance.now() * 0.004 + n.phase;
        n.mesh.rotation.y = n.yaw;
        if (n.isCitizen && n.animRoot) {
          if (n.aiState === 'mc_worker') {
            n.animRoot.position.y = Math.abs(Math.sin(tMc)) * 0.03;
            n.animRoot.rotation.z = Math.sin(tMc * 0.7) * 0.04;
            if (n.citizenHead) n.citizenHead.rotation.y = Math.sin(tMc * 0.5) * 0.15;
          } else {
            n.animRoot.position.y = -0.28;
            if (n.citizenHead) n.citizenHead.rotation.x = Math.sin(tMc * 0.8) * 0.08;
          }
        } else if (n.aiState === 'mc_worker') {
          if (n.parts.ArmL) n.parts.ArmL.rotation.x = -0.55 + Math.sin(tMc) * 0.35;
          if (n.parts.ArmR) n.parts.ArmR.rotation.x = -0.55 - Math.cos(tMc) * 0.35;
        } else {
          if (n.parts.LegL) n.parts.LegL.rotation.x = -1.25;
          if (n.parts.LegR) n.parts.LegR.rotation.x = -1.25;
          if (n.parts.ArmR) n.parts.ArmR.rotation.x = -0.65 + Math.sin(tMc * 0.8) * 0.25;
        }
        continue;
      }

      // Recicla NPCs muito longe (>100m) para ruas válidas no chão (gy <= 2.0m)
      const distP = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z);
      // Culling de distância: oculta e pula animação de NPCs > 85m
      n.mesh.visible = distP < 85;
      if (distP > 100 || (n.dead && n.knockTimer <= 0.1)) {
        for (let t = 0; t < 16; t++) {
          const a = Math.random() * Math.PI * 2;
          const r = 18 + Math.random() * 44;
          const rx = player.pos.x + Math.cos(a) * r;
          const rz = player.pos.z + Math.sin(a) * r;
          if (getRoadCellAt(rx, rz) < 1) continue;
          const rgy = getSafeGroundForSpawn(rx, rz, player.pos.y);
          if (rgy !== null && Math.abs(rgy - player.pos.y) <= 14.0 && !isNpcBlockedAt(rx, rz, rgy, n)) {
            n.pos.set(rx, rgy, rz);
            n.hp = 100; n.dead = false; n.knockTimer = 0; n.velY = 0;
            n.mesh.rotation.x = 0;
            break;
          }
        }
      }
      if (!n.mesh.visible) continue;

      if (n.knockTimer > 0) {
        n.knockTimer -= dt;
        n.pos.x += n.vel.x * dt; n.pos.z += n.vel.z * dt;
        n.velY -= 20 * dt;
        n.pos.y += n.velY * dt;
        n.vel.multiplyScalar(0.86);
        resolveMapWallCollision(n.pos, 0.5);
        if (n.dead) {
          // Queda progressiva suave no chão
          n.fallTilt = Math.min(Math.PI * 0.48, (n.fallTilt || 0) + dt * 5.5);
          n.mesh.rotation.x = n.fallTilt;
        } else {
          // Stagger de impacto (curva o tronco para trás/lado sem virar tábua dura!)
          const stg = Math.sin(Math.min(1, n.knockTimer / 0.6) * Math.PI);
          n.mesh.rotation.x = -0.36 * stg;
          n.mesh.rotation.z = 0.18 * stg;
        }
        const gy = getWalkableGround(n.pos.x, n.pos.z, n.pos.y) ?? getGroundHeight(n.pos.x, n.pos.z);
        if (gy !== null && n.pos.y <= gy + 0.06) { n.pos.y = gy; n.velY = 0; }
        continue;
      }
      n.fallTilt = 0;
      n.mesh.rotation.x = 0;
      n.mesh.rotation.z = 0;

      // Se o NPC ficou hostil após ser agredido, persegue o jogador e revida!
      if (n.hostileToPlayer && !player.inCar && distP < 18) {
        const hdx = player.pos.x - n.pos.x;
        const hdz = player.pos.z - n.pos.z;
        const hd = Math.hypot(hdx, hdz) || 1;
        n.yaw = Math.atan2(-hdx, -hdz);
        if (hd > 1.25) {
          n.pos.x += (hdx / hd) * 3.1 * dt;
          n.pos.z += (hdz / hd) * 3.1 * dt;
          resolveMapWallCollision(n.pos, 0.55);
          if (n.isCitizen && n.bones && n.bones.Hips) animateJobNpcBones(n, dt * 1.4, true);
        } else {
          n.attackCool = (n.attackCool || 0) - dt;
          if (n.attackCool <= 0) {
            n.attackCool = 1.15;
            player.hp = Math.max(0, player.hp - 8);
            ui.hpFill.style.width = player.hp + '%';
            spawnPunchImpact(player.pos.x, player.pos.y + 1.2, player.pos.z, false);
            AudioFX.crash();
            vibrate(35);
            if (player.hp <= 0) { respawnAtHospital('Nocauteado na briga de rua!'); return; }
          }
        }
        const hgy = getWalkableGround(n.pos.x, n.pos.z, n.pos.y);
        if (hgy !== null) n.pos.y = hgy;
        n.mesh.rotation.y = n.yaw;
        continue;
      }

      // IA Autônoma: calçadas, faixas de pedestres, conversa entre si, famílias e fuga de acidentes!
      if (n.chatCooldown > 0) n.chatCooldown -= dt;
      n.aiTimer -= dt;
      if (n.aiTimer <= 0) {
        if (n.aiState === 'walk') {
          n.aiState = Math.random() < (n.role === 'tourist' ? 0.45 : 0.22) ? 'idle_look' : 'walk';
          n.aiTimer = n.aiState === 'idle_look' ? (1.8 + Math.random() * 3.2) : (3.5 + Math.random() * 6.0);
        } else {
          n.aiState = 'walk';
          n.chatPartner = null;
          n.aiTimer = 4.0 + Math.random() * 7.0;
          n.yaw += (Math.random() - 0.5) * 1.2;
        }
      }

      // Parar para conversar entre si quando dois pedestres próximos se encontram
      if (n.aiState === 'walk' && !n.familyLeader && (n.chatCooldown || 0) <= 0) {
        for (const other of npcs) {
          if (other === n || other.isJobNpc || other.dead || other.familyLeader === n || n.familyLeader === other) continue;
          if (other.aiState === 'walk' && (other.chatCooldown || 0) <= 0) {
            const dChat = Math.hypot(other.pos.x - n.pos.x, other.pos.z - n.pos.z);
            if (dChat > 0.8 && dChat < 1.85 && Math.random() < 0.04) {
              const dur = 3.5 + Math.random() * 3.0;
              n.aiState = 'chat'; n.aiTimer = dur; n.chatPartner = other; n.chatCooldown = 18;
              other.aiState = 'chat'; other.aiTimer = dur; other.chatPartner = n; other.chatCooldown = 18;
              break;
            }
          }
        }
      }

      // Foge se houver carro em alta velocidade muito perto
      let curSpeed = n.baseSpeed || 1.7;
      for (const v of vehicles) {
        if (Math.abs(v.speed) > 10 && Math.hypot(v.pos.x - n.pos.x, v.pos.z - n.pos.z) < 9.5) {
          n.aiState = 'flee';
          n.chatPartner = null;
          n.aiTimer = 2.2;
          n.yaw = Math.atan2(-(n.pos.x - v.pos.x), -(n.pos.z - v.pos.z));
          break;
        }
      }

      let isMoving = true;
      if (n.familyLeader && !n.familyLeader.dead && n.familyLeader.knockTimer <= 0) {
        const fl = n.familyLeader;
        const sideAng = fl.yaw + Math.PI * 0.5;
        const tx = fl.pos.x - Math.sin(sideAng) * (n.familyOffset || 0.8);
        const tz = fl.pos.z - Math.cos(sideAng) * (n.familyOffset || 0.8);
        const fdx = tx - n.pos.x, fdz = tz - n.pos.z;
        const fdist = Math.hypot(fdx, fdz);
        if (fdist > 0.35 && fdist < 22) {
          n.yaw = Math.atan2(-fdx, -fdz);
          curSpeed = Math.min(3.4, fdist * 2.2 + 0.8);
        } else if (fl.aiState === 'idle_look' || fl.aiState === 'chat') {
          isMoving = false;
          n.yaw = fl.yaw;
        } else {
          isMoving = true;
          n.yaw = fl.yaw;
          curSpeed = fl.baseSpeed || 1.6;
        }
      } else if (n.aiState === 'chat' && n.chatPartner && !n.chatPartner.dead) {
        isMoving = false;
        const cdx = n.chatPartner.pos.x - n.pos.x;
        const cdz = n.chatPartner.pos.z - n.pos.z;
        n.yaw = Math.atan2(-cdx, -cdz);
      } else if (n.aiState === 'idle_look') {
        isMoving = false;
        n.yaw += Math.sin(performance.now() * 0.001 + n.phase) * 0.25 * dt;
      } else if (n.aiState === 'flee') {
        curSpeed = 3.6;
      } else {
        n.turnTimer -= dt;
        if (n.turnTimer <= 0) { n.yaw += (Math.random() - 0.5) * 1.4; n.turnTimer = 2.2 + Math.random() * 4.5; }
        // Prefere andar nas calçadas (roadCell === 2) e atravessar apenas pelas faixas de pedestres!
        const curCell = getRoadCellAt(n.pos.x, n.pos.z);
        const nextX = n.pos.x - Math.sin(n.yaw) * 2.2;
        const nextZ = n.pos.z - Math.cos(n.yaw) * 2.2;
        const nextCell = getRoadCellAt(nextX, nextZ);
        if (curCell === 2 && nextCell === 1) {
          let nearCrosswalk = false;
          for (const cw of crosswalks) {
            if (Math.hypot(n.pos.x - cw.x, n.pos.z - cw.z) < 7.5) { nearCrosswalk = true; break; }
          }
          if (!nearCrosswalk) n.yaw += 0.85;
        }
      }

      if (isMoving) {
        n.yaw = steerNpcSmart(n, n.yaw, n.pos.y);
        const dx = -Math.sin(n.yaw), dz = -Math.cos(n.yaw);
        n.pos.x += dx * curSpeed * dt; n.pos.z += dz * curSpeed * dt;
        if (resolveMapWallCollision(n.pos, 0.65)) n.yaw = steerNpcSmart(n, n.yaw + Math.PI * 0.5, n.pos.y);
      }

      // Colisão sólida de NPCs com carros e outros NPCs (ninguém atravessa ninguém!)
      for (const v of vehicles) {
        const vdx = n.pos.x - v.pos.x, vdz = n.pos.z - v.pos.z;
        const vd = Math.hypot(vdx, vdz);
        if (vd > 0.001 && vd < 1.85) {
          n.pos.x += (vdx / vd) * (1.85 - vd);
          n.pos.z += (vdz / vd) * (1.85 - vd);
          n.yaw += Math.PI * 0.6;
        }
      }
      for (const tc of trafficCars) {
        const vdx = n.pos.x - tc.pos.x, vdz = n.pos.z - tc.pos.z;
        const vd = Math.hypot(vdx, vdz);
        const minD = tc.radius + 0.45;
        if (vd > 0.001 && vd < minD) {
          n.pos.x += (vdx / vd) * (minD - vd);
          n.pos.z += (vdz / vd) * (minD - vd);
          if (tc.speed > 8.5 && !n.dead) {
            n.hp = Math.max(0, n.hp - tc.speed * 4.5);
            n.knockTimer = n.hp <= 0 ? 10.0 : 2.8;
            n.vel.set((vdx / vd) * 6, 0, (vdz / vd) * 6);
            n.velY = 3.2;
            if (n.hp <= 0) n.dead = true;
          }
        }
      }
      if (distP < 48) {
        for (const other of npcs) {
          if (other === n) continue;
          const ndx = n.pos.x - other.pos.x, ndz = n.pos.z - other.pos.z;
          const nd = Math.hypot(ndx, ndz);
          if (nd > 0.001 && nd < 0.78) {
            const push = (0.78 - nd) * 0.5;
            n.pos.x += (ndx / nd) * push;
            n.pos.z += (ndz / nd) * push;
          }
        }
      }

      const gy = getWalkableGround(n.pos.x, n.pos.z, n.pos.y) ?? getGroundHeight(n.pos.x, n.pos.z);
      if (gy !== null && gy >= -30.0 && gy <= 75.0 && Math.abs(gy - n.pos.y) < 1.8) {
        n.pos.y = gy;
      } else {
        // Evita cair em bordas de cais/pontes ou entrar em paredes
        n.yaw += Math.PI * 0.75;
        n.pos.x -= Math.sin(n.yaw) * 0.45;
        n.pos.z -= Math.cos(n.yaw) * 0.45;
        const safeGy = getWalkableGround(n.pos.x, n.pos.z, n.pos.y);
        if (safeGy !== null && Math.abs(safeGy - n.pos.y) < 2.2) n.pos.y = safeGy;
      }

      n.mesh.rotation.y = n.yaw;
      if (n.isCitizen && n.bones && n.bones.Hips) {
        // Cidadãos aleatórios agora usam o mesmo esqueleto de 21 ossos e física completa da NPC 1!
        const speedScale = isMoving ? Math.max(0.75, Math.min(1.6, curSpeed / 1.7)) : 1.0;
        animateJobNpcBones(n, dt * speedScale, isMoving);
      } else if (n.isCitizen && n.animRoot) {
        if (isMoving) {
          n.phase += dt * (curSpeed * 4.2);
          n.animRoot.position.y = Math.abs(Math.sin(n.phase)) * 0.055;
          n.animRoot.rotation.z = Math.sin(n.phase) * 0.045;
          n.animRoot.rotation.y = Math.PI + Math.cos(n.phase) * 0.06;
          if (n.citizenHead) n.citizenHead.rotation.y = Math.sin(n.phase * 0.5) * 0.05;
        } else if (n.aiState === 'chat') {
          const tc = performance.now() * 0.004 + n.phase;
          n.animRoot.position.y = Math.abs(Math.sin(tc * 0.7)) * 0.02;
          n.animRoot.rotation.z = Math.sin(tc) * 0.03;
          n.animRoot.rotation.y = Math.PI;
          if (n.citizenHead) n.citizenHead.rotation.y = Math.sin(tc * 1.1) * 0.16;
        } else {
          n.animRoot.position.y *= 0.85;
          n.animRoot.rotation.z *= 0.85;
          n.animRoot.rotation.y = Math.PI;
          if (n.citizenHead) n.citizenHead.rotation.y = Math.sin(performance.now() * 0.0012 + n.phase) * 0.14;
        }
      } else if (isMoving) {
        n.phase += dt * (curSpeed * 3.4);
        const s = Math.sin(n.phase) * 0.48;
        if (n.parts.LegL) n.parts.LegL.rotation.x = s;
        if (n.parts.LegR) n.parts.LegR.rotation.x = -s;
        if (n.parts.ArmL) n.parts.ArmL.rotation.x = -s * 0.65;
        if (n.parts.ArmR) n.parts.ArmR.rotation.x = s * 0.65;
      } else if (n.aiState === 'chat') {
        const g = Math.sin(performance.now() * 0.005 + n.phase) * 0.32;
        if (n.parts.LegL) n.parts.LegL.rotation.x *= 0.85;
        if (n.parts.LegR) n.parts.LegR.rotation.x *= 0.85;
        if (n.parts.ArmL) n.parts.ArmL.rotation.x = -0.35 + g;
        if (n.parts.ArmR) n.parts.ArmR.rotation.x = -0.35 - g;
      } else {
        ['LegL', 'LegR', 'ArmL', 'ArmR'].forEach((k) => { if (n.parts[k]) n.parts[k].rotation.x *= 0.85; });
      }
    }
  }

  // --- Sistema de Tráfego de Veículos (8 direções + Grid 1024x1024) ---
  const TRAFFIC_DIRS = [
    { dx: 0,  dy: -1, yaw: Math.PI,           axis: 'NS' },   // 0: Norte (-Z)
    { dx: 1,  dy: -1, yaw: Math.PI * 0.75,    axis: 'DIAG' }, // 1: Nordeste
    { dx: 1,  dy: 0,  yaw: Math.PI * 0.5,     axis: 'EW' },   // 2: Leste (+X)
    { dx: 1,  dy: 1,  yaw: Math.PI * 0.25,    axis: 'DIAG' }, // 3: Sudeste
    { dx: 0,  dy: 1,  yaw: 0,                 axis: 'NS' },   // 4: Sul (+Z)
    { dx: -1, dy: 1,  yaw: -Math.PI * 0.25,   axis: 'DIAG' }, // 5: Sudoeste
    { dx: -1, dy: 0,  yaw: -Math.PI * 0.5,    axis: 'EW' },   // 6: Oeste (-X)
    { dx: -1, dy: -1, yaw: -Math.PI * 0.75,   axis: 'DIAG' }  // 7: Noroeste
  ];

  function buildRoadCells() {
    roadCells = [];
    const N = roadGridN;
    driveableGrid = new Uint8Array(N * N);
    if (!colMeta || !roadGrid) return;
    const worldW = colMeta.W * colMeta.step;
    const worldH = colMeta.H * colMeta.step;
    for (let gy = 4; gy < N - 4; gy++) {
      for (let gx = 4; gx < N - 4; gx++) {
        if (roadGrid[gy * N + gx] !== 1) continue;
        const wx = colMeta.minX + ((gx + 0.5) / N) * worldW;
        const wz = -(colMeta.minY + (1.0 - (gy + 0.5) / N) * worldH);
        if (isOutsideIsland(wx, wz)) continue;
        const ix = Math.floor((wx - colMeta.minX) / colMeta.step);
        const iy = Math.floor((-wz - colMeta.minY) / colMeta.step);
        if (ix < 0 || iy < 0 || ix >= colMeta.W || iy >= colMeta.H) continue;
        const raw = getCellRaw(ix, iy);
        const hasTop = (raw !== -32768 && raw < 29500 && raw >= -3000 && raw <= 7500);
        let hasUnder = false;
        if (colFloor) {
          const fi = (iy * colMeta.W + ix) * 2;
          const f = colFloor[fi];
          const c = colFloor[fi + 1];
          if (f !== -32768 && (c - f) >= 200 && f >= -3000 && f <= 7500) hasUnder = true;
        }
        if (!hasTop && !hasUnder) continue;
        driveableGrid[gy * N + gx] = 1;
      }
    }
    // Marca com 2 o miolo seguro da via (afastado >= 1 célula de meio-fio, calçada ou mureta)
    for (let gy = 5; gy < N - 5; gy++) {
      const row = gy * N;
      for (let gx = 5; gx < N - 5; gx++) {
        if (driveableGrid[row + gx] === 0) continue;
        if (driveableGrid[row + gx + 1] > 0 &&
            driveableGrid[row + gx - 1] > 0 &&
            driveableGrid[row + N + gx] > 0 &&
            driveableGrid[row - N + gx] > 0) {
          driveableGrid[row + gx] = 2;
        }
      }
    }
    const stride = N >= 512 ? 2 : 1;
    for (let gy = 6; gy < N - 6; gy += stride) {
      for (let gx = 6; gx < N - 6; gx += stride) {
        if (driveableGrid[gy * N + gx] !== 2) continue;
        const wx = colMeta.minX + ((gx + 0.5) / N) * worldW;
        const wz = -(colMeta.minY + (1.0 - (gy + 0.5) / N) * worldH);
        roadCells.push({ gx, gy, wx, wz });
      }
    }
  }

  function getDriveableLevel(gx, gy) {
    const N = roadGridN;
    if (!driveableGrid || gx < 4 || gy < 4 || gx >= N - 4 || gy >= N - 4) return 0;
    return driveableGrid[gy * N + gx];
  }

  function gridCellToWorld(gx, gy) {
    const N = roadGridN;
    const worldW = colMeta.W * colMeta.step;
    const worldH = colMeta.H * colMeta.step;
    return {
      x: colMeta.minX + ((gx + 0.5) / N) * worldW,
      z: -(colMeta.minY + (1.0 - (gy + 0.5) / N) * worldH)
    };
  }

  // Retorna altura real de pista contínua (funciona embaixo de viadutos E em cima de pontes/ladeiras, sem subir muretas)
  function getTrafficGroundY(wx, wz, refY) {
    const topY = getGroundHeight(wx, wz);
    if (refY === undefined || refY === null) {
      const uf0 = getUnderFloorWorld(wx, wz, 0.2, 65.0, 2.1);
      if (topY !== null && topY >= -30 && topY <= 75 && !isSolidMapCell(wx, wz, topY, 0.42)) return topY;
      if (uf0 !== null && uf0 >= -30 && uf0 <= 75 && !isSolidMapCell(wx, wz, uf0, 0.42)) return uf0;
      return null;
    }
    let best = null;
    let bestDiff = 0.72;
    const uf = getUnderFloorWorld(wx, wz, refY, 0.72, 2.0);
    if (uf !== null) {
      const d = Math.abs(uf - refY);
      if (d <= bestDiff) { best = uf; bestDiff = d; }
    }
    if (topY !== null) {
      const d = Math.abs(topY - refY);
      if (d <= bestDiff) { best = topY; bestDiff = d; }
    }
    return best;
  }

  function isCarPoseClear(wx, wz, y, pad = 1.0) {
    if (getRoadCellAt(wx, wz) !== 1) return false;
    if (isSolidMapCell(wx, wz, y, 0.40)) return false;
    if (isSolidMapCell(wx + pad, wz, y, 0.40)) return false;
    if (isSolidMapCell(wx - pad, wz, y, 0.40)) return false;
    if (isSolidMapCell(wx, wz + pad, y, 0.40)) return false;
    if (isSolidMapCell(wx, wz - pad, y, 0.40)) return false;
    return true;
  }

  function canStepTraffic(gx, gy, curY, dirIdx, stepCells = 3, requireCore = true) {
    const d = TRAFFIC_DIRS[dirIdx];
    const minLv = requireCore ? 2 : 1;
    let runY = curY;
    for (let k = 1; k <= stepCells; k++) {
      const nx = gx + d.dx * k;
      const ny = gy + d.dy * k;
      if (getDriveableLevel(nx, ny) < minLv) return false;
      const wp = gridCellToWorld(nx, ny);
      const hy = getTrafficGroundY(wp.x, wp.z, runY);
      if (hy === null || Math.abs(hy - runY) > 0.65) return false;
      if (!isCarPoseClear(wp.x, wp.z, hy, 0.92)) return false;
      runY = hy;
    }
    return true;
  }

  function getLaneTargetPos(gx, gy, curY, dirIdx) {
    const c = gridCellToWorld(gx, gy);
    const baseH = getTrafficGroundY(c.x, c.z, curY) ?? curY;
    const d = TRAFFIC_DIRS[dirIdx];
    const rightDir = TRAFFIC_DIRS[(dirIdx + 2) % 8];
    const rx = -Math.cos(d.yaw);
    const rz = Math.sin(d.yaw);
    if (getDriveableLevel(gx + rightDir.dx * 2, gy + rightDir.dy * 2) >= 2) {
      for (const off of [1.30, 0.75]) {
        const tx = c.x + rx * off;
        const tz = c.z + rz * off;
        const th = getTrafficGroundY(tx, tz, baseH);
        if (th !== null && Math.abs(th - baseH) <= 0.35 && isCarPoseClear(tx, tz, th, 1.05)) {
          return { x: tx, y: th, z: tz };
        }
      }
    }
    return { x: c.x, y: baseH, z: c.z };
  }

  function pickTrafficSpawnNear(px, pz, minDist, maxDist) {
    if (roadCells.length === 0) return null;
    const stepCells = roadGridN >= 512 ? 4 : 1;
    for (let t = 0; t < 110; t++) {
      const cell = roadCells[Math.floor(Math.random() * roadCells.length)];
      const dist = Math.hypot(cell.wx - px, cell.wz - pz);
      if (dist < minDist || dist > maxDist) continue;
      const gyH = getTrafficGroundY(cell.wx, cell.wz, null);
      if (gyH === null || !isCarPoseClear(cell.wx, cell.wz, gyH, 1.1)) continue;
      // Prefere spawnar nas 4 direções cardinais da via (0, 2, 4, 6) com pista longa à frente
      const validDirs = [];
      for (let di = 0; di < 8; di += 2) {
        if (canStepTraffic(cell.gx, cell.gy, gyH, di, stepCells + 2, true)) validDirs.push(di);
      }
      if (validDirs.length === 0) {
        for (let di = 1; di < 8; di += 2) {
          if (canStepTraffic(cell.gx, cell.gy, gyH, di, stepCells + 2, true)) validDirs.push(di);
        }
      }
      if (validDirs.length === 0) continue;
      const dirIdx = validDirs[Math.floor(Math.random() * validDirs.length)];
      const d = TRAFFIC_DIRS[dirIdx];
      const nextGx = cell.gx + d.dx * stepCells;
      const nextGy = cell.gy + d.dy * stepCells;
      const startPos = getLaneTargetPos(cell.gx, cell.gy, gyH, dirIdx);
      const endPos = getLaneTargetPos(nextGx, nextGy, startPos.y, dirIdx);
      const segYaw = Math.atan2(endPos.x - startPos.x, endPos.z - startPos.z);
      let busy = false;
      for (const tc of trafficCars) {
        if (Math.hypot(tc.pos.x - startPos.x, tc.pos.z - startPos.z) < 18.0) { busy = true; break; }
      }
      for (const v of vehicles) {
        if (Math.hypot(v.pos.x - startPos.x, v.pos.z - startPos.z) < 12.0) { busy = true; break; }
      }
      if (busy) continue;
      return {
        gx: cell.gx, gy: cell.gy,
        nextGx, nextGy,
        dirIdx,
        segStartX: startPos.x, segStartZ: startPos.z,
        segEndX: endPos.x, segEndZ: endPos.z,
        segLen: Math.max(0.5, Math.hypot(endPos.x - startPos.x, endPos.z - startPos.z)),
        x: startPos.x, y: startPos.y, z: startPos.z, yaw: segYaw
      };
    }
    return null;
  }

  function setupTrafficSystem(px, pz) {
    if (trafficTemplates.length === 0 || roadCells.length === 0) return;
    const TARGET_TRAFFIC = 10;
    for (let i = 0; i < TARGET_TRAFFIC; i++) {
      const sp = pickTrafficSpawnNear(px, pz, i < 8 ? 16 : 34, i < 8 ? 55 : 102);
      if (!sp) continue;
      const tpl = trafficTemplates[Math.floor(Math.random() * trafficTemplates.length)];
      const mesh = tpl.mesh.clone(true);
      const wheels = [];
      mesh.traverse((o) => { if (o.name === 'TrafficWheel') wheels.push(o); });
      mesh.position.set(sp.x, sp.y, sp.z);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.y = sp.yaw;
      scene.add(mesh);
      trafficCars.push({
        mesh,
        wheels,
        pos: mesh.position,
        radius: tpl.radius,
        mass: tpl.isHeavy ? 2.5 : 1.15,
        yaw: sp.yaw,
        speed: 5.5 + Math.random() * 2.5,
        maxSpeed: tpl.isHeavy ? (6.5 + Math.random() * 1.8) : (8.2 + Math.random() * 2.8),
        gx: sp.gx,
        gy: sp.gy,
        nextGx: sp.nextGx,
        nextGy: sp.nextGy,
        dirIdx: sp.dirIdx,
        segStartX: sp.segStartX,
        segStartZ: sp.segStartZ,
        segEndX: sp.segEndX,
        segEndZ: sp.segEndZ,
        segLen: sp.segLen,
        segProgress: 0,
        turning: false,
        waitTimer: 0,
        physVel: new THREE.Vector3(),
        physVelY: 0,
        angVel: 0,
        knockTimer: 0,
        impactPitch: 0,
        impactRoll: 0,
        slopePitch: 0,
        hornCooldown: 0
      });
    }
  }

  function updateTraffic(dt) {
    if (trafficCars.length === 0) return;
    const pFocus = player.inCar ? player.inCar.pos : player.pos;
    let nsRed = false, ewRed = false;
    for (const tl of trafficLights) {
      if (tl.axis === 'NS' && tl.state !== 'GREEN') nsRed = true;
      if (tl.axis === 'EW' && tl.state !== 'GREEN') ewRed = true;
    }

    for (const tc of trafficCars) {
      const distP = Math.hypot(tc.pos.x - pFocus.x, tc.pos.z - pFocus.z);
      tc.mesh.visible = distP < 115;

      // Recicla se foi muito longe ou saiu dos limites da cidade
      if (distP > 125 || isOutsideIsland(tc.pos.x, tc.pos.z)) {
        const sp = pickTrafficSpawnNear(pFocus.x, pFocus.z, 42, 105);
        if (sp) {
          tc.pos.set(sp.x, sp.y, sp.z);
          tc.gx = sp.gx; tc.gy = sp.gy;
          tc.nextGx = sp.nextGx; tc.nextGy = sp.nextGy;
          tc.dirIdx = sp.dirIdx;
          tc.segStartX = sp.segStartX; tc.segStartZ = sp.segStartZ;
          tc.segEndX = sp.segEndX; tc.segEndZ = sp.segEndZ;
          tc.segLen = sp.segLen; tc.segProgress = 0;
          tc.yaw = sp.yaw;
          tc.speed = tc.maxSpeed * 0.6;
          tc.turning = false;
          tc.waitTimer = 0;
          tc.stuckTimer = 0;
          tc.physVel.set(0, 0, 0);
          tc.physVelY = 0;
          tc.angVel = 0;
          tc.knockTimer = 0;
          tc.impactPitch = 0;
          tc.impactRoll = 0;
          tc.slopePitch = 0;
        }
        continue;
      }

      if (tc.hornCooldown > 0) tc.hornCooldown -= dt;

      // MODO FÍSICO LIVRE: carro aleatório foi empurrado/atingido — desliza, derrapa, gira (spin) e empurra outros (efeito dominó)!
      if (tc.knockTimer > 0 || (tc.physVel && tc.physVel.lengthSq() > 0.06)) {
        tc.knockTimer = Math.max(0, (tc.knockTimer || 0) - dt);

        // Atrito anisotrópico real dos pneus (rola mais fácil na frente/trás, derrapa forte de lado com fumaça!)
        const fX = Math.sin(tc.yaw), fZ = Math.cos(tc.yaw);
        const rX = fZ, rZ = -fX;
        const vFwd = tc.physVel.x * fX + tc.physVel.z * fZ;
        const vLat = tc.physVel.x * rX + tc.physVel.z * rZ;
        const newVFwd = vFwd * Math.max(0, 1 - dt * 1.9);
        const newVLat = vLat * Math.max(0, 1 - dt * 5.6);
        tc.physVel.x = fX * newVFwd + rX * newVLat;
        tc.physVel.z = fZ * newVFwd + rZ * newVLat;

        // Fumaça branca de pneu ao derrapar de lado após colisão
        if (Math.abs(vLat) > 3.2 && Math.random() < 0.45) {
          spawnSmoke(new THREE.Vector3(tc.pos.x, tc.pos.y + 0.25, tc.pos.z), tc.physVel);
        }

        // Integração linear + rotação angular real
        tc.pos.x += tc.physVel.x * dt;
        tc.pos.z += tc.physVel.z * dt;
        tc.yaw += (tc.angVel || 0) * dt;
        tc.angVel = (tc.angVel || 0) * Math.max(0, 1 - dt * 3.8);

        // Colisão do carro aleatório empurrado com prédios/muros
        if (resolveMapWallCollision(tc.pos, tc.radius * 0.85, tc.physVel, 1.05)) {
          tc.physVel.multiplyScalar(0.55);
          tc.angVel *= 0.6;
        }

        // Efeito dominó: carro aleatório empurrado colide e empurra OUTROS carros aleatórios!
        for (const other of trafficCars) {
          if (other === tc || Math.abs(other.pos.y - tc.pos.y) > 2.6) continue;
          const odx = other.pos.x - tc.pos.x;
          const odz = other.pos.z - tc.pos.z;
          const od = Math.hypot(odx, odz);
          const minSep = tc.radius + other.radius + 0.15;
          if (od > 0.01 && od < minSep) {
            const onx = odx / od, onz = odz / od;
            const pen = minSep - od;
            tc.pos.x -= onx * pen * 0.45; tc.pos.z -= onz * pen * 0.45;
            other.pos.x += onx * pen * 0.55; other.pos.z += onz * pen * 0.55;
            const oVx = other.knockTimer > 0 ? other.physVel.x : Math.sin(other.yaw) * other.speed;
            const oVz = other.knockTimer > 0 ? other.physVel.z : Math.cos(other.yaw) * other.speed;
            const rVn = (tc.physVel.x - oVx) * onx + (tc.physVel.z - oVz) * onz;
            if (rVn > 0.5) {
              const invA = 1 / (tc.mass || 1.15), invB = 1 / (other.mass || 1.15);
              const jj = (1.18 * rVn) / (invA + invB);
              if (other.knockTimer <= 0) other.physVel.set(oVx, 0, oVz);
              tc.physVel.x -= onx * jj * invA * 0.85;
              tc.physVel.z -= onz * jj * invA * 0.85;
              other.physVel.x += onx * jj * invB * 1.10;
              other.physVel.z += onz * jj * invB * 1.10;
              other.angVel = (other.angVel || 0) + (onx * Math.cos(other.yaw) - onz * Math.sin(other.yaw)) * rVn * 0.18;
              other.knockTimer = Math.max(other.knockTimer || 0, 1.5);
              other.waitTimer = 0;
            }
          }
        }

        // Gravidade real e altura de terreno/calçada/escada sob o carro aleatório empurrado
        tc.physVelY = (tc.physVelY || 0) - 22 * dt;
        tc.pos.y += tc.physVelY * dt;
        const kGy = getWalkableGround(tc.pos.x, tc.pos.z, tc.pos.y, 1.65);
        if (kGy !== null && tc.pos.y <= kGy + 0.08) {
          tc.pos.y = kGy;
          if (tc.physVelY < -2.5) tc.impactPitch = (tc.impactPitch || 0) + 0.08;
          tc.physVelY = 0;
        } else if (tc.pos.y < -35) {
          tc.pos.x = 99999; // recicla se cair fora do mapa
          continue;
        }

        // Inclinação de rampa + amortecimento do balanço de impacto
        const fhT = getWalkableGround(tc.pos.x + fX * 1.35, tc.pos.z + fZ * 1.35, tc.pos.y, 1.4) ?? tc.pos.y;
        const rhT = getWalkableGround(tc.pos.x - fX * 1.35, tc.pos.z - fZ * 1.35, tc.pos.y, 1.4) ?? tc.pos.y;
        const targetSp = Math.max(-0.45, Math.min(0.45, -Math.atan2(fhT - rhT, 2.7)));
        tc.slopePitch = (tc.slopePitch || 0) + (targetSp - (tc.slopePitch || 0)) * Math.min(1, dt * 10);
        tc.impactPitch *= Math.max(0, 1 - dt * 6.5);
        tc.impactRoll *= Math.max(0, 1 - dt * 6.5);

        tc.mesh.rotation.order = 'YXZ';
        tc.mesh.rotation.set(tc.slopePitch + tc.impactPitch, tc.yaw, tc.impactRoll);
        if (tc.mesh.visible && Math.abs(newVFwd) > 0.2) {
          const wSpin = newVFwd * dt * 2.5;
          for (const w of tc.wheels) w.rotation.x = (w.rotation.x + wSpin) % (Math.PI * 2);
        }

        // Quando desacelerou quase por completo e acabou o knockTimer, retoma a IA na rua mais próxima
        if (tc.knockTimer <= 0 && tc.physVel.lengthSq() < 0.25 && Math.abs(tc.angVel || 0) < 0.25) {
          tc.physVel.set(0, 0, 0);
          tc.angVel = 0;
          tc.speed = 0;
          if (colMeta && roadGrid) {
            const N = roadGridN;
            const worldW = colMeta.W * colMeta.step, worldH = colMeta.H * colMeta.step;
            const gx0 = Math.max(4, Math.min(N - 5, Math.floor(((tc.pos.x - colMeta.minX) / worldW) * N)));
            const gy0 = Math.max(4, Math.min(N - 5, Math.floor((1.0 - (-tc.pos.z - colMeta.minY) / worldH) * N)));
            const [rgx, rgy] = snapNodeToNearestRoad(gx0, gy0, N, 18);
            tc.gx = rgx; tc.gy = rgy;
            tc.nextGx = rgx; tc.nextGy = rgy;
          }
          tc.segStartX = tc.pos.x; tc.segStartZ = tc.pos.z;
          tc.segEndX = tc.pos.x; tc.segEndZ = tc.pos.z;
          tc.segLen = 0.5; tc.segProgress = 0.5;
          tc.waitTimer = 0.4;
        }
        continue;
      }

      if (tc.waitTimer > 0) {
        tc.waitTimer -= dt;
        tc.speed *= Math.max(0, 1 - dt * 6);
        continue;
      }

      const fwdX = Math.sin(tc.yaw);
      const fwdZ = Math.cos(tc.yaw);
      let shouldBrake = false;
      let hardStop = false;
      let stoppedByLight = false;

      const curAxis = TRAFFIC_DIRS[tc.dirIdx].axis;
      if ((curAxis === 'NS' && nsRed) || (curAxis === 'EW' && ewRed)) {
        for (const tl of trafficLights) {
          if (tl.axis !== curAxis) continue;
          const cdx = tl.x - tc.pos.x;
          const cdz = tl.z - tc.pos.z;
          const proj = cdx * fwdX + cdz * fwdZ;
          const lat = Math.abs(-cdx * fwdZ + cdz * fwdX);
          if (proj > 2.5 && proj < 18.0 && lat < 9.5 && Math.abs((tl.y || tc.pos.y) - tc.pos.y) < 4.0) {
            shouldBrake = true;
            stoppedByLight = true;
            if (proj < 8.5) hardStop = true;
            break;
          }
        }
      }

      if (!shouldBrake) {
        for (const other of trafficCars) {
          if (other === tc) continue;
          if (Math.abs(other.pos.y - tc.pos.y) > 2.8) continue;
          const odx = other.pos.x - tc.pos.x;
          const odz = other.pos.z - tc.pos.z;
          const proj = odx * fwdX + odz * fwdZ;
          const lat = Math.abs(-odx * fwdZ + odz * fwdX);
          if (proj > 0 && proj < tc.radius + other.radius + 5.8 && lat < 2.4) {
            shouldBrake = true;
            if (proj < tc.radius + other.radius + 2.4) hardStop = true;
            break;
          }
        }
      }
      if (!shouldBrake) {
        for (const v of vehicles) {
          if (Math.abs(v.pos.y - tc.pos.y) > 2.8) continue;
          const vdx = v.pos.x - tc.pos.x;
          const vdz = v.pos.z - tc.pos.z;
          const proj = vdx * fwdX + vdz * fwdZ;
          const lat = Math.abs(-vdx * fwdZ + vdz * fwdX);
          if (proj > 0 && proj < tc.radius + 6.5 && lat < 2.7) {
            shouldBrake = true;
            if (proj < tc.radius + 3.2) hardStop = true;
            break;
          }
        }
      }
      if (!shouldBrake && !player.inCar && Math.abs(player.pos.y - tc.pos.y) < 2.8) {
        const pdx = player.pos.x - tc.pos.x;
        const pdz = player.pos.z - tc.pos.z;
        const proj = pdx * fwdX + pdz * fwdZ;
        const lat = Math.abs(-pdx * fwdZ + pdz * fwdX);
        if (proj > 0 && proj < tc.radius + 5.2 && lat < 2.3) { shouldBrake = true; hardStop = true; }
      }
      if (!shouldBrake) {
        for (const n of npcs) {
          if (n.dead || Math.abs(n.pos.y - tc.pos.y) > 2.8) continue;
          const ndx = n.pos.x - tc.pos.x;
          const ndz = n.pos.z - tc.pos.z;
          const proj = ndx * fwdX + ndz * fwdZ;
          const lat = Math.abs(-ndx * fwdZ + ndz * fwdX);
          if (proj > 0 && proj < tc.radius + 4.4 && lat < 2.0) { shouldBrake = true; break; }
        }
      }

      const cruiseSpeed = tc.turning ? Math.min(tc.maxSpeed, 4.8) : tc.maxSpeed;
      const targetSpd = shouldBrake ? 0 : cruiseSpeed;
      if (hardStop) {
        tc.speed = Math.max(0, tc.speed - 28 * dt);
      } else {
        tc.speed += (targetSpd - tc.speed) * Math.min(1, dt * (shouldBrake ? 10.0 : 2.8));
      }

      const stepCells = roadGridN >= 512 ? 3 : 1;
      tc.segProgress += tc.speed * dt;
      if (tc.segProgress >= tc.segLen) {
        tc.gx = tc.nextGx;
        tc.gy = tc.nextGy;
        const straight = tc.dirIdx;
        const diagR = (tc.dirIdx + 1) % 8;
        const diagL = (tc.dirIdx + 7) % 8;
        const right = (tc.dirIdx + 2) % 8;
        const left = (tc.dirIdx + 6) % 8;

        const chooseNextDir = (requireCore) => {
          const canS = canStepTraffic(tc.gx, tc.gy, tc.pos.y, straight, stepCells, requireCore);
          const sharp = [];
          if (canStepTraffic(tc.gx, tc.gy, tc.pos.y, right, stepCells, requireCore)) sharp.push(right);
          if (canStepTraffic(tc.gx, tc.gy, tc.pos.y, left, stepCells, requireCore)) sharp.push(left);
          if (canS) {
            if (sharp.length > 0 && Math.random() < 0.08) {
              return sharp[Math.floor(Math.random() * sharp.length)];
            }
            return straight;
          }
          const soft = [];
          if (canStepTraffic(tc.gx, tc.gy, tc.pos.y, diagR, stepCells, requireCore)) soft.push(diagR);
          if (canStepTraffic(tc.gx, tc.gy, tc.pos.y, diagL, stepCells, requireCore)) soft.push(diagL);
          if (soft.length > 0) return soft[Math.floor(Math.random() * soft.length)];
          if (sharp.length > 0) return sharp[Math.floor(Math.random() * sharp.length)];
          return -1;
        };

        let chosenDir = chooseNextDir(true);
        if (chosenDir < 0) chosenDir = chooseNextDir(false);
        if (chosenDir < 0) {
          if (distP > 60) tc.pos.x = 99999;
          else { tc.speed = 0; tc.waitTimer = 1.2; tc.stuckTimer = (tc.stuckTimer || 0) + 1.2; }
          continue;
        }

        tc.turning = (chosenDir !== tc.dirIdx);
        tc.dirIdx = chosenDir;
        const nd = TRAFFIC_DIRS[chosenDir];
        tc.nextGx = tc.gx + nd.dx * stepCells;
        tc.nextGy = tc.gy + nd.dy * stepCells;
        tc.segStartX = tc.pos.x;
        tc.segStartZ = tc.pos.z;
        const nextLane = getLaneTargetPos(tc.nextGx, tc.nextGy, tc.pos.y, chosenDir);
        tc.segEndX = nextLane.x;
        tc.segEndZ = nextLane.z;
        tc.segLen = Math.max(0.5, Math.hypot(tc.segEndX - tc.segStartX, tc.segEndZ - tc.segStartZ));
        tc.segProgress = 0;
      }

      const u = Math.min(1, tc.segProgress / tc.segLen);
      tc.pos.x = tc.segStartX + (tc.segEndX - tc.segStartX) * u;
      tc.pos.z = tc.segStartZ + (tc.segEndZ - tc.segStartZ) * u;
      if (distP < 70) {
        if (resolveMapWallCollision(tc.pos, tc.radius * 0.78, null, 0.42)) {
          // Não puxa o carro de volta contra a mureta; realinha o segmento a partir da posição limpa
          tc.segStartX = tc.pos.x;
          tc.segStartZ = tc.pos.z;
          tc.segProgress = tc.segLen;
          tc.speed *= 0.35;
        }
      }
      const gy = getTrafficGroundY(tc.pos.x, tc.pos.z, tc.pos.y);
      if (gy !== null) {
        tc.pos.y += (gy - tc.pos.y) * Math.min(1, dt * 14);
      }

      const segDx = tc.segEndX - tc.segStartX;
      const segDz = tc.segEndZ - tc.segStartZ;
      if (segDx * segDx + segDz * segDz > 0.04) {
        const segYaw = Math.atan2(segDx, segDz);
        let yDiff = segYaw - tc.yaw;
        while (yDiff > Math.PI) yDiff -= Math.PI * 2;
        while (yDiff < -Math.PI) yDiff += Math.PI * 2;
        tc.yaw += yDiff * Math.min(1, dt * 9.5);
      }

      for (const other of trafficCars) {
        if (other === tc || Math.abs(other.pos.y - tc.pos.y) > 2.5) continue;
        const odx = tc.pos.x - other.pos.x;
        const odz = tc.pos.z - other.pos.z;
        const od = Math.hypot(odx, odz);
        const minSep = tc.radius + other.radius + 0.35;
        if (od > 0.01 && od < minSep) {
          const push = (minSep - od) * 0.5;
          tc.pos.x += (odx / od) * push;
          tc.pos.z += (odz / od) * push;
        }
      }

      if (!stoppedByLight && tc.speed < 0.35) {
        tc.stuckTimer = (tc.stuckTimer || 0) + dt;
        if (tc.stuckTimer > 2.2) {
          tc.stuckTimer = 0;
          tc.pos.x = 99999;
          continue;
        }
      } else {
        tc.stuckTimer = 0;
      }

      // Inclinação suave de rampa também nos carros de tráfego normal
      const fX0 = Math.sin(tc.yaw), fZ0 = Math.cos(tc.yaw);
      const fh0 = getWalkableGround(tc.pos.x + fX0 * 1.35, tc.pos.z + fZ0 * 1.35, tc.pos.y, 1.2) ?? tc.pos.y;
      const rh0 = getWalkableGround(tc.pos.x - fX0 * 1.35, tc.pos.z - fZ0 * 1.35, tc.pos.y, 1.2) ?? tc.pos.y;
      const tSlope0 = Math.max(-0.4, Math.min(0.4, -Math.atan2(fh0 - rh0, 2.7)));
      tc.slopePitch = (tc.slopePitch || 0) + (tSlope0 - (tc.slopePitch || 0)) * Math.min(1, dt * 8);
      tc.impactPitch = (tc.impactPitch || 0) * Math.max(0, 1 - dt * 6);
      tc.impactRoll = (tc.impactRoll || 0) * Math.max(0, 1 - dt * 6);
      tc.mesh.rotation.order = 'YXZ';
      tc.mesh.rotation.set(tc.slopePitch + tc.impactPitch, tc.yaw, tc.impactRoll);
      if (tc.mesh.visible && tc.speed > 0.2) {
        const wSpin = tc.speed * dt * 2.5;
        for (const w of tc.wheels) w.rotation.x = (w.rotation.x + wSpin) % (Math.PI * 2);
      }
    }
  }

  let gpsRecalcTimer = 0;
  function updateDelivery(dt) {
    if (gpsRoute.active) {
      if (gpsRoute.beacon) gpsRoute.beacon.rotation.y += dt * 2.0;
      const gp = player.inCar ? player.inCar.pos : player.pos;
      gpsRecalcTimer += dt;
      if (gpsRecalcTimer > 0.75) {
        gpsRecalcTimer = 0;
        gpsRoute.waypoints = computeGpsRoute(gp.x, gp.z, gpsRoute.target.x, gpsRoute.target.z);
      }
      if (Math.hypot(gp.x - gpsRoute.target.x, gp.z - gpsRoute.target.z) < 5.5) {
        clearGpsDestination();
        showToast('📍 Você chegou ao seu destino GPS!');
        AudioFX.coin();
      }
    }

    if (!delivery.active) return;
    delivery.beacon.rotation.y += dt * 1.8;
    const p = player.inCar ? player.inCar.pos : player.pos;
    const dist = Math.hypot(p.x - delivery.targetPos.x, p.z - delivery.targetPos.z);
    if (dist < 4.5) {
      delivery.active = false;
      delivery.beacon.visible = false;
      ui.missionBanner.classList.add('hidden');
      save.cash += delivery.reward;
      save.deliveries += 1;
      persistSave();
      refreshMoneyUI();
      AudioFX.coin();
      vibrate(80);
      showToast(`✅ Entrega concluída! +R$ ${delivery.reward}`, 3500);
    }
  }

  function updateWanted(dt) {
    if (player.wanted > 0) {
      player.wantedTimer -= dt;
      if (player.wantedTimer <= 0) { player.wanted = Math.max(0, player.wanted - 1); player.wantedTimer = 15; }
    }
    ui.wantedStars.textContent = '★'.repeat(player.wanted) + '☆'.repeat(5 - player.wanted);
  }

  const camFollow = new THREE.Vector3();
  let camFollowInit = false;
  let camBaseFov = null;

  function updateCamera(dt) {
    if (camBaseFov === null) camBaseFov = camera.fov;
    const wantFov = camBaseFov + ((!player.inCar && !player.firstPersonFoot) ? GTA.sprintFovBoost * (player.sprintBlend || 0) : 0);
    if (Math.abs(camera.fov - wantFov) > 0.05) {
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 6);
      camera.updateProjectionMatrix();
    }
    if (player.inCar || player.firstPersonFoot) camFollowInit = false;

    const wantNear = (player.inCar && player.firstPersonCar) ? 0.05 : (!player.inCar && player.firstPersonFoot ? 0.12 : 0.28);
    if (Math.abs(camera.near - wantNear) > 0.01) {
      camera.near = wantNear;
      camera.updateProjectionMatrix();
    }
    if (!player.inCar && player.firstPersonFoot) {
      if (player.mesh) player.mesh.visible = false;
      const eye = new THREE.Vector3(player.pos.x, player.pos.y + 1.56, player.pos.z);
      const fpPitch = Math.max(-0.85, Math.min(0.85, (0.24 - input.camPitch) * 1.8));
      const cosP = Math.cos(fpPitch);
      // Em 3ª pessoa câmera fica em +sin(camYaw), +cos(camYaw) olhando para -sin(camYaw), -cos(camYaw)
      const lookDir = new THREE.Vector3(-Math.sin(input.camYaw) * cosP, Math.sin(fpPitch), -Math.cos(input.camYaw) * cosP);
      camera.position.copy(eye);
      camera.lookAt(eye.clone().add(lookDir.multiplyScalar(10)));
      return;
    } else if (!player.inCar && player.mesh) {
      player.mesh.visible = true;
    }
    if (player.inCar && player.firstPersonCar) {
      const car = player.inCar;
      const fSign = car.forwardSign || -1;
      const eyeX = fSign > 0 ? 0.36 : -0.34;
      const eyeY = fSign > 0 ? 1.03 : 1.06;
      const eyeZ = fSign > 0 ? -0.02 : 0.04;
      const localEye = new THREE.Vector3(eyeX, eyeY, eyeZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.yaw).add(car.pos);
      const totalYaw = car.yaw + (fSign > 0 ? 0 : Math.PI) + input.interiorYaw;
      const cosP = Math.cos(input.interiorPitch);
      const lookDir = new THREE.Vector3(
        Math.sin(totalYaw) * cosP,
        Math.sin(input.interiorPitch),
        Math.cos(totalYaw) * cosP
      );
      camera.position.copy(localEye);
      camera.lookAt(localEye.clone().add(lookDir.multiplyScalar(10)));
      return;
    }

    const realTarget = player.inCar ? player.inCar.pos : player.pos;
    if (!camFollowInit || camFollow.distanceTo(realTarget) > 4.0) {
      camFollow.copy(realTarget);
      camFollowInit = true;
    } else if (player.inCar) {
      // No carro: trava X/Z diretamente no carro (ZERO judder/trepidação ao acelerar!) e suaviza apenas Y
      camFollow.x = realTarget.x;
      camFollow.z = realTarget.z;
      const ky = 1.0 - Math.exp(-12.0 * dt);
      camFollow.y += (realTarget.y - camFollow.y) * ky;
    } else {
      const kXZ = Math.min(1, dt * GTA.camFollowRate);
      camFollow.x += (realTarget.x - camFollow.x) * kXZ;
      camFollow.z += (realTarget.z - camFollow.z) * kXZ;
      camFollow.y += (realTarget.y - camFollow.y) * Math.min(1, dt * GTA.camFollowRateY);
    }
    const target = camFollow;
    const baseDist = player.inCar ? 5.2 : 3.2;
    const dist = Math.max(player.inCar ? 1.05 : 0.65, Math.min(14.0, baseDist + input.camZoomOffset));
    const closeT = player.inCar ? Math.max(0, Math.min(1, (3.4 - dist) / 2.35)) : 0;
    const height = player.inCar ? (1.85 - closeT * 1.05) : (dist < 1.5 ? 1.32 : 1.45);

    if (camManualTimer > 0) camManualTimer -= dt;
    if (player.inCar && !player.carFreeCam360 && Math.abs(player.inCar.speed) > 0.8 && camTouchId === null && camManualTimer <= 0) {
      const fSign = player.inCar.forwardSign || -1;
      const desiredYaw = fSign > 0 ? (player.inCar.yaw + Math.PI) : player.inCar.yaw;
      let diff = desiredYaw - input.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const followRate = player.inCar.speed >= 0 ? 2.4 : 1.6;
      input.camYaw += diff * (1.0 - Math.exp(-followRate * dt));
    }

    const cx = target.x + Math.sin(input.camYaw) * Math.cos(input.camPitch) * dist;
    let cy = target.y + height + Math.sin(input.camPitch) * dist;
    const cz = target.z + Math.cos(input.camYaw) * Math.cos(input.camPitch) * dist;
    if (player.inCar && cy < target.y + 0.26) cy = target.y + 0.26;

    if (!player.inCar) {
      const camGy = getWalkableGround(cx, cz, target.y, 2.5);
      if (camGy !== null && cy < camGy + 0.35) cy = camGy + 0.35;
    }
    // Posicionamento direto sem lerp defasado em X/Z = 100% fluido e ZERO trepidação em qualquer velocidade!
    camera.position.set(cx, cy, cz);
    if (camShakeTimer > 0) {
      const s = camShakePower * (camShakeTimer / 0.65);
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
    }
    const lookY = player.inCar ? (0.95 - closeT * 0.30) : 1.18;
    camera.lookAt(target.x, target.y + lookY, target.z);
  }

  function drawMinimap() {
    const ctx = ui.minimap;
    const W = 128, H = 128, R = W / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b1c30';
    ctx.fillRect(0, 0, W, H);

    const p = player.inCar ? player.inCar.pos : player.pos;
    const scale = 0.52;

    if (mapAiReady && colMeta) {
      const worldW = colMeta.W * colMeta.step;
      const worldH = colMeta.H * colMeta.step;
      const iw = mapAiImage.width;
      const ih = mapAiImage.height;
      const pImgX = ((p.x - colMeta.minX) / worldW) * iw;
      const pImgY = ih - ((-p.z - colMeta.minY) / worldH) * ih;
      const pxPerMeter = iw / worldW;
      const drawScale = scale / pxPerMeter;

      ctx.save();
      ctx.translate(R, R);
      // Frente da câmera = -(sin yaw, cos yaw) → gira +camYaw para a frente ficar sempre para cima
      ctx.rotate(input.camYaw);
      ctx.scale(drawScale, drawScale);
      ctx.drawImage(mapAiImage, -pImgX, -pImgY);
      ctx.restore();
    }

    const rotCos = Math.cos(input.camYaw);
    const rotSin = Math.sin(input.camYaw);
    function toMini(wx, wz) {
      const dx = (wx - p.x) * scale;
      const dz = (wz - p.z) * scale;
      return { x: R + dx * rotCos - dz * rotSin, y: R + dx * rotSin + dz * rotCos };
    }

    if (gpsRoute.active && gpsRoute.waypoints.length > 1) {
      ctx.strokeStyle = '#d500f9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      gpsRoute.waypoints.forEach((wp, idx) => {
        const pt = toMini(wp.x, wp.z);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }

    vehicles.forEach((v) => {
      const pt = toMini(v.pos.x, v.pos.z);
      ctx.fillStyle = v.type === 'ford_mustang_gtd' ? '#ff1744' : v.type === 'car_pm' ? '#00f0ff' : v.type === 'volkswagen_saveiro' ? '#00e676' : '#ffd43b';
      ctx.fillRect(pt.x - 2.5, pt.y - 2.5, 5, 5);
    });
    trafficCars.forEach((tc) => {
      const pt = toMini(tc.pos.x, tc.pos.z);
      ctx.fillStyle = '#ffa726';
      ctx.fillRect(pt.x - 1.8, pt.y - 1.8, 3.6, 3.6);
    });
    npcs.forEach((n) => {
      if (n.dead) return;
      const pt = toMini(n.pos.x, n.pos.z);
      ctx.fillStyle = n.isJobNpc ? '#ff4081' : '#cfd8dc';
      ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
    });

    rpProps.forEach((pr) => {
      const pt = toMini(pr.pos.x, pr.pos.z);
      if (pr.type === 'safehouse') {
        ctx.fillStyle = '#ffd43b';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = pr.type === 'atm' ? '#ff1744' : '#00e676';
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
      }
    });

    // Jogadores reais online no Minimapa (azul/verde neon pulsante)
    if (window.BrasilMP && typeof window.BrasilMP.getRemotePlayers === 'function') {
      const remotes = window.BrasilMP.getRemotePlayers();
      for (let i = 0; i < remotes.length; i++) {
        const rp = remotes[i];
        const pt = toMini(rp.x, rp.z);
        ctx.fillStyle = rp.speaking ? '#00e676' : '#00e5ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    if (gpsRoute.active) {
      const pt = toMini(gpsRoute.target.x, gpsRoute.target.z);
      const cx = Math.max(8, Math.min(W - 8, pt.x));
      const cy = Math.max(8, Math.min(H - 8, pt.y));
      ctx.fillStyle = '#d500f9';
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (window.BrasilMissions && typeof window.BrasilMissions.getActiveMarker === 'function') {
      const mm = window.BrasilMissions.getActiveMarker();
      if (mm) {
        const pt = toMini(mm.x, mm.z);
        const cx = Math.max(8, Math.min(W - 8, pt.x));
        const cy = Math.max(8, Math.min(H - 8, pt.y));
        ctx.fillStyle = '#' + (mm.color || 0xffd41f).toString(16).padStart(6, '0');
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx, cy, 5.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    // Seta do jogador apontando para onde o personagem/carro realmente está virado
    let hx, hz;
    if (player.inCar) {
      const fs = player.inCar.forwardSign || -1;
      hx = Math.sin(player.inCar.yaw) * fs;
      hz = Math.cos(player.inCar.yaw) * fs;
    } else {
      hx = -Math.sin(player.yaw);
      hz = -Math.cos(player.yaw);
    }
    const sdx = hx * rotCos - hz * rotSin;
    const sdy = hx * rotSin + hz * rotCos;
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(Math.atan2(sdx, -sdy));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // --- Mapa em Tela Cheia com Zoom & GPS ---
  function drawFullMap() {
    if (!colMeta) return;
    const fCanvas = el('fullMapCanvas');
    const ctx = fCanvas.getContext('2d');
    const W = fCanvas.width;
    const H = fCanvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b1c30';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 + fullMapPanX, H / 2 + fullMapPanY);
    ctx.scale(fullMapZoom, fullMapZoom);
    ctx.translate(-W / 2, -H / 2);

    if (mapAiReady) {
      ctx.drawImage(mapAiImage, 0, 0, W, H);
    }

    const worldW = colMeta.W * colMeta.step;
    const worldH = colMeta.H * colMeta.step;
    const toFull = (wx, wz) => ({
      x: ((wx - colMeta.minX) / worldW) * W,
      y: H - ((-wz - colMeta.minY) / worldH) * H
    });

    if (gpsRoute.active && gpsRoute.waypoints.length > 1) {
      ctx.strokeStyle = '#d500f9';
      ctx.lineWidth = 4 / fullMapZoom;
      ctx.beginPath();
      gpsRoute.waypoints.forEach((wp, i) => {
        const pt = toFull(wp.x, wp.z);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }

    rpProps.forEach((pr) => {
      const pt = toFull(pr.pos.x, pr.pos.z);
      if (pr.type === 'safehouse') {
        ctx.fillStyle = '#ffd43b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8 / fullMapZoom;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 6.5 / fullMapZoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = pr.type === 'atm' ? '#ff1744' : '#00e676';
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 5 / fullMapZoom, 0, Math.PI * 2); ctx.fill();
      }
    });

    vehicles.forEach((v) => {
      const pt = toFull(v.pos.x, v.pos.z);
      ctx.fillStyle = v.type === 'ford_mustang_gtd' ? '#ff1744' : v.type === 'volkswagen_saveiro' ? '#00e676' : '#00f0ff';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4.5 / fullMapZoom, 0, Math.PI * 2); ctx.fill();
    });
    trafficCars.forEach((tc) => {
      const pt = toFull(tc.pos.x, tc.pos.z);
      ctx.fillStyle = '#ffa726';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.2 / fullMapZoom, 0, Math.PI * 2); ctx.fill();
    });

    // Jogadores reais online no Mapa Completo com Nome
    if (window.BrasilMP && typeof window.BrasilMP.getRemotePlayers === 'function') {
      const remotes = window.BrasilMP.getRemotePlayers();
      ctx.font = `bold ${Math.max(9, Math.round(11 / fullMapZoom))}px sans-serif`;
      ctx.textAlign = 'center';
      for (let i = 0; i < remotes.length; i++) {
        const rp = remotes[i];
        const pt = toFull(rp.x, rp.z);
        ctx.fillStyle = rp.speaking ? '#00e676' : '#00e5ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / fullMapZoom;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 6 / fullMapZoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(rp.name || 'Jogador', pt.x, pt.y - 9 / fullMapZoom);
      }
    }

    if (gpsRoute.active) {
      const pt = toFull(gpsRoute.target.x, gpsRoute.target.z);
      ctx.fillStyle = '#d500f9';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / fullMapZoom;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 7 / fullMapZoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (window.BrasilMissions && typeof window.BrasilMissions.getActiveMarker === 'function') {
      const mm = window.BrasilMissions.getActiveMarker();
      if (mm) {
        const pt = toFull(mm.x, mm.z);
        ctx.fillStyle = '#' + (mm.color || 0xffd41f).toString(16).padStart(6, '0');
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2 / fullMapZoom;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 8 / fullMapZoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    const p = player.inCar ? player.inCar.pos : player.pos;
    const pp = toFull(p.x, p.z);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2 / fullMapZoom;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 6.5 / fullMapZoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  el('minimapBtn').onclick = () => {
    fullMapZoom = 1.0; fullMapPanX = 0; fullMapPanY = 0;
    el('fullMapModal').classList.remove('hidden');
    drawFullMap();
  };
  el('btnCloseFullMap').onclick = () => el('fullMapModal').classList.add('hidden');
  el('btnClearRoute').onclick = () => { clearGpsDestination(); drawFullMap(); };
  el('btnMapZoomIn').onclick = () => { fullMapZoom = Math.min(4.0, fullMapZoom + 0.5); drawFullMap(); };
  el('btnMapZoomOut').onclick = () => { fullMapZoom = Math.max(1.0, fullMapZoom - 0.5); if (fullMapZoom === 1) { fullMapPanX = 0; fullMapPanY = 0; } drawFullMap(); };

  el('fullMapCanvas').addEventListener('click', (e) => {
    if (!colMeta) return;
    const fCanvas = el('fullMapCanvas');
    const rect = fCanvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * fCanvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * fCanvas.height;
    // Desfaz zoom/pan para achar coordenada normalizada 0..1
    const rawX = (cx - fCanvas.width / 2 - fullMapPanX) / fullMapZoom + fCanvas.width / 2;
    const rawY = (cy - fCanvas.height / 2 - fullMapPanY) / fullMapZoom + fCanvas.height / 2;
    const nx = Math.max(0, Math.min(1, rawX / fCanvas.width));
    const ny = Math.max(0, Math.min(1, rawY / fCanvas.height));

    const worldW = colMeta.W * colMeta.step;
    const worldH = colMeta.H * colMeta.step;
    const wx = colMeta.minX + nx * worldW;
    const wz = -(colMeta.minY + (1.0 - ny) * worldH);
    setGpsDestination(wx, wz, 'Destino GPS');
    drawFullMap();
    AudioFX.beep(780, 0.08, 'triangle', 0.1);
  });

  initGame();
})();
