// Bibliothèque : Templates (Imgflip), Mèmes (Reddit), GIF (Giphy), Favoris.
// Expose window.openLibrary(callback) ; callback reçoit l'image choisie (dataURL).
(function () {
  const overlay = document.getElementById('libOverlay');
  const closeBtn = document.getElementById('libClose');
  const tabTemplates = document.getElementById('tabTemplates');
  const tabMemes = document.getElementById('tabMemes');
  const tabGifs = document.getElementById('tabGifs');
  const tabFavoris = document.getElementById('tabFavoris');
  const searchWrap = document.getElementById('libSearchWrap');
  const query = document.getElementById('libQuery');
  const keyWrap = document.getElementById('libKeyWrap');
  const keyInput = document.getElementById('libKey');
  const status = document.getElementById('libStatus');
  const grid = document.getElementById('libGrid');
  const moreBtn = document.getElementById('libMore');

  // Clé Giphy par défaut (intégrée) — surchargeable dans le champ.
  const DEFAULT_GIPHY_KEY = 'LTXZLRtn5BUnCCJ6wl4p4kHRsthhVoF4';

  let onDone = null;
  let mode = 'templates';
  let templatesCache = null;
  let redditItems = [];
  let searchTimer = null;

  window.openLibrary = function (cb) {
    onDone = cb;
    overlay.hidden = false;
    setMode('templates');
  };
  function close() { overlay.hidden = true; }
  closeBtn.addEventListener('click', close);

  keyInput.value = localStorage.getItem('giphyKey') || DEFAULT_GIPHY_KEY;
  keyInput.addEventListener('change', () => {
    localStorage.setItem('giphyKey', keyInput.value.trim());
    if (mode === 'gifs') loadGifs();
  });

  tabTemplates.addEventListener('click', () => setMode('templates'));
  tabMemes.addEventListener('click', () => setMode('memes'));
  tabGifs.addEventListener('click', () => setMode('gifs'));
  tabFavoris.addEventListener('click', () => setMode('favoris'));
  moreBtn.addEventListener('click', () => loadReddit(true));

  query.addEventListener('input', () => {
    clearTimeout(searchTimer);
    if (mode === 'templates') renderTemplates();
    else if (mode === 'gifs') searchTimer = setTimeout(loadGifs, 450);
  });

  function setMode(m) {
    mode = m;
    tabTemplates.classList.toggle('active', m === 'templates');
    tabMemes.classList.toggle('active', m === 'memes');
    tabGifs.classList.toggle('active', m === 'gifs');
    tabFavoris.classList.toggle('active', m === 'favoris');
    searchWrap.style.display = (m === 'templates' || m === 'gifs') ? 'block' : 'none';
    keyWrap.style.display = (m === 'gifs') ? 'block' : 'none';
    moreBtn.style.display = (m === 'memes') ? 'block' : 'none';
    query.value = '';
    query.placeholder = m === 'templates' ? 'Filtrer les templates…' : 'Cherche un GIF… (dance, cat, lol)';
    grid.innerHTML = '';
    status.textContent = '';
    if (m === 'templates') loadTemplates();
    else if (m === 'memes') loadReddit(false);
    else if (m === 'gifs') loadGifs();
    else loadFavs();
  }

  // ---------- Favoris (localStorage) ----------
  function getFavs() {
    try { return JSON.parse(localStorage.getItem('favs') || '[]'); } catch (e) { return []; }
  }
  function setFavs(arr) { localStorage.setItem('favs', JSON.stringify(arr)); }
  function favKey(it) { return it.kind + '|' + it.url; }
  function isFav(it) { return getFavs().some((f) => favKey(f) === favKey(it)); }
  function toggleFav(it) {
    const k = favKey(it);
    let arr = getFavs();
    if (arr.some((f) => favKey(f) === k)) arr = arr.filter((f) => favKey(f) !== k);
    else arr.push(it);
    setFavs(arr);
  }

  // ---------- Une cellule (avec étoile favori) ----------
  function makeCell(item) {
    const cell = document.createElement('div');
    cell.className = 'lib-cell';

    const im = document.createElement('img');
    im.src = item.preview;
    im.loading = 'lazy';
    if (item.name) im.title = item.name;
    cell.appendChild(im);

    const star = document.createElement('button');
    star.className = 'lib-star';
    const refresh = () => {
      const f = isFav(item);
      star.textContent = f ? '★' : '☆';
      star.classList.toggle('on', f);
    };
    refresh();
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(item);
      refresh();
      if (mode === 'favoris') loadFavs();
    });
    cell.appendChild(star);

    cell.addEventListener('click', () => pick(item));
    return cell;
  }

  // ---------- Sélection d'un élément ----------
  async function pick(item) {
    status.textContent = 'Chargement…';
    try {
      const dataUrl = await window.api.httpDataUrl(item.url);
      if (item.kind === 'template') {
        // image fixe → on ouvre l'éditeur pour la légender
        close();
        window.openMemeEditor((finalUrl) => { if (onDone) onDone(finalUrl); }, dataUrl);
      } else {
        // mème prêt ou GIF → envoi direct
        if (onDone) onDone(dataUrl);
        close();
      }
    } catch (e) {
      status.textContent = 'Échec du chargement.';
    }
  }

  // ---------- Onglet Templates (Imgflip) ----------
  async function loadTemplates() {
    if (!templatesCache) {
      status.textContent = 'Chargement…';
      try {
        const j = await window.api.httpJson('https://api.imgflip.com/get_memes');
        templatesCache = (j && j.data && j.data.memes) ? j.data.memes : [];
      } catch (e) { status.textContent = 'Impossible de charger les templates.'; return; }
    }
    renderTemplates();
  }
  function renderTemplates() {
    const q = query.value.trim().toLowerCase();
    const list = (templatesCache || []).filter((m) => !q || m.name.toLowerCase().includes(q));
    status.textContent = list.length + ' templates — clique pour ajouter ton texte';
    grid.innerHTML = '';
    list.forEach((m) =>
      grid.appendChild(makeCell({ kind: 'template', url: m.url, preview: m.url, name: m.name }))
    );
  }

  // ---------- Onglet Mèmes (Reddit, sans clé) ----------
  async function loadReddit(append) {
    if (!append) redditItems = [];
    status.textContent = 'Chargement des mèmes…';
    try {
      const j = await window.api.httpJson('https://meme-api.com/gimme/50');
      const memes = j.memes || [];
      const seen = new Set(redditItems.map((it) => it.url));
      for (const m of memes) {
        if (m.nsfw || seen.has(m.url)) continue;
        seen.add(m.url);
        redditItems.push({ kind: 'image', url: m.url, preview: m.url, name: m.title });
      }
    } catch (e) { status.textContent = 'Impossible de charger les mèmes.'; return; }
    status.textContent = redditItems.length + ' mèmes — clique pour envoyer';
    grid.innerHTML = '';
    redditItems.forEach((it) => grid.appendChild(makeCell(it)));
  }

  // ---------- Onglet GIF (Giphy) ----------
  async function loadGifs() {
    const key = (localStorage.getItem('giphyKey') || DEFAULT_GIPHY_KEY).trim();
    const q = query.value.trim();
    const base = q ? 'search' : 'trending';
    const url =
      'https://api.giphy.com/v1/gifs/' + base +
      '?api_key=' + encodeURIComponent(key) +
      (q ? '&q=' + encodeURIComponent(q) : '') +
      '&limit=24&rating=pg-13';
    status.textContent = 'Recherche…';
    try {
      const j = await window.api.httpJson(url);
      if (j.meta && j.meta.status !== 200) {
        grid.innerHTML = '';
        status.textContent = 'Clé Giphy refusée (' + j.meta.status + ').';
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
        grid.appendChild(makeCell({ kind: 'gif', url: full, preview: prev }));
      }
    } catch (e) { grid.innerHTML = ''; status.textContent = 'Erreur réseau.'; }
  }

  // ---------- Onglet Favoris ----------
  function loadFavs() {
    const favs = getFavs();
    status.textContent = favs.length
      ? favs.length + ' favoris'
      : 'Aucun favori. Clique l\'étoile ⭐ sur un mème/GIF pour l\'ajouter.';
    grid.innerHTML = '';
    favs.forEach((it) => grid.appendChild(makeCell(it)));
  }
})();
