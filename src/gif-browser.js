// Bibliothèque GIF & mèmes. Onglet "Mèmes" (Imgflip, sans clé) + onglet "GIF" (Giphy, clé requise).
// Expose window.openLibrary(callback) ; callback reçoit l'image choisie (dataURL).
(function () {
  const overlay = document.getElementById('libOverlay');
  const closeBtn = document.getElementById('libClose');
  const tabMemes = document.getElementById('tabMemes');
  const tabGifs = document.getElementById('tabGifs');
  const query = document.getElementById('libQuery');
  const keyWrap = document.getElementById('libKeyWrap');
  const keyInput = document.getElementById('libKey');
  const status = document.getElementById('libStatus');
  const grid = document.getElementById('libGrid');

  let onDone = null;
  let mode = 'memes';
  let memesCache = null;
  let searchTimer = null;

  window.openLibrary = function (cb) {
    onDone = cb;
    overlay.hidden = false;
    setMode('memes');
  };
  function close() { overlay.hidden = true; }
  closeBtn.addEventListener('click', close);

  keyInput.value = localStorage.getItem('giphyKey') || '';
  keyInput.addEventListener('change', () => {
    localStorage.setItem('giphyKey', keyInput.value.trim());
    if (mode === 'gifs') loadGifs();
  });

  tabMemes.addEventListener('click', () => setMode('memes'));
  tabGifs.addEventListener('click', () => setMode('gifs'));

  function setMode(m) {
    mode = m;
    tabMemes.classList.toggle('active', m === 'memes');
    tabGifs.classList.toggle('active', m === 'gifs');
    keyWrap.style.display = m === 'gifs' ? 'block' : 'none';
    query.placeholder = m === 'memes' ? 'Filtrer les mèmes…' : 'Cherche un GIF… (dance, cat, lol)';
    query.value = '';
    grid.innerHTML = '';
    status.textContent = '';
    if (m === 'memes') loadMemes();
    else loadGifs();
  }

  query.addEventListener('input', () => {
    clearTimeout(searchTimer);
    if (mode === 'memes') renderMemes();
    else searchTimer = setTimeout(loadGifs, 450);
  });

  // ---------- Onglet Mèmes (Imgflip, sans clé) ----------
  async function loadMemes() {
    if (!memesCache) {
      status.textContent = 'Chargement des mèmes…';
      try {
        const j = await window.api.httpJson('https://api.imgflip.com/get_memes');
        memesCache = (j && j.data && j.data.memes) ? j.data.memes : [];
      } catch (e) {
        status.textContent = 'Impossible de charger les mèmes (connexion ?).';
        return;
      }
    }
    renderMemes();
  }

  function renderMemes() {
    const q = query.value.trim().toLowerCase();
    const list = (memesCache || []).filter((m) => !q || m.name.toLowerCase().includes(q));
    status.textContent = list.length + ' mèmes — clique pour ajouter ton texte';
    grid.innerHTML = '';
    for (const m of list) {
      grid.appendChild(makeCell(m.url, m.name, () => pickMeme(m)));
    }
  }

  async function pickMeme(m) {
    status.textContent = 'Préparation de « ' + m.name + ' »…';
    try {
      const dataUrl = await window.api.httpDataUrl(m.url);
      close();
      // On ouvre l'éditeur pré-chargé pour ajouter du texte sur le template.
      window.openMemeEditor((finalUrl) => { if (onDone) onDone(finalUrl); }, dataUrl);
    } catch (e) {
      status.textContent = 'Échec du chargement de ce mème.';
    }
  }

  // ---------- Onglet GIF (Giphy, clé requise) ----------
  async function loadGifs() {
    const key = (localStorage.getItem('giphyKey') || '').trim();
    if (!key) {
      grid.innerHTML = '';
      status.textContent = '👆 Colle ta clé Giphy gratuite ci-dessus pour activer les GIF.';
      return;
    }
    const q = query.value.trim();
    const base = q
      ? 'https://api.giphy.com/v1/gifs/search'
      : 'https://api.giphy.com/v1/gifs/trending';
    const url =
      base + '?api_key=' + encodeURIComponent(key) +
      (q ? '&q=' + encodeURIComponent(q) : '') +
      '&limit=24&rating=pg-13';

    status.textContent = 'Recherche…';
    try {
      const j = await window.api.httpJson(url);
      if (j.meta && j.meta.status !== 200) {
        grid.innerHTML = '';
        status.textContent = 'Clé Giphy refusée (' + j.meta.status + '). Vérifie-la.';
        return;
      }
      const data = j.data || [];
      status.textContent = data.length ? data.length + ' GIF' : 'Aucun résultat.';
      grid.innerHTML = '';
      for (const g of data) {
        const im = g.images || {};
        const prev = (im.fixed_width_small || im.fixed_width || im.downsized || {}).url;
        const full = (im.downsized || im.fixed_height || im.original || {}).url;
        if (!prev || !full) continue;
        grid.appendChild(makeCell(prev, '', () => pickGif(full)));
      }
    } catch (e) {
      grid.innerHTML = '';
      status.textContent = 'Erreur réseau ou clé invalide.';
    }
  }

  async function pickGif(url) {
    status.textContent = 'Téléchargement du GIF…';
    try {
      const dataUrl = await window.api.httpDataUrl(url);
      if (onDone) onDone(dataUrl);
      close();
    } catch (e) {
      status.textContent = 'Échec du téléchargement.';
    }
  }

  // ---------- Helper : une cellule de la grille ----------
  function makeCell(src, title, onClick) {
    const cell = document.createElement('div');
    cell.className = 'lib-cell';
    const im = document.createElement('img');
    im.src = src;
    im.loading = 'lazy';
    if (title) im.title = title;
    cell.appendChild(im);
    cell.addEventListener('click', onClick);
    return cell;
  }
})();
