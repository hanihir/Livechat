const frame = document.getElementById('frame');
const pic = document.getElementById('pic');
const caption = document.getElementById('caption');

// On reçoit l'image + la durée + le pseudo + éventuellement une musique.
window.api.onOverlayData(({ image, duration, from, audio, audioName }) => {
  pic.src = image;

  const bits = [];
  if (from) bits.push('📨 ' + from);
  if (audioName) bits.push('🎵 ' + audioName);
  if (bits.length) {
    caption.textContent = bits.join('   •   ');
    caption.style.display = 'block';
  }

  // Lance la musique (extrait iTunes ou son importé). Elle s'arrête quand la fenêtre se ferme.
  if (audio) {
    const player = new Audio(audio);
    player.volume = 1;
    player.play().catch(() => {});
  }

  requestAnimationFrame(() => frame.classList.add('show'));

  const ms = Math.max(1, Number(duration) || 5) * 1000;
  setTimeout(() => {
    frame.classList.remove('show');
    frame.classList.add('hide');
  }, ms);
});
