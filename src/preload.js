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
  httpRequest: (opts) => ipcRenderer.invoke('http-request', opts),

  // --- Sondages ---
  openPoll: (data) => ipcRenderer.send('poll-open', data), // contrôle -> main : ouvre la fenêtre
  onPollData: (cb) => ipcRenderer.on('poll-data', (_e, d) => cb(d)), // main -> fenêtre sondage
  castVote: (data) => ipcRenderer.send('poll-cast', data), // fenêtre sondage -> main
  onPollVoteToControl: (cb) => ipcRenderer.on('poll-cast-to-control', (_e, d) => cb(d)), // main -> contrôle
  sendPollTally: (data) => ipcRenderer.send('poll-tally-up', data), // contrôle -> main
  onPollTally: (cb) => ipcRenderer.on('poll-tally', (_e, d) => cb(d)), // main -> fenêtre sondage
});
