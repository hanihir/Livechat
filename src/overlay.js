const pic = document.getElementById('pic');

// On reçoit l'image + la durée, on l'affiche avec un petit effet d'apparition.
window.api.onOverlayData(({ image, duration }) => {
  pic.src = image;
  requestAnimationFrame(() => pic.classList.add('show'));

  const ms = Math.max(1, Number(duration) || 5) * 1000;
  // Fondu de sortie juste avant que la fenêtre se ferme (gérée côté Electron)
  setTimeout(() => {
    pic.classList.remove('show');
    pic.classList.add('hide');
  }, ms);
});
