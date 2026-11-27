(() => {
  'use strict';

  const STORAGE_KEY = 'brasilrp_police_stats_v1';
  const RANKS = [
    { min: 0, name: 'Soldado PM' },
    { min: 3, name: 'Cabo PM' },
    { min: 7, name: 'Sargento PM' },
    { min: 13, name: 'Subtenente PM' },
    { min: 20, name: 'Tenente PM' },
    { min: 30, name: 'Capitão PM' }
  ];

  let stats = { arrests: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stats = Object.assign(stats, JSON.parse(raw));
  } catch (_) {}

  function saveStats() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) {}
  }

  function getRank() {
    let r = RANKS[0].name;
    for (const rk of RANKS) {
      if (stats.arrests >= rk.min) r = rk.name;
    }
    return r;
  }

  const el = (id) => document.getElementById(id);
  const ui = {
    badge: el('policeStatusBadge'),
    bar: el('policeActionBar'),
    btnCuff: el('btnPolCuff'),
    btnSearch: el('btnPolSearch'),
    btnPutCar: el('btnPolPutCar'),
    btnInterrogate: el('btnPolInterrogate'),
    btnArrest: el('btnPolArrest'),
    modal: el('policeModal'),
    modalTitle: el('polModalTitle'),
    modalSub: el('polModalSub'),
    modalBody: el('polModalBody'),
    modalBtns: el('polModalBtns'),
    btnCloseModal: el('btnClosePolModal'),
    phDutyBtn: el('phPoliceDuty'),
    phDutyLbl: el('phPoliceDutyLbl')
  };

  const state = {
    active: false,
    preDutyChar: 'cool_man',
    activeSuspect: null,
    nextCallTimer: 0
  };

  const CRIMES = [
    { title: 'Suspeito armado na via', items: ['🔫 Pistola 9mm sem porte', '💵 R$ 480 em espécie', '🪪 RG adulterado'], reward: 650, flees: true },
    { title: 'Tráfico / pacote suspeito', items: ['📦 Pacote ilícito lacrado', '📱 Celular descartável', '💵 R$ 320'], reward: 550, flees: false },
    { title: 'Furto / roubo em andamento', items: ['🔑 Chave micha automotiva', '🔫 Revólver .38', '💳 Cartões clonados'], reward: 780, flees: true },
    { title: 'Indivíduo com mandado em aberto', items: ['📄 Mandado de prisão ativo', '💵 R$ 250'], reward: 500, flees: false }
  ];

  function updateBadge() {
    if (!ui.badge) return;
    if (!state.active) {
      ui.badge.classList.add('hidden');
      if (ui.phDutyLbl) ui.phDutyLbl.textContent = 'PM-BR';
      return;
    }
    ui.badge.classList.remove('hidden');
    ui.badge.textContent = `👮 PM-BR • ${getRank().toUpperCase()} • ${stats.arrests} PRISÕES`;
    if (ui.phDutyLbl) ui.phDutyLbl.textContent = 'Sair PM';
  }

  function speakPolice(text) {
    try {
      if (window.BrasilNative && typeof window.BrasilNative.speakNpc === 'function') {
        window.BrasilNative.speakNpc(text, 0.92, 1.08);
      }
    } catch (_) {}
  }

  function spawnSuspect() {
    const b = window.BrasilRPBridge;
    if (!b || !b.player || !b.spawnNPC) return;
    if (state.activeSuspect && !state.activeSuspect.dead) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 42 + Math.random() * 48;
    const sx = Math.max(-880, Math.min(740, b.player.pos.x + Math.sin(angle) * dist));
    const sz = Math.max(-1380, Math.min(150, b.player.pos.z + Math.cos(angle) * dist));
    const sy = b.getSafeGroundForSpawn ? b.getSafeGroundForSpawn(sx, sz, b.player.pos.y) : b.player.pos.y;

    const npc = b.spawnNPC(sx, sy, sz);
    if (!npc) return;

    const crime = CRIMES[Math.floor(Math.random() * CRIMES.length)];
    npc.isPoliceSuspect = true;
    npc.suspect = {
      name: 'Suspeito #' + Math.floor(100 + Math.random() * 899),
      crime: crime.title,
      items: crime.items.slice(),
      reward: crime.reward,
      flees: crime.flees,
      cuffed: false,
      searched: false,
      interrogated: false,
      confessed: false,
      inCar: null,
      seat: null
    };
    state.activeSuspect = npc;

    if (b.setGpsDestination) b.setGpsDestination(sx, sz, `🚨 ${crime.title}`);
    if (b.AudioFX && b.AudioFX.beep) b.AudioFX.beep(880, 0.14, 'square', 0.08);
    if (b.showToast) b.showToast(`🚨 COPOM: ${crime.title} (${Math.round(dist)}m)`, 4200);
  }

  function attachPoliceGear(enable) {
    const b = window.BrasilRPBridge;
    if (!b || !b.player || !b.player.bones) return;
    const p = b.player;
    const chestBone = (p.customRig && p.customRig.chest && p.bones[p.customRig.chest]) || p.bones['mixamorig:Spine2_81'] || null;
    const headBone = (p.customRig && p.customRig.head && p.bones[p.customRig.head]) || p.bones['mixamorig:Head_1'] || null;
    if (p._pmVest && p._pmVest.parent) p._pmVest.parent.remove(p._pmVest);
    if (p._pmCap && p._pmCap.parent) p._pmCap.parent.remove(p._pmCap);
    p._pmVest = null;
    p._pmCap = null;
    if (!enable) return;

    if (chestBone) {
      const vest = new THREE.Group();
      const matVest = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.25 });
      const matBadge = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.8 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.24), matVest);
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.02), matBadge);
      badge.position.set(0.08, 0.05, 0.13);
      vest.add(box, badge);
      chestBone.add(vest);
      p._pmVest = vest;
    }
    if (headBone) {
      const cap = new THREE.Group();
      const matCap = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.08, 12), matCap);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.10), matCap);
      visor.position.set(0, -0.02, 0.11);
      cap.add(crown, visor);
      cap.position.set(0, 0.16, 0.01);
      headBone.add(cap);
      p._pmCap = cap;
    }
  }

  function toggleDuty() {
    const b = window.BrasilRPBridge;
    if (!b) return;
    state.active = !state.active;
    if (state.active) {
      state.preDutyChar = (b.save && b.save.playerChar) || 'cool_man';
      attachPoliceGear(true);
      if (b.AudioFX && b.AudioFX.coin) b.AudioFX.coin();
      if (b.showToast) b.showToast('👮 Você entrou em SERVIÇO PM-BR! Farda equipada — aguarde chamado.', 3500);
      speakPolice('Policial em serviço. QAP na rede.');

      // Garante viatura PM-BR próxima se não houver nenhuma perto
      const hasPmCar = (b.vehicles || []).some((v) => v.type === 'car_pm' && v.pos.distanceTo(b.player.pos) < 35);
      if (!hasPmCar && b.spawnVehicle) {
        const vx = b.player.pos.x + 3.2;
        const vz = b.player.pos.z + 2.5;
        const vy = b.getSafeGroundForSpawn ? b.getSafeGroundForSpawn(vx, vz, b.player.pos.y) : b.player.pos.y;
        b.spawnVehicle('car_pm', vx, vy + 0.05, vz, 0);
      }
      state.nextCallTimer = 2.5;
    } else {
      attachPoliceGear(false);
      if (state.activeSuspect && b.npcs) {
        if (state.activeSuspect.mesh && state.activeSuspect.mesh.parent) {
          state.activeSuspect.mesh.parent.remove(state.activeSuspect.mesh);
        }
        const idx = b.npcs.indexOf(state.activeSuspect);
        if (idx >= 0) b.npcs.splice(idx, 1);
      }
      state.activeSuspect = null;
      if (b.clearGpsDestination) b.clearGpsDestination();
      if (b.selectPlayableCharacter) b.selectPlayableCharacter(state.preDutyChar || 'cool_man', true);
      if (b.showToast) b.showToast('👮 Você saiu de serviço e voltou ao seu personagem civil.', 2600);
    }
    updateBadge();
  }

  function getTargetSuspect() {
    const b = window.BrasilRPBridge;
    if (!b || !b.player) return null;
    if (state.activeSuspect && !state.activeSuspect.dead) {
      const d = state.activeSuspect.pos.distanceTo(b.player.pos);
      if (d < 6.5 || state.activeSuspect.suspect.cuffed) return state.activeSuspect;
    }
    // Permite abordar qualquer NPC proximo em serviço
    let best = null;
    let bestD = 4.6;
    for (const n of (b.npcs || [])) {
      if (!n || n.dead) continue;
      const d = n.pos.distanceTo(b.player.pos);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best && !best.suspect) {
      best.suspect = {
        name: 'Cidadão Abordado',
        crime: 'Abordagem de rotina',
        items: Math.random() < 0.45 ? ['🪪 RG válido', '📱 Celular'] : ['🪪 RG válido', '📦 Pacote suspeito'],
        reward: 350,
        flees: false,
        cuffed: false,
        searched: false,
        interrogated: false,
        confessed: false,
        inCar: null,
        seat: null
      };
    }
    return best;
  }

  function cuffTarget() {
    const b = window.BrasilRPBridge;
    const t = getTargetSuspect();
    if (!t || !t.suspect) return;
    t.suspect.cuffed = !t.suspect.cuffed;
    t.suspect.flees = false;
    if (b.vibrate) b.vibrate(45);
    if (b.AudioFX && b.AudioFX.beep) b.AudioFX.beep(520, 0.12, 'triangle', 0.1);
    if (t.suspect.cuffed) {
      speakPolice('Parado! Polícia! Mãos na cabeça, você está algemado!');
      if (b.showToast) b.showToast(`🚨 ${t.suspect.name} imobilizado e algemado!`);
    } else {
      t.suspect.inCar = null;
      t.suspect.seat = null;
      if (b.showToast) b.showToast(`🔓 Algemas removidas de ${t.suspect.name}.`);
    }
  }

  function searchTarget() {
    const b = window.BrasilRPBridge;
    const t = getTargetSuspect();
    if (!t || !t.suspect || !ui.modal) return;
    t.suspect.searched = true;
    ui.modalTitle.textContent = '🔍 REVISTA POLICIAL';
    ui.modalSub.textContent = `${t.suspect.name} • ${t.suspect.crime}`;
    ui.modalBody.innerHTML = '<b>Itens encontrados na revista:</b><br><br>' +
      t.suspect.items.map((it) => `• ${it}`).join('<br>');
    ui.modalBtns.innerHTML = '';
    ui.modal.classList.remove('hidden');
    if (b.AudioFX && b.AudioFX.beep) b.AudioFX.beep(660, 0.08, 'sine', 0.08);
  }

  function putInPatrolCar() {
    const b = window.BrasilRPBridge;
    const t = getTargetSuspect();
    if (!t || !t.suspect) return;
    if (!t.suspect.cuffed) {
      if (b.showToast) b.showToast('🚨 Algeme o suspeito primeiro antes de colocá-lo na viatura!');
      return;
    }
    if (t.suspect.inCar) {
      const c = t.suspect.inCar;
      const s = t.suspect.seat;
      const out = b.localCarToWorld(c, s.standX, s.standZ);
      t.suspect.inCar = null;
      t.suspect.seat = null;
      t.pos.set(out.x, c.pos.y + 0.05, out.z);
      if (t.mesh) t.mesh.scale.setScalar(1.0);
      if (b.showToast) b.showToast('🚓 Suspeito retirado da viatura.');
      return;
    }
    let patrol = b.player.inCar || null;
    if (!patrol) {
      let bestD = 16;
      for (const v of (b.vehicles || [])) {
        const d = v.pos.distanceTo(b.player.pos);
        if (d < bestD) { bestD = d; patrol = v; }
      }
    }
    if (!patrol || !b.getVehicleSeats) {
      if (b.showToast) b.showToast('🚓 Aproxime uma viatura (até 16m) para embarcar o preso!');
      return;
    }
    const seats = b.getVehicleSeats(patrol);
    const rear = seats.find((s) => s.id.startsWith('rear')) || seats.find((s) => s.id !== 'driver') || seats[0];
    t.suspect.inCar = patrol;
    t.suspect.seat = rear;
    if (b.AudioFX && b.AudioFX.doorSlam) b.AudioFX.doorSlam();
    if (b.policeStationPos && b.setGpsDestination) {
      b.setGpsDestination(b.policeStationPos.x, b.policeStationPos.z, '🚔 Delegacia PM-BR (Prender)');
    }
    if (b.showToast) b.showToast(`🚔 ${t.suspect.name} embarcado no ${rear.label}! Leve até a Delegacia.`, 3600);
  }

  function interrogateTarget() {
    const b = window.BrasilRPBridge;
    const t = getTargetSuspect();
    if (!t || !t.suspect || !ui.modal) return;
    t.suspect.interrogated = true;
    ui.modalTitle.textContent = '🗣️ INTERROGATÓRIO PM-BR';
    ui.modalSub.textContent = `${t.suspect.name} • ${t.suspect.crime}`;
    ui.modalBody.innerHTML = 'Escolha uma pergunta tática para extrair informações:';
    ui.modalBtns.innerHTML = '';

    const qs = [
      { q: '🗣️ "De quem você pegou esse material?"', a: '"Eu só estava fazendo a entrega pra um contato da zona sul, senhor!" (+R$ 150 bônus)' },
      { q: '🗣️ "Vai colaborar e confessar o crime?"', a: '"Sim senhor, eu confesso! Estava errado, me leva logo!" (+R$ 150 bônus)' },
      { q: '🗣️ "Tem mais algum comparsa por perto?"', a: '"Não, estou sozinho! Não quero mais confusão!" (+R$ 100 bônus)' }
    ];
    qs.forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.textContent = item.q;
      btn.onclick = () => {
        t.suspect.confessed = true;
        ui.modalBody.innerHTML = `<div style="padding:8px;border-radius:8px;background:rgba(56,189,248,0.14);border:1px solid rgba(56,189,248,0.4)"><b>Suspeito respondeu:</b><br>${item.a}</div>`;
        if (b.AudioFX && b.AudioFX.beep) b.AudioFX.beep(740, 0.08, 'sine', 0.08);
      };
      ui.modalBtns.appendChild(btn);
    });
    ui.modal.classList.remove('hidden');
  }

  function arrestTarget() {
    const b = window.BrasilRPBridge;
    const t = getTargetSuspect();
    if (!t || !t.suspect) return;
    if (!t.suspect.cuffed) {
      if (b.showToast) b.showToast('🚨 Algeme o suspeito antes de prender!');
      return;
    }
    const bonus = t.suspect.confessed ? 150 : 0;
    const total = (t.suspect.reward || 450) + bonus;
    if (b.save && b.refreshMoneyUI) {
      b.save.cash = (b.save.cash || 0) + total;
      b.persistSave();
      b.refreshMoneyUI();
    }
    stats.arrests += 1;
    saveStats();
    updateBadge();

    if (t.mesh && t.mesh.parent) t.mesh.parent.remove(t.mesh);
    if (b.npcs) {
      const idx = b.npcs.indexOf(t);
      if (idx >= 0) b.npcs.splice(idx, 1);
    }
    if (state.activeSuspect === t) state.activeSuspect = null;
    if (b.clearGpsDestination) b.clearGpsDestination();
    if (b.AudioFX && b.AudioFX.coin) b.AudioFX.coin();
    if (b.showToast) b.showToast(`🔒 Preso conduzido! +R$ ${total} | Patente: ${getRank()}`, 3800);
    state.nextCallTimer = 14.0;
  }

  if (ui.btnCuff) ui.btnCuff.onclick = cuffTarget;
  if (ui.btnSearch) ui.btnSearch.onclick = searchTarget;
  if (ui.btnPutCar) ui.btnPutCar.onclick = putInPatrolCar;
  if (ui.btnInterrogate) ui.btnInterrogate.onclick = interrogateTarget;
  if (ui.btnArrest) ui.btnArrest.onclick = arrestTarget;
  if (ui.btnCloseModal) ui.btnCloseModal.onclick = () => ui.modal && ui.modal.classList.add('hidden');
  if (ui.phDutyBtn) {
    ui.phDutyBtn.onclick = () => {
      const pm = el('phoneModal');
      if (pm) pm.classList.add('hidden');
      toggleDuty();
    };
  }

  function tick(dt) {
    if (!state.active) {
      if (ui.bar) ui.bar.classList.add('hidden');
      return;
    }
    const b = window.BrasilRPBridge;
    if (!b || !b.player) return;

    if (!state.activeSuspect || state.activeSuspect.dead) {
      state.nextCallTimer -= dt;
      if (state.nextCallTimer <= 0) {
        state.nextCallTimer = 25;
        spawnSuspect();
      }
    }

    // Atualiza comportamento de todos os suspeitos abordados / algemados / na viatura
    for (const n of (b.npcs || [])) {
      if (!n || !n.suspect || n.dead) continue;
      const s = n.suspect;
      if (s.inCar && s.seat) {
        const c = s.inCar;
        c.mesh.updateMatrixWorld(true);
        const bodyRef = (c.parts && c.parts.chassis) ? c.parts.chassis : c.mesh;
        const p = new THREE.Vector3(s.seat.x, s.seat.y, s.seat.z).applyMatrix4(bodyRef.matrixWorld);
        const q = new THREE.Quaternion();
        bodyRef.getWorldQuaternion(q);
        n.pos.copy(c.pos);
        if (n.mesh) {
          n.mesh.scale.setScalar(0.76);
          n.mesh.position.copy(p);
          n.mesh.quaternion.copy(q);
        }
        if (b.applyDriverPoseBlend) b.applyDriverPoseBlend(1.0, 0, 0, 0, s.seat.x >= 0 ? 1 : -1, 0, n);
      } else if (s.cuffed) {
        // Escolta: suspeito algemado segue o policial a pé
        const dx = b.player.pos.x - n.pos.x;
        const dz = b.player.pos.z - n.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 2.2 && !b.player.inCar) {
          const spd = Math.min(4.2, dist * 1.4);
          n.pos.x += (dx / dist) * spd * dt;
          n.pos.z += (dz / dist) * spd * dt;
          if (b.getWalkableGround) {
            const gy = b.getWalkableGround(n.pos.x, n.pos.z, n.pos.y);
            if (gy !== null) n.pos.y = gy;
          }
          if (n.mesh) {
            n.mesh.position.copy(n.pos);
            n.mesh.rotation.y = Math.atan2(dx, dz);
          }
          if (b.animateJobNpcBones) b.animateJobNpcBones(n, dt * 1.2, true);
        }
      } else if (s.flees) {
        const dx = n.pos.x - b.player.pos.x;
        const dz = n.pos.z - b.player.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 22 && dist > 0.5) {
          n.pos.x += (dx / dist) * 3.8 * dt;
          n.pos.z += (dz / dist) * 3.8 * dt;
          if (b.getWalkableGround) {
            const gy = b.getWalkableGround(n.pos.x, n.pos.z, n.pos.y);
            if (gy !== null) n.pos.y = gy;
          }
          if (n.mesh) {
            n.mesh.position.copy(n.pos);
            n.mesh.rotation.y = Math.atan2(dx, dz);
          }
          if (b.animateJobNpcBones) b.animateJobNpcBones(n, dt * 1.5, true);
        }
      }
    }

    const target = getTargetSuspect();
    if (ui.bar) {
      ui.bar.classList.toggle('hidden', !target);
      if (target && target.suspect && ui.btnCuff) {
        ui.btnCuff.textContent = target.suspect.cuffed ? '🔓 Soltar' : '🚨 Algemar';
      }
    }
  }

  window.BrasilPolice = { toggleDuty, tick, isOnDuty: () => state.active };
})();
