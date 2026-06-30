// Soundboard partagé : grille de sons (depuis Supabase), clic = envoie à tout le monde.
(function () {
  const overlay = document.getElementById('soundOverlay');
  const openBtn = document.getElementById('openSound');
  const closeBtn = document.getElementById('soundClose');
  const importBtn = document.getElementById('soundImport');
  const fileInput = document.getElementById('soundFile');
  const status = document.getElementById('soundStatus');
  const grid = document.getElementById('soundGrid');
  const volInput = document.getElementById('soundVol');
  const volVal = document.getElementById('soundVolVal');

  const preview = new Audio();

  // Volume du soundboard (mémorisé), appliqué à l'aperçu ET envoyé avec le son.
  volInput.value = localStorage.getItem('soundVol') || '100';
  volVal.textContent = volInput.value;
  volInput.addEventListener('input', () => {
    volVal.textContent = volInput.value;
    localStorage.setItem('soundVol', volInput.value);
  });
  function getVol() { return Number(volInput.value) / 100; }

  // --- Raccourcis clavier : assignation d'une combinaison à un son ---
  let capturing = null;
  function getKeys() { try { return JSON.parse(localStorage.getItem('soundKeys') || '{}'); } catch (_) { return {}; } }
  function setKeys(k) { localStorage.setItem('soundKeys', JSON.stringify(k)); if (window.refreshSoundShortcuts) window.refreshSoundShortcuts(); }
  function comboFor(s) { const k = getKeys(); return Object.keys(k).find((c) => k[c].data === s.data) || null; }
  // On se base sur la touche PHYSIQUE (e.code) et non e.key : ça marche pareil
  // en AZERTY/QWERTY (la touche « 1 » donne bien « 1 », pas « & ») et ça produit
  // toujours un accélérateur valide pour Electron (1, A, num1, Up, F5…).
  function keyFromCode(e) {
    const c = e.code || '';
    let m;
    if ((m = c.match(/^Key([A-Z])$/))) return m[1];
    if ((m = c.match(/^Digit(\d)$/))) return m[1];
    if ((m = c.match(/^Numpad(\d)$/))) return 'num' + m[1];
    if ((m = c.match(/^F(\d{1,2})$/))) return 'F' + m[1];
    const map = {
      ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
      Space: 'Space', Enter: 'Return', NumpadEnter: 'Return', Tab: 'Tab',
      Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
      Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
      NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult',
      NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
      Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
      Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`',
    };
    if (map[c]) return map[c];
    // dernier recours : e.key si c'est une lettre/chiffre exploitable
    if (e.key && e.key.length === 1) return e.key.toUpperCase();
    return null;
  }
  function buildAccel(e) {
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
    const key = keyFromCode(e);
    if (!key) return null;
    const parts = [];
    if (e.ctrlKey) parts.push('CommandOrControl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    parts.push(key);
    return parts.join('+'); // n'importe quelle touche, seule ou en combo
  }
  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (!capturing) { if (e.key === 'Escape') preview.pause(); return; }
    e.preventDefault();
    if (e.key === 'Escape') { capturing = null; status.textContent = 'Assignation annulée.'; renderGrid(); return; }
    const accel = buildAccel(e);
    if (!accel) { status.textContent = 'Touche non reconnue, réessaie…'; return; }
    const k = getKeys();
    for (const c of Object.keys(k)) if (k[c].data === capturing.data) delete k[c]; // 1 son = 1 raccourci
    k[accel] = { name: capturing.name, data: capturing.data };
    setKeys(k);
    status.textContent = '⌨️ ' + accel + ' → ' + capturing.name + (accel.includes('+') ? '' : '  (touche captée partout)');
    capturing = null;
    renderGrid();
  }, true);

  window.openSoundboard = function () {
    overlay.hidden = false;
    load();
  };
  function close() {
    preview.pause();
    overlay.hidden = true;
  }
  openBtn.addEventListener('click', () => window.openSoundboard());
  closeBtn.addEventListener('click', close);

  let currentSounds = [];
  async function load() {
    grid.innerHTML = '';
    if (!window.SB || !window.SB.configured()) {
      status.textContent = '⚠️ Base de données pas configurée.';
      return;
    }
    status.textContent = 'Chargement…';
    try {
      currentSounds = await window.SB.getSounds();
    } catch (e) {
      status.textContent = 'Erreur de chargement.';
      return;
    }
    status.textContent = currentSounds.length
      ? currentSounds.length + ' sons — clique pour envoyer 🔊  (⌨️ = raccourci)'
      : 'Aucun son. Importes-en un !';
    renderGrid();
  }
  // palette de couleurs pour égayer les pads (cycle)
  const PADS = ['var(--lime)', 'var(--yellow)', 'var(--pink)', 'var(--blue)', 'var(--coral)', '#9DE7D7'];

  function renderGrid() {
    grid.innerHTML = '';
    currentSounds.forEach((s, i) => grid.appendChild(makeTile(s, i)));
  }

  function makeTile(s, idx) {
    const tile = document.createElement('div');
    tile.className = 'sound-tile' + (capturing && capturing.data === s.data ? ' capturing' : '');
    tile.style.setProperty('--accent', PADS[idx % PADS.length]);

    const play = document.createElement('button');
    play.className = 'sound-play';
    play.textContent = '▶';
    play.title = 'Écouter (sans envoyer)';
    play.addEventListener('click', (e) => {
      e.stopPropagation();
      preview.pause();
      preview.src = s.data;
      preview.volume = getVol();
      preview.play().catch(() => {});
    });
    tile.appendChild(play);

    // coin haut-gauche : keycap du raccourci (+ bouton ✕ pour retirer si assigné)
    const kbdWrap = document.createElement('div');
    kbdWrap.className = 'kbd-wrap';
    const combo = comboFor(s);
    const kbd = document.createElement('button');
    kbd.className = 'sound-kbd' + (combo ? '' : ' empty');
    kbd.textContent = combo || '⌨';
    kbd.title = combo ? 'Raccourci : ' + combo + ' (clic = changer)' : 'Assigner un raccourci clavier';
    kbd.addEventListener('click', (e) => {
      e.stopPropagation();
      capturing = s;
      status.textContent = '⌨️ Appuie sur la touche de ton choix pour « ' + s.name + ' »  (Échap = annuler)';
      renderGrid();
    });
    kbdWrap.appendChild(kbd);
    if (combo) {
      const clr = document.createElement('button');
      clr.className = 'sound-clear';
      clr.textContent = '✕';
      clr.title = 'Retirer le raccourci';
      clr.addEventListener('click', (e) => {
        e.stopPropagation();
        const k = getKeys();
        for (const c of Object.keys(k)) if (k[c].data === s.data) delete k[c];
        setKeys(k);
        renderGrid();
      });
      kbdWrap.appendChild(clr);
    }
    tile.appendChild(kbdWrap);

    const name = document.createElement('div');
    name.className = 'sound-name';
    name.textContent = s.name;
    tile.appendChild(name);

    // Clic = on envoie à tout le monde. On NE ferme PAS (pour pouvoir spammer).
    tile.addEventListener('click', () => {
      window.sendSound(s, getVol());
      tile.classList.add('hit');
      setTimeout(() => tile.classList.remove('hit'), 180);
    });
    return tile;
  }

  // --- Enregistrement micro (permanent ou éphémère) ---
  const recBtn = document.getElementById('soundRec');
  const recPanel = document.getElementById('recPanel');
  const recStartBtn = document.getElementById('recStart');
  const recStopBtn = document.getElementById('recStop');
  const recCancelBtn = document.getElementById('recCancel');
  const recTime = document.getElementById('recTime');
  const recAudio = document.getElementById('recAudio');
  const recActions = document.getElementById('recActions');
  const recName = document.getElementById('recName');
  const recSavePerm = document.getElementById('recSavePerm');
  const recSendOnce = document.getElementById('recSendOnce');
  const recRetake = document.getElementById('recRetake');
  const recHint = document.getElementById('recHint');

  let mediaRec = null, recChunks = [], recStream = null, recData = null, recTimer = null, recStart0 = 0;

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function recReset() {
    if (recTimer) { clearInterval(recTimer); recTimer = null; }
    recData = null; recChunks = [];
    recTime.textContent = '0:00';
    recPanel.classList.remove('recording');
    recStartBtn.style.display = 'inline-flex';
    recStopBtn.style.display = 'none';
    recAudio.style.display = 'none'; recAudio.removeAttribute('src');
    recActions.style.display = 'none';
    recHint.style.display = 'block';
  }
  function recStopStream() { if (recStream) { recStream.getTracks().forEach((t) => t.stop()); recStream = null; } }

  recBtn.addEventListener('click', () => {
    recPanel.hidden = !recPanel.hidden;
    if (!recPanel.hidden) recReset();
  });
  recCancelBtn.addEventListener('click', () => {
    if (mediaRec && mediaRec.state !== 'inactive') { try { mediaRec.stop(); } catch (_) {} }
    recStopStream(); recReset(); recPanel.hidden = true;
  });

  recStartBtn.addEventListener('click', async () => {
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      status.textContent = '🎙️ Micro inaccessible (occupé ou refusé par Windows).';
      return;
    }
    recChunks = [];
    mediaRec = new MediaRecorder(recStream);
    mediaRec.ondataavailable = (ev) => { if (ev.data && ev.data.size) recChunks.push(ev.data); };
    mediaRec.onstop = () => {
      recStopStream();
      const blob = new Blob(recChunks, { type: mediaRec.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        recData = reader.result;
        recAudio.src = recData; recAudio.style.display = 'block';
        recActions.style.display = 'flex';
        recHint.style.display = 'none';
      };
      reader.readAsDataURL(blob);
    };
    mediaRec.start();
    recPanel.classList.add('recording');
    recStartBtn.style.display = 'none';
    recStopBtn.style.display = 'inline-flex';
    recAudio.style.display = 'none'; recActions.style.display = 'none'; recHint.style.display = 'block';
    recStart0 = Date.now();
    recTimer = setInterval(() => {
      const el = Date.now() - recStart0;
      recTime.textContent = fmtTime(el);
      if (el > 30000) recStopBtn.click(); // garde-fou : 30 s max
    }, 200);
  });

  recStopBtn.addEventListener('click', () => {
    if (mediaRec && mediaRec.state !== 'inactive') { try { mediaRec.stop(); } catch (_) {} }
    if (recTimer) { clearInterval(recTimer); recTimer = null; }
    recPanel.classList.remove('recording');
    recStartBtn.style.display = 'none';
    recStopBtn.style.display = 'none';
  });

  recRetake.addEventListener('click', () => recReset());

  // Permanent : on ajoute au soundboard partagé (Supabase) → visible par tout le monde.
  recSavePerm.addEventListener('click', async () => {
    if (!recData) return;
    const name = (recName.value || '').trim().slice(0, 40) || 'Ma voix';
    recHint.textContent = 'Ajout…'; recHint.style.display = 'block';
    try {
      await window.SB.addSound(name, localStorage.getItem('name') || 'Anonyme', recData);
      recPanel.hidden = true; recReset(); recName.value = '';
      load();
    } catch (e) { recHint.textContent = 'Erreur lors de l\'ajout.'; }
  });

  // Éphémère : on l'envoie UNE fois à tout le monde, sans rien sauvegarder.
  recSendOnce.addEventListener('click', () => {
    if (!recData) return;
    const name = (recName.value || '').trim().slice(0, 40) || '🎙️ Voix';
    window.sendSound({ name, data: recData }, getVol());
    recPanel.hidden = true; recReset(); recName.value = '';
    status.textContent = '⚡ Son éphémère envoyé à tout le monde (non sauvegardé).';
  });

  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      status.textContent = 'Son trop lourd (max 10 Mo).';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      status.textContent = 'Ajout…';
      const name = f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'son';
      try {
        await window.SB.addSound(name, localStorage.getItem('name') || 'Anonyme', reader.result);
      } catch (e) { /* ignore */ }
      load();
    };
    reader.readAsDataURL(f);
  });
})();
