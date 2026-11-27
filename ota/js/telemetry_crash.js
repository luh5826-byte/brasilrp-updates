(() => {
  'use strict';

  const API_BASE = 'https://brasilrp-server.onrender.com';
  const STORAGE_USER_UID = 'brasilrp_user_uid';
  const STORAGE_DEVICE_ID = 'brasilrp_device_id';
  const STORAGE_NAME_KEY = 'brasilrp_mp_name';
  const STORAGE_ALIVE_KEY = 'brasilrp_session_alive_v1';

  function hashToBrpCode(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let out = '';
    let n = h >>> 0;
    for (let i = 0; i < 6; i++) {
      out += alphabet[n % alphabet.length];
      n = Math.floor(n / alphabet.length) ^ ((h >>> (i * 4)) & 0xff);
    }
    return 'BRP-' + out;
  }

  function getDeviceId() {
    // 1. Se o APK tiver ID nativo permanente (ANDROID_ID), usa sempre ele (nao muda nem reinstalando)
    try {
      if (window.BrasilNative && typeof window.BrasilNative.getPermanentId === 'function') {
        const natId = String(window.BrasilNative.getPermanentId() || '').trim();
        if (natId.startsWith('BRP-')) {
          try {
            localStorage.setItem(STORAGE_USER_UID, natId);
            localStorage.setItem(STORAGE_DEVICE_ID, natId);
          } catch (_) {}
          return natId;
        }
      }
    } catch (_) {}

    // 2. ID proprio persistente salvo no aparelho
    let uid = '';
    try { uid = localStorage.getItem(STORAGE_USER_UID) || ''; } catch (_) {}
    if (uid && uid.startsWith('BRP-')) return uid;

    // 3. Migra ID antigo de forma deterministica ou gera um novo BRP-XXXXXX fixo
    let legacy = '';
    try { legacy = localStorage.getItem(STORAGE_DEVICE_ID) || ''; } catch (_) {}
    if (legacy && legacy.startsWith('BRP-')) {
      uid = legacy;
    } else if (legacy) {
      uid = hashToBrpCode(legacy);
    } else {
      const seed = [
        navigator.userAgent || '',
        screen.width + 'x' + screen.height,
        navigator.hardwareConcurrency || '',
        Date.now(),
        Math.random()
      ].join('|');
      uid = hashToBrpCode(seed);
    }
    try {
      localStorage.setItem(STORAGE_USER_UID, uid);
      localStorage.setItem(STORAGE_DEVICE_ID, uid);
    } catch (_) {}
    return uid;
  }

  function getWebGLGpu() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return 'WebGL indisponível';
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        if (renderer) return String(renderer).slice(0, 80);
      }
      return String(gl.getParameter(gl.RENDERER) || 'WebGL').slice(0, 80);
    } catch (_) {
      return '-';
    }
  }

  function getAppVersion() {
    try {
      if (window.BrasilNative && typeof window.BrasilNative.getAppVersion === 'function') {
        return String(window.BrasilNative.getAppVersion() || '1.0.42');
      }
    } catch (_) {}
    return (window.BrasilRPVersion && window.BrasilRPVersion.versionName) || '1.0.42';
  }

  function getNativeDetails() {
    try {
      if (window.BrasilNative && typeof window.BrasilNative.getDeviceDetails === 'function') {
        const raw = window.BrasilNative.getDeviceDetails();
        if (raw) return JSON.parse(raw);
      }
    } catch (_) {}
    return null;
  }

  function getDeviceLabel(nativeInfo) {
    if (nativeInfo && (nativeInfo.brand || nativeInfo.model)) {
      const b = String(nativeInfo.brand || '').trim();
      const m = String(nativeInfo.model || '').trim();
      if (b && m && !m.toLowerCase().startsWith(b.toLowerCase())) return `${b} ${m}`.slice(0, 48);
      return (m || b).slice(0, 48);
    }
    const ua = navigator.userAgent || '';
    const m = ua.match(/Android\s+[^;)]+;\s*([^)]+)\)/i);
    if (m && m[1]) {
      const cleaned = m[1].replace(/\s*Build\/.*/i, '').trim();
      if (cleaned && cleaned !== 'K') return cleaned.slice(0, 44);
    }
    if (/Android/i.test(ua)) return 'Android (modelo oculto pelo WebView)';
    return navigator.platform || 'Web';
  }

  function getOsLabel(nativeInfo) {
    if (nativeInfo && nativeInfo.os) return String(nativeInfo.os).slice(0, 24);
    const ua = navigator.userAgent || '';
    const m = ua.match(/Android\s+([0-9.]+)/i);
    if (m) return 'Android ' + m[1];
    return /Android/i.test(ua) ? 'Android' : (navigator.platform || 'Web');
  }

  function getNetworkInfo(nativeInfo) {
    if (nativeInfo && nativeInfo.network && nativeInfo.network !== '-') {
      return String(nativeInfo.network).slice(0, 24);
    }
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return 'Desconhecida';
    const rawType = String(conn.type || '').toLowerCase();
    const eff = conn.effectiveType ? String(conn.effectiveType).toUpperCase() : '';
    if (rawType === 'wifi') return eff ? `Wi-Fi (${eff})` : 'Wi-Fi';
    if (rawType === 'cellular') return eff ? `Dados Móveis (${eff})` : 'Dados Móveis';
    if (rawType === 'ethernet') return 'Ethernet';
    if (rawType === 'none') return 'Sem Rede';
    if (eff) return `Rede ${eff}${conn.downlink ? ' ' + conn.downlink + 'Mbps' : ''}`;
    return 'Online';
  }

  function collectDeviceSpecs() {
    const nat = getNativeDetails();
    const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
    return {
      deviceId: getDeviceId(),
      playerName: (localStorage.getItem(STORAGE_NAME_KEY) || 'Jogador').slice(0, 20),
      appVersion: getAppVersion(),
      device: getDeviceLabel(nat),
      os: getOsLabel(nat),
      gpu: getWebGLGpu(),
      ramGb: (nat && nat.ramGb) ? nat.ramGb : (navigator.deviceMemory ? `${navigator.deviceMemory} GB` : '-'),
      cpuCores: navigator.hardwareConcurrency || null,
      screen: `${screen.width}x${screen.height} (${dpr}x)`,
      network: getNetworkInfo(nat),
      userAgent: (navigator.userAgent || '').slice(0, 220)
    };
  }

  const specs = collectDeviceSpecs();
  window.BrasilDeviceInfo = specs;

  function getJsHeapMb() {
    try {
      if (performance && performance.memory && performance.memory.usedJSHeapSize) {
        return Math.round(performance.memory.usedJSHeapSize / 1048576);
      }
    } catch (_) {}
    return null;
  }

  // Tenta extrair modelo e versao reais do Android via Client Hints (quando UA vem mascarado como "K")
  try {
    if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
      navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']).then((ua) => {
        let changed = false;
        if (ua && ua.model && (!specs.device || specs.device.includes('oculto') || specs.device === 'Android Device')) {
          specs.device = String(ua.model).trim().slice(0, 48);
          changed = true;
        }
        if (ua && ua.platformVersion) {
          const major = String(ua.platformVersion).split('.')[0];
          if (major && Number(major) > 0) {
            specs.os = 'Android ' + major;
            changed = true;
          }
        }
        if (changed) {
          sendDeviceSpecs('device_info');
          if (window.BrasilMP && typeof window.BrasilMP.sendDeviceInfo === 'function') {
            window.BrasilMP.sendDeviceInfo(specs);
          }
        }
      }).catch(() => {});
    }
  } catch (_) {}

  let reportsSentThisSession = 0;
  const lastSentByKind = {};

  function getGameContext() {
    const bridge = window.BrasilRPBridge;
    const lobby = document.getElementById('lobby3d');
    const splash = document.getElementById('splash');
    let stage = 'jogando';
    if (splash && !splash.classList.contains('hidden')) stage = 'carregando_splash';
    else if (lobby && !lobby.classList.contains('hidden')) stage = 'lobby_3d';

    const fpsEl = document.getElementById('fpsText');
    const fpsText = fpsEl ? fpsEl.textContent.trim() : '';
    const p = bridge && bridge.player ? bridge.player : null;
    return {
      stage,
      fpsText,
      jsHeapMb: getJsHeapMb(),
      inCar: !!(p && p.inCar),
      carType: p && p.inCar ? (p.inCar.templateKey || p.inCar.type || '') : '',
      x: p ? Math.round((p.inCar ? p.inCar.pos.x : p.pos.x) * 10) / 10 : null,
      z: p ? Math.round((p.inCar ? p.inCar.pos.z : p.pos.z) * 10) / 10 : null,
      uptimeSec: Math.round(performance.now() / 1000)
    };
  }

  function buildCauseReason(kind, detail, ctx) {
    const memStr = ctx.jsHeapMb != null ? `${ctx.jsHeapMb} MB RAM JS` : 'RAM JS n/d';
    const baseState = `Etapa: ${ctx.stage} | ${ctx.fpsText || 'FPS n/d'} | ${memStr}` + (ctx.inCar ? ` | Dirigindo (${ctx.carType || 'carro'})` : '');
    if (kind === 'freeze') {
      const hints = [];
      if (ctx.stage === 'carregando_splash') hints.push('gargalo durante carregamento de modelos/texturas 3D');
      if (ctx.jsHeapMb != null && ctx.jsHeapMb > 380) hints.push('pressão alta de memória JS / Garbage Collector');
      if (ctx.inCar) hints.push('streaming de chunks em movimento');
      if (!hints.length) hints.push('sobrecarga de CPU/GPU ou bloqueio na thread principal');
      return `${detail}. Provável causa: ${hints.join('; ')}. (${baseState})`;
    }
    if (kind === 'webgl_lost') {
      return `Contexto WebGL perdido pela GPU (${specs.gpu}). Causa provável: falta de VRAM ou reinício do driver gráfico. (${baseState})`;
    }
    if (kind === 'previous_crash') {
      return `O jogo fechou abruptamente na sessão anterior sem encerramento limpo (possível OOM kill do Android ou crash nativo do WebView). Último estado: ${detail}`;
    }
    return `${detail} (${baseState})`;
  }

  function sendCrashReport(kind, cause, detail, stack = '', customCtx = null) {
    if (reportsSentThisSession >= 5) return;
    const now = Date.now();
    if (lastSentByKind[kind] && (now - lastSentByKind[kind]) < 30000) return;
    lastSentByKind[kind] = now;
    reportsSentThisSession += 1;

    const ctx = customCtx || getGameContext();
    const payload = Object.assign({}, specs, {
      playerName: (localStorage.getItem(STORAGE_NAME_KEY) || specs.playerName || 'Jogador').slice(0, 20),
      appVersion: getAppVersion(),
      cause: String(cause).slice(0, 140),
      reason: buildCauseReason(kind, detail, ctx).slice(0, 500),
      stack: String(stack || '').slice(0, 1500),
      context: ctx
    });

    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(API_BASE + '/api/crash-report', new Blob([body], { type: 'application/json' }));
        if (ok) return;
      }
      fetch(API_BASE + '/api/crash-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    } catch (_) {}
  }

  // 1. Verifica se a sessao anterior travou / fechou por OOM sem sair normalmente
  try {
    const prevRaw = localStorage.getItem(STORAGE_ALIVE_KEY);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw);
      if (prev && prev.cleanExit === false && prev.ts && (Date.now() - prev.ts) < 86400000) {
        const lastInfo = `Etapa: ${prev.stage || '?'} | ${prev.fpsText || 'FPS ?'} | ${prev.jsHeapMb != null ? prev.jsHeapMb + ' MB RAM JS' : 'RAM n/d'} | Tempo ativo: ${prev.uptimeSec || 0}s`;
        sendCrashReport(
          'previous_crash',
          'Fechamento inesperado / Crash na sessão anterior',
          lastInfo,
          '',
          prev
        );
      }
    }
  } catch (_) {}

  // Marca sessao atual como ativa
  function saveAliveState(cleanExit) {
    try {
      const ctx = getGameContext();
      localStorage.setItem(STORAGE_ALIVE_KEY, JSON.stringify({
        ts: Date.now(),
        cleanExit: !!cleanExit,
        stage: ctx.stage,
        fpsText: ctx.fpsText,
        jsHeapMb: ctx.jsHeapMb,
        inCar: ctx.inCar,
        carType: ctx.carType,
        uptimeSec: ctx.uptimeSec
      }));
    } catch (_) {}
  }
  saveAliveState(false);
  setInterval(() => {
    if (!document.hidden) saveAliveState(false);
  }, 3000);

  function notifyLifecycle(evName, beaconOnly) {
    try {
      const nat = getNativeDetails();
      specs.network = getNetworkInfo(nat);
      specs.playerName = (localStorage.getItem(STORAGE_NAME_KEY) || specs.playerName || 'Jogador').slice(0, 20);
      const body = JSON.stringify(Object.assign({ event: evName }, specs));
      if (beaconOnly && navigator.sendBeacon) {
        navigator.sendBeacon(API_BASE + '/api/track', new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch(API_BASE + '/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    } catch (_) {}
  }

  function handleBackground() {
    saveAliveState(false);
    if (window.BrasilMP && typeof window.BrasilMP.setMinimized === 'function') {
      window.BrasilMP.setMinimized(true);
    }
    notifyLifecycle('app_minimized', true);
  }

  function handleForeground() {
    saveAliveState(false);
    if (window.BrasilMP && typeof window.BrasilMP.setMinimized === 'function') {
      window.BrasilMP.setMinimized(false);
    }
    if (window.BrasilMP && typeof window.BrasilMP.connect === 'function') {
      window.BrasilMP.connect();
    }
    notifyLifecycle('app_resumed', false);
  }

  const prevBg = window.onAppBackground;
  window.onAppBackground = function () {
    if (typeof prevBg === 'function') try { prevBg(); } catch (_) {}
    handleBackground();
  };
  const prevFg = window.onAppForeground;
  window.onAppForeground = function () {
    if (typeof prevFg === 'function') try { prevFg(); } catch (_) {}
    handleForeground();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleBackground();
    else handleForeground();
  });
  window.addEventListener('pagehide', () => { saveAliveState(true); notifyLifecycle('app_closed', true); });
  window.addEventListener('beforeunload', () => { saveAliveState(true); notifyLifecycle('app_closed', true); });

  // 2. Envia abertura do jogo com dados completos do aparelho para o painel
  function sendDeviceSpecs(evName) {
    try {
      const nat = getNativeDetails();
      specs.network = getNetworkInfo(nat);
      specs.playerName = (localStorage.getItem(STORAGE_NAME_KEY) || specs.playerName || 'Jogador').slice(0, 20);
      specs.appVersion = getAppVersion();
      fetch(API_BASE + '/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ event: evName || 'game_open' }, specs))
      }).catch(() => {});
    } catch (_) {}
  }
  setTimeout(() => sendDeviceSpecs('game_open'), 1500);
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', () => sendDeviceSpecs('device_info'));
    }
  } catch (_) {}

  // 3. Captura erros JS nao tratados e Promises rejeitadas
  window.addEventListener('error', (ev) => {
    const msg = (ev && ev.message) || 'Erro JavaScript fatal';
    const src = ev && ev.filename ? `${ev.filename.split('/').pop()}:${ev.lineno}:${ev.colno}` : 'script';
    const stack = ev && ev.error && ev.error.stack ? ev.error.stack : `${msg} @ ${src}`;
    sendCrashReport('js_error', `Erro JS em ${src}`, msg, stack);
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev && ev.reason;
    const msg = (r && r.message) ? r.message : String(r || 'Promise rejeitada sem tratamento');
    const stack = (r && r.stack) ? r.stack : msg;
    sendCrashReport('promise_error', 'Erro assíncrono não tratado', msg, stack);
  });

  // 4. Captura perda de contexto WebGL (GPU / falta de VRAM)
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', (e) => {
        sendCrashReport('webgl_lost', 'Perda de contexto WebGL (GPU)', 'O driver WebGL reiniciou ou ficou sem VRAM');
      });
    }
  });

  // 5. Watchdog de travamento / freeze na thread principal (ignora quando minimizado)
  let lastFrameAt = performance.now();
  let wasHidden = document.hidden;
  function watchdogFrame(now) {
    if (document.hidden) {
      wasHidden = true;
      lastFrameAt = now;
    } else {
      if (wasHidden) {
        wasHidden = false;
        lastFrameAt = now;
      } else {
        const stallMs = now - lastFrameAt;
        // Ignora picos normais logo nos primeiros 12s de boot do mapa
        if (stallMs >= 5000 && performance.now() > 12000) {
          const sec = (stallMs / 1000).toFixed(1);
          sendCrashReport('freeze', `Travamento / Freeze (${sec}s sem frame)`, `Thread principal congelada por ${sec} segundos`);
        }
        lastFrameAt = now;
      }
    }
    requestAnimationFrame(watchdogFrame);
  }
  requestAnimationFrame(watchdogFrame);

  window.BrasilCrashReporter = { sendCrashReport, getDeviceSpecs: () => specs };
})();
