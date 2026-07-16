/* ── Boardroom CXO — Institutional Monolith · Interactions ── */

// Sticky header
(function () {
  const header = document.getElementById('site-header');
  if (!header) return;
  function update() {
    if (window.scrollY > 40) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
})();

// Mobile menu
(function () {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('nav-menu-mobile');
  if (!hamburger || !mobileMenu) return;
  hamburger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    const spans = hamburger.querySelectorAll('span');
    if (open) {
      spans[0].style.transform = 'rotate(45deg) translate(4px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(4px, -5px)';
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }));
})();

// Counters
function animateCounter(el) {
  const target = parseFloat(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';
  const isDecimal = target % 1 !== 0;
  const duration = 1800;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = eased * target;
    el.textContent = prefix + (isDecimal ? current.toFixed(1) : Math.floor(current)) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// IntersectionObserver
document.addEventListener('DOMContentLoaded', () => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fadeObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in-view'); fadeObs.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .problem-row, .role-col, .process-step, .why-feat, .testi-item, .blog-item, .mvv-item, .values-item, .what-item, .case-item, .article-row, .topic-item, .stats-band-item, .impact-metric')
    .forEach((el, i) => {
      if (!el.classList.contains('reveal')) el.classList.add('reveal');
      el.style.transitionDelay = Math.min((i % 4) * 0.06, 0.24) + 's';
      fadeObs.observe(el);
    });

  if (!reduced) {
    const countObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { animateCounter(e.target); countObs.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-target]').forEach(el => countObs.observe(el));
  } else {
    document.querySelectorAll('[data-target]').forEach(el => {
      const t = parseFloat(el.dataset.target);
      const s = el.dataset.suffix || '';
      const p = el.dataset.prefix || '';
      el.textContent = p + (t % 1 !== 0 ? t.toFixed(1) : Math.floor(t)) + s;
    });
  }
});

// Salary tool data (unchanged from original)
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
  const roleSelect = document.getElementById('salary-role');
  const storesSelect = document.getElementById('salary-stores');
  const tierSelect = document.getElementById('salary-tier');
  const resultRange = document.getElementById('salary-result-range');
  const familyBadge = document.getElementById('salary-family-badge');
  const toolPanel = document.querySelector('.salary-tool-live');
  if (!roleSelect || !storesSelect || !tierSelect || !resultRange || !toolPanel) return;

  const FAMILY_KEY = {
    'Marketing': 'marketing',
    'Sales & Retail': 'sales',
    'Business & Franchise Development': 'bd',
    'Strategy & Operations': 'strategy'
  };
  const FAMILY_LABEL = {
    marketing: 'A / Marketing',
    sales:     'B / Sales & Retail',
    bd:        'C / BD & Franchise',
    strategy:  'D / Strategy & Ops'
  };

  SALARY_DATA.forEach(group => {
    const fam = FAMILY_KEY[group.group];
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.group;
    group.roles.forEach(role => {
      const opt = document.createElement('option');
      opt.value = role.id;
      opt.textContent = role.label;
      opt.dataset.family = fam;
      optgroup.appendChild(opt);
    });
    roleSelect.appendChild(optgroup);
  });

  function findRole(id) {
    for (const g of SALARY_DATA) {
      const m = g.roles.find(r => r.id === id);
      if (m) return { role: m, family: FAMILY_KEY[g.group] };
    }
    return null;
  }
  function fmt(n) { return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1); }

  let typeTimer = null;
  function typeResult(text) {
    clearTimeout(typeTimer);
    resultRange.textContent = '';
    let i = 0;
    function step() {
      resultRange.textContent = text.slice(0, ++i);
      if (i < text.length) typeTimer = setTimeout(step, 22);
    }
    step();
  }

  function updateResult(animate) {
    const found = findRole(roleSelect.value);
    if (!found) return;
    const { role, family } = found;
    toolPanel.dataset.family = family;
    if (familyBadge) familyBadge.textContent = FAMILY_LABEL[family];
    const [min, max] = role[storesSelect.value];
    const isTier2 = tierSelect.value === '2';
    const factor = isTier2 ? (1 - role.tierCut) : 1;
    const text = `\u20B9${fmt(min * factor)}L to \u20B9${fmt(max * factor)}L`;
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      typeResult(text);
    } else {
      resultRange.textContent = text;
    }
  }

  [roleSelect, storesSelect, tierSelect].forEach(el => el.addEventListener('change', () => updateResult(true)));
  // initial render (no animation)
  updateResult(false);

  // Animate result on scroll-into-view (first time only)
  if ('IntersectionObserver' in window) {
    let played = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && !played) {
          played = true;
          updateResult(true);
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(toolPanel);
  }
})();
