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
  const drawCanvas = document.getElementById('meDraw');
  const dctx = drawCanvas.getContext('2d');
  const drawToggle = document.getElementById('meDrawToggle');
  const drawCtrl = document.getElementById('meDrawCtrl');
  const brushColor = document.getElementById('meBrushColor');
  const brushSize = document.getElementById('meBrushSize');
  const drawClear = document.getElementById('meDrawClear');

  let onDone = null;
  let blocks = []; // { el, text, size, color, xPct, yPct }  (position en % du visuel)
  let selected = null;
  let hasImage = false;
  let drawingMode = false; // pinceau actif ?
  let painting = false;
  let hasStrokes = false;

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
      drawToggle.disabled = false;
      // le canvas de dessin épouse la taille affichée de l'image
      drawCanvas.width = img.clientWidth;
      drawCanvas.height = img.clientHeight;
      dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      hasStrokes = false;
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
    // dessin
    setDrawing(false);
    drawToggle.disabled = true;
    dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    hasStrokes = false;
  }

  // --- Pinceau (dessin à main levée) ---
  function setDrawing(on) {
    drawingMode = on;
    drawToggle.classList.toggle('active', on);
    drawCanvas.classList.toggle('drawing', on);
    drawCtrl.hidden = !on;
    if (on) { textCtrl.hidden = true; select(null); }
  }
  drawToggle.addEventListener('click', () => { if (hasImage) setDrawing(!drawingMode); });
  drawClear.addEventListener('click', () => {
    dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    hasStrokes = false;
  });
  drawCanvas.addEventListener('mousedown', (e) => {
    if (!drawingMode) return;
    painting = true;
    const p = drawPoint(e);
    dctx.beginPath();
    dctx.moveTo(p.x, p.y);
  });
  window.addEventListener('mousemove', (e) => {
    if (!painting) return;
    const p = drawPoint(e);
    dctx.lineTo(p.x, p.y);
    dctx.strokeStyle = brushColor.value;
    dctx.lineWidth = Number(brushSize.value);
    dctx.lineCap = 'round';
    dctx.lineJoin = 'round';
    dctx.stroke();
    hasStrokes = true;
  });
  window.addEventListener('mouseup', () => { painting = false; });

  function drawPoint(e) {
    const r = drawCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (drawCanvas.width / r.width),
      y: (e.clientY - r.top) * (drawCanvas.height / r.height),
    };
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
    setDrawing(false); // on quitte le pinceau pour pouvoir déplacer le texte
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
    // largeur max pour que le texte reste DANS le cadre (passe à la ligne)
    el.style.maxWidth = Math.max(12, 98 - b.xPct) + '%';
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

  // Découpe un texte en lignes qui tiennent dans une largeur donnée (pixels canvas).
  function wrapCanvas(ctx, text, maxW) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width <= maxW || !cur) cur = test;
      else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // --- Export : on « aplatit » l'image + les textes dans un canvas ---
  validateBtn.addEventListener('click', () => {
    if (!hasImage) { close(); return; }

    // GIF : on ne l'aplatit PAS (sinon on perd l'animation). On renvoie le GIF
    // + une couche de texte (positions et tailles en % pour rester proportionnel).
    if (img.src.startsWith('data:image/gif')) {
      const stageH = stage.getBoundingClientRect().height || 1;
      const texts = blocks.map((b) => ({
        text: b.text,
        xPct: b.xPct,
        yPct: b.yPct,
        sizePct: (b.size / stageH) * 100,
        color: b.color,
      }));
      const drawing = hasStrokes ? drawCanvas.toDataURL('image/png') : null;
      if (onDone) onDone({ gif: img.src, texts, drawing });
      close();
      return;
    }

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

    // dessin du pinceau fusionné dans l'image (sous le texte)
    if (hasStrokes) ctx.drawImage(drawCanvas, 0, 0, w, h);

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
      const maxW = (Math.max(12, 98 - b.xPct) / 100) * w; // même largeur que dans l'éditeur
      ctx.lineWidth = Math.max(2, fontPx / 7);
      const lines = wrapCanvas(ctx, b.text, maxW);
      const lineH = fontPx * 1.08;
      lines.forEach((ln, i) => {
        const ly = y + i * lineH;
        ctx.strokeStyle = '#000';
        ctx.strokeText(ln, x, ly);
        ctx.fillStyle = b.color;
        ctx.fillText(ln, x, ly);
      });
    }

    const dataUrl = canvas.toDataURL('image/png');
    if (onDone) onDone(dataUrl);
    close();
  });

  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
})();
