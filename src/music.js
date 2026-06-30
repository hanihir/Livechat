// Sélecteur de son à attacher au mème : iTunes (30s) + sons importés + favoris + soundboard.
// Expose window.openMusic(callback) ; callback reçoit { name, artist, src }.
(function () {
  const overlay = document.getElementById('musicOverlay');
  const closeBtn = document.getElementById('musicClose');
  const tabSearch = document.getElementById('tabSearch');
  const tabMine = document.getElementById('tabMine');
  const tabMusFav = document.getElementById('tabMusFav');
  const tabSound = document.getElementById('tabSound');
  const searchWrap = document.getElementById('musicSearchWrap');
  const query = document.getElementById('musicQuery');
  const importBtn = document.getElementById('musicImport');
  const fileInput = document.getElementById('musicFile');
  const status = document.getElementById('musicStatus');
  const list = document.getElementById('trackList');

  const MAX_IMPORT = 5 * 1024 * 1024;
  let onChoose = null;
  let mode = 'search';
  let searchTimer = null;
  const preview = new Audio();
  let playingBtn = null;

  window.openMusic = function (cb) { onChoose = cb; overlay.hidden = false; setMode('search'); };
  function close() { stopPreview(); overlay.hidden = true; }
  closeBtn.addEventListener('click', close);

  tabSearch.addEventListener('click', () => setMode('search'));
  tabMine.addEventListener('click', () => setMode('mine'));
  tabMusFav.addEventListener('click', () => setMode('favoris'));
  tabSound.addEventListener('click', () => setMode('sound'));

  query.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 450); });

  // Échap : stoppe l'aperçu en cours
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) stopPreview(); });

  function setMode(m) {
    stopPreview();
    mode = m;
    tabSearch.classList.toggle('active', m === 'search');
    tabMine.classList.toggle('active', m === 'mine');
    tabMusFav.classList.toggle('active', m === 'favoris');
    tabSound.classList.toggle('active', m === 'sound');
    searchWrap.style.display = m === 'search' ? 'block' : 'none';
    importBtn.style.display = m === 'mine' ? 'block' : 'none';
    list.innerHTML = '';
    if (m === 'search') { query.value = ''; status.textContent = 'Tape le nom d\'une chanson ou d\'un artiste 🎤'; }
    else if (m === 'mine') renderMine();
    else if (m === 'favoris') renderFavoris();
    else renderSound();
  }

  // ---------- Aperçu ----------
  function playPreview(src, btn) {
    if (playingBtn === btn) { stopPreview(); return; }
    stopPreview();
    preview.src = src;
    preview.play().catch(() => {});
    btn.textContent = '⏸️';
    playingBtn = btn;
    preview.onended = stopPreview;
  }
  function stopPreview() {
    preview.pause();
    if (playingBtn) { playingBtn.textContent = '▶️'; playingBtn = null; }
  }

  // ---------- Favoris (localStorage) ----------
  function getFavs() { try { return JSON.parse(localStorage.getItem('musicFavs') || '[]'); } catch (e) { return []; } }
  function setFavs(a) { localStorage.setItem('musicFavs', JSON.stringify(a)); }
  function isFav(t) { return getFavs().some((f) => f.src === t.src); }
  function toggleFav(t) {
    let a = getFavs();
    if (a.some((f) => f.src === t.src)) a = a.filter((f) => f.src !== t.src);
    else a.push({ name: t.name, artist: t.artist || '', src: t.src, art: t.art || '' });
    setFavs(a);
  }
  function renderFavoris() {
    const f = getFavs();
    status.textContent = f.length ? f.length + ' favoris' : 'Aucun favori. Clique l\'étoile ⭐ sur une musique.';
    renderTracks(f, {});
  }

  // ---------- Soundboard (sons partagés à coller sur un mème) ----------
  async function renderSound() {
    status.textContent = 'Chargement des sons…';
    if (!window.SB || !window.SB.configured()) { status.textContent = 'Base non configurée.'; return; }
    let sounds;
    try { sounds = await window.SB.getSounds(); } catch (e) { status.textContent = 'Erreur de chargement.'; return; }
    status.textContent = sounds.length + ' sons — choisis-en un à coller sur ton mème/GIF';
    renderTracks(sounds.map((s) => ({ name: s.name, artist: 'son', src: s.data, art: '' })), {});
  }

  // ---------- Recherche iTunes ----------
  async function search() {
    const q = query.value.trim();
    if (!q) { list.innerHTML = ''; status.textContent = 'Tape le nom d\'une chanson ou d\'un artiste 🎤'; return; }
    status.textContent = 'Recherche…';
    try {
      const j = await window.api.httpJson('https://itunes.apple.com/search?term=' + encodeURIComponent(q) + '&media=music&limit=25');
      const tracks = (j.results || []).filter((t) => t.previewUrl)
        .map((t) => ({ name: t.trackName, artist: t.artistName, art: t.artworkUrl100, src: t.previewUrl }));
      status.textContent = tracks.length ? tracks.length + ' titres (extraits 30s)' : 'Aucun résultat.';
      renderTracks(tracks, {});
    } catch (e) { status.textContent = 'Erreur réseau.'; }
  }

  // ---------- Sons importés ----------
  function getMine() { try { return JSON.parse(localStorage.getItem('mySongs') || '[]'); } catch (e) { return []; } }
  function setMine(arr) { localStorage.setItem('mySongs', JSON.stringify(arr)); }

  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    if (f.size > MAX_IMPORT) { status.textContent = 'Son trop lourd (max 5 Mo).'; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const arr = getMine();
      arr.push({ name: f.name.replace(/\.[^.]+$/, ''), src: reader.result });
      setMine(arr);
      renderMine();
    };
    reader.readAsDataURL(f);
  });

  function renderMine() {
    const songs = getMine();
    status.textContent = songs.length ? songs.length + ' son(s) importé(s)' : 'Aucun son importé. Clique « ➕ Importer un son ».';
    renderTracks(songs.map((s) => ({ name: s.name, artist: '', art: '', src: s.src })), { mine: true });
  }

  // ---------- Rendu d'une liste ----------
  function renderTracks(tracks, opts) {
    list.innerHTML = '';
    tracks.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = 'track';

      const art = document.createElement('img');
      art.src = t.art || '';
      art.alt = '';
      row.appendChild(art);

      const info = document.createElement('div');
      info.className = 'info';
      const tt = document.createElement('div'); tt.className = 't'; tt.textContent = t.name || 'Sans titre';
      const ta = document.createElement('div'); ta.className = 'a'; ta.textContent = t.artist || (opts.mine ? 'Mon son' : '');
      info.appendChild(tt); info.appendChild(ta);
      row.appendChild(info);

      const play = document.createElement('button');
      play.className = 'play'; play.textContent = '▶️';
      play.addEventListener('click', () => playPreview(t.src, play));
      row.appendChild(play);

      // étoile favori
      const fav = document.createElement('button');
      fav.className = 'play';
      const refreshFav = () => { fav.textContent = isFav(t) ? '⭐' : '☆'; };
      refreshFav();
      fav.addEventListener('click', () => { toggleFav(t); refreshFav(); if (mode === 'favoris') renderFavoris(); });
      row.appendChild(fav);

      const choose = document.createElement('button');
      choose.className = 'choose'; choose.textContent = 'Choisir';
      choose.addEventListener('click', () => {
        if (onChoose) onChoose({ name: t.name, artist: t.artist, src: t.src });
        close();
      });
      row.appendChild(choose);

      if (opts.mine) {
        const del = document.createElement('button');
        del.className = 'del'; del.textContent = '🗑️';
        del.addEventListener('click', () => {
          const arr = getMine(); arr.splice(idx, 1); setMine(arr); stopPreview(); renderMine();
        });
        row.appendChild(del);
      }

      list.appendChild(row);
    });
  }
})();
