// Serveur relais en ligne (Render). Tes amis se connectent ici automatiquement.
// Pour tester en local à la place : 'ws://localhost:8080'
const DEFAULT_SERVER = 'wss://livechat-k7we.onrender.com';

// Version affichée dans la barre du haut (« v1.0.4 »)
try { const v = document.getElementById('appVer'); if (v && window.api.appVersion) v.textContent = 'v' + window.api.appVersion; } catch (_) {}

const els = {
  pseudoDisplay: document.getElementById('pseudoDisplay'),
  pseudoSetup: document.getElementById('pseudoSetup'),
  pseudoInput: document.getElementById('pseudoInput'),
  pseudoValidate: document.getElementById('pseudoValidate'),
  drop: document.getElementById('drop'),
  file: document.getElementById('file'),
  preview: document.getElementById('preview'),
  dur: document.getElementById('dur'),
  durVal: document.getElementById('durVal'),
  send: document.getElementById('send'),
  dot: document.getElementById('dot'),
  statusText: document.getElementById('statusText'),
  server: document.getElementById('server'),
  everyone: document.getElementById('everyone'),
  userList: document.getElementById('userList'),
  onlineCount: document.getElementById('onlineCount'),
  musicChip: document.getElementById('musicChip'),
  musicChipName: document.getElementById('musicChipName'),
  musicRemove: document.getElementById('musicRemove'),
  volumeRow: document.getElementById('volumeRow'),
  volume: document.getElementById('volume'),
  volVal: document.getElementById('volVal'),
  posGrid: document.getElementById('posGrid'),
  memeSize: document.getElementById('memeSize'),
  memeSizeVal: document.getElementById('memeSizeVal'),
  memeOpacity: document.getElementById('memeOpacity'),
  memeOpacityVal: document.getElementById('memeOpacityVal'),
  fxGrid: document.getElementById('fxGrid'),
};

let imageData = null;
let chosenAudio = null; // { src, name }
let chosenAudioVolume = 1; // 0..1, réglé par le curseur
let chosenPos = 'center-center'; // position du mème à l'écran
let chosenSize = 70; // taille du mème en % de l'écran
let chosenOpacity = 100; // opacité du mème en % (100 = opaque)
let chosenEffect = 'none'; // effet d'apparition
let chosenTexts = null; // couche texte (quand on légende un GIF)
let chosenDrawing = null; // couche dessin/pinceau (quand on dessine sur un GIF)
let incomingAudio = null; // musique en cours de lecture à la réception
let activeSounds = []; // sons du soundboard en cours de lecture

// Affiche/masque le bouton STOP selon qu'un son joue ou non.
function updateStopBtn() {
  const btn = document.getElementById('stopBtn');
  if (btn) btn.hidden = !(incomingAudio || activeSounds.length > 0);
}
// Coupe tout ce qui joue ICI.
function stopAllAudio() {
  if (incomingAudio) { try { incomingAudio.pause(); } catch (_) {} incomingAudio = null; }
  activeSounds.forEach((a) => { try { a.pause(); } catch (_) {} });
  activeSounds = [];
  updateStopBtn();
}
// Coupe ICI et chez TOUT LE MONDE.
function stopEverywhere() {
  stopAllAudio();
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop-sound' }));
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') stopEverywhere(); });
document.getElementById('stopBtn').addEventListener('click', stopEverywhere);

// Joue la musique reçue depuis la fenêtre principale (lecture audio plus fiable
// que dans la pop-up transparente), et l'arrête à la fin de la durée du mème.
function playIncomingAudio(src, duration, volume) {
  if (incomingAudio) {
    try { incomingAudio.pause(); } catch (_) {}
    incomingAudio = null;
  }
  if (!src) return;
  const audio = new Audio(src);
  audio.volume = typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1;
  audio.play().catch(() => {});
  incomingAudio = audio;
  updateStopBtn();
  const ms = Math.max(1, Number(duration) || 5) * 1000;
  setTimeout(() => {
    if (incomingAudio === audio) {
      try { audio.pause(); } catch (_) {}
      incomingAudio = null;
      updateStopBtn();
    }
  }, ms);
}
let ws = null;
let reconnectTimer = null;
let myId = null;
let users = []; // [{ id, name }]
const selectedTargets = new Set(); // ids cochés quand "tout le monde" est décoché

// --- Pseudo : demandé une seule fois au lancement, puis verrouillé ---
let myName = localStorage.getItem('name') || '';

function applyPseudo(name) {
  myName = name;
  localStorage.setItem('name', name);
  els.pseudoDisplay.textContent = name;
  els.pseudoSetup.hidden = true;
  sendHello(); // informe le serveur (et met à jour la liste des connectés)
}

if (myName) {
  els.pseudoDisplay.textContent = myName;
} else {
  // Première ouverture : on demande le pseudo (écran bloquant).
  els.pseudoSetup.hidden = false;
  setTimeout(() => els.pseudoInput.focus(), 50);
}

function validatePseudo() {
  const v = els.pseudoInput.value.trim();
  if (!v) { els.pseudoInput.focus(); return; }
  applyPseudo(v);
}
els.pseudoValidate.addEventListener('click', validatePseudo);
els.pseudoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') validatePseudo();
});

// --- Adresse serveur ---
els.server.value = localStorage.getItem('server') || DEFAULT_SERVER;
els.server.addEventListener('change', () => {
  localStorage.setItem('server', els.server.value || DEFAULT_SERVER);
  connect();
});

// Garde le serveur gratuit (Render) éveillé : un petit ping HTTP toutes les 10 min
// évite les démarrages à froid (~30-60 s) qui ajoutent du délai.
setInterval(() => {
  const httpUrl = (els.server.value || DEFAULT_SERVER).replace(/^wss?:/i, 'https:');
  window.api.httpJson(httpUrl).catch(() => {});
}, 10 * 60 * 1000);

// --- Réglages : ce qu'on accepte de recevoir ---
const recv = (() => {
  try { return JSON.parse(localStorage.getItem('recv') || '{}'); } catch (_) { return {}; }
})();
function getRecv(key) { return recv[key] !== false; } // par défaut : on reçoit tout
[['recvMemes', 'memes'], ['recvVideos', 'videos'], ['recvPolls', 'polls'], ['recvSounds', 'sounds'], ['recvMessages', 'messages']]
  .forEach(([id, key]) => {
    const cb = document.getElementById(id);
    cb.checked = getRecv(key);
    cb.addEventListener('change', () => {
      recv[key] = cb.checked;
      localStorage.setItem('recv', JSON.stringify(recv));
    });
  });

// --- Coller une image depuis le presse-papier (Ctrl+V) ---
window.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const it of items) {
    if (it.type && it.type.startsWith('image/')) {
      const blob = it.getAsFile();
      if (!blob) continue;
      const reader = new FileReader();
      reader.onload = () => resizeImage(reader.result);
      reader.readAsDataURL(blob);
      e.preventDefault();
      return;
    }
  }
});

// --- Durée ---
els.dur.addEventListener('input', () => {
  els.durVal.textContent = els.dur.value;
});

// --- Placement & taille du mème ---
const POSITIONS = [
  ['top-left', '↖'], ['top-center', '↑'], ['top-right', '↗'],
  ['center-left', '←'], ['center-center', '●'], ['center-right', '→'],
  ['bottom-left', '↙'], ['bottom-center', '↓'], ['bottom-right', '↘'],
];
POSITIONS.forEach(([pos, glyph]) => {
  const cell = document.createElement('button');
  cell.className = 'poscell' + (pos === chosenPos ? ' active' : '');
  cell.textContent = glyph;
  cell.addEventListener('click', () => {
    chosenPos = pos;
    [...els.posGrid.children].forEach((c) => c.classList.remove('active'));
    cell.classList.add('active');
  });
  els.posGrid.appendChild(cell);
});
els.memeSize.addEventListener('input', () => {
  chosenSize = Number(els.memeSize.value);
  els.memeSizeVal.textContent = els.memeSize.value;
});
els.memeOpacity.addEventListener('input', () => {
  chosenOpacity = Number(els.memeOpacity.value);
  els.memeOpacityVal.textContent = els.memeOpacity.value;
});

// Effets d'apparition (chips)
const EFFECTS = [
  ['none', '✨ Aucun'], ['shake', '🫨 Tremblement'], ['glitch', '📺 Glitch'],
  ['fall', '⬇️ Chute'], ['zoom', '🔍 Zoom'], ['spin', '🌀 Rotation'], ['pulse', '💓 Battement'],
];
EFFECTS.forEach(([id, label]) => {
  const b = document.createElement('button');
  b.className = 'gif-cat' + (id === chosenEffect ? ' active' : '');
  b.textContent = label;
  b.addEventListener('click', () => {
    chosenEffect = id;
    [...els.fxGrid.children].forEach((c) => c.classList.remove('active'));
    b.classList.add('active');
  });
  els.fxGrid.appendChild(b);
});

// --- Destinataires ---
els.everyone.addEventListener('change', renderUserList);

// --- Choix de l'image ---
els.drop.addEventListener('click', () => els.file.click());
els.file.addEventListener('change', () => {
  const f = els.file.files[0];
  if (f) loadImage(f);
});

// Glisser-déposer une image sur la zone
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
els.drop.addEventListener('dragover', (e) => { e.preventDefault(); els.drop.classList.add('drag'); });
els.drop.addEventListener('dragleave', () => els.drop.classList.remove('drag'));
els.drop.addEventListener('drop', (e) => {
  e.preventDefault();
  els.drop.classList.remove('drag');
  const f = e.dataTransfer && e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadImage(f);
});

// Quand une image finale est prête (éditeur ou bibliothèque), on la met en attente d'envoi.
function setReadyImage(result) {
  if (result && typeof result === 'object') {
    // GIF légendé / dessiné : { gif, texts, drawing }
    imageData = result.gif;
    chosenTexts = Array.isArray(result.texts) ? result.texts : null;
    chosenDrawing = result.drawing || null;
  } else {
    imageData = result;
    chosenTexts = null;
    chosenDrawing = null;
  }
  els.preview.innerHTML = `<img src="${imageData}" alt="aperçu" />`;
  updateSendButton();
}

// --- Créateur de mème ---
document.getElementById('openMeme').addEventListener('click', () => {
  window.openMemeEditor(setReadyImage);
});

// --- Bibliothèque GIF & mèmes ---
document.getElementById('openLib').addEventListener('click', () => {
  window.openLibrary(setReadyImage);
});

// --- Vidéo courte ---
document.getElementById('openVideo').addEventListener('click', () =>
  document.getElementById('videoFile').click()
);
document.getElementById('videoFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > 11 * 1024 * 1024) {
    alert('Vidéo trop lourde (max 11 Mo). Choisis un clip plus court / plus léger.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    imageData = reader.result; // data:video/...
    chosenTexts = null;
    chosenDrawing = null;
    els.preview.innerHTML =
      `<video src="${imageData}" muted autoplay loop playsinline style="max-width:100%;max-height:180px;border:var(--bd);border-radius:10px;"></video>`;
    updateSendButton();
  };
  reader.readAsDataURL(f);
});

// --- Webcam ---
document.getElementById('openCam').addEventListener('click', () => window.openWebcam(setReadyImage));

// --- Musique ---
document.getElementById('openMusic').addEventListener('click', () => {
  window.openMusic((track) => {
    const label = track.artist ? `${track.name} — ${track.artist}` : track.name;
    chosenAudio = { src: track.src, name: label };
    els.musicChipName.textContent = '🎵 ' + label;
    els.musicChip.hidden = false;
    els.volumeRow.hidden = false;
  });
});
els.musicRemove.addEventListener('click', () => {
  chosenAudio = null;
  els.musicChip.hidden = true;
  els.volumeRow.hidden = true;
});
els.volume.addEventListener('input', () => {
  els.volVal.textContent = els.volume.value;
  chosenAudioVolume = Number(els.volume.value) / 100;
});

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = () => resizeImage(reader.result);
  reader.readAsDataURL(file);
}

// On redimensionne l'image pour ne pas envoyer un fichier énorme sur le réseau.
function resizeImage(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const MAX = 1280;
    let { width, height } = img;
    if (width > MAX || height > MAX) {
      const ratio = Math.min(MAX / width, MAX / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    imageData = canvas.toDataURL('image/jpeg', 0.82); // JPEG = bien plus léger -> envoi rapide
    chosenTexts = null;
    chosenDrawing = null;
    els.preview.innerHTML = `<img src="${imageData}" alt="aperçu" />`;
    updateSendButton();
  };
  img.src = dataUrl;
}

// --- Liste des connectés ---
function renderUserList() {
  const others = users.filter((u) => u.id !== myId);
  const everyone = els.everyone.checked;

  els.onlineCount.textContent =
    users.length <= 1 ? 'Toi seul' : `${users.length} en ligne`;

  els.userList.classList.toggle('disabled', everyone);

  if (others.length === 0) {
    els.userList.innerHTML =
      '<div class="empty">Personne d\'autre pour l\'instant… invite tes potes !</div>';
    return;
  }

  els.userList.innerHTML = '';
  for (const u of others) {
    const row = document.createElement('label');
    row.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selectedTargets.has(u.id);
    cb.disabled = everyone;
    cb.addEventListener('change', () => {
      if (cb.checked) selectedTargets.add(u.id);
      else selectedTargets.delete(u.id);
      updateSendButton();
    });
    const span = document.createElement('span');
    span.textContent = u.name || 'Anonyme';
    row.appendChild(cb);
    row.appendChild(span);
    els.userList.appendChild(row);
  }
}

// --- WebSocket ---
function setStatus(connected, text) {
  els.dot.classList.toggle('on', connected);
  els.statusText.textContent = text;
  updateSendButton();
}

function sendHello() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'hello', name: myName || 'Anonyme' }));
  }
}

function connect() {
  if (ws) {
    try { ws.close(); } catch (_) {}
  }
  clearTimeout(reconnectTimer);

  const url = els.server.value || DEFAULT_SERVER;
  setStatus(false, 'Connexion…');

  try {
    ws = new WebSocket(url);
  } catch (_) {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    setStatus(true, 'Connecté ✓');
    sendHello();
  };
  ws.onclose = () => {
    setStatus(false, 'Déconnecté — nouvelle tentative…');
    users = [];
    renderUserList();
    scheduleReconnect();
  };
  ws.onerror = () => setStatus(false, 'Erreur de connexion');
  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch (_) { return; }

    if (msg.type === 'welcome') {
      myId = msg.id;
      renderUserList();
    } else if (msg.type === 'presence') {
      users = msg.users || [];
      // on nettoie les cibles qui ne sont plus connectées
      for (const id of [...selectedTargets]) {
        if (!users.some((u) => u.id === id)) selectedTargets.delete(id);
      }
      renderUserList();
    } else if (msg.type === 'show' && msg.image) {
      // Réglages : on ignore si l'utilisateur a coupé la réception de ce type.
      const isVid = String(msg.image).startsWith('data:video');
      if ((isVid && !getRecv('videos')) || (!isVid && !getRecv('memes'))) return;
      window.api.showOverlay({
        image: msg.image,
        duration: msg.duration,
        from: msg.from,
        pos: msg.pos,
        size: msg.size,
        opacity: msg.opacity,
        effect: msg.effect,
        texts: msg.texts,
        drawing: msg.drawing,
      });
      playIncomingAudio(msg.audio, msg.duration, msg.audioVolume);
    } else if (msg.type === 'poll') {
      if (!getRecv('polls')) return;
      polls[msg.pollId] = { voters: {} };
      window.api.openPoll(msg);
    } else if (msg.type === 'vote') {
      const p = polls[msg.pollId] || (polls[msg.pollId] = { voters: {} });
      p.voters[msg.voter] = msg.choice;
      pushTally(msg.pollId);
    } else if (msg.type === 'sound') {
      if (!getRecv('sounds')) return;
      try {
        const a = new Audio(msg.data);
        a.volume = typeof msg.volume === 'number' ? Math.max(0, Math.min(1, msg.volume)) : 1;
        a.play().catch(() => {});
        activeSounds.push(a);
        updateStopBtn();
        a.addEventListener('ended', () => { activeSounds = activeSounds.filter((x) => x !== a); updateStopBtn(); });
      } catch (_) {}
      showToast('🔊 ' + (msg.name || 'son') + (msg.from ? ' — ' + msg.from : ''));
    } else if (msg.type === 'stop-sound') {
      stopAllAudio(); // quelqu'un a coupé : on arrête ici aussi
    } else if (msg.type === 'message') {
      if (!getRecv('messages')) return;
      window.api.showBubble({ from: msg.from, text: msg.text });
    }
  };
}

// --- Chat : envoyer un message (bulle), avec taille, position et destinataires ---
window.sendMessage = function (text, opts) {
  const t = String(text || '').trim();
  if (!t || !ws || ws.readyState !== WebSocket.OPEN) return false;
  opts = opts || {};
  // mêmes destinataires que la section « 3 · Destinataires »
  const targets = els.everyone.checked ? [] : [...selectedTargets];
  ws.send(JSON.stringify({
    type: 'message',
    text: t.slice(0, 280),
    pos: opts.pos || 'bottom-right',
    size: opts.size || 'medium',
    targets,
  }));
  return true;
};

// Barre de saisie (bouton 💬 dans la topbar)
(function () {
  const bar = document.getElementById('chatBar');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const openBtn = document.getElementById('openChat');
  const closeBtn = document.getElementById('chatClose');

  // Boutons segmentés (position / taille) : un seul actif, valeur mémorisée.
  function seg(id, storeKey, fallback) {
    const group = document.getElementById(id);
    let val = localStorage.getItem(storeKey) || fallback;
    const apply = () => group.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === val));
    group.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      val = b.dataset.v; localStorage.setItem(storeKey, val); apply();
    }));
    apply();
    return () => val;
  }
  const getPos = seg('chatPos', 'chatPos', 'bottom-right');
  const getSize = seg('chatSize', 'chatSize', 'medium');

  function openBar() { bar.hidden = false; input.focus(); }
  function closeBar() { bar.hidden = true; input.value = ''; }
  function fire() {
    if (window.sendMessage(input.value, { pos: getPos(), size: getSize() })) {
      input.value = ''; input.focus();
    }
  }
  openBtn.addEventListener('click', () => { bar.hidden ? openBar() : closeBar(); });
  closeBtn.addEventListener('click', closeBar);
  sendBtn.addEventListener('click', fire);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); fire(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeBar(); }
  });
})();

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 2500);
}

function updateSendButton() {
  const connected = ws && ws.readyState === WebSocket.OPEN;
  const hasTarget = els.everyone.checked || selectedTargets.size > 0;
  els.send.disabled = !(connected && imageData && hasTarget);
  // bouton "éditer cette image" : visible si une image (pas une vidéo) est prête
  const canEdit = imageData && !String(imageData).startsWith('data:video');
  document.getElementById('editReady').hidden = !canEdit;
}

// Éditer l'image prête (collée, fichier, webcam…) dans l'éditeur de mème.
document.getElementById('editReady').addEventListener('click', () => {
  if (imageData) window.openMemeEditor(setReadyImage, imageData);
});

// --- Envoi ---
els.send.addEventListener('click', async () => {
  if (!ws || ws.readyState !== WebSocket.OPEN || !imageData) return;
  const targets = els.everyone.checked ? [] : [...selectedTargets];
  ws.send(
    JSON.stringify({
      type: 'show',
      image: imageData,
      duration: Number(els.dur.value),
      targets,
      audio: chosenAudio ? chosenAudio.src : null,
      audioName: chosenAudio ? chosenAudio.name : null,
      audioVolume: chosenAudio ? chosenAudioVolume : 1,
      pos: chosenPos,
      size: chosenSize,
      opacity: chosenOpacity,
      effect: chosenEffect,
      texts: chosenTexts,
      drawing: chosenDrawing,
    })
  );

  // Enregistre le mème dans l'historique partagé (vignette + version pleine taille).
  // Les vidéos ne vont pas dans l'historique (trop lourdes / pas de vignette image).
  if (window.SB && window.SB.configured() && !imageData.startsWith('data:video')) {
    const thumb = await makeThumb(imageData);
    window.SB.addMeme(myName || 'Anonyme', thumb);
  }
});

// Version "pleine taille" pour la visionneuse (garde les GIF animés).
function makeFull(dataUrl) {
  if (dataUrl.startsWith('data:image/gif')) return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1000;
      let w = img.width;
      let h = img.height;
      const r = Math.min(1, MAX / Math.max(w, h));
      w = Math.round(w * r);
      h = Math.round(h * r);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Fabrique une petite vignette (pour l'historique) à partir de l'image envoyée.
function makeThumb(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 560; // assez grand pour la visionneuse, assez léger pour la grille
      let w = img.width;
      let h = img.height;
      const r = Math.min(1, MAX / Math.max(w, h));
      w = Math.round(w * r);
      h = Math.round(h * r);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Ouvre l'historique & le classement.
document.getElementById('openHistory').addEventListener('click', () => window.openHistory());

// --- Sondages (this or that) ---
const polls = {}; // pollId -> { voters: { voterId: 'A'|'B' } }

// La fenêtre de contrôle est la seule à avoir le WebSocket : elle lance le sondage…
window.launchPoll = function (data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'poll',
    pollId: data.pollId,
    question: data.question,
    imageA: data.imageA,
    imageB: data.imageB,
    duration: data.duration,
  }));
};

// …et relaie les votes cliqués dans la fenêtre de sondage.
window.api.onPollVoteToControl(({ pollId, choice }) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'vote', pollId, choice }));
  }
});

// Recalcule le décompte (anti-doublon par votant) et l'envoie à la fenêtre de sondage.
function pushTally(pollId) {
  const p = polls[pollId];
  if (!p) return;
  let a = 0;
  let b = 0;
  for (const v of Object.values(p.voters)) {
    if (v === 'A') a++;
    else if (v === 'B') b++;
  }
  window.api.sendPollTally({ pollId, a, b, myVote: p.voters[myId] || null });
}

// --- Soundboard : envoyer un son à tout le monde ---
window.sendSound = function (s, volume) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'sound', data: s.data, name: s.name,
      volume: typeof volume === 'number' ? volume : 1,
    }));
  }
};

// --- Raccourcis clavier des sons (déclenchent l'envoi d'un son) ---
function getSoundKeys() { try { return JSON.parse(localStorage.getItem('soundKeys') || '{}'); } catch (_) { return {}; } }
window.refreshSoundShortcuts = function () { window.api.registerShortcuts(Object.keys(getSoundKeys())); };
window.api.onShortcutFired((combo) => {
  const s = getSoundKeys()[combo];
  if (s) {
    const vol = Number(localStorage.getItem('soundVol') || '100') / 100;
    window.sendSound(s, vol);
  }
});
window.refreshSoundShortcuts(); // (ré)enregistre les raccourcis au lancement

// Stop depuis le menu de la barre système
window.api.onTrayStop(() => stopEverywhere());
// Avertissement si une combinaison de raccourci a été refusée (déjà prise / réservée Windows)
window.api.onShortcutsFailed((failed) => {
  if (failed && failed.length) {
    showToast('⚠️ Raccourci refusé : ' + failed.join(', ') + ' — essaie une autre combo (ex. Ctrl+1).');
  }
});

// Petit message éphémère (réception d'un son, etc.)
let toastTimer = null;
function showToast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

connect();
