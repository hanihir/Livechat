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
};

let imageData = null;
let ws = null;
let reconnectTimer = null;

// --- Mémorise pseudo + adresse serveur entre deux ouvertures ---
els.name.value = localStorage.getItem('name') || '';
els.server.value = localStorage.getItem('server') || DEFAULT_SERVER;

els.name.addEventListener('input', () => localStorage.setItem('name', els.name.value));
els.server.addEventListener('change', () => {
  localStorage.setItem('server', els.server.value || DEFAULT_SERVER);
  connect();
});

// --- Durée ---
els.dur.addEventListener('input', () => {
  els.durVal.textContent = els.dur.value;
});

// --- Choix de l'image ---
els.drop.addEventListener('click', () => els.file.click());
els.file.addEventListener('change', () => {
  const f = els.file.files[0];
  if (f) loadImage(f);
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

// --- Connexion WebSocket ---
function setStatus(connected, text) {
  els.dot.classList.toggle('on', connected);
  els.statusText.textContent = text;
  updateSendButton();
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

  ws.onopen = () => setStatus(true, 'Connecté ✓');
  ws.onclose = () => {
    setStatus(false, 'Déconnecté — nouvelle tentative…');
    scheduleReconnect();
  };
  ws.onerror = () => setStatus(false, 'Erreur de connexion');
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'show' && msg.image) {
        window.api.showOverlay({ image: msg.image, duration: msg.duration });
      }
    } catch (_) {}
  };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 2500);
}

function updateSendButton() {
  const ready = ws && ws.readyState === WebSocket.OPEN && imageData;
  els.send.disabled = !ready;
}

// --- Envoi ---
els.send.addEventListener('click', () => {
  if (!ws || ws.readyState !== WebSocket.OPEN || !imageData) return;
  ws.send(
    JSON.stringify({
      type: 'show',
      image: imageData,
      duration: Number(els.dur.value),
      from: els.name.value || 'Anonyme',
    })
  );
});

connect();
