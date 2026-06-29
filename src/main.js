const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

// Autorise la lecture audio automatique : sinon Chromium bloque le son
// tant qu'il n'y a pas eu de clic dans la fenêtre (et la pop-up n'en a aucun).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let controlWindow;

// Fenêtre principale : l'interface où on choisit l'image, la durée, etc.
function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 640,
    height: 860,
    minWidth: 480,
    minHeight: 640,
    resizable: true,
    title: 'LiveChatr',
    backgroundColor: '#FBF1DE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // garde l'audio/les timers actifs même en arrière-plan
    },
  });
  controlWindow.setMenuBarVisibility(false);
  controlWindow.loadFile(path.join(__dirname, 'index.html'));
}

// Fenêtre "pop-up" : transparente, sans bordure, au-dessus de tout, au milieu de l'écran.
function createOverlay({ image, duration, from, audio, audioName }) {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;

  const overlay = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    hasShadow: false,
    fullscreenable: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required', // pour que la musique démarre toute seule
    },
  });

  // Au-dessus de TOUT (même par-dessus les jeux en plein écran si possible)
  overlay.setAlwaysOnTop(true, 'screen-saver');
  // Les clics passent à travers : la pop-up ne gêne pas
  overlay.setIgnoreMouseEvents(true);
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.loadFile(path.join(__dirname, 'overlay.html'));

  overlay.webContents.once('did-finish-load', () => {
    overlay.webContents.send('overlay-data', { image, duration, from, audio, audioName });
  });

  // Fermeture automatique après la durée (+ marge pour le fondu de sortie)
  const ms = Math.max(1, Number(duration) || 5) * 1000;
  setTimeout(() => {
    if (!overlay.isDestroyed()) overlay.close();
  }, ms + 600);
}

app.whenReady().then(() => {
  createControlWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

// Demande venant de l'interface : afficher une pop-up
ipcMain.on('show-overlay', (_event, payload) => {
  createOverlay(payload);
});

// Téléchargements depuis internet faits côté processus principal :
// ça évite tous les soucis de CORS pour les API GIF/mèmes.
ipcMain.handle('http-json', async (_event, url) => {
  const res = await fetch(url);
  return await res.json();
});

ipcMain.handle('http-dataurl', async (_event, url) => {
  const res = await fetch(url);
  const contentType = res.headers.get('content-type') || 'image/gif';
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString('base64')}`;
});

// Requête HTTP générique (GET/POST/PATCH…) — utilisée pour la base Supabase.
ipcMain.handle('http-request', async (_event, { url, method, headers, body }) => {
  const res = await fetch(url, {
    method: method || 'GET',
    headers: headers || {},
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { ok: res.ok, status: res.status, json, text };
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
