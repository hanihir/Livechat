// Soundboard partagé : grille de sons (depuis Supabase), clic = envoie à tout le monde.
(function () {
  const overlay = document.getElementById('soundOverlay');
  const openBtn = document.getElementById('openSound');
  const closeBtn = document.getElementById('soundClose');
  const importBtn = document.getElementById('soundImport');
  const fileInput = document.getElementById('soundFile');
  const status = document.getElementById('soundStatus');
  const grid = document.getElementById('soundGrid');
  const volInput = document.getElementById('soundVol');
  const volVal = document.getElementById('soundVolVal');

  const preview = new Audio();

  // Volume du soundboard (mémorisé), appliqué à l'aperçu ET envoyé avec le son.
  volInput.value = localStorage.getItem('soundVol') || '100';
  volVal.textContent = volInput.value;
  volInput.addEventListener('input', () => {
    volVal.textContent = volInput.value;
    localStorage.setItem('soundVol', volInput.value);
  });
  function getVol() { return Number(volInput.value) / 100; }

  window.openSoundboard = function () {
    overlay.hidden = false;
    load();
  };
  function close() {
    preview.pause();
    overlay.hidden = true;
  }
  openBtn.addEventListener('click', () => window.openSoundboard());
  closeBtn.addEventListener('click', close);

  async function load() {
    grid.innerHTML = '';
    if (!window.SB || !window.SB.configured()) {
      status.textContent = '⚠️ Base de données pas configurée.';
      return;
    }
    status.textContent = 'Chargement…';
    let sounds;
    try {
      sounds = await window.SB.getSounds();
    } catch (e) {
      status.textContent = 'Erreur de chargement.';
      return;
    }
    status.textContent = sounds.length
      ? sounds.length + ' sons — clique pour envoyer 🔊'
      : 'Aucun son. Importes-en un !';
    grid.innerHTML = '';
    for (const s of sounds) grid.appendChild(makeTile(s));
  }

  function makeTile(s) {
    const tile = document.createElement('div');
    tile.className = 'sound-tile';

    const play = document.createElement('button');
    play.className = 'sound-play';
    play.textContent = '▶️';
    play.addEventListener('click', (e) => {
      e.stopPropagation();
      preview.pause();
      preview.src = s.data;
      preview.volume = getVol();
      preview.play().catch(() => {});
    });
    tile.appendChild(play);

    const name = document.createElement('div');
    name.className = 'sound-name';
    name.textContent = s.name;
    tile.appendChild(name);

    // Clic = on envoie à tout le monde. On NE ferme PAS (pour pouvoir spammer).
    tile.addEventListener('click', () => {
      window.sendSound(s, getVol());
      tile.classList.add('hit');
      setTimeout(() => tile.classList.remove('hit'), 180);
    });
    return tile;
  }

  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      status.textContent = 'Son trop lourd (max 10 Mo).';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      status.textContent = 'Ajout…';
      const name = f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'son';
      try {
        await window.SB.addSound(name, localStorage.getItem('name') || 'Anonyme', reader.result);
      } catch (e) { /* ignore */ }
      load();
    };
    reader.readAsDataURL(f);
  });
})();
