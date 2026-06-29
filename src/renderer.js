// Serveur relais en ligne (Render). Tes amis se connectent ici automatiquement.
// Pour tester en local à la place : 'ws://localhost:8080'
const DEFAULT_SERVER = 'wss://livechat-k7we.onrender.com';

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
};

let imageData = null;
let chosenAudio = null; // { src, name }
let chosenAudioVolume = 1; // 0..1, réglé par le curseur
let chosenPos = 'center-center'; // position du mème à l'écran
let chosenSize = 70; // taille du mème en % de l'écran
let chosenTexts = null; // couche texte (quand on légende un GIF)
let incomingAudio = null; // musique en cours de lecture à la réception

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
  const ms = Math.max(1, Number(duration) || 5) * 1000;
  setTimeout(() => {
    if (incomingAudio === audio) {
      try { audio.pause(); } catch (_) {}
      incomingAudio = null;
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

// --- Destinataires ---
els.everyone.addEventListener('change', renderUserList);

// --- Choix de l'image ---
els.drop.addEventListener('click', () => els.file.click());
els.file.addEventListener('change', () => {
  const f = els.file.files[0];
  if (f) loadImage(f);
});

// Quand une image finale est prête (éditeur ou bibliothèque), on la met en attente d'envoi.
function setReadyImage(result) {
  if (result && typeof result === 'object') {
    // GIF légendé : { gif, texts }
    imageData = result.gif;
    chosenTexts = Array.isArray(result.texts) ? result.texts : null;
  } else {
    imageData = result;
    chosenTexts = null;
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
    imageData = canvas.toDataURL('image/png');
    chosenTexts = null;
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
      window.api.showOverlay({
        image: msg.image,
        duration: msg.duration,
        from: msg.from,
        pos: msg.pos,
        size: msg.size,
        texts: msg.texts,
      });
      playIncomingAudio(msg.audio, msg.duration, msg.audioVolume);
    }
  };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 2500);
}

function updateSendButton() {
  const connected = ws && ws.readyState === WebSocket.OPEN;
  const hasTarget = els.everyone.checked || selectedTargets.size > 0;
  els.send.disabled = !(connected && imageData && hasTarget);
}

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
      texts: chosenTexts,
    })
  );

  // Enregistre le mème dans l'historique partagé (vignette + version pleine taille).
  if (window.SB && window.SB.configured()) {
    const [thumb, full] = await Promise.all([makeThumb(imageData), makeFull(imageData)]);
    window.SB.addMeme(myName || 'Anonyme', thumb, full);
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
      const MAX = 360;
      let w = img.width;
      let h = img.height;
      const r = Math.min(1, MAX / Math.max(w, h));
      w = Math.round(w * r);
      h = Math.round(h * r);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Ouvre l'historique & le classement.
document.getElementById('openHistory').addEventListener('click', () => window.openHistory());

connect();
