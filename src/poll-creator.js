// Créateur de sondage : 2 images + une question, puis on lance le vote.
(function () {
  const overlay = document.getElementById('pollCreator');
  const openBtn = document.getElementById('openPoll');
  const closeBtn = document.getElementById('pollClose');
  const cancelBtn = document.getElementById('pollCancel');
  const launchBtn = document.getElementById('pollLaunch');
  const question = document.getElementById('pollQuestion');
  const pickA = document.getElementById('pollPickA');
  const pickB = document.getElementById('pollPickB');
  const fileA = document.getElementById('pollFileA');
  const fileB = document.getElementById('pollFileB');
  const prevA = document.getElementById('pollPrevA');
  const prevB = document.getElementById('pollPrevB');
  const dur = document.getElementById('pollDur');
  const durVal = document.getElementById('pollDurVal');

  let imgA = null;
  let imgB = null;

  function open() { overlay.hidden = false; }
  function close() { overlay.hidden = true; }
  function reset() {
    imgA = null; imgB = null;
    question.value = '';
    prevA.innerHTML = '';
    prevB.innerHTML = '';
    dur.value = 15;
    durVal.textContent = '15';
    update();
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', () => { close(); reset(); });
  dur.addEventListener('input', () => { durVal.textContent = dur.value; });

  pickA.addEventListener('click', () => fileA.click());
  pickB.addEventListener('click', () => fileB.click());
  fileA.addEventListener('change', () =>
    handleFile(fileA, (d) => { imgA = d; preview(prevA, d); update(); })
  );
  fileB.addEventListener('change', () =>
    handleFile(fileB, (d) => { imgB = d; preview(prevB, d); update(); })
  );

  function preview(box, dataUrl) {
    box.innerHTML =
      `<img src="${dataUrl}" style="max-width:100%;max-height:130px;border:2.5px solid var(--ink);border-radius:9px;" />`;
  }

  function handleFile(input, cb) {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => resize(reader.result, cb);
    reader.readAsDataURL(f);
  }

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

  function update() { launchBtn.disabled = !(imgA && imgB); }

  launchBtn.addEventListener('click', () => {
    if (!imgA || !imgB) return;
    window.launchPoll({
      pollId: crypto.randomUUID(),
      question: question.value.trim(),
      imageA: imgA,
      imageB: imgB,
      duration: Number(dur.value),
    });
    close();
    reset();
  });
})();
