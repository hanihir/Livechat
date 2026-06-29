// Historique des mèmes + notes 5 étoiles + classement (compétition entre amis).
// Expose window.openHistory().
(function () {
  const overlay = document.getElementById('histOverlay');
  const closeBtn = document.getElementById('histClose');
  const tabHist = document.getElementById('tabHist');
  const tabBoard = document.getElementById('tabBoard');
  const status = document.getElementById('histStatus');
  const body = document.getElementById('histBody');

  let mode = 'hist';

  window.openHistory = function () {
    overlay.hidden = false;
    setMode('hist');
  };
  function close() { overlay.hidden = true; }
  closeBtn.addEventListener('click', close);
  tabHist.addEventListener('click', () => setMode('hist'));
  tabBoard.addEventListener('click', () => setMode('board'));

  function me() { return localStorage.getItem('name') || 'Anonyme'; }

  function timeAgo(iso) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'à l\'instant';
    if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
    return 'il y a ' + Math.floor(s / 86400) + ' j';
  }

  async function setMode(m) {
    mode = m;
    tabHist.classList.toggle('active', m === 'hist');
    tabBoard.classList.toggle('active', m === 'board');
    body.innerHTML = '';

    if (!window.SB || !window.SB.configured()) {
      status.textContent = '⚠️ Base de données pas encore configurée.';
      return;
    }
    status.textContent = 'Chargement…';
    let memes, ratings;
    try {
      [memes, ratings] = await Promise.all([window.SB.getMemes(), window.SB.getRatings()]);
    } catch (e) {
      status.textContent = 'Erreur de connexion à la base.';
      return;
    }

    // Moyenne par mème + ma note
    const byMeme = {};
    for (const r of ratings) {
      const o = byMeme[r.meme_id] || (byMeme[r.meme_id] = { sum: 0, count: 0, mine: 0 });
      o.sum += r.stars;
      o.count++;
      if (r.voter === me()) o.mine = r.stars;
    }

    if (m === 'hist') renderHist(memes, byMeme);
    else renderBoard(memes, byMeme);
  }

  function renderHist(memes, byMeme) {
    status.textContent = memes.length ? memes.length + ' mèmes' : 'Aucun mème pour l\'instant — envoies-en un !';
    body.innerHTML = '';
    for (const mm of memes) {
      const o = byMeme[mm.id] || { sum: 0, count: 0, mine: 0 };
      const avg = o.count ? (o.sum / o.count) : 0;

      const item = document.createElement('div');
      item.className = 'hist-item';

      const img = document.createElement('img');
      img.src = mm.thumb;
      img.className = 'hist-thumb';
      item.appendChild(img);

      const info = document.createElement('div');
      info.className = 'hist-info';
      const head = document.createElement('div');
      head.className = 'hist-head';
      head.textContent = (mm.author || 'Anonyme') + ' · ' + timeAgo(mm.created_at);
      info.appendChild(head);

      info.appendChild(buildStars(mm.id, o.mine));

      const avgLine = document.createElement('div');
      avgLine.className = 'hist-avg';
      avgLine.textContent = o.count
        ? '⭐ ' + avg.toFixed(1) + ' (' + o.count + ' vote' + (o.count > 1 ? 's' : '') + ')'
        : 'Pas encore de note';
      info.appendChild(avgLine);

      item.appendChild(info);
      body.appendChild(item);
    }
  }

  function buildStars(memeId, mine) {
    const wrap = document.createElement('div');
    wrap.className = 'stars';
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement('span');
      s.className = 'star' + (i <= mine ? ' on' : '');
      s.textContent = i <= mine ? '★' : '☆';
      s.addEventListener('click', () => doRate(memeId, i));
      wrap.appendChild(s);
    }
    return wrap;
  }

  async function doRate(memeId, stars) {
    try {
      await window.SB.rate(memeId, me(), stars);
    } catch (e) { /* ignore */ }
    setMode(mode); // recharge pour montrer la nouvelle note + moyenne
  }

  function renderBoard(memes, byMeme) {
    // Agrège par auteur : total d'étoiles reçues / nombre de votes / nombre de mèmes.
    const authors = {};
    for (const mm of memes) {
      const a = authors[mm.author] || (authors[mm.author] = { stars: 0, votes: 0, memes: 0 });
      a.memes++;
      const o = byMeme[mm.id];
      if (o) { a.stars += o.sum; a.votes += o.count; }
    }
    const rows = Object.keys(authors)
      .map((name) => ({
        name,
        memes: authors[name].memes,
        votes: authors[name].votes,
        avg: authors[name].votes ? authors[name].stars / authors[name].votes : 0,
      }))
      .filter((r) => r.votes > 0)
      .sort((a, b) => b.avg - a.avg);

    status.textContent = rows.length ? '🏆 Classement (note moyenne reçue)' : 'Aucune note encore — note des mèmes pour lancer la compétition !';
    body.innerHTML = '';
    const medals = ['👑', '🥈', '🥉'];
    rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'board-row' + (i === 0 ? ' first' : '');
      const rank = document.createElement('div');
      rank.className = 'board-rank';
      rank.textContent = medals[i] || '#' + (i + 1);
      const name = document.createElement('div');
      name.className = 'board-name';
      name.textContent = r.name;
      const score = document.createElement('div');
      score.className = 'board-score';
      score.textContent = '⭐ ' + r.avg.toFixed(2);
      const sub = document.createElement('div');
      sub.className = 'board-sub';
      sub.textContent = r.memes + ' mème' + (r.memes > 1 ? 's' : '') + ' · ' + r.votes + ' vote' + (r.votes > 1 ? 's' : '');
      const right = document.createElement('div');
      right.appendChild(score);
      right.appendChild(sub);
      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(right);
      body.appendChild(row);
    });
  }
})();
