// Logique de la fenêtre de sondage (vote + résultats en direct).
const el = (id) => document.getElementById(id);
const title = el('title');
const count = el('count');
const question = el('question');
const optA = el('optA');
const optB = el('optB');

let pollId = null;
let ended = false;
let myVote = null;
let lastA = 0;
let lastB = 0;

window.api.onPollData((d) => {
  pollId = d.pollId;
  title.textContent = '📊 Sondage de ' + (d.from || '?');
  if (d.question) question.textContent = d.question;
  else question.style.display = 'none';
  el('imgA').src = d.imageA;
  el('imgB').src = d.imageB;
  startCountdown(Math.max(5, Number(d.duration) || 15));
});

optA.addEventListener('click', () => vote('A'));
optB.addEventListener('click', () => vote('B'));
el('close').addEventListener('click', () => window.close());

function vote(choice) {
  if (ended) return;
  myVote = choice;
  markMine();
  window.api.castVote({ pollId, choice });
}

function markMine() {
  optA.classList.toggle('mine', myVote === 'A');
  optB.classList.toggle('mine', myVote === 'B');
}

window.api.onPollTally((d) => {
  if (d.pollId !== pollId) return;
  if (d.myVote) { myVote = d.myVote; markMine(); }
  lastA = d.a; lastB = d.b;
  const total = d.a + d.b;
  const pa = total ? Math.round((d.a / total) * 100) : 0;
  const pb = total ? 100 - pa : 0;
  el('barA').style.width = pa + '%';
  el('barB').style.width = pb + '%';
  el('pctA').textContent = pa + '%';
  el('pctB').textContent = pb + '%';
  el('cntA').textContent = d.a;
  el('cntB').textContent = d.b;
  if (ended) showWinner();
});

function startCountdown(secs) {
  let t = secs;
  count.textContent = t + 's';
  const iv = setInterval(() => {
    t--;
    count.textContent = Math.max(0, t) + 's';
    if (t <= 0) {
      clearInterval(iv);
      ended = true;
      count.textContent = 'Terminé';
      el('hint').textContent = 'Résultats finaux 🏆';
      showWinner();
    }
  }, 1000);
}

function showWinner() {
  optA.classList.toggle('win', lastA > lastB && lastA > 0);
  optB.classList.toggle('win', lastB > lastA && lastB > 0);
}
