const { contextBridge, ipcRenderer } = require('electron');

// Pont sécurisé entre l'interface (page web) et Electron.
contextBridge.exposeInMainWorld('api', {
  // L'interface demande d'afficher une pop-up plein écran
  showOverlay: (payload) => ipcRenderer.send('show-overlay', payload),
  // La fenêtre pop-up reçoit l'image + la durée à afficher
  onOverlayData: (callback) =>
    ipcRenderer.on('overlay-data', (_event, data) => callback(data)),
  // Télécharge du JSON / une image depuis internet (via le processus principal)
  httpJson: (url) => ipcRenderer.invoke('http-json', url),
  httpDataUrl: (url) => ipcRenderer.invoke('http-dataurl', url),
});
