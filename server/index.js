const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// Petit serveur HTTP : utile pour que l'hébergeur (Render) voie que le service répond.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('LiveChatr relay en ligne ✓');
});

// 8 Mo max par message (taille d'image raisonnable après redimensionnement).
const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 * 1024 });

// Envoie à tout le monde la liste des personnes connectées.
function broadcastPresence() {
  const users = [];
  for (const c of wss.clients) {
    if (c.readyState === 1 && c.meta) {
      users.push({ id: c.meta.id, name: c.meta.name });
    }
  }
  const msg = JSON.stringify({ type: 'presence', users });
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(msg);
  }
}

wss.on('connection', (ws) => {
  // Chaque client reçoit un identifiant unique + un pseudo par défaut.
  ws.meta = { id: crypto.randomUUID(), name: 'Anonyme' };

  // On lui dit son propre identifiant, puis on met à jour la liste pour tout le monde.
  ws.send(JSON.stringify({ type: 'welcome', id: ws.meta.id }));
  broadcastPresence();
  console.log(`Client connecté. Total : ${wss.clients.size}`);

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (_) {
      return;
    }

    // Le client annonce / met à jour son pseudo.
    if (msg.type === 'hello') {
      ws.meta.name = String(msg.name || 'Anonyme').slice(0, 40);
      broadcastPresence();
      return;
    }

    // Le client envoie un mème à afficher.
    if (msg.type === 'show') {
      const payload = JSON.stringify({
        type: 'show',
        image: msg.image,
        duration: msg.duration,
        from: ws.meta.name, // on fait confiance au serveur pour le pseudo
      });

      // targets = liste d'identifiants ; vide/absent = tout le monde.
      const targets =
        Array.isArray(msg.targets) && msg.targets.length
          ? new Set(msg.targets)
          : null;

      for (const c of wss.clients) {
        if (c.readyState !== 1) continue;
        if (targets) {
          // destinataires choisis + l'envoyeur (pour qu'il voie ce qu'il a envoyé)
          if (targets.has(c.meta.id) || c === ws) c.send(payload);
        } else {
          c.send(payload); // tout le monde
        }
      }
      return;
    }
  });

  ws.on('close', () => {
    broadcastPresence();
    console.log(`Client parti. Total : ${wss.clients.size}`);
  });
});

server.listen(PORT, () => console.log(`Serveur LiveChatr démarré sur le port ${PORT}`));
