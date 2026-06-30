// Webcam : prévisualisation, capture, puis envoi (ou édition). Choix de la caméra + erreurs claires.
(function () {
  const overlay = document.getElementById('camOverlay');
  const video = document.getElementById('camVideo');
  const preview = document.getElementById('camPreview');
  const errBox = document.getElementById('camErr');
  const closeBtn = document.getElementById('camClose');
  const captureBtn = document.getElementById('camCapture');
  const retakeBtn = document.getElementById('camRetake');
  const editBtn = document.getElementById('camEdit');
  const useBtn = document.getElementById('camUse');
  const camSelect = document.getElementById('camSelect');

  let stream = null;
  let onDone = null;
  let shot = null;

  window.openWebcam = function (cb) {
    onDone = cb;
    overlay.hidden = false;
    errBox.style.display = 'none';
    start(camSelect.value || null);
  };

  async function start(deviceId) {
    shot = null;
    showLive();
    errBox.style.display = 'none';
    stopStream();
    try {
      const video_c = deviceId
        ? { deviceId: { exact: deviceId } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };
      stream = await navigator.mediaDevices.getUserMedia({ video: video_c, audio: false });
      video.srcObject = stream;
      await video.play().catch(() => {});
      populateDevices(); // les libellés sont dispo une fois l'accès accordé
    } catch (e) {
      populateDevices();
      showError(e);
    }
  }

  function showError(e) {
    const name = (e && e.name) || '';
    const msg = (e && e.message) || '';
    let txt;
    if (name === 'NotReadableError' || name === 'TrackStartError' || /in use|busy|allocate/i.test(msg)) {
      txt = '⚠️ La caméra est déjà utilisée par une autre appli (Discord, Zoom…) et ne peut pas être partagée. '
        + 'Essaie une autre caméra ci-dessus, ou ferme l\'autre appli.';
    } else if (name === 'NotAllowedError' || name === 'SecurityError') {
      txt = 'Accès à la caméra refusé par Windows.';
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      txt = 'Aucune caméra disponible (ou ce choix de caméra est invalide).';
    } else {
      txt = 'Impossible d\'accéder à la webcam : ' + (msg || name);
    }
    errBox.textContent = txt;
    errBox.style.display = 'block';
  }

  async function populateDevices() {
    try {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      const cur = camSelect.value;
      camSelect.innerHTML = '';
      cams.forEach((d, i) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || 'Caméra ' + (i + 1);
        camSelect.appendChild(opt);
      });
      if (cur) camSelect.value = cur;
      // on n'affiche le menu que s'il y a un vrai choix
      camSelect.style.display = cams.length > 1 ? 'inline-block' : 'none';
    } catch (_) {}
  }
  camSelect.addEventListener('change', () => start(camSelect.value));

  function stopStream() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }
  function close() { stopStream(); overlay.hidden = true; }

  function showLive() {
    video.style.display = 'block';
    preview.style.display = 'none';
    captureBtn.style.display = 'inline-flex';
    retakeBtn.style.display = 'none';
    editBtn.style.display = 'none';
    useBtn.style.display = 'none';
  }
  function showShot() {
    video.style.display = 'none';
    preview.style.display = 'block';
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'inline-flex';
    editBtn.style.display = 'inline-flex';
    useBtn.style.display = 'inline-flex';
  }

  captureBtn.addEventListener('click', () => {
    if (!video.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext('2d');
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1); // miroir, pour matcher l'aperçu
    ctx.drawImage(video, 0, 0, c.width, c.height);
    shot = c.toDataURL('image/jpeg', 0.9);
    preview.src = shot;
    showShot();
  });

  retakeBtn.addEventListener('click', () => { shot = null; showLive(); });

  useBtn.addEventListener('click', () => {
    const cb = onDone;
    const img = shot;
    close();
    if (cb) cb(img);
  });

  editBtn.addEventListener('click', () => {
    const cb = onDone;
    const img = shot;
    close();
    window.openMemeEditor((r) => { if (cb) cb(r); }, img);
  });

  closeBtn.addEventListener('click', close);
})();
