# 📺 LiveChatr

Un petit logiciel à envoyer à tes amis : tu choisis une **image** et une **durée**,
tu cliques, et l'image apparaît **en plein milieu de l'écran de tous les potes connectés**.

## Comment ça marche

```
   Toi ──image + durée──▶  SERVEUR RELAIS  ──▶ Pote 1 (pop-up !)
                                │ ───────────▶ Pote 2 (pop-up !)
                                └───────────▶ Pote 3 (pop-up !)
```

- **L'application** (dossier `src/`) : interface Electron pour Windows.
- **Le serveur relais** (dossier `server/`) : reçoit les images et les renvoie à tout le monde.

---

## 1. Tester sur ton PC (en local)

```bash
npm install            # installe Electron (peut prendre quelques minutes)
npm install --prefix server   # installe le serveur

npm run server         # démarre le serveur relais (laisse cette fenêtre ouverte)
```

Puis dans une **deuxième** fenêtre de terminal :

```bash
npm start              # lance l'application
```

Choisis une image, une durée, clique sur **Envoyer**. La pop-up apparaît !
(Tu peux lancer `npm start` plusieurs fois pour simuler plusieurs amis.)

---

## 2. Mettre le serveur en ligne (gratuit) pour jouer avec des amis à distance

Le serveur doit être accessible depuis internet. Le plus simple : **Render** (gratuit).

1. Mets ce projet sur un dépôt GitHub.
2. Sur [render.com](https://render.com) → **New** → **Web Service** → connecte ton repo.
3. Réglages :
   - **Root Directory** : `server`
   - **Build Command** : `npm install`
   - **Start Command** : `node index.js`
4. Une fois déployé, tu obtiens une URL du type `https://livechatr-xxxx.onrender.com`.
5. Dans l'appli → ⚙️ **Réglages serveur**, mets l'adresse en **`wss://`** :
   `wss://livechatr-xxxx.onrender.com`

> ⚠️ Le plan gratuit de Render « s'endort » après inactivité : le premier message
> peut mettre ~30 s à réveiller le serveur. Ensuite c'est instantané.

---

## 3. Créer le `.exe` à envoyer aux amis

```bash
npm run dist
```

Le fichier d'installation se retrouve dans le dossier `dist/`.
Tes amis double-cliquent dessus → l'appli s'installe → ils mettent **la même adresse `wss://`**
dans les réglages, et c'est parti.

---

## Idées d'améliorations futures

- Afficher le pseudo de celui qui a envoyé l'image
- Un son quand la pop-up arrive
- Un bouton « mute » pour ne plus recevoir
- Envoyer des GIF / vidéos
- Un mot de passe de salon pour que seuls tes potes se connectent
