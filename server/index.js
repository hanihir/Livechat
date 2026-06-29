const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// Petit serveur HTTP : utile pour que l'hébergeur (Render, etc.) voie que le service répond.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('LiveChatr relay en ligne ✓');
});

// 8 Mo max par message (taille d'image raisonnable après redimensionnement).
const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 * 1024 });

wss.on('connection', (ws) => {
  console.log(`Client connecté. Total : ${wss.clients.size}`);

  ws.on('message', (data) => {
    // On renvoie le message à TOUS les clients connectés (y compris celui qui envoie).
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(data.toString());
      }
    }
  });

  ws.on('close', () => console.log(`Client parti. Total : ${wss.clients.size}`));
});

server.listen(PORT, () => console.log(`Serveur LiveChatr démarré sur le port ${PORT}`));
