const wrap = document.querySelector('.wrap');
const frame = document.getElementById('frame');
const media = document.getElementById('media');
const pic = document.getElementById('pic');
const vid = document.getElementById('vid');
const gdraw = document.getElementById('gdraw');
const gtext = document.getElementById('gtext');
const caption = document.getElementById('caption');

const ALIGN = { top: 'flex-start', center: 'center', bottom: 'flex-end', left: 'flex-start', right: 'flex-end' };

// Rend la couche de texte par-dessus le média (pour les GIF légendés).
function renderTexts(texts) {
  gtext.innerHTML = '';
  if (!texts || !texts.length) return;
  const h = pic.clientHeight || pic.naturalHeight || 0;
  for (const t of texts) {
    const el = document.createElement('div');
    el.className = 'gt';
    el.textContent = t.text || '';
    const fontPx = Math.max(8, ((Number(t.sizePct) || 10) / 100) * h);
    el.style.left = (t.xPct || 50) + '%';
    el.style.top = (t.yPct || 10) + '%';
    el.style.fontSize = fontPx + 'px';
    el.style.color = t.color || '#fff';
    const o = Math.max(1, fontPx / 22);
    el.style.textShadow =
      `${-o}px ${-o}px 0 #000, ${o}px ${-o}px 0 #000, ${-o}px ${o}px 0 #000, ${o}px ${o}px 0 #000, ` +
      `0 ${o}px 0 #000, 0 ${-o}px 0 #000, ${o}px 0 0 #000, ${-o}px 0 0 #000`;
    gtext.appendChild(el);
  }
}

// On reçoit l'image + la durée + le pseudo + la position + la taille + la couche texte.
window.api.onOverlayData(({ image, duration, from, pos, size, opacity, texts, drawing }) => {
  // Transparence du mème (l'image + ses calques ; le pseudo reste opaque)
  media.style.opacity = Math.max(0.15, Math.min(1, (Number(opacity) || 100) / 100));

  // Taille du mème (en % de l'écran)
  const s = Math.max(15, Math.min(100, Number(size) || 70));
  const isVideo = String(image).startsWith('data:video');

  if (isVideo) {
    // Vidéo : jouée avec le son
    pic.style.display = 'none';
    vid.style.display = 'block';
    vid.style.maxWidth = s + 'vw';
    vid.style.maxHeight = s + 'vh';
    vid.src = image;
    vid.play().catch(() => {});
  } else {
    vid.style.display = 'none';
    pic.style.display = 'block';
    pic.style.maxWidth = s + 'vw';
    pic.style.maxHeight = s + 'vh';
    // Quand l'image (ou le GIF) est chargée, on positionne la couche texte.
    pic.onload = () => requestAnimationFrame(() => renderTexts(texts));
    pic.src = image;
    // Couche de dessin (pinceau) par-dessus le GIF
    if (drawing) {
      gdraw.src = drawing;
      gdraw.style.display = 'block';
    }
  }

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
