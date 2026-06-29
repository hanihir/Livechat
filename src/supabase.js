// Connexion à la base Supabase (partagée entre tous les amis) :
// historique des mèmes, notes 5 étoiles, classement.
//
// >>> À REMPLIR avec tes infos Supabase <<<
//   - SUPABASE_URL  : le "Project URL"  (ex : https://abcd1234.supabase.co)
//   - SUPABASE_ANON : la clé "anon public"
const SUPABASE_URL = 'https://kydghjlftojfenxmjgal.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZGdoamxmdG9qZmVueG1qZ2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDYzMDAsImV4cCI6MjA5ODMyMjMwMH0.B6qzImrq4MOcBv8WJiPDxLFI1z4b5Ajp6qxAIAiG-MA';

window.SB = {
  configured() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON);
  },

  async _req(path, { method = 'GET', body, prefer } = {}) {
    const headers = {
      apikey: SUPABASE_ANON,
      Authorization: 'Bearer ' + SUPABASE_ANON,
      'Content-Type': 'application/json',
    };
    if (prefer) headers.Prefer = prefer;
    return window.api.httpRequest({
      url: SUPABASE_URL + '/rest/v1/' + path,
      method,
      headers,
      body,
    });
  },

  // Enregistre un mème envoyé dans l'historique partagé.
  async addMeme(author, thumb) {
    if (!this.configured()) return;
    try {
      await this._req('memes', {
        method: 'POST',
        prefer: 'return=minimal',
        body: { author, thumb },
      });
    } catch (e) { /* silencieux : l'historique ne doit jamais bloquer un envoi */ }
  },

  // Derniers mèmes envoyés (les plus récents d'abord).
  async getMemes(limit = 60) {
    const res = await this._req(
      'memes?select=id,created_at,author,thumb&order=created_at.desc&limit=' + limit
    );
    return res.json || [];
  },

  // Toutes les notes (pour calculer les moyennes + le classement).
  async getRatings() {
    const res = await this._req('ratings?select=meme_id,voter,stars');
    return res.json || [];
  },

  // Pose ou met à jour MA note (1 à 5) pour un mème.
  async rate(memeId, voter, stars) {
    return this._req('ratings?on_conflict=meme_id,voter', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { meme_id: memeId, voter, stars },
    });
  },
};
