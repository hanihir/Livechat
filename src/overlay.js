const wrap = document.querySelector('.wrap');
const frame = document.getElementById('frame');
const pic = document.getElementById('pic');
const caption = document.getElementById('caption');

const ALIGN = { top: 'flex-start', center: 'center', bottom: 'flex-end', left: 'flex-start', right: 'flex-end' };

// On reçoit l'image + la durée + le pseudo + la position + la taille.
window.api.onOverlayData(({ image, duration, from, pos, size }) => {
  pic.src = image;

  // Taille du mème (en % de l'écran)
  const s = Math.max(15, Math.min(100, Number(size) || 70));
  pic.style.maxWidth = s + 'vw';
  pic.style.maxHeight = s + 'vh';

  // Position à l'écran (ex : "bottom-right", "top-center", "center-center")
  const [v, h] = String(pos || 'center-center').split('-');
  wrap.style.alignItems = ALIGN[v] || 'center';
  wrap.style.justifyContent = ALIGN[h] || 'center';

  if (from) {
    caption.textContent = '📨 ' + from;
    caption.style.display = 'block';
  }

  requestAnimationFrame(() => frame.classList.add('show'));

  const ms = Math.max(1, Number(duration) || 5) * 1000;
  setTimeout(() => {
    frame.classList.remove('show');
    frame.classList.add('hide');
  }, ms);
});
