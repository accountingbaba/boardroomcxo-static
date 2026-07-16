/* ── Boardroom CXO — Interactions & Animations ── */

// ── 1. Sticky header ──────────────────────────────────────────
const header = document.getElementById('site-header');
function updateHeader() {
  if (window.scrollY > 40) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

// ── 2. Mobile menu ────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const navMenuCol = document.querySelector('.nav-menu-col');
hamburger.addEventListener('click', () => {
  const open = navMenuCol.classList.toggle('open');
  const spans = hamburger.querySelectorAll('span');
  if (open) {
    spans[0].style.transform = 'rotate(45deg) translate(5px, 6px)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px, -6px)';
  } else {
    spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }
});
// Close on link click
navMenuCol.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navMenuCol.classList.remove('open');
  hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
}));

// ── 3. Counter animation ──────────────────────────────────────
function animateCounter(el) {
  const target = parseFloat(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const isDecimal = target % 1 !== 0;
  const duration = 2200;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = eased * target;
    el.textContent = (isDecimal ? current.toFixed(1) : Math.floor(current)) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── 4. IntersectionObserver — fade-up + counters ─────────────
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.addEventListener('DOMContentLoaded', () => {
  // Fade-up on scroll
  const fadeTargets = [
    '.svc-card', '.process-card', '.testi-card',
    '.blog-card', '.who-card', '.why-feat',
    '.cred-main-img', '.ipo-card'
  ].join(',');
  document.querySelectorAll(fadeTargets).forEach((el, i) => {
    el.classList.add('fade-up');
    const delay = Math.min((i % 3) * 0.08, 0.16);
    el.style.transitionDelay = delay + 's';
    fadeObserver.observe(el);
  });

  // Section headings
  document.querySelectorAll('.section-h2, .tag-pill').forEach(el => {
    el.classList.add('fade-up');
    fadeObserver.observe(el);
  });

  // Counters
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    counterObserver.observe(el);
  });
});

// ── 5. Hero heading — typewriter animation ────────────────────
(function heroAnimation() {
  const headingEl = document.querySelector('.hero-heading-gradient');
  if (!headingEl) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const words = [
    'Right Leaders. Real Results.',
    'Sourced from Competitors. Placed to Stay.',
    'Market Mapped. Offer Closed.',
  ];
  let wordIndex = 0;
  let charIndex = 0;
  let deleting = false;
  let paused = false;

  // Start with empty so typewriter types in from scratch
  headingEl.textContent = '';

  function type() {
    if (paused) { paused = false; setTimeout(type, 2000); return; }
    const current = words[wordIndex];
    if (!deleting) {
      headingEl.textContent = current.substring(0, charIndex + 1);
      charIndex++;
      if (charIndex === current.length) { deleting = true; paused = true; setTimeout(type, 50); return; }
    } else {
      headingEl.textContent = current.substring(0, charIndex - 1);
      charIndex--;
      if (charIndex === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
      }
    }
    setTimeout(type, deleting ? 35 : 65);
  }

  setTimeout(type, 500);
})();

// ── 6. Smooth scroll active nav ───────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      const link = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
      if (link) link.classList.add('active');
    }
  });
}, { rootMargin: '-50% 0px -50% 0px' });
sections.forEach(s => navObserver.observe(s));

// ── 7. Service card — icon lift on hover ─────────────────────
document.querySelectorAll('.svc-card').forEach(card => {
  const icon = card.querySelector('.svc-icon-wrap');
  card.addEventListener('mouseenter', () => {
    if (icon) icon.style.transform = 'translateY(-6px) scale(1.06)';
    if (icon) icon.style.transition = 'transform 0.2s cubic-bezier(0.23,1,0.32,1)';
  });
  card.addEventListener('mouseleave', () => {
    if (icon) icon.style.transform = '';
  });
});

// ── 8. Salary benchmark tool ──────────────────────────────────
// Ranges in ₹ Lakhs annual CTC. Sourced from BoardroomCXO's 2025-26
// org-structure/salary market mapping (Category A 100+ stores / large
// scale, Category B 20-60 stores growth-stage, Category C under 20
// stores early-stage), cross-checked against live candidate pipeline
// data. tierCut is the Tier-2 city discount applied to the Tier-1 base.
const SALARY_DATA = [
  { group: 'Marketing', roles: [
    { id: 'perf-junior', label: 'Performance Marketer (Junior, 0–2 yrs)', A: [4, 7], B: [4, 7], C: [3.5, 5], tierCut: 0.15 },
    { id: 'perf-mid', label: 'Performance Marketer (Mid, 3–5 yrs)', A: [10, 18], B: [8, 15], C: [6, 10], tierCut: 0.15 },
    { id: 'perf-senior', label: 'Performance Marketing Lead (Senior, 5–8 yrs)', A: [18, 32], B: [13, 22], C: [10, 16], tierCut: 0.12 },
    { id: 'brand-lead', label: 'Brand & Marketing Lead', A: [20, 31], B: [15, 25], C: [10, 18], tierCut: 0.08 },
    { id: 'social-media', label: 'Social Media Manager', A: [10, 18], B: [4, 11], C: [4, 10], tierCut: 0.15 },
  ]},
  { group: 'Sales & Retail', roles: [
    { id: 'sales-associate', label: 'Sales Associate / Jewellery Consultant', A: [2.4, 3.5], B: [2.0, 3.0], C: [1.8, 2.5], tierCut: 0.20 },
    { id: 'store-manager', label: 'Store Manager', A: [4.4, 8.0], B: [3.5, 6.0], C: [3.0, 4.5], tierCut: 0.20 },
    { id: 'asm', label: 'Area Sales Manager / City Manager', A: [11.5, 16.6], B: [7, 11], C: [6, 9], tierCut: 0.20 },
    { id: 'rsm', label: 'Regional Sales Manager / Zonal Head', A: [15, 28], B: [10, 18], C: [8, 14], tierCut: 0.18 },
    { id: 'national-sales', label: 'National / Zonal Sales Head', A: [60, 110], B: [35, 60], C: [25, 40], tierCut: 0.05 },
  ]},
  { group: 'Business & Franchise Development', roles: [
    { id: 'bdm', label: 'Business Development Manager (Expansion)', A: [16, 22], B: [12, 18], C: [9, 14], tierCut: 0.18 },
    { id: 'senior-bd', label: 'Senior BD / Expansion Head', A: [35, 55], B: [30, 50], C: [20, 35], tierCut: 0.08 },
  ]},
  { group: 'Strategy & Operations', roles: [
    { id: 'founders-office', label: "Founder's Office / Strategy Generalist", A: [35, 80], B: [25, 40], C: [15, 25], tierCut: 0.05 },
    { id: 'ops-mid', label: 'Operations / Sales Mid-Management', A: [15, 22], B: [11, 16], C: [6, 10], tierCut: 0.15 },
    { id: 'business-head', label: 'Business Head / GM', A: [60, 100], B: [35, 60], C: [22, 38], tierCut: 0.05 },
  ]},
];

(function salaryTool() {
  const modal = document.getElementById('salary-modal');
  const openBtn = document.getElementById('open-salary-tool');
  const roleSelect = document.getElementById('salary-role');
  const storesSelect = document.getElementById('salary-stores');
  const tierSelect = document.getElementById('salary-tier');
  const resultRange = document.getElementById('salary-result-range');
  if (!modal || !openBtn || !roleSelect) return;

  SALARY_DATA.forEach(group => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.group;
    group.roles.forEach(role => {
      const opt = document.createElement('option');
      opt.value = role.id;
      opt.textContent = role.label;
      optgroup.appendChild(opt);
    });
    roleSelect.appendChild(optgroup);
  });

  function findRole(id) {
    for (const group of SALARY_DATA) {
      const match = group.roles.find(r => r.id === id);
      if (match) return match;
    }
    return null;
  }

  function formatLakhs(n) {
    return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
  }

  function updateResult() {
    const role = findRole(roleSelect.value);
    if (!role) return;
    const [min, max] = role[storesSelect.value];
    const isTier2 = tierSelect.value === '2';
    const factor = isTier2 ? (1 - role.tierCut) : 1;
    const adjMin = min * factor;
    const adjMax = max * factor;
    resultRange.textContent = `₹${formatLakhs(adjMin)}L – ₹${formatLakhs(adjMax)}L`;
  }

  function openModal() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    updateResult();
  }
  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  openBtn.addEventListener('click', openModal);
  modal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
  [roleSelect, storesSelect, tierSelect].forEach(el => el.addEventListener('change', updateResult));

  updateResult();
})();

// ── 9. Scroll progress bar ────────────────────────────────────
const progressBar = document.createElement('div');
progressBar.style.cssText = 'position:fixed;top:0;left:0;height:3px;width:100%;background:linear-gradient(90deg,#D4A860,#2C41E4);z-index:10000;transform:scaleX(0);transform-origin:left;will-change:transform;pointer-events:none;';
document.body.appendChild(progressBar);
window.addEventListener('scroll', () => {
  const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
  progressBar.style.transform = `scaleX(${pct})`;
}, { passive: true });
