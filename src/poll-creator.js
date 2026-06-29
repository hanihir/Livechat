// Créateur de sondage : 2 options (image / mème édité / GIF de la biblio) + une question.
(function () {
  const overlay = document.getElementById('pollCreator');
  const openBtn = document.getElementById('openPoll');
  const closeBtn = document.getElementById('pollClose');
  const cancelBtn = document.getElementById('pollCancel');
  const launchBtn = document.getElementById('pollLaunch');
  const question = document.getElementById('pollQuestion');
  const dur = document.getElementById('pollDur');
  const durVal = document.getElementById('pollDurVal');
  const prev = { A: document.getElementById('pollPrevA'), B: document.getElementById('pollPrevB') };
  const fileInput = { A: document.getElementById('pollFileA'), B: document.getElementById('pollFileB') };

  const opt = { A: null, B: null }; // dataURL de chaque option

  function open() { overlay.hidden = false; }
  function close() { overlay.hidden = true; }
  function reset() {
    opt.A = null; opt.B = null;
    question.value = '';
    prev.A.innerHTML = '';
    prev.B.innerHTML = '';
    dur.value = 15;
    durVal.textContent = '15';
    update();
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', () => { close(); reset(); });
  dur.addEventListener('input', () => { durVal.textContent = dur.value; });

  // Place une option (résultat string = image plate ; objet = GIF légendé -> on garde le GIF).
  function setOption(slot, result) {
    const dataUrl = result && typeof result === 'object' ? result.gif : result;
    if (!dataUrl) return;
    opt[slot] = dataUrl;
    prev[slot].innerHTML =
      `<img src="${dataUrl}" style="max-width:100%;max-height:130px;border:2.5px solid var(--ink);border-radius:9px;" />`;
    update();
  }

  ['A', 'B'].forEach((slot) => {
    // 1) Fichier image
    document.getElementById('pollFileBtn' + slot).addEventListener('click', () => fileInput[slot].click());
    fileInput[slot].addEventListener('change', () => {
      const f = fileInput[slot].files[0];
      fileInput[slot].value = '';
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => resize(reader.result, (d) => setOption(slot, d));
      reader.readAsDataURL(f);
    });
    // 2) Créer / éditer un mème (pré-charge l'option déjà choisie pour la modifier)
    document.getElementById('pollMeme' + slot).addEventListener('click', () => {
      window.openMemeEditor((r) => setOption(slot, r), opt[slot] || null);
    });
    // 3) Bibliothèque (templates / mèmes / GIF)
    document.getElementById('pollLib' + slot).addEventListener('click', () => {
      window.openLibrary((r) => setOption(slot, r));
    });
  });

  function resize(dataUrl, cb) {
    const im = new Image();
    im.onload = () => {
      const MAX = 1000;
      let w = im.width;
      let h = im.height;
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX / w, MAX / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(im, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.85));
    };
    im.onerror = () => cb(dataUrl);
    im.src = dataUrl;
  }

  function update() { launchBtn.disabled = !(opt.A && opt.B); }

  launchBtn.addEventListener('click', () => {
    if (!opt.A || !opt.B) return;
    window.launchPoll({
      pollId: crypto.randomUUID(),
      question: question.value.trim(),
      imageA: opt.A,
      imageB: opt.B,
      duration: Number(dur.value),
    });
    close();
    reset();
  });
})();
