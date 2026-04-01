/* ── PAF Wambrechies – Application principale ─────────────────────────────
   Vanilla JS + Supabase backend
   Sections : actus · annuaire · offres · boîte à idées · calendrier
──────────────────────────────────────────────────────────────────────────── */

/* ============================================================
   SUPABASE CLIENT
   ============================================================ */
const SUPABASE_URL = 'https://ancwbfyjzaebxahtlqkm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jCDrtwqzqjbsq0NEIwUbPQ_EFeoFaDh';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null; // { prenom, nom } depuis la table profiles
let isAdmin = false;
let appInitialized = false;

/* ============================================================
   HELPERS
   ============================================================ */
const MONTHS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS_FR[m - 1]} ${y}`;
}

function formatDateShort(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return { day: d, month: MONTHS_FR[m - 1].slice(0, 3) };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function showToast(msg, type) {
  let toast = document.getElementById('paf-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'paf-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ' toast-' + type : '');
  void toast.offsetWidth;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ============================================================
   AUTH
   ============================================================ */
function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function loadProfile() {
  if (!currentUser) return;
  const { data } = await sb.from('profiles').select('prenom, nom, role').eq('id', currentUser.id).single();
  currentProfile = data || null;
  isAdmin = data?.role === 'admin';
}

async function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  await loadProfile();
  if (isAdmin) {
    document.getElementById('nav-admin').classList.remove('hidden');
    document.querySelector('.bottom-nav').classList.add('admin-mode');
  }
  initApp();
}

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
  } else {
    showAuthScreen();
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (session) {
      currentUser = session.user;
      showApp();
    } else {
      currentUser = null;
      appInitialized = false;
      showAuthScreen();
    }
  });

  const form = document.getElementById('auth-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit');
    const errorEl  = document.getElementById('auth-error');

    errorEl.classList.add('hidden');
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion…';

    const { error } = await sb.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';

    if (error) {
      let msg = 'Erreur de connexion. Vérifiez vos identifiants.';
      if (error.message && error.message.toLowerCase().includes('invalid')) {
        msg = 'Email ou mot de passe incorrect.';
      } else if (error.message && error.message.toLowerCase().includes('email')) {
        msg = 'Adresse email invalide.';
      }
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    }
  });
}

async function logout() {
  await sb.auth.signOut();
  appInitialized = false;
}
window.logout = logout;

/* ============================================================
   NAVIGATION
   ============================================================ */
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const section = document.getElementById('section-' + id);
  if (section) section.classList.add('active');

  const btn = document.querySelector(`.nav-item[data-section="${id}"]`);
  if (btn) btn.classList.add('active');

  document.getElementById('main').scrollTop = 0;
  if (id === 'admin' && isAdmin) loadAdminSub();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});

/* ============================================================
   ACTUS
   ============================================================ */
const ACTU_CAT_CLASS = {
  'Actu Asso':    'badge-cat-asso',
  'Infos pratiques': 'badge-cat-infos',
  'Événement':    'badge-cat-event',
  'Partenaire':   'badge-cat-partenaire',
};
function actuBadgeClass(cat) {
  return ACTU_CAT_CLASS[cat] || 'badge-cat-default';
}

async function renderActus() {
  const container = document.getElementById('actus-list');
  container.innerHTML = '<div class="loading">Chargement…</div>';

  const { data, error } = await sb.from('actus').select('*').order('date', { ascending: false });

  if (error) {
    container.innerHTML = '<div class="empty-state">Impossible de charger les actualités.</div>';
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state">Aucune actualité pour le moment.</div>';
    return;
  }

  container.innerHTML = data.map(a => `
    <div class="actu-card">
      <div class="actu-header" onclick="toggleActu(${a.id})">
        <div class="actu-meta">
          <span class="badge ${actuBadgeClass(a.categorie)}">${escHtml(a.categorie)}</span>
          <span class="actu-date">${formatDate(a.date)}</span>
        </div>
        <div class="actu-title">${escHtml(a.titre)}</div>
        <button class="actu-expand-btn" id="btn-actu-${a.id}" aria-expanded="false">
          Lire la suite
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
      <div class="actu-body" id="body-actu-${a.id}">${escHtml(a.contenu || '')}</div>
    </div>
  `).join('');
}

function toggleActu(id) {
  const body = document.getElementById('body-actu-' + id);
  const btn  = document.getElementById('btn-actu-' + id);
  const open = body.classList.toggle('open');
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', open);
  for (const node of btn.childNodes) {
    if (node.nodeType === 3) { node.textContent = open ? 'Réduire ' : 'Lire la suite '; break; }
  }
}
window.toggleActu = toggleActu;

/* ============================================================
   ANNUAIRE
   ============================================================ */
const CATEGORIES_ANNUAIRE = ['Tous', 'Commerçant', 'Restauration', 'Services'];
let annuaireFilter = 'Tous';
let annuaireSearch = '';
let annuaireData = [];

function renderAnnuaireCats() {
  const container = document.getElementById('annuaire-cats');
  container.innerHTML = CATEGORIES_ANNUAIRE.map(cat => `
    <button class="chip ${cat === annuaireFilter ? 'active' : ''}" onclick="setAnnuaireCat('${escHtml(cat)}')">${escHtml(cat)}</button>
  `).join('');
}

function setAnnuaireCat(cat) {
  annuaireFilter = cat;
  renderAnnuaireCats();
  renderAnnuaireList();
}
window.setAnnuaireCat = setAnnuaireCat;

function renderAnnuaireList() {
  const container = document.getElementById('annuaire-list');
  const q = annuaireSearch.toLowerCase().trim();

  const filtered = annuaireData.filter(m => {
    const matchCat = annuaireFilter === 'Tous' || m.categorie === annuaireFilter;
    const fullName = [m.prenom_contact, m.nom_contact, m.nom_entreprise].filter(Boolean).join(' ').toLowerCase();
    const matchQ   = !q || fullName.includes(q) || (m.description || '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (!filtered.length) {
    container.innerHTML = '<p class="empty-state">Aucun résultat trouvé.</p>';
    return;
  }

  container.innerHTML = filtered.map(m => {
    const initial = (m.nom_entreprise || m.prenom_contact || '?').charAt(0).toUpperCase();
    const contact = [m.prenom_contact, m.nom_contact].filter(Boolean).join(' ');
    return `
    <div class="merchant-card" onclick="openMerchantModal(${m.id})">
      ${m.photo_url
        ? `<img src="${escHtml(m.photo_url)}" class="merchant-photo" alt="${escHtml(m.nom_entreprise || '')}" loading="lazy" />`
        : `<div class="merchant-photo-placeholder">${escHtml(initial)}</div>`
      }
      <div class="merchant-body">
        <div class="merchant-name">${escHtml(m.nom_entreprise || contact)}</div>
        ${contact && m.nom_entreprise ? `<div class="merchant-contact">${escHtml(contact)}</div>` : ''}
        <span class="badge badge-muted">${escHtml(m.categorie)}</span>
      </div>
    </div>`;
  }).join('');
}

function openMerchantModal(id) {
  const m = annuaireData.find(x => x.id === id);
  if (!m) return;
  const contact = [m.prenom_contact, m.nom_contact].filter(Boolean).join(' ');
  const initial = (m.nom_entreprise || m.prenom_contact || '?').charAt(0).toUpperCase();
  const content = document.getElementById('merchant-modal-content');
  content.innerHTML = `
    ${m.photo_url
      ? `<img src="${escHtml(m.photo_url)}" class="modal-photo" alt="${escHtml(m.nom_entreprise || '')}" />`
      : `<div class="modal-photo-placeholder">${escHtml(initial)}</div>`}
    <div class="modal-body">
      <span class="badge badge-muted">${escHtml(m.categorie)}</span>
      <h2 class="modal-name">${escHtml(m.nom_entreprise || contact)}</h2>
      ${contact ? `<p class="modal-contact-name">${escHtml(contact)}</p>` : ''}
      ${m.description ? `<p class="modal-desc">${escHtml(m.description)}</p>` : ''}
      <div class="modal-contacts">
        ${m.adresse   ? `<div class="modal-contact"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${escHtml(m.adresse)}</div>` : ''}
        ${m.telephone ? `<a class="modal-contact modal-contact-link" href="tel:${escHtml(m.telephone.replace(/\s/g,''))}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${escHtml(m.telephone)}</a>` : ''}
        ${m.email     ? `<a class="modal-contact modal-contact-link" href="mailto:${escHtml(m.email)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>${escHtml(m.email)}</a>` : ''}
        ${m.linkedin  ? `<a class="modal-contact modal-contact-link" href="${escHtml(m.linkedin)}" target="_blank" rel="noopener"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>LinkedIn</a>` : ''}
        ${m.instagram ? `<a class="modal-contact modal-contact-link" href="https://instagram.com/${escHtml(m.instagram.replace('@',''))}" target="_blank" rel="noopener"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>${escHtml(m.instagram)}</a>` : ''}
      </div>
    </div>`;
  document.getElementById('merchant-modal').classList.remove('hidden');
}
window.openMerchantModal = openMerchantModal;

function closeMerchantModal() {
  document.getElementById('merchant-modal').classList.add('hidden');
}
window.closeMerchantModal = closeMerchantModal;

async function initAnnuaire() {
  const { data, error } = await sb.from('annuaire').select('*').order('nom_entreprise');
  if (!error && data) annuaireData = data;
  renderAnnuaireCats();
  renderAnnuaireList();

  document.getElementById('annuaire-search').addEventListener('input', e => {
    annuaireSearch = e.target.value;
    renderAnnuaireList();
  });
}

/* ============================================================
   OFFRES
   ============================================================ */
const CATEGORIES_OFFRES = ['Tous', 'Particulier', 'Professionnel'];
let offresFilter = 'Tous';
let offresData   = [];

function renderOffresCats() {
  const el = document.getElementById('offres-cats');
  if (!el) return;
  el.innerHTML = CATEGORIES_OFFRES.map(cat => `
    <button class="chip ${cat === offresFilter ? 'active' : ''}" onclick="setOffresCat('${escHtml(cat)}')">${escHtml(cat)}</button>
  `).join('');
}

function setOffresCat(cat) {
  offresFilter = cat;
  renderOffresCats();
  renderOffresList();
}
window.setOffresCat = setOffresCat;

function renderOffresList() {
  const container = document.getElementById('offres-list');
  const filtered  = offresFilter === 'Tous' ? offresData : offresData.filter(o => o.categorie === offresFilter);

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state">Aucune offre dans cette catégorie.</div>';
    return;
  }

  container.innerHTML = filtered.map(o => `
    <div class="offer-card">
      <div class="offer-inner">
        <div class="offer-merchant">${escHtml(o.commercant)}</div>
        <div class="offer-title">${escHtml(o.titre)}</div>
        <div class="offer-desc">${escHtml(o.description || '')}</div>
        <div class="offer-footer">
          <div class="offer-expiry">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Valable jusqu'au ${formatDate(o.expiration)}
          </div>
          <span class="offer-tag">${escHtml(o.tag || '')}</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function renderOffres() {
  const container = document.getElementById('offres-list');
  container.innerHTML = '<div class="loading">Chargement…</div>';

  const { data, error } = await sb.from('offres').select('*').order('expiration');

  if (error) { container.innerHTML = '<div class="empty-state">Impossible de charger les offres.</div>'; return; }
  if (!data?.length) { container.innerHTML = '<div class="empty-state">Aucune offre pour le moment.</div>'; return; }

  offresData = data;
  renderOffresCats();
  renderOffresList();
}

/* ============================================================
   BOÎTE À IDÉES
   ============================================================ */
async function renderIdeesList() {
  const container = document.getElementById('ideas-list');

  const { data, error } = await sb
    .from('idees')
    .select('*, idees_likes(count), idees_commentaires(id, prenom, texte, created_at)')
    .eq('visible', true)
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<div class="empty-state">Impossible de charger les idées.</div>';
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state">Aucune idée pour le moment. Soyez le premier !</div>';
    return;
  }

  container.innerHTML = data.map(idea => {
    const likeCount    = idea.idees_likes && idea.idees_likes[0] ? (idea.idees_likes[0].count || 0) : 0;
    const comments     = idea.idees_commentaires || [];
    const commentCount = comments.length;
    const dateLabel    = idea.created_at
      ? new Date(idea.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    const commentsHtml = comments.map(c => `
      <div class="comment">
        <span class="comment-author">${escHtml(c.prenom || 'Anonyme')}</span>
        <span class="comment-text">${escHtml(c.texte)}</span>
      </div>
    `).join('');

    return `
      <div class="idea-card" id="idea-card-${idea.id}">
        <div class="idea-card-meta">
          <span class="idea-card-author">${escHtml(idea.prenom || 'Anonyme')}</span>
          <span class="badge badge-muted">${escHtml(idea.categorie)}</span>
          <span class="idea-card-date">${dateLabel}</span>
        </div>
        ${idea.titre ? `<div class="idea-card-title">${escHtml(idea.titre)}</div>` : ''}
        <div class="idea-card-text">${escHtml(idea.texte)}</div>
        <div class="idea-actions">
          <button class="idea-like-btn" id="like-btn-${idea.id}" onclick="toggleLike(${idea.id})" aria-label="J'aime">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span id="like-count-${idea.id}">${likeCount}</span>
          </button>
          <button class="idea-comment-toggle" onclick="toggleComments(${idea.id})" aria-label="Commentaires">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${commentCount}</span>
          </button>
        </div>
        <div class="idea-comments hidden" id="comments-${idea.id}">
          <div id="comments-list-${idea.id}">${commentsHtml}</div>
          <form class="comment-form" onsubmit="addComment(event, ${idea.id})">
            <input type="text" class="comment-input" id="comment-input-${idea.id}" placeholder="Ajouter un commentaire…" autocomplete="off" />
            <button type="submit" class="comment-submit" aria-label="Envoyer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </form>
        </div>
      </div>
    `;
  }).join('');

  // Check own likes
  const ideeIds = data.map(i => i.id);
  checkOwnLikes(ideeIds);
}

async function checkOwnLikes(ideeIds) {
  if (!currentUser || !ideeIds.length) return;
  const { data, error } = await sb
    .from('idees_likes')
    .select('idee_id')
    .eq('user_id', currentUser.id)
    .in('idee_id', ideeIds);

  if (error || !data) return;

  data.forEach(row => {
    const btn = document.getElementById('like-btn-' + row.idee_id);
    if (btn) btn.classList.add('liked');
  });
}

async function toggleLike(ideeId) {
  if (!currentUser) return;

  const btn = document.getElementById('like-btn-' + ideeId);
  const countEl = document.getElementById('like-count-' + ideeId);
  const isLiked = btn && btn.classList.contains('liked');

  // Optimistic UI
  if (btn) btn.classList.toggle('liked', !isLiked);
  if (countEl) {
    const current = parseInt(countEl.textContent, 10) || 0;
    countEl.textContent = isLiked ? Math.max(0, current - 1) : current + 1;
  }

  if (isLiked) {
    const { error } = await sb
      .from('idees_likes')
      .delete()
      .eq('idee_id', ideeId)
      .eq('user_id', currentUser.id);
    if (error) {
      if (btn) btn.classList.toggle('liked', true);
      if (countEl) countEl.textContent = parseInt(countEl.textContent, 10) + 1;
    }
  } else {
    const { error } = await sb
      .from('idees_likes')
      .insert({ idee_id: ideeId, user_id: currentUser.id });
    if (error) {
      if (btn) btn.classList.toggle('liked', false);
      if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent, 10) - 1);
    }
  }
}
window.toggleLike = toggleLike;

function toggleComments(ideeId) {
  const div = document.getElementById('comments-' + ideeId);
  if (div) div.classList.toggle('hidden');
}
window.toggleComments = toggleComments;

async function addComment(e, ideeId) {
  e.preventDefault();
  if (!currentUser) return;

  const input = document.getElementById('comment-input-' + ideeId);
  const texte = input ? input.value.trim() : '';
  if (!texte) return;

  const prenom = [currentProfile?.prenom, currentProfile?.nom].filter(Boolean).join(' - ') || currentUser.email?.split('@')[0] || 'Anonyme';

  const { error } = await sb.from('idees_commentaires').insert({
    idee_id: ideeId,
    user_id: currentUser.id,
    prenom,
    texte
  });

  if (error) {
    showToast('Erreur lors de l\'envoi du commentaire.', 'error');
    return;
  }

  if (input) input.value = '';

  // Append dans le DOM sans re-render
  const listEl = document.getElementById('comments-list-' + ideeId);
  if (listEl) {
    const div = document.createElement('div');
    div.className = 'comment';
    div.innerHTML = `<span class="comment-author">${escHtml(prenom)}</span><span class="comment-text">${escHtml(texte)}</span>`;
    listEl.appendChild(div);
  }

  // Incrémenter le compteur
  const card = document.getElementById('idea-card-' + ideeId);
  if (card) {
    const countSpan = card.querySelector('.idea-comment-toggle span');
    if (countSpan) countSpan.textContent = parseInt(countSpan.textContent, 10) + 1;
  }
}
window.addComment = addComment;

// Mise à jour ciblée du compteur de likes (sans re-render)
function handleLikeChange(payload) {
  const ideeId = payload.new?.idee_id || payload.old?.idee_id;
  if (!ideeId) return;
  const countEl = document.getElementById('like-count-' + ideeId);
  if (!countEl) return;
  // Ignorer les événements de l'utilisateur courant (déjà géré par l'UI optimiste)
  const eventUserId = payload.new?.user_id || payload.old?.user_id;
  if (eventUserId === currentUser?.id) return;
  const current = parseInt(countEl.textContent, 10) || 0;
  if (payload.eventType === 'INSERT') countEl.textContent = current + 1;
  else if (payload.eventType === 'DELETE') countEl.textContent = Math.max(0, current - 1);
}

// Append ciblé d'un commentaire (sans re-render)
function handleCommentChange(payload) {
  const ideeId = payload.new?.idee_id;
  if (!ideeId) return;
  // Ignorer ses propres commentaires (déjà ajoutés dans addComment)
  if (payload.new?.user_id === currentUser?.id) return;
  const listEl = document.getElementById('comments-list-' + ideeId);
  if (listEl) {
    const div = document.createElement('div');
    div.className = 'comment';
    div.innerHTML = `<span class="comment-author">${escHtml(payload.new.prenom || 'Anonyme')}</span><span class="comment-text">${escHtml(payload.new.texte)}</span>`;
    listEl.appendChild(div);
  }
  // Incrémenter le compteur de commentaires
  const card = document.getElementById('idea-card-' + ideeId);
  if (card) {
    const countSpan = card.querySelector('.idea-comment-toggle span');
    if (countSpan) countSpan.textContent = parseInt(countSpan.textContent, 10) + 1;
  }
}

function toggleIdeaForm() {
  const card = document.getElementById('idea-form-card');
  card.classList.toggle('hidden');
  if (!card.classList.contains('hidden')) {
    document.getElementById('idea-text').focus();
  }
}
window.toggleIdeaForm = toggleIdeaForm;

function initIdees() {
  renderIdeesList();

  sb.channel('paf-idees')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'idees' }, () => {
      renderIdeesList();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'idees_likes' }, (payload) => {
      handleLikeChange(payload);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'idees_commentaires' }, (payload) => {
      handleCommentChange(payload);
    })
    .subscribe();

  document.getElementById('idea-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const titre = document.getElementById('idea-titre').value.trim();
    if (!titre) { document.getElementById('idea-titre').focus(); return; }
    const texte = document.getElementById('idea-text').value.trim();
    if (!texte) { document.getElementById('idea-text').focus(); return; }

    const categorie = document.getElementById('idea-cat').value;
    const prenom = [currentProfile?.prenom, currentProfile?.nom].filter(Boolean).join(' - ')
                   || currentUser.email?.split('@')[0] || 'Anonyme';

    const { error } = await sb.from('idees').insert({
      user_id: currentUser.id,
      prenom,
      categorie,
      titre,
      texte
    });

    if (error) { showToast('Erreur lors de l\'enregistrement de l\'idée.', 'error'); return; }

    document.getElementById('idea-form').reset();
    document.getElementById('idea-form-card').classList.add('hidden');
    const successEl = document.getElementById('idea-success');
    successEl.classList.remove('hidden');
    setTimeout(() => successEl.classList.add('hidden'), 3000);
    renderIdeesList();
  });
}

/* ============================================================
   CALENDRIER
   ============================================================ */
let calYear        = 2026;
let calMonth       = 3;
let calSelectedDay = null;
let calEventsData  = [];

const today = new Date();

function getEventsForDate(y, m, d) {
  const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return calEventsData.filter(e => e.date === dateStr);
}

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  label.textContent = `${MONTHS_FR[calMonth]} ${calYear}`;

  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(calYear, calMonth, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();

  const cells = [];

  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, month: calMonth - 1, year: calYear, otherMonth: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: calMonth, year: calYear, otherMonth: false });
  }
  const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, month: calMonth + 1, year: calYear, otherMonth: true });
  }

  grid.innerHTML = cells.map(cell => {
    const isToday = !cell.otherMonth
      && cell.day === today.getDate()
      && cell.month === today.getMonth()
      && cell.year === today.getFullYear();
    const isSelected = !cell.otherMonth && calSelectedDay === cell.day;
    const hasEvent   = !cell.otherMonth && getEventsForDate(cell.year, cell.month, cell.day).length > 0;

    const cls = [
      'cal-day',
      cell.otherMonth ? 'other-month' : '',
      isToday         ? 'today'        : '',
      isSelected      ? 'selected'     : '',
      hasEvent        ? 'has-event'    : ''
    ].filter(Boolean).join(' ');

    const onclick = cell.otherMonth ? '' : `onclick="selectCalDay(${cell.day})"`;
    return `<div class="${cls}" ${onclick}>${cell.day}</div>`;
  }).join('');

  renderCalEventsPanel();
  renderUpcomingEvents();
}

function selectCalDay(day) {
  calSelectedDay = calSelectedDay === day ? null : day;
  renderCalendar();
}
window.selectCalDay = selectCalDay;

function renderCalEventsPanel() {
  const panel = document.getElementById('cal-events-panel');
  if (!calSelectedDay) {
    panel.classList.add('hidden');
    return;
  }
  const events    = getEventsForDate(calYear, calMonth, calSelectedDay);
  const dateLabel = `${calSelectedDay} ${MONTHS_FR[calMonth]} ${calYear}`;
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="cal-events-panel-title">${dateLabel}</div>
    ${events.length
      ? events.map(ev => `
          <div class="cal-event-item">
            <div class="cal-event-dot"></div>
            <div class="cal-event-info">
              <div class="cal-event-name">${escHtml(ev.titre)}</div>
              <div class="cal-event-meta">${escHtml(ev.heure || '')} · ${escHtml(ev.lieu || '')}</div>
            </div>
          </div>
        `).join('')
      : '<div class="no-event-msg">Aucun événement ce jour.</div>'
    }
  `;
}

function renderUpcomingEvents() {
  const container = document.getElementById('cal-upcoming');
  const upcoming  = calEventsData
    .filter(ev => {
      const [y, m, d] = ev.date.split('-').map(Number);
      return new Date(y, m - 1, d) >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
    })
    .slice(0, 5);

  if (!upcoming.length) {
    container.innerHTML = '<div class="empty-state">Aucun événement à venir.</div>';
    return;
  }

  container.innerHTML = upcoming.map(ev => {
    const { day, month } = formatDateShort(ev.date);
    const evJson = escHtml(JSON.stringify(ev));
    return `
      <div class="event-card">
        <div class="event-date-block">
          <div class="event-date-day">${day}</div>
          <div class="event-date-month">${month}</div>
        </div>
        <div class="event-info">
          <div class="event-name">${escHtml(ev.titre)}</div>
          <div class="event-meta">
            <span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${escHtml(ev.heure || '')}
            </span>
            <span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${escHtml(ev.lieu || '')}
            </span>
          </div>
          <button class="add-to-cal-btn" onclick="addToCalendar(${ev.id})" aria-label="Ajouter à mon agenda">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
            Ajouter à mon agenda
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function addToCalendar(evId) {
  const ev = calEventsData.find(e => e.id === evId);
  if (!ev) return;
  const dateStr = ev.date.replace(/-/g, '');
  // Parse start/end time from "HH:MM – HH:MM"
  let dtStart = dateStr, dtEnd = dateStr;
  const timeMatch = (ev.heure || '').match(/(\d{2}):(\d{2})/g);
  if (timeMatch?.length >= 1) dtStart = `${dateStr}T${timeMatch[0].replace(':','')}00`;
  if (timeMatch?.length >= 2) dtEnd   = `${dateStr}T${timeMatch[1].replace(':','')}00`;
  else if (timeMatch?.length === 1) dtEnd = dtStart;

  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PAF Wambrechies//FR',
    'BEGIN:VEVENT',
    `UID:paf-${ev.id}@paf-wambrechies`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${ev.titre}`,
    `DESCRIPTION:${(ev.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${ev.lieu || ''}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `${ev.titre.replace(/\s+/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Événement téléchargé — ouvrez le fichier pour l\'ajouter à votre agenda.', 'success');
}
window.addToCalendar = addToCalendar;

async function loadCalendarEvents() {
  const { data, error } = await sb.from('evenements').select('*').order('date');
  if (!error && data) {
    calEventsData = data;
  }
  renderCalendar();
}

function initCalendar() {
  calYear  = today.getFullYear();
  calMonth = today.getMonth();

  document.getElementById('cal-prev').addEventListener('click', () => {
    if (calMonth === 0) { calMonth = 11; calYear--; } else { calMonth--; }
    calSelectedDay = null;
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    if (calMonth === 11) { calMonth = 0; calYear++; } else { calMonth++; }
    calSelectedDay = null;
    renderCalendar();
  });

  loadCalendarEvents();
}

/* ============================================================
   PUSH NOTIFICATIONS
   ============================================================ */
async function requestPushPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    showToast('Les notifications ne sont pas supportées sur cet appareil.', 'error');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    showToast('Notifications activées !', 'success');
    await subscribeToPush();
  } else {
    showToast('Notifications refusées.', 'error');
  }
}
window.requestPushPermission = requestPushPermission;

async function subscribeToPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: null
    });
    if (!sub || !currentUser) return;
    const json = sub.toJSON();
    await sb.from('push_subscriptions').upsert({
      user_id:  currentUser.id,
      endpoint: json.endpoint,
      p256dh:   json.keys?.p256dh  || null,
      auth:     json.keys?.auth    || null
    }, { onConflict: 'user_id,endpoint' });
  } catch (_) { /* push not supported or VAPID not configured */ }
}

/* ============================================================
   INIT
   ============================================================ */
function initApp() {
  if (appInitialized) return;
  appInitialized = true;
  renderActus();
  initAnnuaire();
  renderOffres();
  initIdees();
  initCalendar();
  showSection('actus');
}

/* ============================================================
   ADMIN
   ============================================================ */
let adminSub = 'actus';

window.showAdminSub = function(sub) {
  adminSub = sub;
  document.querySelectorAll('.admin-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.sub === sub)
  );
  loadAdminSub();
};

window.toggleAdminForm = function(formId) {
  const el = document.getElementById(formId);
  if (el) el.classList.toggle('hidden');
};

window.adminDeleteItem = async function(table, id) {
  if (!confirm('Supprimer cet élément définitivement ?')) return;
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) { showToast('Erreur lors de la suppression.', 'error'); return; }
  showToast('Supprimé.', 'success');
  loadAdminSub();
};

window.adminToggleVisible = async function(id, current) {
  const { error } = await sb.from('idees').update({ visible: !current }).eq('id', id);
  if (error) { showToast('Erreur.', 'error'); return; }
  loadAdminSub();
};

async function loadAdminSub() {
  const el = document.getElementById('admin-content');
  if (!el) return;
  el.innerHTML = '<div class="loading">Chargement…</div>';
  switch (adminSub) {
    case 'actus':    await renderAdminActus(el);    break;
    case 'offres':   await renderAdminOffres(el);   break;
    case 'events':   await renderAdminEvents(el);   break;
    case 'annuaire': await renderAdminAnnuaire(el); break;
    case 'idees':    await renderAdminIdees(el);    break;
  }
}

async function renderAdminActus(el) {
  const { data = [] } = await sb.from('actus').select('id, titre, date, categorie').order('date', { ascending: false });
  el.innerHTML = `
    <button class="btn-new-idea" style="margin-bottom:12px" onclick="toggleAdminForm('admin-actu-form')">+ Ajouter une actu</button>
    <div id="admin-actu-form" class="card hidden" style="margin-bottom:12px">
      <form id="form-actu">
        <div class="form-group"><label>Titre *</label><input type="text" id="actu-titre" required /></div>
        <div class="form-group"><label>Date *</label><input type="date" id="actu-date" required /></div>
        <div class="form-group"><label>Catégorie *</label>
          <select id="actu-categorie" required>
            <option value="Actu Asso">Actu Asso</option>
            <option value="Infos pratiques">Infos pratiques</option>
            <option value="Événement">Événement</option>
            <option value="Partenaire">Partenaire</option>
          </select>
        </div>
        <div class="form-group"><label>Extrait</label><textarea id="actu-excerpt" rows="2"></textarea></div>
        <div class="form-group"><label>Contenu complet</label><textarea id="actu-contenu" rows="4"></textarea></div>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </form>
    </div>
    <div class="admin-list">
      ${data.length ? data.map(a => `
        <div class="admin-item">
          <div class="admin-item-info">
            <span class="admin-item-title">${escHtml(a.titre)}</span>
            <span class="admin-item-meta">${formatDate(a.date)} · ${escHtml(a.categorie)}</span>
          </div>
          <button class="admin-delete-btn" onclick="adminDeleteItem('actus', ${a.id})">Supprimer</button>
        </div>`).join('') : '<div class="empty-state">Aucune actualité.</div>'}
    </div>`;
  el.querySelector('#form-actu').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.from('actus').insert({
      titre:     document.getElementById('actu-titre').value.trim(),
      date:      document.getElementById('actu-date').value,
      categorie: document.getElementById('actu-categorie').value.trim(),
      excerpt:   document.getElementById('actu-excerpt').value.trim() || null,
      contenu:   document.getElementById('actu-contenu').value.trim() || null,
    });
    if (error) { showToast('Erreur.', 'error'); return; }
    showToast('Actu ajoutée !', 'success');
    loadAdminSub();
  });
}

async function renderAdminOffres(el) {
  const { data = [] } = await sb.from('offres').select('id, titre, commercant, expiration').order('expiration');
  el.innerHTML = `
    <button class="btn-new-idea" style="margin-bottom:12px" onclick="toggleAdminForm('admin-offre-form')">+ Ajouter une offre</button>
    <div id="admin-offre-form" class="card hidden" style="margin-bottom:12px">
      <form id="form-offre">
        <div class="form-group"><label>Commerçant *</label><input type="text" id="offre-commercant" required /></div>
        <div class="form-group"><label>Titre de l'offre *</label><input type="text" id="offre-titre" required /></div>
        <div class="form-group"><label>Description</label><textarea id="offre-description" rows="3"></textarea></div>
        <div class="form-group"><label>Date d'expiration</label><input type="date" id="offre-expiration" /></div>
        <div class="form-group"><label>Tag</label><input type="text" id="offre-tag" placeholder="Ex : -10%, Offert…" /></div>
        <div class="form-group"><label>Catégorie</label>
          <select id="offre-categorie"><option value="Particulier">Particulier</option><option value="Professionnel">Professionnel</option></select>
        </div>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </form>
    </div>
    <div class="admin-list">
      ${data.length ? data.map(o => `
        <div class="admin-item">
          <div class="admin-item-info">
            <span class="admin-item-title">${escHtml(o.titre)}</span>
            <span class="admin-item-meta">${escHtml(o.commercant)}${o.expiration ? ' · ' + formatDate(o.expiration) : ''}</span>
          </div>
          <button class="admin-delete-btn" onclick="adminDeleteItem('offres', ${o.id})">Supprimer</button>
        </div>`).join('') : '<div class="empty-state">Aucune offre.</div>'}
    </div>`;
  el.querySelector('#form-offre').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.from('offres').insert({
      commercant:  document.getElementById('offre-commercant').value.trim(),
      titre:       document.getElementById('offre-titre').value.trim(),
      description: document.getElementById('offre-description').value.trim() || null,
      expiration:  document.getElementById('offre-expiration').value || null,
      tag:         document.getElementById('offre-tag').value.trim() || null,
      categorie:   document.getElementById('offre-categorie').value,
    });
    if (error) { showToast('Erreur.', 'error'); return; }
    showToast('Offre ajoutée !', 'success');
    loadAdminSub();
  });
}

async function renderAdminEvents(el) {
  const { data = [] } = await sb.from('evenements').select('id, titre, date, heure, lieu').order('date');
  el.innerHTML = `
    <button class="btn-new-idea" style="margin-bottom:12px" onclick="toggleAdminForm('admin-event-form')">+ Ajouter un événement</button>
    <div id="admin-event-form" class="card hidden" style="margin-bottom:12px">
      <form id="form-event">
        <div class="form-group"><label>Titre *</label><input type="text" id="event-titre" required /></div>
        <div class="form-group"><label>Date *</label><input type="date" id="event-date" required /></div>
        <div class="form-row-2">
          <div class="form-group"><label>Heure de début</label><input type="time" id="event-heure-debut" value="09:00" /></div>
          <div class="form-group"><label>Heure de fin</label><input type="time" id="event-heure-fin" value="10:00" /></div>
        </div>
        <div class="form-group"><label>Lieu</label><input type="text" id="event-lieu" placeholder="Ex : Salle des fêtes" /></div>
        <div class="form-group"><label>Description</label><textarea id="event-description" rows="3"></textarea></div>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </form>
    </div>
    <div class="admin-list">
      ${data.length ? data.map(ev => `
        <div class="admin-item">
          <div class="admin-item-info">
            <span class="admin-item-title">${escHtml(ev.titre)}</span>
            <span class="admin-item-meta">${formatDate(ev.date)}${ev.heure ? ' · ' + escHtml(ev.heure) : ''}${ev.lieu ? ' · ' + escHtml(ev.lieu) : ''}</span>
          </div>
          <button class="admin-delete-btn" onclick="adminDeleteItem('evenements', ${ev.id})">Supprimer</button>
        </div>`).join('') : '<div class="empty-state">Aucun événement.</div>'}
    </div>`;
  el.querySelector('#event-heure-debut').addEventListener('change', (e) => {
    const [h, m] = e.target.value.split(':').map(Number);
    if (isNaN(h)) return;
    const finH = String((h + 1) % 24).padStart(2, '0');
    const finM = String(m).padStart(2, '0');
    el.querySelector('#event-heure-fin').value = `${finH}:${finM}`;
  });

  el.querySelector('#form-event').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.from('evenements').insert({
      titre:       document.getElementById('event-titre').value.trim(),
      date:        document.getElementById('event-date').value,
      heure:       (() => { const d = document.getElementById('event-heure-debut').value; const f = document.getElementById('event-heure-fin').value; return d && f ? `${d} – ${f}` : d || f || null; })(),
      lieu:        document.getElementById('event-lieu').value.trim() || null,
      description: document.getElementById('event-description').value.trim() || null,
    });
    if (error) { showToast('Erreur.', 'error'); return; }
    showToast('Événement ajouté !', 'success');
    loadAdminSub();
  });
}

async function renderAdminAnnuaire(el) {
  const { data = [] } = await sb.from('annuaire').select('id, nom_entreprise, prenom_contact, nom_contact, categorie, photo_url').order('nom_entreprise');
  el.innerHTML = `
    <button class="btn-new-idea" style="margin-bottom:12px" onclick="toggleAdminForm('admin-ann-form')">+ Ajouter un commerçant</button>
    <div id="admin-ann-form" class="card hidden" style="margin-bottom:12px">
      <form id="form-ann">
        <div class="form-group"><label>Nom de l'entreprise *</label><input type="text" id="ann-nom-entreprise" required /></div>
        <div class="form-group"><label>Prénom du contact</label><input type="text" id="ann-prenom-contact" /></div>
        <div class="form-group"><label>Nom du contact</label><input type="text" id="ann-nom-contact" /></div>
        <div class="form-group"><label>Catégorie *</label>
          <select id="ann-categorie">
            <option value="Commerçant">Commerçant</option>
            <option value="Restauration">Restauration</option>
            <option value="Services">Services</option>
          </select>
        </div>
        <div class="form-group"><label>Adresse</label><input type="text" id="ann-adresse" /></div>
        <div class="form-group"><label>Téléphone</label><input type="tel" id="ann-telephone" /></div>
        <div class="form-group"><label>Email</label><input type="email" id="ann-email" /></div>
        <div class="form-group"><label>LinkedIn</label><input type="url" id="ann-linkedin" placeholder="https://linkedin.com/in/…" /></div>
        <div class="form-group"><label>Instagram</label><input type="text" id="ann-instagram" placeholder="@nomducompte" /></div>
        <div class="form-group"><label>Description</label><textarea id="ann-description" rows="3"></textarea></div>
        <div class="form-group">
          <label>Photo</label>
          <input type="file" id="ann-photo" accept="image/*" />
          <p style="font-size:.76rem;color:var(--text-muted);margin-top:4px">JPG, PNG, WebP – max 2 Mo</p>
        </div>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </form>
    </div>
    <div class="admin-list">
      ${data.length ? data.map(m => `
        <div class="admin-item">
          ${m.photo_url ? `<img src="${escHtml(m.photo_url)}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0" />` : ''}
          <div class="admin-item-info">
            <span class="admin-item-title">${escHtml(m.nom_entreprise || [m.prenom_contact, m.nom_contact].filter(Boolean).join(' '))}</span>
            <span class="admin-item-meta">${[m.prenom_contact, m.nom_contact].filter(Boolean).join(' ')}${m.prenom_contact || m.nom_contact ? ' · ' : ''}${escHtml(m.categorie)}</span>
          </div>
          <button class="admin-delete-btn" onclick="adminDeleteItem('annuaire', ${m.id})">Supprimer</button>
        </div>`).join('') : '<div class="empty-state">Aucun commerçant.</div>'}
    </div>`;
  el.querySelector('#form-ann').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = el.querySelector('#form-ann .btn-primary');
    submitBtn.disabled = true; submitBtn.textContent = 'Enregistrement…';

    let photo_url = null;
    const photoFile = document.getElementById('ann-photo').files[0];
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop().toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await sb.storage.from('annuaire-photos').upload(path, photoFile);
      if (upErr) { showToast('Erreur upload photo : ' + upErr.message, 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Enregistrer'; return; }
      const { data: urlData } = sb.storage.from('annuaire-photos').getPublicUrl(path);
      photo_url = urlData.publicUrl;
    }

    const { error } = await sb.from('annuaire').insert({
      nom_entreprise:  document.getElementById('ann-nom-entreprise').value.trim(),
      prenom_contact:  document.getElementById('ann-prenom-contact').value.trim() || null,
      nom_contact:     document.getElementById('ann-nom-contact').value.trim() || null,
      categorie:       document.getElementById('ann-categorie').value,
      adresse:     document.getElementById('ann-adresse').value.trim() || null,
      telephone:   document.getElementById('ann-telephone').value.trim() || null,
      email:       document.getElementById('ann-email').value.trim() || null,
      linkedin:    document.getElementById('ann-linkedin').value.trim() || null,
      instagram:   document.getElementById('ann-instagram').value.trim() || null,
      description: document.getElementById('ann-description').value.trim() || null,
      photo_url,
    });
    submitBtn.disabled = false; submitBtn.textContent = 'Enregistrer';
    if (error) { showToast('Erreur.', 'error'); return; }
    showToast('Commerçant ajouté !', 'success');
    loadAdminSub();
  });
}

async function renderAdminIdees(el) {
  const { data = [] } = await sb.from('idees')
    .select('id, titre, texte, prenom, visible, created_at')
    .order('created_at', { ascending: false });
  el.innerHTML = `
    <div class="admin-list">
      ${data.length ? data.map(i => `
        <div class="admin-item">
          <div class="admin-item-info">
            <span class="admin-item-title">${escHtml(i.titre || i.texte.substring(0, 40) + (i.texte.length > 40 ? '…' : ''))}</span>
            <span class="admin-item-meta">${escHtml(i.prenom || 'Anonyme')} · <em>${i.visible ? 'Visible' : 'Masquée'}</em></span>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="admin-toggle-btn${i.visible ? '' : ' admin-toggle-hidden'}"
              onclick="adminToggleVisible(${i.id}, ${i.visible})">${i.visible ? 'Masquer' : 'Afficher'}</button>
            <button class="admin-delete-btn" onclick="adminDeleteItem('idees', ${i.id})">Supprimer</button>
          </div>
        </div>`).join('') : '<div class="empty-state">Aucune idée.</div>'}
    </div>`;
}

initAuth();
