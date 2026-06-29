const frame = document.getElementById('frame');
const pic = document.getElementById('pic');
const caption = document.getElementById('caption');

// On reçoit l'image + la durée + le pseudo + le nom de la musique (jouée par la fenêtre principale).
window.api.onOverlayData(({ image, duration, from, audioName }) => {
  pic.src = image;

  const bits = [];
  if (from) bits.push('📨 ' + from);
  if (audioName) bits.push('🎵 ' + audioName);
  if (bits.length) {
    caption.textContent = bits.join('   •   ');
    caption.style.display = 'block';
  }

  requestAnimationFrame(() => frame.classList.add('show'));

  const ms = Math.max(1, Number(duration) || 5) * 1000;
  setTimeout(() => {
    frame.classList.remove('show');
    frame.classList.add('hide');
  }, ms);
});
