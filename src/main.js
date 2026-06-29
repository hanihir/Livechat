const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let controlWindow;

// Fenêtre principale : l'interface où on choisit l'image, la durée, etc.
function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 520,
    height: 720,
    resizable: false,
    title: 'LiveChatr',
    backgroundColor: '#0f1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  controlWindow.setMenuBarVisibility(false);
  controlWindow.loadFile(path.join(__dirname, 'index.html'));
}

// Fenêtre "pop-up" : transparente, sans bordure, au-dessus de tout, au milieu de l'écran.
function createOverlay({ image, duration }) {
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
    },
  });

  // Au-dessus de TOUT (même par-dessus les jeux en plein écran si possible)
  overlay.setAlwaysOnTop(true, 'screen-saver');
  // Les clics passent à travers : la pop-up ne gêne pas
  overlay.setIgnoreMouseEvents(true);
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.loadFile(path.join(__dirname, 'overlay.html'));

  overlay.webContents.once('did-finish-load', () => {
    overlay.webContents.send('overlay-data', { image, duration });
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
