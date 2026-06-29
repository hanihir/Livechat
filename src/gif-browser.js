// Bibliothèque : Templates (Imgflip), Mèmes (Reddit), GIF (Giphy, catégories + scroll infini), Favoris.
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
  const gifCats = document.getElementById('gifCats');
  const status = document.getElementById('libStatus');
  const grid = document.getElementById('libGrid');
  const moreBtn = document.getElementById('libMore');

  // Clé Giphy par défaut (intégrée) — surchargeable dans le champ.
  const DEFAULT_GIPHY_KEY = 'LTXZLRtn5BUnCCJ6wl4p4kHRsthhVoF4';

  // Catégories de GIF (façon Insta) : libellé affiché + terme de recherche.
  const GIF_CATS = [
    { label: '🔥 Tendances', q: '' },
    { label: '😂 MDR', q: 'lol' },
    { label: '❤️ Amour', q: 'love' },
    { label: '😭 Triste', q: 'sad' },
    { label: '👋 Salut', q: 'hello' },
    { label: '🎉 Fête', q: 'party' },
    { label: '💀 Mort de rire', q: 'dead' },
    { label: '😮 Wow', q: 'wow' },
    { label: '👍 OK', q: 'ok' },
    { label: '🕺 Danse', q: 'dance' },
    { label: '😎 Cool', q: 'cool' },
    { label: '🤔 Hmm', q: 'thinking' },
    { label: '😡 Énervé', q: 'angry' },
    { label: '🥳 Bravo', q: 'congrats' },
    { label: '🙄 Blasé', q: 'whatever' },
    { label: '🐱 Chat', q: 'cat' },
  ];

  let onDone = null;
  let mode = 'templates';
  let templatesCache = null;
  let redditItems = [];
  let searchTimer = null;
  // état de pagination des GIF
  let gif = { q: '', offset: 0, total: Infinity, loading: false, token: 0 };

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
    if (mode === 'gifs') loadGifs(true);
  });

  tabTemplates.addEventListener('click', () => setMode('templates'));
  tabMemes.addEventListener('click', () => setMode('memes'));
  tabGifs.addEventListener('click', () => setMode('gifs'));
  tabFavoris.addEventListener('click', () => setMode('favoris'));
  moreBtn.addEventListener('click', () => loadReddit(true));

  query.addEventListener('input', () => {
    clearTimeout(searchTimer);
    if (mode === 'templates') renderTemplates();
    else if (mode === 'gifs') {
      // recherche libre => on enlève la catégorie active
      [...gifCats.children].forEach((x) => x.classList.remove('active'));
      searchTimer = setTimeout(() => loadGifs(true), 450);
    }
  });

  // Scroll infini (GIF + Mèmes)
  overlay.addEventListener('scroll', () => {
    const nearBottom = overlay.scrollTop + overlay.clientHeight >= overlay.scrollHeight - 320;
    if (!nearBottom) return;
    if (mode === 'gifs') fetchGifPage();
    else if (mode === 'memes') loadReddit(true);
  });

  buildCats();

  function setMode(m) {
    mode = m;
    tabTemplates.classList.toggle('active', m === 'templates');
    tabMemes.classList.toggle('active', m === 'memes');
    tabGifs.classList.toggle('active', m === 'gifs');
    tabFavoris.classList.toggle('active', m === 'favoris');
    searchWrap.style.display = (m === 'templates' || m === 'gifs') ? 'block' : 'none';
    keyWrap.style.display = (m === 'gifs') ? 'block' : 'none';
    gifCats.style.display = (m === 'gifs') ? 'flex' : 'none';
    moreBtn.style.display = (m === 'memes') ? 'block' : 'none';
    query.value = '';
    query.placeholder = m === 'templates' ? 'Filtrer les templates…' : 'Cherche un GIF…';
    grid.innerHTML = '';
    status.textContent = '';
    overlay.scrollTop = 0;
    if (m === 'templates') loadTemplates();
    else if (m === 'memes') loadReddit(false);
    else if (m === 'gifs') {
      [...gifCats.children].forEach((x, i) => x.classList.toggle('active', i === 0));
      loadGifs(true);
    } else loadFavs();
  }

  function buildCats() {
    gifCats.innerHTML = '';
    GIF_CATS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'gif-cat' + (i === 0 ? ' active' : '');
      b.textContent = c.label;
      b.addEventListener('click', () => {
        query.value = c.q;
        [...gifCats.children].forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        loadGifs(true);
      });
      gifCats.appendChild(b);
    });
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

  // ---------- Une cellule (étoile + animation au survol) ----------
  function makeCell(item) {
    const cell = document.createElement('div');
    cell.className = 'lib-cell';

    const im = document.createElement('img');
    im.src = item.preview;
    im.loading = 'lazy';
    if (item.name) im.title = item.name;
    if (item.hover) {
      im.addEventListener('mouseenter', () => { im.src = item.hover; });
      im.addEventListener('mouseleave', () => { im.src = item.preview; });
    }
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

  async function pick(item) {
    status.textContent = 'Chargement…';
    try {
      const dataUrl = await window.api.httpDataUrl(item.url);
      if (item.kind === 'template') {
        close();
        window.openMemeEditor((finalUrl) => { if (onDone) onDone(finalUrl); }, dataUrl);
      } else {
        if (onDone) onDone(dataUrl);
        close();
      }
    } catch (e) { status.textContent = 'Échec du chargement.'; }
  }

  // ---------- Templates (Imgflip) ----------
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

  // ---------- Mèmes (Reddit) ----------
  async function loadReddit(append) {
    if (gif.loading && append) return; // évite les doublons de requêtes pendant le scroll
    if (!append) { redditItems = []; grid.innerHTML = ''; }
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
    status.textContent = redditItems.length + ' mèmes — défile pour en voir plus';
    grid.innerHTML = '';
    redditItems.forEach((it) => grid.appendChild(makeCell(it)));
  }

  // ---------- GIF (Giphy, catégories + scroll infini) ----------
  function loadGifs(reset) {
    if (reset) {
      gif.q = query.value.trim();
      gif.offset = 0;
      gif.total = Infinity;
      gif.token++;
      grid.innerHTML = '';
    }
    fetchGifPage();
  }

  async function fetchGifPage() {
    if (gif.loading || gif.offset >= gif.total) return;
    gif.loading = true;
    const token = gif.token;
    const key = (localStorage.getItem('giphyKey') || DEFAULT_GIPHY_KEY).trim();
    const base = gif.q ? 'search' : 'trending';
    const url =
      'https://api.giphy.com/v1/gifs/' + base +
      '?api_key=' + encodeURIComponent(key) +
      (gif.q ? '&q=' + encodeURIComponent(gif.q) : '') +
      '&limit=50&offset=' + gif.offset + '&rating=pg-13';

    if (gif.offset === 0) status.textContent = 'Chargement…';
    try {
      const j = await window.api.httpJson(url);
      if (token !== gif.token) { gif.loading = false; return; } // une autre recherche a démarré
      if (j.meta && j.meta.status !== 200) {
        status.textContent = 'Clé Giphy refusée (' + j.meta.status + ').';
        gif.loading = false; return;
      }
      const data = j.data || [];
      if (j.pagination && typeof j.pagination.total_count === 'number') {
        gif.total = j.pagination.total_count;
      }
      gif.offset += data.length;
      for (const g of data) {
        const im = g.images || {};
        const still = (im.fixed_width_small_still || im.fixed_width_still || {}).url;
        const anim = (im.fixed_width_small || im.fixed_width || im.downsized || {}).url;
        const full = (im.downsized || im.fixed_height || im.original || {}).url;
        if (!anim || !full) continue;
        grid.appendChild(makeCell({ kind: 'gif', url: full, preview: still || anim, hover: anim }));
      }
      if (gif.offset === 0 || (data.length === 0 && grid.children.length === 0)) {
        status.textContent = 'Aucun résultat.';
      } else {
        status.textContent = grid.children.length + ' GIF — défile pour en voir plus';
      }
      gif.loading = false;
      // si la grille ne remplit pas l'écran, on charge encore une page
      if (overlay.scrollHeight <= overlay.clientHeight + 40 && gif.offset < gif.total) {
        fetchGifPage();
      }
    } catch (e) { status.textContent = 'Erreur réseau.'; gif.loading = false; }
  }

  // ---------- Favoris ----------
  function loadFavs() {
    const favs = getFavs();
    status.textContent = favs.length
      ? favs.length + ' favoris'
      : 'Aucun favori. Clique l\'étoile ⭐ sur un mème/GIF pour l\'ajouter.';
    grid.innerHTML = '';
    favs.forEach((it) => grid.appendChild(makeCell(it)));
  }
})();
