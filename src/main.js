const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Autorise la lecture audio automatique : sinon Chromium bloque le son
// tant qu'il n'y a pas eu de clic dans la fenêtre (et la pop-up n'en a aucun).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let controlWindow;
let tray = null;
let isQuitting = false; // vrai seulement quand on quitte vraiment (menu « Quitter »)
const startHidden = process.argv.includes('--hidden'); // lancé au démarrage Windows = discret

// Une seule instance de l'appli à la fois (sinon un 2e lancement rouvre la fenêtre).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
}

// Fenêtre principale : l'interface où on choisit l'image, la durée, etc.
function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 640,
    height: 860,
    minWidth: 480,
    minHeight: 640,
    resizable: true,
    show: !startHidden, // au démarrage Windows, on reste dans la barre système
    title: 'LiveChatr',
    icon: path.join(__dirname, 'icon.png'),
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

  // Fermer la fenêtre (croix) = la cacher dans la barre système, sans quitter l'appli.
  controlWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      controlWindow.hide();
    }
  });
}

// Affiche / ramène la fenêtre principale au premier plan.
function showWindow() {
  if (!controlWindow || controlWindow.isDestroyed()) {
    createControlWindow();
  }
  controlWindow.show();
  controlWindow.focus();
}

// Icône dans la barre système (à côté de l'horloge) avec un menu clic droit.
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
  tray = new Tray(icon.resize({ width: 18, height: 18 }));
  tray.setToolTip('LiveChatr');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir LiveChatr', click: showWindow },
    { type: 'separator' },
    { label: 'Quitter', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
}

// Fenêtre "pop-up" : transparente, sans bordure, au-dessus de tout, au milieu de l'écran.
function createOverlay({ image, duration, from, pos, size, texts }) {
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
    overlay.webContents.send('overlay-data', { image, duration, from, pos, size, texts });
  });

  // Fermeture automatique après la durée (+ marge pour le fondu de sortie)
  const ms = Math.max(1, Number(duration) || 5) * 1000;
  setTimeout(() => {
    if (!overlay.isDestroyed()) overlay.close();
  }, ms + 600);
}

app.whenReady().then(() => {
  createControlWindow();
  createTray();
  // Lancement automatique au démarrage de Windows (démarré masqué dans la barre système).
  if (app.isPackaged) {
    // Pour un .exe portable, on pointe vers le vrai fichier (et pas la copie temporaire).
    const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    app.setLoginItemSettings({ openAtLogin: true, path: exePath, args: ['--hidden'] });
  }
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

// Quand l'appli quitte vraiment, on laisse les fenêtres se fermer.
app.on('before-quit', () => { isQuitting = true; });

// On NE quitte PAS quand la fenêtre est fermée : l'appli reste vivante dans la barre système.
app.on('window-all-closed', () => { /* rien : on vit dans le tray */ });
