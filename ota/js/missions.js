(() => {
  'use strict';

  // =========================================================================
  // MODO HISTÓRIA & MISSÕES — "ASCENSÃO EM LIBERTY BR" (CAPÍTULO 1 + SIDE RP)
  // =========================================================================

  const CONTACTS = {
    marta:  { name: 'Dona Marta',    role: 'Central Delivery', color: '#4ade80', icon: '📦' },
    bola:   { name: 'Mecânico Bola', role: 'Oficina & Garagem', color: '#fbbf24', icon: '🔧' },
    ruan:   { name: 'DJ Ruan',       role: 'Rei dos Rachas',    color: '#38bdf8', icon: '🎧' },
    nina:   { name: 'Nina',          role: 'Parceira VIP',      color: '#f472b6', icon: '💃' },
    silva:  { name: 'Delegado Silva', role: 'Central PM-BR',    color: '#60a5fa', icon: '🚓' }
  };

  // Coordenadas 100% validadas em vias reais transitáveis (road_grid === 1)
  const STORY_MISSIONS = [
    {
      id: 'm1_corre',
      num: 1,
      title: '01. Primeiro Corre',
      contact: 'marta',
      desc: 'Pegue seu carro, retire o combo VIP no McDonald\'s Drive-Thru, entregue no Centro Sul e volte ao Banco 24h.',
      rewardCash: 1200,
      rewardXp: 150,
      intro: [
        { who: 'marta', text: 'Fala novato! Bem-vindo a Liberty BR. Tenho um corre rápido pagando R$ 1.200 no Pix.' },
        { who: 'marta', text: 'Pega seu carro, passa no Drive-Thru do McDonald\'s e leva a encomenda pro Centro Sul!' }
      ],
      outro: [
        { who: 'marta', text: 'Mandou bem demais! O Pix já caiu na conta. Fica de olho no celular, o Bola quer falar contigo.' }
      ],
      steps: [
        { type: 'enter_car', label: 'Entre em um veículo na rua', color: 0xffd41f },
        { type: 'reach', x: -143.4, z: -56.9, radius: 9, requireCar: true, timer: 120, label: 'Passe no McDonald\'s Drive-Thru', gpsName: '🍔 McDonald\'s Drive-Thru', color: 0xffd41f, onDoneDialogue: [{ who: 'marta', text: 'Boa! Pedido retirado. Agora acelera pro Centro Sul antes que esfrie!' }] },
        { type: 'reach', x: -65.7, z: 13.4, radius: 9.5, requireCar: true, timer: 110, label: 'Entregue no Centro Sul VIP', gpsName: '📦 Entrega VIP', color: 0x00e676, onDoneDialogue: [{ who: 'marta', text: 'Cliente satisfeito! Volta até o Caixa Banco 24h na Central para encerrar o expediente.' }] },
        { type: 'reach', x: -171.8, z: -173.1, radius: 9.5, label: 'Volte ao Banco 24h Central', gpsName: '🏧 Banco 24h Central', color: 0xffd41f }
      ]
    },
    {
      id: 'm2_treta',
      num: 2,
      title: '02. Treta na Calçada',
      contact: 'bola',
      desc: 'Um cobrador rival está intimidando a vizinhança na porta da sua Casa Própria. Resolva no braço e proteja o terreno.',
      rewardCash: 1800,
      rewardXp: 220,
      intro: [
        { who: 'bola', text: 'Ei parceiro, papo reto: tem um folgado cobrando taxa na porta da sua casa!' },
        { who: 'bola', text: 'Cola lá na sua Residência e coloca esse cara pra dormir. Mostra quem manda na área!' }
      ],
      outro: [
        { who: 'bola', text: 'É disso que eu tô falando! Agora geral já sabe seu nome no bairro. O DJ Ruan te marcou pro próximo racha.' }
      ],
      steps: [
        { type: 'reach', x: -134.7, z: -185.7, radius: 18, label: 'Vá até a sua Casa Própria', gpsName: '🏠 Minha Casa (Treta)', color: 0xff1744, onDoneDialogue: [{ who: 'bola', text: 'Olha o folgado ali na frente! Desce do carro e nocauteia ele!' }] },
        { type: 'defeat_enemy', x: -133.2, z: -182.8, enemyHp: 135, label: 'Nocauteie o Capanga Rival', gpsName: '🥊 Capanga Rival', color: 0xff1744, onDoneDialogue: [{ who: 'bola', text: 'Nocauteado! Agora chega na porta da sua casa pra confirmar que a área tá limpa.' }] },
        { type: 'reach', x: -135.0, z: -182.0, radius: 6.5, label: 'Garanta a entrada da Minha Casa', gpsName: '🏠 Porta da Casa', color: 0xffd41f }
      ]
    },
    {
      id: 'm3_racha',
      num: 3,
      title: '03. Racha do Estádio',
      contact: 'ruan',
      desc: 'Circuito de rua cronometrado (6 checkpoints) subindo a avenida até a volta completa do Estádio Memorial.',
      rewardCash: 3000,
      rewardXp: 350,
      intro: [
        { who: 'ruan', text: 'Salve piloto! Aqui é o DJ Ruan. A galera fechou a avenida do Estádio Memorial pro racha de hoje.' },
        { who: 'ruan', text: 'Passa pelos 6 checkpoints no limite do giro. Se fechar no tempo, leva R$ 3.000 limpo!' }
      ],
      outro: [
        { who: 'ruan', text: 'QUE TOCADA ABSURDA! Você destruiu o relógio na volta do Estádio! Já tá famoso na pista!' }
      ],
      steps: [
        { type: 'enter_car', label: 'Entre em um carro para o racha', color: 0x00e5ff },
        { type: 'reach', x: -47.2, z: -346.9, radius: 11, requireCar: true, timer: 165, keepTimer: true, label: 'Checkpoint 1/6 — Av. Norte', gpsName: '🏁 CP 1/6', color: 0x00e5ff },
        { type: 'reach', x: -50.6, z: -536.6, radius: 11, requireCar: true, keepTimer: true, label: 'Checkpoint 2/6 — Reta Staunton', gpsName: '🏁 CP 2/6', color: 0x00e5ff },
        { type: 'reach', x: -52.3, z: -750.0, radius: 11, requireCar: true, keepTimer: true, label: 'Checkpoint 3/6 — Frente do Estádio', gpsName: '🏟️ CP 3/6 Estádio', color: 0x00e5ff },
        { type: 'reach', x: -89.3, z: -860.6, radius: 11, requireCar: true, keepTimer: true, label: 'Checkpoint 4/6 — Curva Norte', gpsName: '🏁 CP 4/6', color: 0x00e5ff },
        { type: 'reach', x: -190.3, z: -750.0, radius: 11, requireCar: true, keepTimer: true, label: 'Checkpoint 5/6 — Lateral Oeste', gpsName: '🏁 CP 5/6', color: 0x00e5ff },
        { type: 'reach', x: -114.5, z: -658.3, radius: 12, requireCar: true, keepTimer: true, label: 'CHEGADA 6/6 — Esplanada Estádio', gpsName: '🏆 Chegada Estádio', color: 0xffd41f }
      ]
    },
    {
      id: 'm4_porto',
      num: 4,
      title: '04. Carga Quente no Porto',
      contact: 'bola',
      desc: 'Cruze a Ponte Callahan até as docas de Portland, pegue a carga quente e fuja com 2 estrelas de procurado até sua casa.',
      rewardCash: 4500,
      rewardXp: 450,
      intro: [
        { who: 'bola', text: 'Seguinte: chegou um lote raro nas docas de Portland, mas a área tá vigiada pela PM.' },
        { who: 'bola', text: 'Atravessa a Ponte Callahan, recolhe a carga no Porto e pisa fundo de volta pra sua casa!' }
      ],
      outro: [
        { who: 'bola', text: 'Carga na garagem e polícia despistada! Você dirige igual profissional. R$ 4.500 na mão!' }
      ],
      steps: [
        { type: 'enter_car', label: 'Entre em um carro rápido', color: 0xffd41f },
        { type: 'reach', x: 139.6, z: -498.7, radius: 14, requireCar: true, label: 'Cruze a Ponte Callahan para Portland', gpsName: '🌉 Ponte Callahan', color: 0xffd41f },
        { type: 'reach', x: 540.2, z: -256.8, radius: 12, requireCar: true, label: 'Recolha a Carga no Porto de Portland', gpsName: '⚓ Porto de Portland', color: 0xff1744, triggerWanted: 2, onDoneDialogue: [{ who: 'bola', text: 'ALERTA! A PM bateu o olho na carga (★★)! Pisa fundo de volta pela Ponte Callahan até sua casa!' }] },
        { type: 'reach', x: 139.6, z: -498.7, radius: 14, requireCar: true, timer: 185, keepTimer: true, label: 'Fuga! Cruze a Ponte Callahan de volta', gpsName: '🚨 Fuga Ponte Callahan', color: 0xff1744 },
        { type: 'reach', x: -134.7, z: -185.7, radius: 11, requireCar: true, keepTimer: true, clearWantedOnDone: true, label: 'Leve a carga segura até Minha Casa', gpsName: '🏠 Garagem Segura', color: 0x00e676 }
      ]
    },
    {
      id: 'm5_aeroporto',
      num: 5,
      title: '05. Resgate no Aeroporto',
      contact: 'nina',
      desc: 'Atravessa a Ponte Levadiça até o Aeroporto Internacional em Shoreside Vale, busque Nina e traga-a em segurança.',
      rewardCash: 6000,
      rewardXp: 600,
      intro: [
        { who: 'nina', text: 'Oi! Aqui é a Nina! Acabei de pousar no Aeroporto Internacional e meu transporte furou!' },
        { who: 'nina', text: 'Cruza a Ponte Levadiça até Shoreside Vale e vem me buscar antes que o terminal feche!' }
      ],
      outro: [
        { who: 'nina', text: 'Obrigada por me salvar, piloto! Transferi R$ 6.000 no Pix. O Ruan tá te chamando pra grande final!' }
      ],
      steps: [
        { type: 'enter_car', label: 'Entre em um carro para buscar Nina', color: 0xf472b6 },
        { type: 'reach', x: -397.3, z: -593.5, radius: 13, requireCar: true, timer: 210, keepTimer: true, label: 'Cruze a Ponte Levadiça (Shoreside)', gpsName: '🌉 Ponte Levadiça', color: 0xf472b6 },
        { type: 'reach', x: -560.6, z: -359.6, radius: 12, requireCar: true, keepTimer: true, label: 'Busque Nina no Aeroporto Internacional', gpsName: '✈️ Aeroporto (Nina)', color: 0xf472b6, onDoneDialogue: [{ who: 'nina', text: 'Entrei! Que carrão lindo! Agora me leva de volta pro Centro de Staunton pela Ponte Levadiça!' }] },
        { type: 'reach', x: -397.3, z: -593.5, radius: 13, requireCar: true, keepTimer: true, label: 'Volte pela Ponte Levadiça', gpsName: '🌉 Ponte Levadiça (Volta)', color: 0x00e676 },
        { type: 'reach', x: -171.8, z: -173.1, radius: 11, requireCar: true, keepTimer: true, label: 'Deixe Nina no Centro de Staunton', gpsName: '💃 Centro Staunton', color: 0xffd41f }
      ]
    },
    {
      id: 'm6_rei',
      num: 6,
      title: '06. Rei do Asfalto (Final Cap. 1)',
      contact: 'ruan',
      desc: 'Grande Circuito Noturno pelas 3 ilhas (8 checkpoints) valendo R$ 12.000 e um Lexus LC 500 Wald Dourado!',
      rewardCash: 12000,
      rewardXp: 1200,
      setEnvOnStart: 'night',
      grantLexusOnWin: true,
      intro: [
        { who: 'ruan', text: 'CHEGOU A HORA DA VERDADE! O Grande Circuito Noturno das 3 Ilhas de Liberty BR!' },
        { who: 'ruan', text: 'Staunton → Estádio → Ponte Callahan → Portland → Ponte Levadiça → Aeroporto → Chegada! Quem vencer leva R$ 12.000 e o título de REI DO ASFALTO!' }
      ],
      outro: [
        { who: 'ruan', text: 'HISTÓRICO!! VOCÊ É O NOVO REI DO ASFALTO DE LIBERTY BR! R$ 12.000 + Lexus LC 500 Wald entregue na sua porta!' }
      ],
      steps: [
        { type: 'enter_car', label: 'Entre no seu carro pro Grande Circuito', color: 0xffd41f },
        { type: 'reach', x: -52.3, z: -750.0, radius: 13, requireCar: true, timer: 340, keepTimer: true, label: 'CP 1/8 — Estádio Memorial', gpsName: '🏁 CP 1/8 Estádio', color: 0x00e5ff },
        { type: 'reach', x: 139.6, z: -498.7, radius: 14, requireCar: true, keepTimer: true, label: 'CP 2/8 — Ponte Callahan', gpsName: '🏁 CP 2/8 Ponte', color: 0x00e5ff },
        { type: 'reach', x: 435.8, z: -449.7, radius: 13, requireCar: true, keepTimer: true, label: 'CP 3/8 — Centro Portland', gpsName: '🏁 CP 3/8 Portland', color: 0x00e5ff },
        { type: 'reach', x: 459.4, z: -750.0, radius: 13, requireCar: true, keepTimer: true, label: 'CP 4/8 — Portland Norte', gpsName: '🏁 CP 4/8 Norte', color: 0x00e5ff },
        { type: 'reach', x: 139.6, z: -498.7, radius: 14, requireCar: true, keepTimer: true, label: 'CP 5/8 — Retorno Ponte Callahan', gpsName: '🏁 CP 5/8 Volta', color: 0x00e5ff },
        { type: 'reach', x: -397.3, z: -593.5, radius: 14, requireCar: true, keepTimer: true, label: 'CP 6/8 — Ponte Levadiça', gpsName: '🏁 CP 6/8 Levadiça', color: 0x00e5ff },
        { type: 'reach', x: -560.6, z: -359.6, radius: 13, requireCar: true, keepTimer: true, label: 'CP 7/8 — Aeroporto Internacional', gpsName: '🏁 CP 7/8 Aeroporto', color: 0x00e5ff },
        { type: 'reach', x: -171.8, z: -173.1, radius: 13, requireCar: true, keepTimer: true, label: 'CHEGADA FINAL 8/8 — Centro!', gpsName: '👑 Chegada Final', color: 0xffd41f }
      ]
    }
  ];

  // Estado ativo do motor de missões
  let active = null; // { kind: 'story'|'uber'|'race'|'police', def, stepIdx, timer, elapsed, startCarHp, enemyNpc, enemyHalo, markerPos }
  let markerGroup = null;
  let markerRingMat = null;
  let markerPadMat = null;
  let markerArrow = null;
  let dialogueQueue = [];
  let dialogueTimer = 0;
  let welcomeShown = false;
  let playSeconds = 0;
  let resultTimer = null;

  const $ = (id) => document.getElementById(id);

  function B() { return window.BrasilRPBridge; }

  function ensureSaveDefaults() {
    const b = B();
    if (!b || !b.save) return;
    if (typeof b.save.storyIdx !== 'number') b.save.storyIdx = 0;
    if (typeof b.save.xp !== 'number') b.save.xp = 0;
    if (typeof b.save.level !== 'number') b.save.level = 1;
    if (!Array.isArray(b.save.completedMissions)) b.save.completedMissions = [];
    if (typeof b.save.sideDone !== 'number') b.save.sideDone = 0;
  }

  function xpNeededFor(lv) {
    return 300 + (lv - 1) * 200;
  }

  function addXp(amount) {
    const b = B();
    if (!b || !b.save) return false;
    ensureSaveDefaults();
    b.save.xp += amount;
    let leveled = false;
    while (b.save.level < 50 && b.save.xp >= xpNeededFor(b.save.level)) {
      b.save.xp -= xpNeededFor(b.save.level);
      b.save.level += 1;
      leveled = true;
    }
    b.persistSave();
    updateLevelHud();
    if (leveled) {
      b.showToast(`⭐ LEVEL UP! Agora você é Nível RP ${b.save.level}!`, 4000);
    }
    return leveled;
  }

  function updateLevelHud() {
    const b = B();
    if (!b || !b.save) return;
    ensureSaveDefaults();
    const lvEl = $('rpLevelBadge');
    if (lvEl) lvEl.textContent = `LV ${b.save.level}`;
  }

  function playMissionSound(type) {
    const b = B();
    if (!b || !b.AudioFX) return;
    if (type === 'pass') {
      b.AudioFX.beep(523, 0.12, 'triangle', 0.16);
      setTimeout(() => b.AudioFX.beep(659, 0.12, 'triangle', 0.16), 110);
      setTimeout(() => b.AudioFX.beep(784, 0.14, 'triangle', 0.17), 220);
      setTimeout(() => b.AudioFX.beep(1046, 0.34, 'triangle', 0.19), 340);
    } else if (type === 'fail') {
      b.AudioFX.beep(280, 0.18, 'sawtooth', 0.13);
      setTimeout(() => b.AudioFX.beep(190, 0.35, 'sawtooth', 0.14), 190);
    } else if (type === 'cp') {
      b.AudioFX.beep(740, 0.08, 'sine', 0.13);
      setTimeout(() => b.AudioFX.beep(988, 0.11, 'sine', 0.13), 75);
    } else if (type === 'radio') {
      b.AudioFX.beep(880, 0.035, 'sine', 0.07);
    }
  }

  function queueDialogues(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return;
    for (const ln of lines) dialogueQueue.push(ln);
    if (dialogueTimer <= 0) advanceDialogue();
  }

  function advanceDialogue() {
    const bar = $('gtaDialogueBar');
    if (!bar) return;
    if (dialogueQueue.length === 0) {
      bar.classList.add('hidden');
      dialogueTimer = 0;
      return;
    }
    const item = dialogueQueue.shift();
    const c = CONTACTS[item.who] || { name: item.who || 'Contato', color: '#ffd41f', icon: '📱' };
    const ico = $('dlgIcon'), nm = $('dlgName'), txt = $('dlgText');
    if (ico) ico.textContent = c.icon;
    if (nm) { nm.textContent = c.name; nm.style.color = c.color; }
    if (txt) txt.textContent = item.text;
    bar.classList.remove('hidden');
    dialogueTimer = Math.max(3.6, Math.min(6.2, item.text.length * 0.055));
    playMissionSound('radio');
  }

  function showResultBanner(title, subtitle, rewardLine, isFail = false) {
    const elB = $('missionResultBanner');
    if (!elB) return;
    elB.classList.remove('hidden', 'fail');
    if (isFail) elB.classList.add('fail');
    const tEl = $('mrTitle'), sEl = $('mrSub'), rEl = $('mrReward');
    if (tEl) tEl.textContent = title;
    if (sEl) sEl.textContent = subtitle;
    if (rEl) rEl.textContent = rewardLine || '';
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => elB.classList.add('hidden'), 4600);
  }

  function ensureMarkerGroup() {
    if (markerGroup) return;
    const b = B();
    if (!b || !b.scene || typeof THREE === 'undefined') return;
    markerGroup = new THREE.Group();
    markerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd41f,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 5.5, 22, 1, true), markerRingMat);
    cyl.position.y = 2.75;
    markerGroup.add(cyl);

    markerPadMat = new THREE.MeshBasicMaterial({
      color: 0xffea70,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.7, 24).rotateX(-Math.PI / 2), markerPadMat);
    pad.position.y = 0.12;
    markerGroup.add(pad);

    markerArrow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.5, 4), markerPadMat);
    markerArrow.rotation.x = Math.PI;
    markerArrow.position.y = 6.8;
    markerGroup.add(markerArrow);

    markerGroup.visible = false;
    b.scene.add(markerGroup);
  }

  function setMarkerVisual(x, z, colorHex) {
    ensureMarkerGroup();
    const b = B();
    if (!markerGroup || !b) return;
    const refY = b.player.inCar ? b.player.inCar.pos.y : b.player.pos.y;
    const y = b.getSafeGroundForSpawn(x, z, refY);
    markerGroup.position.set(x, y, z);
    markerGroup.visible = true;
    const col = colorHex || 0xffd41f;
    if (markerRingMat) markerRingMat.color.setHex(col);
    if (markerPadMat) markerPadMat.color.setHex(col);
  }

  function hideMarkerVisual() {
    if (markerGroup) markerGroup.visible = false;
  }

  function cleanupMissionEntities() {
    const b = B();
    hideMarkerVisual();
    if (active && active.enemyHalo && b && b.scene) {
      b.scene.remove(active.enemyHalo);
    }
    if (active && active.enemyNpc && active.enemyNpc.mesh && b && b.scene) {
      // Remove halo e deixa NPC sumir se era temporário
      const idx = b.npcs.indexOf(active.enemyNpc);
      if (idx >= 0 && active.enemyNpc._isMissionTemp) {
        b.scene.remove(active.enemyNpc.mesh);
        b.npcs.splice(idx, 1);
      }
    }
    if (b && b.clearGpsDestination) b.clearGpsDestination();
    const mb = $('missionBanner');
    if (mb) mb.classList.add('hidden');
  }

  function formatSec(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function updateMissionHud() {
    const mb = $('missionBanner');
    const mt = $('missionText');
    const tm = $('missionTimerTag');
    const cBtn = $('btnCancelStoryMission');
    if (!mb || !mt) return;
    if (!active) {
      mb.classList.add('hidden');
      if (tm) tm.classList.add('hidden');
      if (cBtn) cBtn.classList.add('hidden');
      return;
    }
    const step = active.def.steps[active.stepIdx];
    mb.classList.remove('hidden');
    mt.textContent = step ? step.label : active.def.title;
    if (cBtn) cBtn.classList.remove('hidden');
    if (tm) {
      if (active.timer !== null && active.timer > 0) {
        tm.classList.remove('hidden');
        tm.textContent = '⏱ ' + formatSec(active.timer);
        tm.classList.toggle('urgent', active.timer < 20);
      } else if (active.kind === 'race') {
        tm.classList.remove('hidden');
        tm.textContent = '⏱ ' + active.elapsed.toFixed(1) + 's';
        tm.classList.remove('urgent');
      } else {
        tm.classList.add('hidden');
      }
    }
  }

  function setupCurrentStep() {
    const b = B();
    if (!active || !b) return;
    const step = active.def.steps[active.stepIdx];
    if (!step) {
      completeActiveMission();
      return;
    }

    if (step.timer && !step.keepTimer) {
      active.timer = step.timer;
    } else if (step.timer && active.timer === null) {
      active.timer = step.timer;
    } else if (!step.timer && !step.keepTimer) {
      active.timer = null;
    }

    if (step.type === 'enter_car') {
      hideMarkerVisual();
      active.markerPos = null;
      if (b.player.inCar) {
        active.stepIdx++;
        setupCurrentStep();
        return;
      }
    } else if (step.type === 'reach') {
      setMarkerVisual(step.x, step.z, step.color || 0xffd41f);
      active.markerPos = { x: step.x, z: step.z, color: step.color || 0xffd41f };
      b.setGpsDestination(step.x, step.z, step.gpsName || active.def.title);
    } else if (step.type === 'defeat_enemy') {
      const refY = b.player.inCar ? b.player.inCar.pos.y : b.player.pos.y;
      const ey = b.getSafeGroundForSpawn(step.x, step.z, refY);
      const npc = b.spawnNPC(step.x, ey, step.z, false, { doa: false });
      if (npc) {
        npc._isMissionTemp = true;
        npc.hp = step.enemyHp || 130;
        npc.hostileToPlayer = true;
        npc.aiState = 'hostile';
        npc.dead = false;
        npc.knockTimer = 0;
        active.enemyNpc = npc;
        // Halo vermelho flutuante acima da cabeça do alvo para facilitar identificação
        const halo = new THREE.Mesh(
          new THREE.ConeGeometry(0.32, 0.65, 4),
          new THREE.MeshBasicMaterial({ color: 0xff1744 })
        );
        halo.rotation.x = Math.PI;
        halo.position.set(step.x, ey + 2.4, step.z);
        b.scene.add(halo);
        active.enemyHalo = halo;
      }
      hideMarkerVisual();
      active.markerPos = { x: step.x, z: step.z, color: 0xff1744 };
      b.setGpsDestination(step.x, step.z, step.gpsName || 'Alvo Hostil');
    }

    updateMissionHud();
  }

  function completeActiveMission() {
    const b = B();
    if (!active || !b) return;
    ensureSaveDefaults();
    const done = active;
    cleanupMissionEntities();
    active = null;

    let cash = done.def.rewardCash || 500;
    let xp = done.def.rewardXp || 100;
    let extraNote = '';

    if (done.kind === 'uber' && b.player.inCar && done.startCarHp !== null) {
      if (b.player.inCar.hp >= done.startCarHp - 2) {
        cash += 250;
        extraNote = ' • Bônus Direção Limpa +R$ 250!';
      }
    }
    if (done.kind === 'race') {
      const tSec = Number(done.elapsed.toFixed(1));
      if (!b.save.bestRaceTime || tSec < b.save.bestRaceTime) {
        b.save.bestRaceTime = tSec;
        extraNote = ` • NOVO RECORDE: ${tSec}s!`;
      } else {
        extraNote = ` • Tempo: ${tSec}s (Rec: ${b.save.bestRaceTime}s)`;
      }
    }

    b.save.cash += cash;
    if (done.kind === 'story') {
      if (!b.save.completedMissions.includes(done.def.id)) {
        b.save.completedMissions.push(done.def.id);
      }
      if (done.def.num > b.save.storyIdx) {
        b.save.storyIdx = done.def.num;
      }
      if (done.def.grantLexusOnWin) {
        const p = b.player.inCar ? b.player.inCar.pos : b.player.pos;
        const gx = p.x + 5.5, gz = p.z + 3.0;
        const gy = b.getSafeGroundForSpawn(gx, gz, p.y);
        const lex = b.spawnVehicle('lexus_lc_500_wald', gx, gy + 0.05, gz, 0);
        if (lex) b.paintVehicle(lex, '#ffd41f');
        extraNote = ' • 🏁 Lexus LC 500 Wald Entregue!';
      }
    } else {
      b.save.sideDone += 1;
    }

    b.persistSave();
    b.refreshMoneyUI();
    addXp(xp);
    playMissionSound('pass');
    b.vibrate(110);

    showResultBanner(
      done.kind === 'story' && done.def.num === STORY_MISSIONS.length ? '👑 CAPÍTULO 1 CONCLUÍDO!' : 'MISSÃO CONCLUÍDA!',
      done.def.title,
      `+R$ ${cash.toLocaleString('pt-BR')}  •  +${xp} XP${extraNote}`,
      false
    );

    if (done.def.outro) queueDialogues(done.def.outro);
    updateMissionHud();
    renderPhoneUI();
  }

  function failActiveMission(reason) {
    if (!active) return;
    const title = active.def.title;
    cleanupMissionEntities();
    active = null;
    playMissionSound('fail');
    showResultBanner('MISSÃO FALHOU', title, reason || 'Tente novamente pelo Smartphone iFruit', true);
    updateMissionHud();
    renderPhoneUI();
  }

  function startStoryMission(idx) {
    const b = B();
    if (!b) return;
    ensureSaveDefaults();
    const mIdx = Math.max(0, Math.min(STORY_MISSIONS.length - 1, idx));
    const def = STORY_MISSIONS[mIdx];
    if (active) cleanupMissionEntities();

    if (def.setEnvOnStart && b.applyEnv) {
      b.applyEnv(def.setEnvOnStart);
    }

    active = {
      kind: 'story',
      def,
      stepIdx: 0,
      timer: null,
      elapsed: 0,
      startCarHp: b.player.inCar ? b.player.inCar.hp : null,
      enemyNpc: null,
      enemyHalo: null,
      markerPos: null
    };
    const pm = $('phoneModal');
    if (pm) pm.classList.add('hidden');

    queueDialogues(def.intro);
    setupCurrentStep();
    renderPhoneUI();
  }

  function pickRandomRoadPoint(px, pz, minDist, maxDist) {
    const b = B();
    if (!b || !b.roadCells || b.roadCells.length === 0) return { x: px + 110, z: pz - 90 };
    for (let t = 0; t < 160; t++) {
      const c = b.roadCells[Math.floor(Math.random() * b.roadCells.length)];
      const d = Math.hypot(c.wx - px, c.wz - pz);
      if (d >= minDist && d <= maxDist) return { x: c.wx, z: c.wz };
    }
    return { x: -52.3, z: -750.0 };
  }

  function startSideMission(kind) {
    const b = B();
    if (!b) return;
    if (active) cleanupMissionEntities();
    const p = b.player.inCar ? b.player.inCar.pos : b.player.pos;
    let def = null;

    if (kind === 'uber') {
      const pick = pickRandomRoadPoint(p.x, p.z, 55, 190);
      const drop = pickRandomRoadPoint(pick.x, pick.z, 170, 420);
      const dist = Math.round(Math.hypot(drop.x - pick.x, drop.z - pick.z));
      const reward = Math.max(550, Math.min(1300, Math.round(400 + dist * 2.1)));
      def = {
        id: 'side_uber',
        title: '🚕 Corrida App (Uber RP)',
        rewardCash: reward,
        rewardXp: 120,
        intro: [{ who: 'marta', text: `Nova corrida aceita! Busca o passageiro no marcador e leva até o destino (${dist}m). Sem bater ganha bônus!` }],
        outro: [{ who: 'marta', text: '5 estrelas do passageiro! Corrida paga direto na sua conta.' }],
        steps: [
          { type: 'enter_car', label: 'Entre em um carro para iniciar o Uber RP', color: 0x00e676 },
          { type: 'reach', x: pick.x, z: pick.z, radius: 10, requireCar: true, timer: 95, label: 'Busque o passageiro na calçada', gpsName: '🚕 Passageiro', color: 0x00e676, onDoneDialogue: [{ who: 'marta', text: 'Passageiro embarcou! Siga o GPS até o destino com direção limpa.' }] },
          { type: 'reach', x: drop.x, z: drop.z, radius: 10, requireCar: true, timer: 130, label: 'Leve o passageiro ao destino', gpsName: '📍 Destino Uber', color: 0xffd41f }
        ]
      };
    } else if (kind === 'race') {
      def = {
        id: 'side_race',
        title: '🏁 Time Trial — Circuito Relâmpago',
        rewardCash: 1200,
        rewardXp: 180,
        intro: [{ who: 'ruan', text: 'Cronômetro ligado! Fecha os 5 checkpoints do Circuito Relâmpago no menor tempo possível!' }],
        outro: [{ who: 'ruan', text: 'Bela volta! Tempo registrado no ranking do seu celular.' }],
        steps: [
          { type: 'enter_car', label: 'Entre em um carro para largar', color: 0x00e5ff },
          { type: 'reach', x: -111.2, z: -419.6, radius: 11, requireCar: true, label: 'Time Trial 1/5 — Parque Central', gpsName: '🏁 CP 1/5', color: 0x00e5ff },
          { type: 'reach', x: -52.3, z: -750.0, radius: 11, requireCar: true, label: 'Time Trial 2/5 — Estádio Frente', gpsName: '🏁 CP 2/5', color: 0x00e5ff },
          { type: 'reach', x: -190.3, z: -750.0, radius: 11, requireCar: true, label: 'Time Trial 3/5 — Estádio Oeste', gpsName: '🏁 CP 3/5', color: 0x00e5ff },
          { type: 'reach', x: -114.5, z: -658.3, radius: 11, requireCar: true, label: 'Time Trial 4/5 — Esplanada', gpsName: '🏁 CP 4/5', color: 0x00e5ff },
          { type: 'reach', x: -171.8, z: -173.1, radius: 12, requireCar: true, label: 'CHEGADA 5/5 — Centro!', gpsName: '🏆 Chegada', color: 0xffd41f }
        ]
      };
    } else if (kind === 'police') {
      const spot = pickRandomRoadPoint(p.x, p.z, 75, 220);
      def = {
        id: 'side_police',
        title: '🚓 Patrulha PM-BR — Ocorrência',
        rewardCash: 950,
        rewardXp: 160,
        intro: [{ who: 'silva', text: 'Atenção QAP! Suspeito causando confusão na via. Desloque até o ponto vermelho e neutralize a ocorrência!' }],
        outro: [{ who: 'silva', text: 'Ocorrência neutralizada com sucesso, guerreiro! Gratificação liberada.' }],
        steps: [
          { type: 'reach', x: spot.x, z: spot.z, radius: 22, timer: 135, label: 'Desloque até a Ocorrência PM-BR', gpsName: '🚨 Ocorrência PM', color: 0xff1744, onDoneDialogue: [{ who: 'silva', text: 'Alvo avistado! Imobilize o suspeito!' }] },
          { type: 'defeat_enemy', x: spot.x, z: spot.z, enemyHp: 115, label: 'Neutralize o Suspeito no local', gpsName: '🚨 Suspeito', color: 0xff1744 }
        ]
      };
    }

    if (!def) return;
    active = {
      kind,
      def,
      stepIdx: 0,
      timer: null,
      elapsed: 0,
      startCarHp: b.player.inCar ? b.player.inCar.hp : null,
      enemyNpc: null,
      enemyHalo: null,
      markerPos: null
    };
    const pm = $('phoneModal');
    if (pm) pm.classList.add('hidden');
    queueDialogues(def.intro);
    setupCurrentStep();
    renderPhoneUI();
  }

  function cancelMission() {
    if (!active) return;
    cleanupMissionEntities();
    active = null;
    const b = B();
    if (b) b.showToast('Missão cancelada.', 2000);
    updateMissionHud();
    renderPhoneUI();
  }

  function tick(dt) {
    const b = B();
    if (!b || b.getGameMode() !== 'playing') return;
    ensureSaveDefaults();

    // Mensagem de boas-vindas do Capítulo 1 após 4s no mundo livre
    if (!welcomeShown) {
      playSeconds += dt;
      if (playSeconds > 4.0) {
        welcomeShown = true;
        updateLevelHud();
        if (b.save.storyIdx === 0 && !active) {
          queueDialogues([
            { who: 'marta', text: 'Bem-vindo a Liberty BR! Abra o Smartphone 📱 → Missões para iniciar o Capítulo 1 da História!' }
          ]);
        }
      }
    }

    // Fila de legendas/diálogos estilo GTA
    if (dialogueTimer > 0) {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0) advanceDialogue();
    }

    if (!active) return;

    active.elapsed += dt;

    // Cronômetro regressivo
    if (active.timer !== null) {
      active.timer -= dt;
      if (active.timer <= 0) {
        failActiveMission('⏱ Tempo esgotado!');
        return;
      }
    }

    // Animação do checkpoint 3D
    if (markerGroup && markerGroup.visible) {
      const t = performance.now() * 0.004;
      if (markerArrow) {
        markerArrow.position.y = 6.6 + Math.sin(t) * 0.55;
        markerArrow.rotation.y += dt * 2.4;
      }
      if (markerRingMat) markerRingMat.opacity = 0.34 + Math.sin(t * 1.4) * 0.14;
    }

    const step = active.def.steps[active.stepIdx];
    if (!step) return;
    const p = b.player.inCar ? b.player.inCar.pos : b.player.pos;

    if (step.type === 'enter_car') {
      if (b.player.inCar) {
        active.startCarHp = b.player.inCar.hp;
        playMissionSound('cp');
        active.stepIdx++;
        setupCurrentStep();
      }
    } else if (step.type === 'reach') {
      const d = Math.hypot(p.x - step.x, p.z - step.z);
      if (d <= (step.radius || 10)) {
        if (step.requireCar && !b.player.inCar) {
          // Aguarda estar no carro
        } else {
          if (step.triggerWanted) {
            b.player.wanted = Math.max(b.player.wanted, step.triggerWanted);
            b.player.wantedTimer = 38;
          }
          if (step.clearWantedOnDone) {
            b.player.wanted = 0;
            b.player.wantedTimer = 0;
          }
          if (step.onDoneDialogue) queueDialogues(step.onDoneDialogue);
          playMissionSound('cp');
          b.vibrate(45);
          active.stepIdx++;
          setupCurrentStep();
        }
      }
    } else if (step.type === 'defeat_enemy') {
      const en = active.enemyNpc;
      if (en && active.enemyHalo) {
        active.enemyHalo.position.set(en.pos.x, en.pos.y + 2.35 + Math.sin(performance.now() * 0.006) * 0.2, en.pos.z);
        active.enemyHalo.rotation.y += dt * 3.0;
        active.markerPos = { x: en.pos.x, z: en.pos.z, color: 0xff1744 };
      }
      if (!en || en.dead || en.hp <= 0) {
        if (active.enemyHalo && b.scene) {
          b.scene.remove(active.enemyHalo);
          active.enemyHalo = null;
        }
        if (step.onDoneDialogue) queueDialogues(step.onDoneDialogue);
        playMissionSound('cp');
        b.vibrate(65);
        active.stepIdx++;
        setupCurrentStep();
      }
    }

    updateMissionHud();
  }

  function renderPhoneUI() {
    const b = B();
    if (!b || !b.save) return;
    ensureSaveDefaults();
    updateLevelHud();

    const lvTxt = $('phMissionLv');
    const xpFill = $('phMissionXpFill');
    const xpTxt = $('phMissionXpText');
    const need = xpNeededFor(b.save.level);
    if (lvTxt) lvTxt.textContent = `Nível RP ${b.save.level}`;
    if (xpTxt) xpTxt.textContent = `${b.save.xp} / ${need} XP • Cap. 1 (${Math.min(STORY_MISSIONS.length, b.save.storyIdx)}/${STORY_MISSIONS.length})`;
    if (xpFill) xpFill.style.width = Math.min(100, Math.round((b.save.xp / need) * 100)) + '%';

    const storyBox = $('phStoryCard');
    if (storyBox) {
      const nextIdx = Math.min(STORY_MISSIONS.length - 1, b.save.storyIdx);
      const finishedAll = b.save.storyIdx >= STORY_MISSIONS.length;
      const m = STORY_MISSIONS[nextIdx];
      const c = CONTACTS[m.contact];
      if (active) {
        storyBox.innerHTML = `
          <div class="m-card-head">
            <span class="m-badge active">EM ANDAMENTO</span>
            <span class="m-reward">⚡ Ativa</span>
          </div>
          <div class="m-card-title">${active.def.title}</div>
          <div class="m-card-desc">${active.def.steps[active.stepIdx] ? active.def.steps[active.stepIdx].label : ''}</div>
          <button class="m-btn danger" id="phBtnCancelActive">✕ CANCELAR MISSÃO ATUAL</button>
        `;
        const cb = $('phBtnCancelActive');
        if (cb) cb.onclick = () => cancelMission();
      } else if (finishedAll) {
        storyBox.innerHTML = `
          <div class="m-card-head">
            <span class="m-badge done">👑 CAPÍTULO 1 COMPLETO</span>
            <span class="m-reward">6/6</span>
          </div>
          <div class="m-card-title">Rei do Asfalto de Liberty BR</div>
          <div class="m-card-desc">Você concluiu toda a história do Capítulo 1! Rejogue o Circuito Final ou faça missões secundárias abaixo.</div>
          <button class="m-btn gold" id="phBtnReplayFinal">▶ REJOGAR FINAL (CAP. 1)</button>
        `;
        const rb = $('phBtnReplayFinal');
        if (rb) rb.onclick = () => startStoryMission(STORY_MISSIONS.length - 1);
      } else {
        storyBox.innerHTML = `
          <div class="m-card-head">
            <span class="m-badge story">${c.icon} ${c.name}</span>
            <span class="m-reward">R$ ${m.rewardCash.toLocaleString('pt-BR')} • +${m.rewardXp} XP</span>
          </div>
          <div class="m-card-title">${m.title}</div>
          <div class="m-card-desc">${m.desc}</div>
          <button class="m-btn gold" id="phBtnStartStory">▶ INICIAR MISSÃO ${m.num}/${STORY_MISSIONS.length}</button>
        `;
        const sb = $('phBtnStartStory');
        if (sb) sb.onclick = () => startStoryMission(nextIdx);
      }
    }

    const raceSub = $('phRaceRecordSub');
    if (raceSub) {
      raceSub.textContent = b.save.bestRaceTime
        ? `5 checkpoints • Recorde: ${b.save.bestRaceTime}s • +R$ 1.200`
        : '5 checkpoints contra o relógio • +R$ 1.200';
    }
  }

  function bindStaticButtons() {
    const btnUber = $('phSideUber');
    if (btnUber) btnUber.onclick = () => startSideMission('uber');
    const btnRace = $('phSideRace');
    if (btnRace) btnRace.onclick = () => startSideMission('race');
    const btnPol = $('phSidePolice');
    if (btnPol) btnPol.onclick = () => startSideMission('police');
    const btnCancel = $('btnCancelStoryMission');
    if (btnCancel) btnCancel.onclick = () => cancelMission();
    const dlgBar = $('gtaDialogueBar');
    if (dlgBar) dlgBar.onclick = () => advanceDialogue();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindStaticButtons);
  } else {
    bindStaticButtons();
  }

  window.BrasilMissions = {
    tick,
    renderPhoneUI,
    startStoryMission,
    startSideMission,
    cancelMission,
    getActiveMarker: () => (active ? active.markerPos : null),
    isActive: () => Boolean(active)
  };
})();
