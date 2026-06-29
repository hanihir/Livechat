// Créateur de mèmes : une image de fond + des blocs de texte déplaçables.
// Expose window.openMemeEditor(callback) ; callback reçoit l'image finale (dataURL).
(function () {
  const overlay = document.getElementById('memeEditor');
  const stage = document.getElementById('meStage');
  const hint = document.getElementById('meHint');
  const img = document.getElementById('meImage');
  const fileInput = document.getElementById('meFile');
  const loadBtn = document.getElementById('meLoad');
  const addTextBtn = document.getElementById('meAddText');
  const textCtrl = document.getElementById('meTextCtrl');
  const textInput = document.getElementById('meTextInput');
  const sizeInput = document.getElementById('meSize');
  const colorInput = document.getElementById('meColor');
  const deleteBtn = document.getElementById('meDelete');
  const cancelBtn = document.getElementById('meCancel');
  const validateBtn = document.getElementById('meValidate');
  const closeBtn = document.getElementById('meEditClose');

  let onDone = null;
  let blocks = []; // { el, text, size, color, xPct, yPct }  (position en % du visuel)
  let selected = null;
  let hasImage = false;

  window.openMemeEditor = function (cb, startDataUrl) {
    reset();
    onDone = cb;
    overlay.hidden = false;
    if (startDataUrl) loadImageSrc(startDataUrl); // image de départ (ex : template de mème)
  };

  // Charge une image (depuis un fichier ou un template) dans l'éditeur.
  function loadImageSrc(src) {
    img.onload = () => {
      hasImage = true;
      img.style.display = 'block';
      hint.style.display = 'none';
      addTextBtn.disabled = false;
    };
    img.src = src;
  }

  function reset() {
    blocks.forEach((b) => b.el.remove());
    blocks = [];
    selected = null;
    hasImage = false;
    img.removeAttribute('src');
    img.style.display = 'none';
    hint.style.display = 'block';
    addTextBtn.disabled = true;
    textCtrl.hidden = true;
    fileInput.value = '';
  }

  function close() {
    overlay.hidden = true;
  }

  // --- Charger une image de fond ---
  loadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => loadImageSrc(reader.result);
    reader.readAsDataURL(f);
  });

  // --- Ajouter un bloc de texte ---
  addTextBtn.addEventListener('click', () => {
    if (!hasImage) return;
    const el = document.createElement('div');
    el.className = 'me-text';
    const b = { el, text: 'TEXTE', size: 44, color: '#ffffff', xPct: 50, yPct: 12 };
    stage.appendChild(el);
    blocks.push(b);
    applyBlock(b);
    makeDraggable(b);
    select(b);
    textInput.focus();
    textInput.select();
  });

  // Applique l'état d'un bloc à son élément à l'écran.
  function applyBlock(b) {
    const el = b.el;
    el.textContent = b.text || ' ';
    el.style.fontSize = b.size + 'px';
    el.style.color = b.color;
    el.style.left = b.xPct + '%';
    el.style.top = b.yPct + '%';
    // contour noir « façon mème » derrière le texte (s'adapte à la taille)
    const o = Math.max(1, b.size / 22);
    el.style.textShadow =
      `${-o}px ${-o}px 0 #000, ${o}px ${-o}px 0 #000, ` +
      `${-o}px ${o}px 0 #000, ${o}px ${o}px 0 #000, ` +
      `0 ${o}px 0 #000, 0 ${-o}px 0 #000, ${o}px 0 0 #000, ${-o}px 0 0 #000`;
  }

  function select(b) {
    selected = b;
    blocks.forEach((bl) => bl.el.classList.toggle('sel', bl === b));
    if (!b) { textCtrl.hidden = true; return; }
    textCtrl.hidden = false;
    textInput.value = b.text;
    sizeInput.value = b.size;
    colorInput.value = b.color;
  }

  textInput.addEventListener('input', () => {
    if (selected) { selected.text = textInput.value; applyBlock(selected); }
  });
  sizeInput.addEventListener('input', () => {
    if (selected) { selected.size = Number(sizeInput.value); applyBlock(selected); }
  });
  colorInput.addEventListener('input', () => {
    if (selected) { selected.color = colorInput.value; applyBlock(selected); }
  });
  deleteBtn.addEventListener('click', () => {
    if (!selected) return;
    selected.el.remove();
    blocks = blocks.filter((b) => b !== selected);
    select(null);
  });

  // --- Déplacement à la souris ---
  function makeDraggable(b) {
    b.el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      select(b);
      const rect = stage.getBoundingClientRect();
      const move = (ev) => {
        let x = ((ev.clientX - rect.left) / rect.width) * 100;
        let y = ((ev.clientY - rect.top) / rect.height) * 100;
        b.xPct = Math.max(0, Math.min(100, x));
        b.yPct = Math.max(0, Math.min(100, y));
        applyBlock(b);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }

  // Clic dans le vide => on désélectionne
  stage.addEventListener('mousedown', (e) => {
    if (e.target === stage || e.target === img || e.target === hint) select(null);
  });

  // --- Export : on « aplatit » l'image + les textes dans un canvas ---
  validateBtn.addEventListener('click', () => {
    if (!hasImage) { close(); return; }

    const MAX = 1280;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > MAX || h > MAX) {
      const r = Math.min(MAX / w, MAX / h);
      w = Math.round(w * r);
      h = Math.round(h * r);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // facteur d'échelle entre l'affichage (CSS px) et l'image finale
    const scale = w / stage.getBoundingClientRect().width;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';

    for (const b of blocks) {
      const fontPx = b.size * scale;
      ctx.font = `${fontPx}px Impact, "Arial Black", sans-serif`;
      const x = (b.xPct / 100) * w;
      const y = (b.yPct / 100) * h;
      ctx.lineWidth = Math.max(2, fontPx / 7);
      ctx.strokeStyle = '#000';
      ctx.strokeText(b.text, x, y);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, x, y);
    }

    const dataUrl = canvas.toDataURL('image/png');
    if (onDone) onDone(dataUrl);
    close();
  });

  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
})();
