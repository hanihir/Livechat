// Webcam : prévisualisation en direct, capture d'une photo, puis envoi (ou édition).
// Expose window.openWebcam(callback) ; callback reçoit l'image (dataURL) ou un résultat d'éditeur.
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

  let stream = null;
  let onDone = null;
  let shot = null;

  window.openWebcam = function (cb) {
    onDone = cb;
    overlay.hidden = false;
    errBox.style.display = 'none';
    start();
  };

  async function start() {
    shot = null;
    showLive();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
    } catch (e) {
      errBox.textContent = 'Impossible d\'accéder à la webcam : ' + (e.message || e.name);
      errBox.style.display = 'block';
    }
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }
  function close() {
    stopStream();
    overlay.hidden = true;
  }

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
    // miroir, pour correspondre à l'aperçu (effet selfie)
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
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
    // ouvre l'éditeur pré-chargé avec la photo (pour ajouter texte / dessin)
    window.openMemeEditor((r) => { if (cb) cb(r); }, img);
  });

  closeBtn.addEventListener('click', close);
})();
