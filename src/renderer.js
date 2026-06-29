// Serveur relais en ligne (Render). Tes amis se connectent ici automatiquement.
// Pour tester en local à la place : 'ws://localhost:8080'
const DEFAULT_SERVER = 'wss://livechat-k7we.onrender.com';

const els = {
  name: document.getElementById('name'),
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
};

let imageData = null;
let ws = null;
let reconnectTimer = null;
let myId = null;
let users = []; // [{ id, name }]
const selectedTargets = new Set(); // ids cochés quand "tout le monde" est décoché

// --- Mémorise pseudo + adresse serveur entre deux ouvertures ---
els.name.value = localStorage.getItem('name') || '';
els.server.value = localStorage.getItem('server') || DEFAULT_SERVER;

els.name.addEventListener('input', () => localStorage.setItem('name', els.name.value));
els.name.addEventListener('change', sendHello); // prévient le serveur du nouveau pseudo
els.server.addEventListener('change', () => {
  localStorage.setItem('server', els.server.value || DEFAULT_SERVER);
  connect();
});

// --- Durée ---
els.dur.addEventListener('input', () => {
  els.durVal.textContent = els.dur.value;
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
function setReadyImage(dataUrl) {
  imageData = dataUrl;
  els.preview.innerHTML = `<img src="${dataUrl}" alt="aperçu" />`;
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
    ws.send(JSON.stringify({ type: 'hello', name: els.name.value || 'Anonyme' }));
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
      window.api.showOverlay({ image: msg.image, duration: msg.duration, from: msg.from });
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
els.send.addEventListener('click', () => {
  if (!ws || ws.readyState !== WebSocket.OPEN || !imageData) return;
  const targets = els.everyone.checked ? [] : [...selectedTargets];
  ws.send(
    JSON.stringify({
      type: 'show',
      image: imageData,
      duration: Number(els.dur.value),
      targets,
    })
  );
});

connect();
