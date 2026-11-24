(() => {
  'use strict';

  // =========================================================================
  // SISTEMA COMPLETO DE ÁUDIO 3D DO BRASIL RP:
  // - Som ambiente da cidade (vento/urbano, pássaros de dia, grilos à noite, mar)
  // - Passos do protagonista (andar/correr/pular/pousar)
  // - Sons realistas de carros (motor multi-camada + marchas, freio/pneu, porta, buzina)
  // - Som espacial de carros de tráfego passando + buzinas de trânsito
  // - Diálogos e falas em PT-BR de terceiros (NPCs da rua + NPC do Job via TTS nativo)
  // =========================================================================

  let ctx = null;
  let masterGain = null;
  let noiseBuf = null;
  let initialized = false;

  // Camadas contínuas
  let ambGain = null;
  let ambFilter = null;
  let oceanGain = null;
  let engSubOsc = null;
  let engMainOsc = null;
  let engHarmOsc = null;
  let engFilter = null;
  let engGain = null;
  let tireGain = null;
  let trafficGain = null;
  let trafficFilter = null;

  // Controle de eventos
  let stepAccum = 0;
  let stepFoot = 0;
  let wasInCar = false;
  let wasGrounded = true;
  let prevCarSpeed = 0;
  let prevCarRotY = 0;
  let birdTimer = 3.5;
  let cityEventTimer = 11.0;
  let npcTalkTimer = 6.0;
  let hornActive = false;
  let hornOsc1 = null;
  let hornOsc2 = null;
  let hornGain = null;

  // --- Banco de Samples Reais do Apex Circuit (Lexus LC 500 V8 Muscle + Shift Pop + Tire Screech) ---
  const apexBank = {
    loading: false,
    loaded: false,
    v8Buffers: [null, null, null, null, null],
    shiftPop: null,
    tireScreech: null,
    v8Sources: [],
    v8Gains: [],
    screechSrc: null,
    screechGain: null,
    prevGear: 0
  };

  function ensureApexAudioLoaded() {
    if (apexBank.loading || apexBank.loaded || !ctx) return;
    apexBank.loading = true;
    const files = [
      'audio/v8_muscle_0.wav',
      'audio/v8_muscle_1.wav',
      'audio/v8_muscle_2.wav',
      'audio/v8_muscle_3.wav',
      'audio/v8_muscle_4.wav',
      'audio/shift_pop.wav',
      'audio/tire_screech.wav'
    ];
    Promise.all(files.map((url) =>
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .catch(() => null)
    )).then((bufs) => {
      for (let i = 0; i < 5; i++) apexBank.v8Buffers[i] = bufs[i];
      apexBank.shiftPop = bufs[5];
      apexBank.tireScreech = bufs[6];
      apexBank.loaded = true;
      startApexV8Loops();
    }).catch(() => { apexBank.loading = false; });
  }

  function startApexV8Loops() {
    if (!ctx || !masterGain || apexBank.v8Sources.length > 0) return;
    for (let i = 0; i < 5; i++) {
      const buf = apexBank.v8Buffers[i];
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0.0;
      src.connect(g);
      g.connect(masterGain);
      src.start();
      apexBank.v8Sources[i] = src;
      apexBank.v8Gains[i] = g;
    }
    if (apexBank.tireScreech && !apexBank.screechSrc) {
      const sSrc = ctx.createBufferSource();
      sSrc.buffer = apexBank.tireScreech;
      sSrc.loop = true;
      const sGain = ctx.createGain();
      sGain.gain.value = 0.0;
      sSrc.connect(sGain);
      sGain.connect(masterGain);
      sSrc.start();
      apexBank.screechSrc = sSrc;
      apexBank.screechGain = sGain;
    }
  }

  function playShiftPopSound() {
    if (!ctx || !masterGain || !apexBank.shiftPop) return;
    const src = ctx.createBufferSource();
    src.buffer = apexBank.shiftPop;
    const g = ctx.createGain();
    g.gain.value = 0.34;
    src.connect(g);
    g.connect(masterGain);
    src.start();
  }

  const NPC_LINES_STREET = [
    'E aí parceiro, beleza?',
    'Trânsito hoje tá bravo, hein!',
    'Olha o carro, cuidado aí mano!',
    'Calorão hoje na cidade, viu!',
    'Partiu trabalhar, boleto não se paga sozinho.',
    'Ei, já passou no posto hoje?',
    'Que carrão daora, mano!',
    'Opa, licença aí amigo!',
    'Hoje a cidade tá movimentada demais.',
    'Valeu meu consagrado, tudo certo?',
    'Nossa, quase me atrasei pro serviço!',
    'Salve! Tudo tranquilo por aqui.'
  ];

  const NPC_LINES_CAR = [
    'Caraca, que nave braba!',
    'Devagar aí piloto!',
    'Acelera esse motor aí parceiro!',
    'Olha o sinal, meu chapa!',
    'Top demais esse carro!'
  ];

  const NPC_LINES_JOB = [
    'Oi! Tem entrega nova esperando por você aqui na central.',
    'Chegou em boa hora! Quer pegar uma rota de entrega?',
    'Bora faturar uma grana extra com entregas pela cidade!'
  ];

  function isAudioOn() {
    const b = window.BrasilRPBridge;
    if (!b) return false;
    if (typeof b.getSoundEnabled === 'function' && !b.getSoundEnabled()) return false;
    return true;
  }

  function getEnvMode() {
    const active = document.querySelector('#env-pills .pill-btn.active');
    return active ? (active.dataset.env || 'day') : 'day';
  }

  function createNoiseBuffer(audioCtx) {
    const sampleRate = audioCtx.sampleRate;
    const len = sampleRate * 3;
    const buffer = audioCtx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      data[i] = lastOut * 3.2;
    }
    return buffer;
  }

  function initAudio() {
    if (initialized) {
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    try {
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(ctx.destination);
      noiseBuf = createNoiseBuffer(ctx);

      // 1. Som ambiente urbano / brisa
      const ambSrc = ctx.createBufferSource();
      ambSrc.buffer = noiseBuf;
      ambSrc.loop = true;
      ambFilter = ctx.createBiquadFilter();
      ambFilter.type = 'bandpass';
      ambFilter.frequency.value = 320;
      ambFilter.Q.value = 0.7;
      ambGain = ctx.createGain();
      ambGain.gain.value = 0.0;
      ambSrc.connect(ambFilter);
      ambFilter.connect(ambGain);
      ambGain.connect(masterGain);
      ambSrc.start();

      // 2. Som de ondas do mar (perto das bordas da ilha)
      const oceanSrc = ctx.createBufferSource();
      oceanSrc.buffer = noiseBuf;
      oceanSrc.loop = true;
      const oceanFilter = ctx.createBiquadFilter();
      oceanFilter.type = 'lowpass';
      oceanFilter.frequency.value = 460;
      oceanGain = ctx.createGain();
      oceanGain.gain.value = 0.0;
      oceanSrc.connect(oceanFilter);
      oceanFilter.connect(oceanGain);
      oceanGain.connect(masterGain);
      oceanSrc.start();

      // 3. Motor multi-camada do carro dirigido
      engSubOsc = ctx.createOscillator();
      engMainOsc = ctx.createOscillator();
      engHarmOsc = ctx.createOscillator();
      engSubOsc.type = 'triangle';
      engMainOsc.type = 'sawtooth';
      engHarmOsc.type = 'square';
      engSubOsc.frequency.value = 36;
      engMainOsc.frequency.value = 72;
      engHarmOsc.frequency.value = 144;

      const subG = ctx.createGain(); subG.gain.value = 0.55;
      const mainG = ctx.createGain(); mainG.gain.value = 0.35;
      const harmG = ctx.createGain(); harmG.gain.value = 0.08;

      engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 280;
      engFilter.Q.value = 2.2;

      engGain = ctx.createGain();
      engGain.gain.value = 0.0;

      engSubOsc.connect(subG); subG.connect(engFilter);
      engMainOsc.connect(mainG); mainG.connect(engFilter);
      engHarmOsc.connect(harmG); harmG.connect(engFilter);
      engFilter.connect(engGain);
      engGain.connect(masterGain);

      engSubOsc.start();
      engMainOsc.start();
      engHarmOsc.start();

      // 4. Chiado de freio / pneu derrapando
      const tireSrc = ctx.createBufferSource();
      tireSrc.buffer = noiseBuf;
      tireSrc.loop = true;
      const tireFilter = ctx.createBiquadFilter();
      tireFilter.type = 'bandpass';
      tireFilter.frequency.value = 1850;
      tireFilter.Q.value = 5.5;
      tireGain = ctx.createGain();
      tireGain.gain.value = 0.0;
      tireSrc.connect(tireFilter);
      tireFilter.connect(tireGain);
      tireGain.connect(masterGain);
      tireSrc.start();

      // 5. Som espacial de carros de tráfego passando por perto
      const trafSrc = ctx.createBufferSource();
      trafSrc.buffer = noiseBuf;
      trafSrc.loop = true;
      trafficFilter = ctx.createBiquadFilter();
      trafficFilter.type = 'lowpass';
      trafficFilter.frequency.value = 210;
      trafficGain = ctx.createGain();
      trafficGain.gain.value = 0.0;
      trafSrc.connect(trafficFilter);
      trafficFilter.connect(trafficGain);
      trafficGain.connect(masterGain);
      trafSrc.start();

      initialized = true;
    } catch (_) {}
  }

  // Destrava o WebAudio no primeiro toque em qualquer lugar da tela
  const unlock = () => { initAudio(); };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });

  // --- Efeitos pontuais ---
  function playFootstep(running) {
    if (!ctx || !noiseBuf || !isAudioOn()) return;
    const now = ctx.currentTime;

    // Impacto curto no asfalto/calcada
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq = running ? 620 : 460;
    filter.frequency.value = baseFreq + (stepFoot ? 55 : -45) + (Math.random() * 60 - 30);
    filter.Q.value = 1.6;

    const g = ctx.createGain();
    const vol = running ? 0.17 : 0.11;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + (running ? 0.095 : 0.08));

    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    src.start(now, Math.random() * 1.8, 0.12);

    // Sub-thump do calcanhar
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(running ? 115 : 95, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.055);
    tg.gain.setValueAtTime(running ? 0.11 : 0.065, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    thump.connect(tg);
    tg.connect(masterGain);
    thump.start(now);
    thump.stop(now + 0.065);

    stepFoot = 1 - stepFoot;
  }

  function playDoorSlam(entering) {
    if (!ctx || !noiseBuf || !isAudioOn()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(entering ? 140 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  function playHornBurst(durationSec, volume, pitchMul) {
    if (!ctx || !isAudioOn()) return;
    const now = ctx.currentTime;
    const pm = pitchMul || 1.0;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const flt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.value = 392 * pm;
    o2.frequency.value = 493.88 * pm;
    flt.type = 'lowpass';
    flt.frequency.value = 1400;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(volume || 0.11, now + 0.02);
    g.gain.setValueAtTime(volume || 0.11, now + durationSec - 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    o1.connect(flt);
    o2.connect(flt);
    flt.connect(g);
    g.connect(masterGain);
    o1.start(now);
    o2.start(now);
    o1.stop(now + durationSec + 0.02);
    o2.stop(now + durationSec + 0.02);
  }

  function setHornHeld(on) {
    if (!ctx || !isAudioOn()) on = false;
    if (on && !hornActive) {
      hornActive = true;
      const now = ctx.currentTime;
      hornOsc1 = ctx.createOscillator();
      hornOsc2 = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      hornGain = ctx.createGain();
      hornOsc1.type = 'sawtooth';
      hornOsc2.type = 'sawtooth';
      hornOsc1.frequency.value = 385;
      hornOsc2.frequency.value = 485;
      flt.type = 'lowpass';
      flt.frequency.value = 1500;
      hornGain.gain.setValueAtTime(0.001, now);
      hornGain.gain.linearRampToValueAtTime(0.14, now + 0.025);
      hornOsc1.connect(flt);
      hornOsc2.connect(flt);
      flt.connect(hornGain);
      hornGain.connect(masterGain);
      hornOsc1.start(now);
      hornOsc2.start(now);
    } else if (!on && hornActive) {
      hornActive = false;
      try {
        const now = ctx.currentTime;
        hornGain.gain.setTargetAtTime(0.0001, now, 0.02);
        hornOsc1.stop(now + 0.08);
        hornOsc2.stop(now + 0.08);
      } catch (_) {}
      hornOsc1 = hornOsc2 = hornGain = null;
    }
  }

  function playBirdOrCricket(isNight) {
    if (!ctx || !isAudioOn()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    if (!isNight) {
      // Passarinho tropical curto (2 notas)
      const f = 2200 + Math.random() * 900;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.28, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(f * 0.92, now + 0.16);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.028, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.19);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.21);
    } else {
      // Grilo noturno suave
      const f = 4100 + Math.random() * 300;
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0008, now);
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.07;
        g.gain.linearRampToValueAtTime(0.014, t + 0.015);
        g.gain.linearRampToValueAtTime(0.0008, t + 0.05);
      }
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }

  function playDistantSiren() {
    if (!ctx || !isAudioOn()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.linearRampToValueAtTime(920, now + 0.7);
    osc.frequency.linearRampToValueAtTime(640, now + 1.4);
    osc.frequency.linearRampToValueAtTime(920, now + 2.1);
    g.gain.setValueAtTime(0.0005, now);
    g.gain.linearRampToValueAtTime(0.014, now + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 2.3);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 2.35);
  }

  function speakNpcNearby(player, npcs) {
    if (!isAudioOn() || !Array.isArray(npcs) || npcs.length === 0) return;
    const px = player.inCar ? player.inCar.pos.x : player.pos.x;
    const pz = player.inCar ? player.inCar.pos.z : player.pos.z;

    let closest = null;
    let bestD2 = 15 * 15;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (!n || !n.mesh) continue;
      const dx = n.mesh.position.x - px;
      const dz = n.mesh.position.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        closest = n;
      }
    }
    if (!closest) return;

    let line;
    let pitch = 0.92 + Math.random() * 0.34;
    if (closest.isJob || closest.isDoa) {
      line = NPC_LINES_JOB[Math.floor(Math.random() * NPC_LINES_JOB.length)];
      pitch = 1.18;
    } else if (player.inCar) {
      line = NPC_LINES_CAR[Math.floor(Math.random() * NPC_LINES_CAR.length)];
    } else {
      line = NPC_LINES_STREET[Math.floor(Math.random() * NPC_LINES_STREET.length)];
    }

    if (window.BrasilNative && typeof window.BrasilNative.speakNpc === 'function') {
      try {
        window.BrasilNative.speakNpc(line, pitch, 1.04);
      } catch (_) {}
    }
    if (window.BrasilRPBridge && typeof window.BrasilRPBridge.showToast === 'function') {
      const who = (closest.isJob || closest.isDoa) ? '👩 NPC Job' : '🗣️ Cidadão';
      window.BrasilRPBridge.showToast(who + ': "' + line + '"');
    }
  }

  // Botão de Buzina no carro
  const btnHorn = document.getElementById('btnCarHorn');
  if (btnHorn) {
    btnHorn.addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); setHornHeld(true); });
    btnHorn.addEventListener('pointerup', () => setHornHeld(false));
    btnHorn.addEventListener('pointercancel', () => setHornHeld(false));
    btnHorn.addEventListener('pointerleave', () => setHornHeld(false));
  }

  // --- Loop principal de áudio (chamado a cada frame) ---
  function tick(dt) {
    const b = window.BrasilRPBridge;
    if (!b || !b.player) return;

    const playing = b.getGameMode && b.getGameMode() === 'playing';
    const soundOn = isAudioOn();

    if (!initialized || !ctx) return;

    const now = ctx.currentTime;
    if (!soundOn) {
      ambGain.gain.setTargetAtTime(0, now, 0.1);
      oceanGain.gain.setTargetAtTime(0, now, 0.1);
      engGain.gain.setTargetAtTime(0, now, 0.08);
      tireGain.gain.setTargetAtTime(0, now, 0.08);
      if (apexBank.screechGain) apexBank.screechGain.gain.setTargetAtTime(0, now, 0.06);
      trafficGain.gain.setTargetAtTime(0, now, 0.1);
      setHornHeld(false);
      return;
    }

    const p = b.player;
    const inCar = !!p.inCar;
    const px = inCar ? p.inCar.pos.x : p.pos.x;
    const pz = inCar ? p.inCar.pos.z : p.pos.z;

    // Som de porta ao entrar/sair do carro
    if (playing && inCar !== wasInCar) {
      playDoorSlam(inCar);
      wasInCar = inCar;
    }

    // 1. Som ambiente da cidade (vento + ondas perto da costa)
    const ambTarget = playing ? (inCar ? 0.032 : 0.055) : 0.02;
    ambGain.gain.setTargetAtTime(ambTarget, now, 0.25);
    const windWave = 290 + Math.sin(now * 0.45) * 85;
    ambFilter.frequency.setTargetAtTime(windWave, now, 0.25);

    const edgeDist = Math.max(Math.abs(px), Math.abs(pz));
    const oceanVol = (playing && edgeDist > 155) ? Math.min(0.08, ((edgeDist - 155) / 65) * 0.08) : 0.0;
    oceanGain.gain.setTargetAtTime(oceanVol * (0.75 + 0.25 * Math.sin(now * 0.7)), now, 0.2);

    // Pássaros (dia/pôr do sol) ou Grilos (noite)
    if (playing && !inCar) {
      birdTimer -= dt;
      if (birdTimer <= 0) {
        birdTimer = 3.5 + Math.random() * 5.5;
        playBirdOrCricket(getEnvMode() === 'night');
      }
    }

    // Eventos distantes da cidade (buzina distante / sirene rara)
    if (playing) {
      cityEventTimer -= dt;
      if (cityEventTimer <= 0) {
        cityEventTimer = 14 + Math.random() * 18;
        if (Math.random() < 0.72) {
          playHornBurst(0.18 + Math.random() * 0.16, 0.028, 0.85 + Math.random() * 0.35);
        } else {
          playDistantSiren();
        }
      }
    }

    // 2. Passos do protagonista + Pulo/Pouso
    if (playing && !inCar) {
      const grounded = p.onGround !== false && (p.pos.y <= (p.groundY || 0) + 0.15);
      if (!wasGrounded && grounded) {
        playFootstep(true);
      }
      wasGrounded = grounded;

      const moveSpd = Math.hypot(p.vel ? p.vel.x : 0, p.vel ? p.vel.z : 0);
      if (grounded && moveSpd > 0.65) {
        const running = moveSpd > 5.2;
        stepAccum += dt * (running ? 3.2 : 2.15);
        if (stepAccum >= 1.0) {
          stepAccum = 0;
          playFootstep(running);
        }
      } else {
        stepAccum = 0.65;
      }
    } else {
      wasGrounded = true;
    }

    // 3. Motor realista + Marchas + Chiado de pneu/freio/burnout (inclui V8 Muscle oficial do Apex Circuit para o Lexus!)
    if (playing && inCar && !p.inCar.broken) {
      const car = p.inCar;
      const spd = Math.abs(car.speed || 0); // m/s
      const isBurnout = Boolean(car.burnoutActive);
      const bHeat = car.burnoutHeat || 0;
      const isLaunching = (car.launchBoostTimer || 0) > 0.1;
      const gearStep = 10.5;
      const curGear = Math.floor(spd / gearStep);
      const gearRatio = (spd % gearStep) / gearStep;

      if (isBurnout || isLaunching) ensureApexAudioLoaded();

      if (car.soundProfile === 'v8_muscle') {
        ensureApexAudioLoaded();
        engGain.gain.setTargetAtTime(0.0, now, 0.05);
        if (apexBank.loaded && apexBank.v8Gains.length > 0) {
          if (!isBurnout && curGear > apexBank.prevGear && spd > 6) playShiftPopSound();
          apexBank.prevGear = curGear;
          const revLimiter = Math.sin(now * 34) * 0.045;
          const rpmNorm = isBurnout
            ? Math.min(1.0, Math.max(0.68, 0.78 + bHeat * 0.20 + revLimiter))
            : Math.min(1.0, Math.max(0.0, (spd / 75.0) * 0.65 + gearRatio * 0.35 + (isLaunching ? 0.22 : 0)));
          const bandPos = rpmNorm * 4.0;
          for (let i = 0; i < 5; i++) {
            const g = apexBank.v8Gains[i];
            const s = apexBank.v8Sources[i];
            if (!g || !s) continue;
            const w = Math.max(0, 1.0 - Math.abs(bandPos - i));
            g.gain.setTargetAtTime(w * (0.18 + rpmNorm * 0.22), now, 0.05);
            s.playbackRate.setTargetAtTime(0.82 + rpmNorm * 0.45, now, 0.05);
          }
        }
      } else {
        for (let i = 0; i < apexBank.v8Gains.length; i++) {
          if (apexBank.v8Gains[i]) apexBank.v8Gains[i].gain.setTargetAtTime(0.0, now, 0.05);
        }
        const baseHz = isBurnout
          ? (66 + bHeat * 24 + Math.sin(now * 32) * 4.5)
          : (34 + Math.min(48, spd * 1.15) + gearRatio * 26);
        engSubOsc.frequency.setTargetAtTime(baseHz, now, 0.06);
        engMainOsc.frequency.setTargetAtTime(baseHz * 2.0, now, 0.06);
        engHarmOsc.frequency.setTargetAtTime(baseHz * 3.01, now, 0.06);
        engFilter.frequency.setTargetAtTime(
          isBurnout ? (1150 + bHeat * 450) : (220 + Math.min(1300, spd * 42 + gearRatio * 220)),
          now, 0.07
        );
        engGain.gain.setTargetAtTime(
          isBurnout ? 0.155 : Math.min(0.16, 0.055 + spd * 0.0038),
          now, 0.07
        );
      }

      // Freio forte, curva fechada em alta velocidade ou burnout -> cantar pneu
      const decel = (prevCarSpeed - spd) / Math.max(0.016, dt);
      const yawRate = Math.abs(car.rotY - prevCarRotY) / Math.max(0.016, dt);
      const skidding = (spd > 8 && decel > 10) || (spd > 11 && yawRate > 1.6);
      const tireTarget = isBurnout
        ? (0.095 + bHeat * 0.06)
        : (isLaunching ? 0.085 : (skidding ? 0.075 : 0.0));
      tireGain.gain.setTargetAtTime(tireTarget, now, 0.05);
      if (apexBank.screechGain && apexBank.screechSrc) {
        const screechVol = isBurnout
          ? (0.16 + bHeat * 0.22)
          : (isLaunching ? 0.18 : (skidding ? 0.12 : 0.0));
        apexBank.screechGain.gain.setTargetAtTime(screechVol, now, 0.05);
        apexBank.screechSrc.playbackRate.setTargetAtTime(
          isBurnout ? (0.94 + bHeat * 0.14 + Math.sin(now * 9) * 0.03) : 1.0,
          now, 0.06
        );
      }

      prevCarSpeed = spd;
      prevCarRotY = car.rotY;
    } else {
      for (let i = 0; i < apexBank.v8Gains.length; i++) {
        if (apexBank.v8Gains[i]) apexBank.v8Gains[i].gain.setTargetAtTime(0.0, now, 0.06);
      }
      if (apexBank.screechGain) apexBank.screechGain.gain.setTargetAtTime(0.0, now, 0.06);
      engGain.gain.setTargetAtTime(0.0, now, 0.08);
      tireGain.gain.setTargetAtTime(0.0, now, 0.06);
      prevCarSpeed = 0;
      apexBank.prevGear = 0;
    }

    // 4. Som espacial de carros de tráfego passando por perto
    if (playing && Array.isArray(b.trafficCars) && b.trafficCars.length > 0) {
      let minD2 = 28 * 28;
      let nearestSpd = 0;
      for (let i = 0; i < b.trafficCars.length; i++) {
        const tc = b.trafficCars[i];
        if (!tc || !tc.mesh) continue;
        const dx = tc.mesh.position.x - px;
        const dz = tc.mesh.position.z - pz;
        const d2 = dx * dx + dz * dz;
        if (d2 < minD2) {
          minD2 = d2;
          nearestSpd = Math.abs(tc.speed || 0);
        }
      }
      if (minD2 < 28 * 28 && nearestSpd > 0.8) {
        const d = Math.sqrt(minD2);
        const prox = Math.max(0, 1 - d / 28);
        trafficGain.gain.setTargetAtTime(prox * prox * 0.14, now, 0.1);
        trafficFilter.frequency.setTargetAtTime(160 + prox * 480 + nearestSpd * 18, now, 0.1);
      } else {
        trafficGain.gain.setTargetAtTime(0.0, now, 0.15);
      }
    } else {
      trafficGain.gain.setTargetAtTime(0.0, now, 0.15);
    }

    // Voz dos NPCs desativada conforme preferência do usuário
  }

  function setPaused(paused) {
    if (!ctx) return;
    if (paused) {
      if (masterGain) masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      if (ctx.state === 'running') ctx.suspend().catch(() => {});
    } else if (isAudioOn()) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (masterGain) masterGain.gain.setTargetAtTime(0.85, ctx.currentTime, 0.05);
    }
  }

  window.BrasilAudio = { tick, playHornBurst, playDoorSlam, playFootstep, setPaused };
})();
