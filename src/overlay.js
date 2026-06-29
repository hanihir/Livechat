const frame = document.getElementById('frame');
const pic = document.getElementById('pic');
const caption = document.getElementById('caption');

// On reçoit l'image + la durée + le pseudo de l'envoyeur.
window.api.onOverlayData(({ image, duration, from }) => {
  pic.src = image;

  if (from) {
    caption.textContent = `📨 ${from}`;
    caption.style.display = 'block';
  }

  requestAnimationFrame(() => frame.classList.add('show'));

  const ms = Math.max(1, Number(duration) || 5) * 1000;
  // Fondu de sortie juste avant que la fenêtre se ferme (gérée côté Electron).
  setTimeout(() => {
    frame.classList.remove('show');
    frame.classList.add('hide');
  }, ms);
});
