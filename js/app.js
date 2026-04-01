/* ── PAF Wambrechies – Application principale ─────────────────────────────
   Vanilla JS, no dependencies.
   Sections : actus · annuaire · offres · boîte à idées · calendrier
──────────────────────────────────────────────────────────────────────────── */

/* ============================================================
   DATA
   ============================================================ */
const DATA = {

  actus: [
    {
      id: 1,
      titre: "Braderie de printemps 2026",
      date: "2026-04-12",
      categorie: "Événement",
      excerpt: "La grande braderie printanière revient le 12 avril sur la Grand-Place ! Plus de 50 exposants attendus.",
      contenu: "La braderie de printemps se tiendra le samedi 12 avril de 9 h à 18 h sur la Grand-Place de Wambrechies. Plus de 50 commerçants et artisans seront présents. Au programme : animations musicales en plein air, jeux pour enfants, dégustation de produits locaux et vide-grenier. Venez profiter de cette journée festive avec toute la famille !"
    },
    {
      id: 2,
      titre: "Nouveau parking gratuit rue de la Lys",
      date: "2026-03-20",
      categorie: "Infos pratiques",
      excerpt: "La mairie a inauguré 40 nouvelles places de stationnement gratuites à deux pas du centre-ville.",
      contenu: "Bonne nouvelle pour les commerçants et leurs clients : un nouveau parking gratuit de 40 places a été ouvert rue de la Lys, à moins de 100 mètres de la Grand-Place. Il est accessible 7j/7, 24h/24. Cette initiative fait suite aux demandes répétées de la PAF auprès de la municipalité. Merci à tous les adhérents qui ont soutenu cette démarche !"
    },
    {
      id: 3,
      titre: "Résultats du concours vitrine de Pâques",
      date: "2026-03-28",
      categorie: "Concours",
      excerpt: "Le jury a délibéré ! Découvrez les trois lauréats du concours de décoration de vitrine.",
      contenu: "Le concours de décoration de vitrine sur le thème de Pâques a réuni 18 participants cette année, un record ! Après délibération du jury citoyen, les lauréats sont : 1er prix – Boulangerie Artisanale Leroy ; 2e prix – Fleuriste Les Jardins de Flandre ; 3e prix – Librairie Au Fil des Pages. Félicitations à tous les participants pour leur créativité !"
    },
    {
      id: 4,
      titre: "Compte-rendu de la réunion PAF – mars 2026",
      date: "2026-03-15",
      categorie: "Association",
      excerpt: "Retour sur les décisions prises lors de la réunion mensuelle : budget événements, communication digitale et agenda.",
      contenu: "La réunion mensuelle du bureau PAF du 15 mars a réuni 24 adhérents. Points abordés : validation du budget pour la braderie (5 500 €), lancement de la newsletter mensuelle numérique, discussion sur l'organisation du marché nocturne d'avril, et présentation de la nouvelle application mobile pour les adhérents. La prochaine réunion aura lieu le 19 avril à 19 h à la salle des associations."
    },
    {
      id: 5,
      titre: "Bienvenue à nos 3 nouveaux adhérents !",
      date: "2026-03-05",
      categorie: "Association",
      excerpt: "La PAF accueille trois nouveaux commerçants wambrechiens en ce début de printemps.",
      contenu: "La PAF est heureuse d'accueillir trois nouveaux membres : La Crêperie du Moulin (rue du Château), le Cabinet de Kinésithérapie Duplessis (allée des Flandres) et le Salon de Thé Chez Léonie (Grand-Place). Ils bénéficieront dès maintenant de tous les avantages de l'adhésion. N'hésitez pas à leur souhaiter la bienvenue !"
    }
  ],

  annuaire: [
    {
      id: 1, nom: "Boulangerie Artisanale Leroy",
      categorie: "Alimentation",
      adresse: "3 Grand-Place, Wambrechies",
      telephone: "03 20 68 12 45",
      description: "Pains spéciaux, viennoiseries et pâtisseries faites maison. Ouvert du mardi au dimanche."
    },
    {
      id: 2, nom: "Fleuriste Les Jardins de Flandre",
      categorie: "Mode & Maison",
      adresse: "17 rue du Château, Wambrechies",
      telephone: "03 20 68 34 21",
      description: "Compositions florales sur mesure, plantes, bouquets de saison et deuil."
    },
    {
      id: 3, nom: "Restaurant La Brasserie du Canal",
      categorie: "Restauration",
      adresse: "8 quai de la Lys, Wambrechies",
      telephone: "03 20 39 55 60",
      description: "Cuisine traditionnelle du Nord, spécialités flamandes, terrasse au bord du canal."
    },
    {
      id: 4, nom: "Pharmacie Centrale de Wambrechies",
      categorie: "Santé",
      adresse: "2 Grand-Place, Wambrechies",
      telephone: "03 20 68 10 08",
      description: "Pharmacie de garde, conseils en parapharmacie, vaccinations et tests. Livraison à domicile."
    },
    {
      id: 5, nom: "Coiffure Style & Co",
      categorie: "Beauté",
      adresse: "11 rue de Marquette, Wambrechies",
      telephone: "03 20 68 47 99",
      description: "Coiffure mixte et enfants, colorations végétales, extensions. Sur rendez-vous et sans rendez-vous."
    },
    {
      id: 6, nom: "Optique Wambrechies",
      categorie: "Santé",
      adresse: "5 rue de la Lys, Wambrechies",
      telephone: "03 20 77 22 14",
      description: "Lunettes de vue, solaires et lentilles. Bilan de vue gratuit, tiers payant accepté."
    },
    {
      id: 7, nom: "Épicerie Fine du Terroir",
      categorie: "Alimentation",
      adresse: "14 Grand-Place, Wambrechies",
      telephone: "03 20 68 58 03",
      description: "Produits locaux et régionaux, bières artisanales, fromages affinés, charcuterie de qualité."
    },
    {
      id: 8, nom: "Auto-École du Pont",
      categorie: "Services",
      adresse: "22 rue du Pont, Wambrechies",
      telephone: "03 20 68 31 77",
      description: "Formation permis B, moto (A1/A2/A), code de la route. Financement CPF accepté."
    },
    {
      id: 9, nom: "Cabinet Médical Dr Martin",
      categorie: "Santé",
      adresse: "6 allée des Flandres, Wambrechies",
      telephone: "03 20 39 44 20",
      description: "Médecine générale, pédiatrie et suivi grossesse. Téléconsultation disponible."
    },
    {
      id: 10, nom: "Librairie Papeterie Au Fil des Pages",
      categorie: "Services",
      adresse: "9 Grand-Place, Wambrechies",
      telephone: "03 20 68 19 55",
      description: "Livres, papeterie, presse, jeux de société et cadeaux. Commandes spéciales sous 48 h."
    }
  ],

  offres: [
    {
      id: 1,
      commercant: "Boulangerie Artisanale Leroy",
      titre: "–15 % sur toutes les pâtisseries",
      description: "Présentez votre carte adhérent PAF et bénéficiez de 15 % de réduction sur l'ensemble de la gamme de pâtisseries.",
      expiration: "2026-04-30",
      tag: "–15 %"
    },
    {
      id: 2,
      commercant: "Fleuriste Les Jardins de Flandre",
      titre: "Un bouquet offert dès 30 € d'achat",
      description: "Pour tout achat de 30 € ou plus, recevez un bouquet de saison en cadeau. Sur présentation de la carte adhérent.",
      expiration: "2026-05-15",
      tag: "Cadeau"
    },
    {
      id: 3,
      commercant: "La Brasserie du Canal",
      titre: "Menu du jour à –10 %",
      description: "10 % de réduction sur le menu du jour du lundi au vendredi, midi uniquement, sur présentation de votre carte PAF.",
      expiration: "2026-06-30",
      tag: "–10 %"
    },
    {
      id: 4,
      commercant: "Pharmacie Centrale",
      titre: "Bilan minceur offert",
      description: "Analyse de composition corporelle (poids, IMC, masse graisseuse) offerte pour tout adhérent PAF. Sur rendez-vous.",
      expiration: "2026-05-31",
      tag: "Offert"
    },
    {
      id: 5,
      commercant: "Coiffure Style & Co",
      titre: "Coupe + brushing à –20 %",
      description: "20 % de réduction sur la prestation coupe + brushing pour femme ou homme. Valable du lundi au mercredi.",
      expiration: "2026-04-30",
      tag: "–20 %"
    },
    {
      id: 6,
      commercant: "Optique Wambrechies",
      titre: "Bilan de vue 100 % gratuit",
      description: "Profitez d'un bilan visuel complet offert, sans engagement d'achat. Prenez rendez-vous en mentionnant votre adhésion PAF.",
      expiration: "2026-06-15",
      tag: "Gratuit"
    }
  ],

  evenements: [
    {
      id: 1, titre: "Braderie de printemps",
      date: "2026-04-12",
      heure: "09:00 – 18:00",
      lieu: "Grand-Place, Wambrechies",
      description: "Grande braderie annuelle avec exposants, animations et restauration."
    },
    {
      id: 2, titre: "Marché nocturne",
      date: "2026-04-18",
      heure: "18:00 – 23:00",
      lieu: "Place de l'Église, Wambrechies",
      description: "Marché vespéral, artisanat local, dégustations et musique live."
    },
    {
      id: 3, titre: "Atelier dégustation vins & fromages",
      date: "2026-04-25",
      heure: "19:30 – 22:00",
      lieu: "Épicerie Fine du Terroir",
      description: "Soirée dégustation organisée par l'Épicerie Fine. Places limitées – inscription obligatoire."
    },
    {
      id: 4, titre: "Fête du Muguet",
      date: "2026-05-01",
      heure: "10:00 – 13:00",
      lieu: "Grand-Place, Wambrechies",
      description: "Distribution de muguet et petit marché festif pour le 1er mai."
    },
    {
      id: 5, titre: "Journée Portes Ouvertes des commerces",
      date: "2026-05-10",
      heure: "10:00 – 18:00",
      lieu: "Tous les commerces PAF",
      description: "Les adhérents PAF ouvrent leurs portes et proposent des démonstrations et offres spéciales."
    },
    {
      id: 6, titre: "Concert en plein air",
      date: "2026-05-17",
      heure: "15:00 – 19:00",
      lieu: "Parc du Château, Wambrechies",
      description: "Concert gratuit de musiques du monde, en partenariat avec la PAF et la mairie."
    },
    {
      id: 7, titre: "Grand Vide-Grenier",
      date: "2026-05-24",
      heure: "08:00 – 17:00",
      lieu: "Parking de la Mairie, Wambrechies",
      description: "Vide-grenier géant. Inscriptions des exposants ouvertes jusqu'au 17 mai."
    },
    {
      id: 8, titre: "Soirée gastronomique PAF",
      date: "2026-05-31",
      heure: "19:30 – 23:30",
      lieu: "La Brasserie du Canal",
      description: "Dîner de gala annuel des adhérents PAF. Menu gastronomique 4 services. Réservation obligatoire."
    }
  ]
};

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

  // Scroll main content to top
  document.getElementById('main').scrollTo(0, 0);
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});

/* ============================================================
   ACTUS
   ============================================================ */
function renderActus() {
  const container = document.getElementById('actus-list');
  container.innerHTML = DATA.actus.map(a => `
    <div class="actu-card">
      <div class="actu-header" onclick="toggleActu(${a.id})">
        <div class="actu-meta">
          <span class="badge">${escHtml(a.categorie)}</span>
          <span class="actu-date">${formatDate(a.date)}</span>
        </div>
        <div class="actu-title">${escHtml(a.titre)}</div>
        <div class="actu-excerpt">${escHtml(a.excerpt)}</div>
        <button class="actu-expand-btn" id="btn-actu-${a.id}" aria-expanded="false">
          Lire la suite
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
      <div class="actu-body" id="body-actu-${a.id}">${escHtml(a.contenu)}</div>
    </div>
  `).join('');
}

function toggleActu(id) {
  const body = document.getElementById('body-actu-' + id);
  const btn  = document.getElementById('btn-actu-' + id);
  const open = body.classList.toggle('open');
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', open);
  btn.querySelector('span') && (btn.querySelector('span').textContent = open ? 'Réduire' : 'Lire la suite');
  // Update text node (first text node inside btn)
  for (const node of btn.childNodes) {
    if (node.nodeType === 3) { node.textContent = open ? 'Réduire ' : 'Lire la suite '; break; }
  }
}

/* ============================================================
   ANNUAIRE
   ============================================================ */
const CATEGORIES_ANNUAIRE = ['Tous', 'Alimentation', 'Beauté', 'Mode & Maison', 'Restauration', 'Santé', 'Services'];
let annuaireFilter = 'Tous';
let annuaireSearch = '';

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

function renderAnnuaireList() {
  const container = document.getElementById('annuaire-list');
  const q = annuaireSearch.toLowerCase().trim();
  const filtered = DATA.annuaire.filter(m => {
    const matchCat = annuaireFilter === 'Tous' || m.categorie === annuaireFilter;
    const matchQ   = !q || m.nom.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (!filtered.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px 0;font-size:.9rem;">Aucun résultat trouvé.</p>';
    return;
  }

  container.innerHTML = filtered.map(m => `
    <div class="merchant-card">
      <span class="badge badge-muted">${escHtml(m.categorie)}</span>
      <div class="merchant-name">${escHtml(m.nom)}</div>
      <div class="merchant-desc">${escHtml(m.description)}</div>
      <div class="merchant-info">
        <span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escHtml(m.adresse)}
        </span>
        <a href="tel:${escHtml(m.telephone.replace(/\s/g,''))}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          ${escHtml(m.telephone)}
        </a>
      </div>
    </div>
  `).join('');
}

function initAnnuaire() {
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
function renderOffres() {
  const container = document.getElementById('offres-list');
  container.innerHTML = DATA.offres.map(o => `
    <div class="offer-card">
      <div class="offer-inner">
        <div class="offer-merchant">${escHtml(o.commercant)}</div>
        <div class="offer-title">${escHtml(o.titre)}</div>
        <div class="offer-desc">${escHtml(o.description)}</div>
        <div class="offer-footer">
          <div class="offer-expiry">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Valable jusqu'au ${formatDate(o.expiration)}
          </div>
          <span class="offer-tag">${escHtml(o.tag)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* ============================================================
   BOÎTE À IDÉES
   ============================================================ */
const LS_KEY = 'paf-idees';

function loadIdees() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}

function saveIdees(idees) {
  localStorage.setItem(LS_KEY, JSON.stringify(idees));
}

function renderIdeesList() {
  const idees = loadIdees();
  const header = document.getElementById('ideas-list-header');
  const container = document.getElementById('ideas-list');

  if (!idees.length) {
    header.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  header.classList.remove('hidden');
  container.innerHTML = idees.slice().reverse().map(idea => `
    <div class="idea-card">
      <div class="idea-card-meta">
        <span class="idea-card-author">${escHtml(idea.prenom || 'Anonyme')}</span>
        <span class="badge badge-muted">${escHtml(idea.categorie)}</span>
        <span class="idea-card-date">${idea.date}</span>
      </div>
      <div class="idea-card-text">${escHtml(idea.texte)}</div>
    </div>
  `).join('');
}

function initIdees() {
  renderIdeesList();

  document.getElementById('idea-form').addEventListener('submit', e => {
    e.preventDefault();
    const texte = document.getElementById('idea-text').value.trim();
    if (!texte) {
      document.getElementById('idea-text').focus();
      return;
    }
    const idea = {
      prenom:    document.getElementById('idea-prenom').value.trim(),
      categorie: document.getElementById('idea-cat').value,
      texte,
      date:      new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })
    };
    const idees = loadIdees();
    idees.push(idea);
    saveIdees(idees);

    // Reset form
    document.getElementById('idea-form').reset();

    // Show success message
    const successEl = document.getElementById('idea-success');
    successEl.classList.remove('hidden');
    setTimeout(() => successEl.classList.add('hidden'), 3000);

    renderIdeesList();
  });
}

/* ============================================================
   CALENDRIER
   ============================================================ */
let calYear  = 2026;
let calMonth = 3; // April (0-indexed)
let calSelectedDay = null;

const today = new Date();

function getEventsForDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  return DATA.evenements.filter(e => e.date === dateStr);
}

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  label.textContent = `${MONTHS_FR[calMonth]} ${calYear}`;

  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(calYear, calMonth, 1);
  // JS getDay: 0=Sun … 6=Sat → convert to Mon-first: Mon=0 … Sun=6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();

  const cells = [];

  // Leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, month: calMonth - 1, year: calYear, otherMonth: true });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: calMonth, year: calYear, otherMonth: false });
  }
  // Trailing days to complete the grid (always complete last row)
  const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, month: calMonth + 1, year: calYear, otherMonth: true });
  }

  grid.innerHTML = cells.map(cell => {
    const isToday = !cell.otherMonth
      && cell.day === today.getDate()
      && cell.month === today.getMonth()
      && cell.year === today.getFullYear();
    const isSelected = !cell.otherMonth
      && calSelectedDay === cell.day;
    const hasEvent = !cell.otherMonth && getEventsForDate(cell.year, cell.month, cell.day).length > 0;

    const cls = [
      'cal-day',
      cell.otherMonth ? 'other-month' : '',
      isToday        ? 'today'        : '',
      isSelected     ? 'selected'     : '',
      hasEvent       ? 'has-event'    : ''
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

function renderCalEventsPanel() {
  const panel = document.getElementById('cal-events-panel');
  if (!calSelectedDay) {
    panel.classList.add('hidden');
    return;
  }
  const events = getEventsForDate(calYear, calMonth, calSelectedDay);
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
              <div class="cal-event-meta">${escHtml(ev.heure)} · ${escHtml(ev.lieu)}</div>
            </div>
          </div>
        `).join('')
      : '<div class="no-event-msg">Aucun événement ce jour.</div>'
    }
  `;
}

function renderUpcomingEvents() {
  const container = document.getElementById('cal-upcoming');
  const now = new Date(calYear, calMonth, 1);
  const upcoming = DATA.evenements
    .filter(ev => {
      const [y, m, d] = ev.date.split('-').map(Number);
      return new Date(y, m - 1, d) >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
    })
    .slice(0, 5);

  container.innerHTML = upcoming.map(ev => {
    const { day, month } = formatDateShort(ev.date);
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
              ${escHtml(ev.heure)}
            </span>
            <span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${escHtml(ev.lieu)}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function initCalendar() {
  // Start on current month if 2026, otherwise default April 2026
  calYear  = today.getFullYear() === 2026 ? today.getFullYear() : 2026;
  calMonth = today.getFullYear() === 2026 ? today.getMonth()    : 3;

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
  renderCalendar();
}

/* ============================================================
   INIT
   ============================================================ */
(function init() {
  renderActus();
  initAnnuaire();
  renderOffres();
  initIdees();
  initCalendar();
  showSection('actus');
})();
