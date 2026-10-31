// Public Boardroom Moves pages on boardroomcxo.com: the hub (/moves), one page per featured leader
// (/moves/<slug>), their website image (/moves/img/<slug>) and the sitemap (/sitemap-moves.xml).
// Only features that went live and were not removed appear. Prices never appear here.
import { esc, ensureSchema, todayIst } from './lib.js';

const SITE = 'https://boardroomcxo.com';
const LIVE = "status = 'live' AND removed_at IS NULL AND slug IS NOT NULL";
const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600', ...extra } });
const niceDate = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
const isDedicated = o => o.tier === 'plus' || o.tier === 'pick' || (o.tier === 'pack' && o.pack_id);
const DEDICATED_SQL = "(tier IN ('plus', 'pick') OR (tier = 'pack' AND pack_id IS NOT NULL))";
// Plus pages are paid placements, so links out to the leader and the company never pass ranking.
const OUT_REL = 'noopener sponsored';
// The matching hiring page for the new role, so each article feeds the service pages.
const FUNCTIONS = [
  [/\b(cmo|marketing|brand|growth|digital|communications?)\b/i, '/marketing-leadership-hiring', 'marketing and CMO executive search'],
  [/\b(cfo|finance|financial|accounts|treasury)\b/i, '/finance-leadership-hiring', 'CFO and finance leadership executive search'],
  [/\b(chro|hr|people|talent|human)\b/i, '/hr-leadership-hiring', 'HR and people leadership executive search'],
  [/\b(sales|cso|revenue|commercial|retail|business head|stores?)\b/i, '/sales-leadership-hiring', 'sales and retail leadership executive search']];
const fnPage = role => (FUNCTIONS.find(([re]) => re.test(role || '')) || []).slice(1);
const headline = o => `${o.name} joins ${o.company} as ${o.role_title}`;
const altOf = o => `${o.name}, ${o.role_title}, ${o.company}`;
// The free weekly Brief: one roundup page per Thursday, shown only once the team has pasted the Brief's LinkedIn link.
// Names come from the leads the desk put in that Brief; anyone who declined, was removed or took a paid plan is left out.
const BRIEF_IN = "stage NOT IN ('removed', 'declined', 'linked')";
async function publishedBriefs(db, limit = 60) {
  return ((await db.prepare("SELECT substr(key, 7) AS d, value AS link FROM meta WHERE key LIKE 'brief:%' AND value <> '' ORDER BY key DESC LIMIT ?").bind(limit).all()).results || [])
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.d));
}
const briefNames = (db, d) => db.prepare(`SELECT name, role_title, company, prev_role, linkedin FROM leads WHERE brief_date = ? AND ${BRIEF_IN} ORDER BY name`).bind(d).all().then(r => r.results || []);
const briefTitle = d => `Leadership moves this week: ${niceDate(d + 'T12:00:00Z')}`;

// The website text the team pastes: blank lines split paragraphs, "## " starts a subheading, "> " a quote.
function prose(text) {
  return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean).map(b => {
    if (b.startsWith('## ')) return `<h2>${esc(b.slice(3))}</h2>`;
    if (b.startsWith('> ')) return `<blockquote>${esc(b.replace(/^> ?/gm, ''))}</blockquote>`;
    return `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}
const firstPara = text => String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(s => s.trim()).find(s => s && !s.startsWith('#')) || '';

function page({ title, description, canonical, image, jsonld, robots = 'index, follow', body }) {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-R2405BSX22"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-R2405BSX22');</script>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Boardroom CXO" />
<meta property="og:locale" content="en_IN" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${image}" />
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
<link rel="icon" href="/images/favicon.png" type="image/png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Manrope:wght@300;400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/style.css" />
<style>
.mv-wrap{max-width:1100px;margin:0 auto;padding:0 var(--pad-x)}
.mv-hero{padding:clamp(120px,14vw,170px) 0 40px;border-bottom:1px solid var(--line)}
.mv-hero h1{font-family:var(--font-display);font-weight:500;font-size:clamp(2.2rem,5vw,3.8rem);line-height:1.06;letter-spacing:-.02em;text-wrap:balance;max-width:22ch}
.mv-hero .lead{margin-top:18px}
.mv-crumb{font-family:var(--font-mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-2);margin-bottom:22px}
.mv-crumb a{border-bottom:1px solid var(--line)}
.mv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:0;border-left:1px solid var(--line);border-top:1px solid var(--line);margin:40px 0}
.mv-card{border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--surface);display:flex;flex-direction:column}
.mv-card img{aspect-ratio:1200/630;object-fit:cover;width:100%;background:var(--bg-alt)}
.mv-card div{padding:20px 22px 24px;display:flex;flex-direction:column;gap:6px}
.mv-card h3{font-family:var(--font-display);font-weight:500;font-size:1.45rem;line-height:1.15}
.mv-card p{color:var(--ink-2);font-size:.95rem}
.mv-card time,.mv-meta{font-family:var(--font-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2)}
.mv-week{margin:56px 0 0}
.mv-week h2{font-family:var(--font-mono);font-size:12px;letter-spacing:.2em;text-transform:uppercase;padding-bottom:12px;border-bottom:1px solid var(--ink)}
.mv-week li{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:24px;padding:16px 0;border-bottom:1px solid var(--line)}
.mv-week li strong{font-family:var(--font-display);font-weight:500;font-size:1.2rem}
.mv-week li span{color:var(--ink-2)}
.mv-article{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:56px;padding:48px 0 80px}
.mv-article .mv-figure{margin-bottom:32px;border:1px solid var(--line)}
.mv-body{font-size:1.06rem;line-height:1.75;max-width:68ch}
.mv-body p{margin:0 0 1.1em}
.mv-body h2{font-family:var(--font-display);font-weight:500;font-size:1.7rem;margin:1.6em 0 .5em}
.mv-body blockquote{font-family:var(--font-display);font-size:1.45rem;line-height:1.35;border-left:2px solid var(--emerald);padding:4px 0 4px 22px;margin:1.4em 0}
.mv-side{border-left:1px solid var(--line);padding-left:28px;display:flex;flex-direction:column;gap:22px;align-self:start;position:sticky;top:110px}
.mv-side dt{font-family:var(--font-mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-2)}
.mv-side dd{font-size:1rem;margin-top:4px}
.mv-side a.mv-link{border-bottom:1px solid var(--ink)}
.mv-cta{background:var(--ink);color:var(--bg);padding:40px clamp(24px,4vw,48px);margin:24px 0 80px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between}
.mv-cta h2{font-family:var(--font-display);font-weight:500;font-size:clamp(1.5rem,3vw,2.2rem);max-width:24ch}
.mv-cta a{border:1px solid var(--bg);padding:14px 22px;font-family:var(--font-mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase}
.mv-empty{padding:40px 0;color:var(--ink-2)}
.mv-faq{margin:64px 0 0;max-width:820px}
.mv-faq h2{font-family:var(--font-mono);font-size:12px;letter-spacing:.2em;text-transform:uppercase;padding-bottom:12px;border-bottom:1px solid var(--ink)}
.mv-faq div{padding:20px 0;border-bottom:1px solid var(--line)}
.mv-faq h3{font-family:var(--font-display);font-weight:500;font-size:1.3rem;margin-bottom:8px}
.mv-faq p{color:var(--ink-2);max-width:68ch}
.mv-faq a{border-bottom:1px solid var(--ink);color:var(--ink)}
.mv-share{border-top:1px solid var(--line);margin-top:36px;padding-top:24px;max-width:68ch}
.mv-share h2,.mv-related h2{font-family:var(--font-mono);font-size:12px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:12px}
.mv-share p{color:var(--ink-2);font-size:.95rem;margin-bottom:12px}
.mv-share input{width:100%;font:inherit;font-size:.9rem;padding:10px 12px;border:1px solid var(--line);background:var(--surface);color:var(--ink)}
.mv-btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.mv-btns a,.mv-btns button{border:1px solid var(--ink);background:none;color:var(--ink);padding:10px 16px;font-family:var(--font-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
.mv-services{margin-top:28px;max-width:68ch;font-size:1rem}
.mv-services a{border-bottom:1px solid var(--ink)}
.mv-related{margin:0 0 56px}
.mv-related .mv-grid{margin:16px 0 0}
.mv-week a{border-bottom:1px solid var(--line)}
.mv-brief-list{margin:40px 0 0;max-width:820px}
.mv-brief-list li{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:24px;padding:18px 0;border-bottom:1px solid var(--line)}
.mv-brief-list strong{font-family:var(--font-display);font-weight:500;font-size:1.25rem}
.mv-brief-list span{color:var(--ink-2)}
.mv-brief-src{margin:28px 0 0;color:var(--ink-2)}
.mv-brief-src a{border-bottom:1px solid var(--ink)}
.mv-report{max-width:820px}
.mv-report h2{font-family:var(--font-mono);font-size:12px;letter-spacing:.2em;text-transform:uppercase;padding-bottom:12px;border-bottom:1px solid var(--ink);margin:48px 0 0}
.mv-report p{color:var(--ink-2);margin:16px 0 0;max-width:68ch}
.mv-report p a,.mv-report li a{border-bottom:1px solid var(--ink);color:var(--ink)}
.mv-report .mv-brief-list{margin:0}
.mv-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.mv-table th,.mv-table td{text-align:left;padding:12px 8px 12px 0;border-bottom:1px solid var(--line)}
.mv-table th:not(:first-child),.mv-table td:not(:first-child){text-align:right;width:90px}
.mv-table th{font-family:var(--font-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2);font-weight:500}
.mv-table tfoot td{font-weight:600;border-bottom:0}
.mv-draft{margin:0 0 20px;padding:12px 16px;border:1px solid var(--ink);font-family:var(--font-mono);font-size:12px;letter-spacing:.06em}
@media(max-width:860px){.mv-article{grid-template-columns:1fr;gap:32px}.mv-side{position:static;border-left:0;border-top:1px solid var(--line);padding:24px 0 0}.mv-week li{grid-template-columns:1fr;gap:4px}}
</style>
</head>
<body>
<header class="site-header" id="site-header">
  <div class="nav-inner">
    <a href="/" class="nav-brand" aria-label="Boardroom CXO"><img width="341" height="150" src="/images/logo-boardroomcxo-transparent.png" alt="Boardroom CXO" /></a>
    <nav class="nav-menu">
      <a href="/" class="nav-link">Home</a>
      <a href="/about-us" class="nav-link">About</a>
      <a href="/resources" class="nav-link">Resources</a>
      <a href="/case-studies" class="nav-link">Case Studies</a>
      <a href="/moves" class="nav-link">Boardroom Moves</a>
    </nav>
    <a href="/schedule-a-call" class="nav-cta">Let's Talk</a>
    <button class="hamburger" id="hamburger" aria-label="Toggle menu"><span></span><span></span><span></span></button>
  </div>
  <div class="nav-menu-mobile" id="nav-menu-mobile">
    <a href="/">Home</a><a href="/about-us">About</a><a href="/resources">Resources</a><a href="/case-studies">Case Studies</a><a href="/moves">Boardroom Moves</a>
    <a href="/schedule-a-call" class="nav-cta-mobile">Let's Talk →</a>
  </div>
</header>
<main>${body}</main>
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="footer-brand"><img width="341" height="150" src="/images/logo-boardroomcxo-transparent.png" alt="Boardroom CXO" /></div>
        <p class="footer-tag">Executive search for retail, jewelry, and D2C brands. Sourced from competitors. Benchmarked on real pay data.</p>
      </div>
      <div class="footer-col"><p class="footer-h5">Navigate</p><ul><li><a href="/">Home</a></li><li><a href="/about-us">About Us</a></li><li><a href="/resources">Resources</a></li><li><a href="/moves">Boardroom Moves</a></li></ul></div>
      <div class="footer-col"><p class="footer-h5">Engage</p><ul><li><a href="/schedule-a-call">Schedule a Call</a></li><li><a href="/get-featured">Get Featured</a></li><li><a href="https://www.linkedin.com/company/boardroom-cxo" target="_blank" rel="noopener">LinkedIn</a></li></ul></div>
      <div class="footer-col footer-contact"><p class="footer-h5">Contact</p><p><a href="mailto:hire@boardroomcxo.com">hire@boardroomcxo.com</a></p><p>Mon–Sat · 10am–6pm IST</p><p>Surat, India &amp; UAE</p></div>
    </div>
    <div class="footer-bottom"><span>© Boardroom CXO · ${todayIst().slice(0, 4)}</span><span><a href="/privacy-policy">Privacy Policy</a> · All Rights Reserved</span></div>
  </div>
</footer>
<script src="/script.js" defer></script>
<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a||!window.gtag)return;var h=a.getAttribute('href');if(/^[/](get-featured|schedule-a-call|[a-z]+-leadership-hiring)/.test(h))gtag('event','moves_cta',{link:h,page:location.pathname});});</script>
</body>
</html>`;
}

const ctaBlock = `<section class="mv-cta"><h2>Made a leadership move? Tell us about it.</h2><a href="/get-featured">Get featured</a></section>`;

// Hub FAQ, approved by Ketul 31 Oct 2026. The plain text goes into FAQPage schema; links are added only on the page.
const HUB_FAQ = [
  ['What is Boardroom Moves?', 'Boardroom Moves records senior leadership moves in India, with a focus on retail, D2C and consumer brands. Each move is announced on the Boardroom CXO LinkedIn page and kept here, so anyone searching for the leader or the company can find it.'],
  ['Who runs it?', 'Boardroom CXO, an executive search firm for retail, jewellery and D2C brands in India and the UAE.'],
  ['How do I get featured?', 'We look for new leadership appointments on LinkedIn and write to the leader directly. You can also tell us about a move on the Get Featured page.'],
  ['What is the weekly Brief?', 'A short roundup of 5 to 6 leaders who moved that week, posted on LinkedIn every Thursday and listed here. It is written from public LinkedIn announcements, and nothing is asked of the leader.'],
  ['Does a featured leader see the write-up before it goes live?', 'Yes. We send the draft first and ask one question: is there anything to highlight or leave out? If we hear nothing within 48 hours, it goes live as drafted.'],
  ['What does "Featured placement" mean?', 'It marks a feature the leader or their company arranged with us. The weekly Brief is not paid for.'],
  ['Can a feature be corrected or removed?', 'Yes. Write to hire@boardroomcxo.com with the page link and what needs to change.']];
const faqLinks = a => esc(a).replace('the Get Featured page', '<a href="/get-featured">the Get Featured page</a>').replace('hire@boardroomcxo.com', '<a href="mailto:hire@boardroomcxo.com">hire@boardroomcxo.com</a>');
const faqBlock = `<section class="mv-faq"><h2>Questions about Boardroom Moves</h2>${HUB_FAQ.map(([q, a]) => `<div><h3>${esc(q)}</h3><p>${faqLinks(a)}</p></div>`).join('')}</section>`;

export async function renderHub(env) {
  const db = env.MOVES_DB;
  await ensureSchema(db);
  const rows = (await db.prepare(`SELECT o.id, o.name, o.role_title, o.company, o.tier, o.pack_id, o.slug, o.live_at, o.slot_date,
      (SELECT text FROM contents c WHERE c.order_id = o.id AND c.platform = 'website') AS website,
      (SELECT 1 FROM images i WHERE i.order_id = o.id AND i.kind = 'website') AS has_img
    FROM orders o WHERE ${LIVE} ORDER BY o.live_at DESC LIMIT 400`).all()).results || [];
  const featured = rows.filter(isDedicated);
  const briefs = await publishedBriefs(db, 8);
  for (const b of briefs) b.names = await briefNames(db, b.d);
  const shown = briefs.filter(b => b.names.length);
  const reports = await publishedReports(db);
  const reportBlock = reports.length ? `<section class="mv-week"><h2>Monthly reports</h2><ul>${reports.map(x => `<li><strong><a href="/moves/report/${x.m}">Senior leadership moves in India: ${monthName(x.m)}</a></strong></li>`).join('')}</ul></section>` : '';
  const cards = featured.map(o => `<a class="mv-card" href="/moves/${esc(o.slug)}">${o.has_img ? `<img src="/moves/img/${esc(o.slug)}" alt="${esc(altOf(o))}" loading="lazy" width="1200" height="630">` : ''}
    <div><time datetime="${esc(String(o.live_at).slice(0, 10))}">${niceDate(o.live_at)}</time><h3>${esc(o.name)}</h3><p>${esc(o.role_title)} at ${esc(o.company)}</p></div></a>`).join('');
  const weekBlocks = shown.map(b => `<section class="mv-week" id="brief-${b.d}"><h2><a href="/moves/brief/${b.d}">The Brief · ${niceDate(b.d + 'T12:00:00Z')}</a></h2><ul>${b.names.map(n =>
    `<li><strong>${esc(n.name)}</strong><span>${esc(n.role_title)} at ${esc(n.company)}</span></li>`).join('')}</ul></section>`).join('');
  const body = `<div class="mv-wrap">
<section class="mv-hero"><p class="mv-crumb"><a href="/">Home</a> / Boardroom Moves</p><h1>Boardroom Moves: senior leadership moves in India</h1>
<p class="lead">Senior leadership appointments in India, with a focus on retail, D2C and consumer brands, announced on the Boardroom CXO LinkedIn page and recorded here. Featured leaders see their write-up before it goes live; the weekly Brief is written from public LinkedIn announcements.</p></section>
${featured.length ? `<div class="mv-grid">${cards}</div>` : ''}${reportBlock}${weekBlocks}${!featured.length && !shown.length ? '<p class="mv-empty">The first Boardroom Moves features appear here soon.</p>' : ''}
${faqBlock}
${ctaBlock}</div>`;
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'Boardroom Moves', url: SITE + '/moves',
      isPartOf: { '@type': 'WebSite', name: 'Boardroom CXO', url: SITE + '/' },
      mainEntity: { '@type': 'ItemList', itemListElement: featured.slice(0, 50).map((o, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/moves/${o.slug}`, name: `${o.name}, ${o.role_title} at ${o.company}` })) } },
    { '@type': 'FAQPage', url: SITE + '/moves', mainEntity: HUB_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] };
  return html(page({ title: 'Boardroom Moves | Senior leadership appointments in India | Boardroom CXO',
    description: 'Recent senior leadership appointments in India, with a focus on retail, D2C and consumer brands, as featured on the Boardroom CXO LinkedIn page.',
    canonical: SITE + '/moves', image: SITE + '/images/Homepage-Meta-removebg-preview.png', jsonld, body }));
}

export async function renderProfile(env, slug) {
  const db = env.MOVES_DB;
  await ensureSchema(db);
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return notFound();
  const o = await db.prepare(`SELECT * FROM orders WHERE slug = ? AND ${LIVE}`).bind(slug).first();
  if (!o) return notFound();
  if (!isDedicated(o)) return new Response(null, { status: 302, headers: { Location: `/moves#${slug}` } });
  const c = await db.prepare("SELECT text FROM contents WHERE order_id = ? AND platform = 'website'").bind(o.id).first();
  const img = await db.prepare("SELECT 1 FROM images WHERE order_id = ? AND kind = 'website'").bind(o.id).first();
  const d = JSON.parse(o.details || '{}');
  const url = `${SITE}/moves/${slug}`, image = img ? `${SITE}/moves/img/${slug}` : SITE + '/images/Homepage-Meta-removebg-preview.png';
  const site = /^https?:\/\/[^\s]+\.[^\s]+/i.test(d.company_site || '') ? d.company_site : '';
  const related = (await db.prepare(`SELECT id, name, role_title, company, slug, live_at, (SELECT 1 FROM images i WHERE i.order_id = orders.id AND i.kind = 'website') AS has_img
    FROM orders WHERE ${LIVE} AND ${DEDICATED_SQL} AND slug <> ? ORDER BY live_at DESC LIMIT 3`).bind(slug).all()).results || [];
  const [fnHref, fnName] = fnPage(o.role_title);
  const title = `${headline(o)} | Boardroom Moves`;
  const description = (firstPara(c && c.text) || `${headline(o)}.`).slice(0, 158);
  const side = [['New role', `${esc(o.role_title)}<br>${esc(o.company)}`], d.prev_role ? ['Previously', esc(d.prev_role)] : null, ['Featured', niceDate(o.live_at)],
    site ? ['Company', `<a class="mv-link" href="${esc(site)}" target="_blank" rel="${OUT_REL}">${esc(o.company)} website</a>`] : null,
    o.linkedin_url ? ['On LinkedIn', `<a class="mv-link" href="${esc(o.linkedin_url)}" target="_blank" rel="noopener">Read the post</a>`] : null,
    d.linkedin ? ['Profile', `<a class="mv-link" href="${esc(d.linkedin)}" target="_blank" rel="${OUT_REL}">${esc(o.name)} on LinkedIn</a>`] : null].filter(Boolean)
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const share = `<section class="mv-share"><h2>Link to this announcement</h2>
<p>Add it to your LinkedIn Featured section, your company newsroom or your website.</p>
<input type="text" readonly value="${url}" aria-label="Page link" onclick="this.select()">
<div class="mv-btns"><button type="button" onclick="navigator.clipboard.writeText('${url}').then(()=>{this.textContent='Copied'})">Copy link</button>
<a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Share on LinkedIn</a>
<a href="https://wa.me/?text=${encodeURIComponent(headline(o) + ' ' + url)}" target="_blank" rel="noopener">Share on WhatsApp</a></div></section>`;
  const services = `<p class="mv-services">Boardroom CXO runs executive search for retail, jewellery and D2C brands. ${fnHref ? `See our <a href="${fnHref}">${esc(fnName)}</a>, or <a href="/schedule-a-call">talk to us</a> about a leadership hire.` : `<a href="/schedule-a-call">Talk to us</a> about a leadership hire.`}</p>`;
  const relatedBlock = related.length ? `<section class="mv-related"><h2>More Boardroom Moves</h2><div class="mv-grid">${related.map(r => `<a class="mv-card" href="/moves/${esc(r.slug)}">${r.has_img ? `<img src="/moves/img/${esc(r.slug)}" alt="${esc(altOf(r))}" loading="lazy" width="1200" height="630">` : ''}
    <div><time datetime="${esc(String(r.live_at).slice(0, 10))}">${niceDate(r.live_at)}</time><h3>${esc(r.name)}</h3><p>${esc(r.role_title)} at ${esc(r.company)}</p></div></a>`).join('')}</div></section>` : '';
  const body = `<div class="mv-wrap">
<section class="mv-hero"><p class="mv-crumb"><a href="/">Home</a> / <a href="/moves">Boardroom Moves</a></p><p class="mv-meta">Boardroom Moves · Featured placement · ${niceDate(o.live_at)}</p>
<h1 style="margin-top:14px">${esc(headline(o))}</h1></section>
<article class="mv-article"><div>${img ? `<img class="mv-figure" src="/moves/img/${esc(slug)}" alt="${esc(altOf(o))}" width="1200" height="630">` : ''}
<div class="mv-body">${prose(c && c.text) || `<p>${esc(headline(o))}.</p>`}</div>${services}${share}</div>
<aside><dl class="mv-side">${side}</dl></aside></article>
${relatedBlock}${ctaBlock}</div>`;
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'NewsArticle', headline: headline(o).slice(0, 110), url, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, image: [image], description,
      datePublished: o.live_at, dateModified: o.updated_at || o.live_at,
      author: { '@type': 'Organization', name: 'Boardroom CXO', url: SITE + '/' }, publisher: { '@type': 'Organization', name: 'Boardroom CXO', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/images/logo-boardroomcxo.png' } },
      about: { '@type': 'Person', name: o.name, jobTitle: o.role_title, worksFor: { '@type': 'Organization', name: o.company, ...(site ? { url: site } : {}) }, ...(d.linkedin ? { sameAs: [d.linkedin] } : {}) },
      isPartOf: { '@type': 'CollectionPage', name: 'Boardroom Moves', url: SITE + '/moves' } },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Boardroom Moves', item: SITE + '/moves' }, { '@type': 'ListItem', position: 3, name: o.name, item: url }] }] };
  return html(page({ title, description, canonical: url, image, jsonld, body }));
}

export async function renderBrief(env, d) {
  const db = env.MOVES_DB;
  await ensureSchema(db);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return notFound();
  const link = (await db.prepare('SELECT value FROM meta WHERE key = ?').bind('brief:' + d).first() || {}).value || '';
  const names = link ? await briefNames(db, d) : [];
  if (!names.length) return notFound();
  const url = `${SITE}/moves/brief/${d}`, title = briefTitle(d);
  const description = `${names.length} leadership ${names.length === 1 ? 'move' : 'moves'} in India: ${names.slice(0, 3).map(n => `${n.name} (${n.company})`).join(', ')}${names.length > 3 ? ' and more' : ''}.`.slice(0, 158);
  const list = names.map(n => `<li><strong>${n.linkedin ? `<a href="${esc(n.linkedin)}" target="_blank" rel="noopener nofollow">${esc(n.name)}</a>` : esc(n.name)}</strong><span>${esc(n.role_title)} at ${esc(n.company)}${n.prev_role ? `. Previously ${esc(n.prev_role)}` : ''}</span></li>`).join('');
  const body = `<div class="mv-wrap">
<section class="mv-hero"><p class="mv-crumb"><a href="/">Home</a> / <a href="/moves">Boardroom Moves</a> / The Brief</p><p class="mv-meta">The Brief · ${niceDate(d + 'T12:00:00Z')}</p>
<h1 style="margin-top:14px">${esc(title)}</h1>
<p class="lead">${names.length} leadership ${names.length === 1 ? 'move' : 'moves'} in India this week, from the Boardroom CXO weekly Brief.</p></section>
<ul class="mv-brief-list">${list}</ul>
<p class="mv-brief-src">Written from public LinkedIn announcements. <a href="${esc(link)}" target="_blank" rel="noopener">Read the Brief on LinkedIn</a>. To correct or remove an entry, write to <a href="mailto:hire@boardroomcxo.com">hire@boardroomcxo.com</a>.</p>
${ctaBlock}</div>`;
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'NewsArticle', headline: title, url, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, description, datePublished: d, dateModified: d,
      image: [SITE + '/images/Homepage-Meta-removebg-preview.png'],
      author: { '@type': 'Organization', name: 'Boardroom CXO', url: SITE + '/' }, publisher: { '@type': 'Organization', name: 'Boardroom CXO', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/images/logo-boardroomcxo.png' } },
      isPartOf: { '@type': 'CollectionPage', name: 'Boardroom Moves', url: SITE + '/moves' },
      mentions: names.map(n => ({ '@type': 'Person', name: n.name, jobTitle: n.role_title, worksFor: { '@type': 'Organization', name: n.company } })) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Boardroom Moves', item: SITE + '/moves' }, { '@type': 'ListItem', position: 3, name: 'The Brief, ' + niceDate(d + 'T12:00:00Z'), item: url }] }] };
  return html(page({ title: `${title} | Boardroom Moves Brief`, description, canonical: url, image: SITE + '/images/Homepage-Meta-removebg-preview.png', jsonld, body }));
}

// The monthly report (SEO plan S2.2): every senior move the desk tracked that month, counted by function and sector.
// On boardroomcxo.com a month shows only once meta 'report:<yyyy-mm>' holds its publish date, set after Ketul checks it.
// On the desk preview address the draft always shows, marked noindex, so it can be checked first.
// Leaders are named only if they already appeared in a live feature or a published Brief; everyone else is counted, not named.
const REPORT_FN = [
  ['CEO and MD', /\b(ceo|chief executive|managing director|md|president|founder|country (head|manager))\b/i],
  ['Marketing and brand', /\b(cmo|marketing|brand|communications|martech)\b/i],
  ['Operations', /\b(coo|chief operating|operations)\b/i],
  ['Sales and business development', /\b(sales|cso|business development|revenue|account management|partnerships)\b/i],
  ['Business and growth heads', /\b(cbo|chief business|business head|growth|cgo|consumer business|vertical head)\b/i],
  ['Finance and investment', /\b(cfo|finance|financial|chief investment)\b/i],
  ['Technology', /\b(cto|technology|engineering|chief information|digital transformation)\b/i],
  ['HR', /\b(chro|hr|human resources|people|talent)\b/i],
  ['Retail and merchandising', /\b(merchandis\w*|retail|category)\b/i],
  ['Strategy', /\b(strategy|chief of staff)\b/i]];
const REPORT_SECTOR = [
  ['FMCG, food and agri', /fmcg|food|beverage|agri|produce/i],
  ['Retail, fashion and consumer brands', /retail|fashion|apparel|denim|jewel|d2c|luggage|consumer (brand|durable|electronic)|grocery/i],
  ['Healthcare and pharma', /health|pharma|genomic|hospital/i],
  ['Financial services', /financ|nbfc|bank|fintech|broking|asset|insurance|invest/i],
  ['Media, advertising and entertainment', /media|music|advertis|gaming|entertainment|sports/i],
  ['Real estate', /real estate|realty/i],
  ['Technology and IT services', /\bit\b|software|tech|\bai\b|digital|saas|edtech/i],
  ['Industrial, auto, energy and telecom', /auto|\bev\b|steel|industrial|engineering|solar|energy|lighting|electrical|telecom|mobility/i]];
const fnOf = role => (REPORT_FN.find(([, re]) => re.test(String(role || '').replace(/\b(senior |executive |assistant )?vice[- ]president\b|\b[aes]?vp\b/gi, ' '))) || ['Other'])[0];
const sectorOf = s => (REPORT_SECTOR.find(([, re]) => re.test(s || '')) || ['Other B2B and services'])[0];
const monthName = m => new Date(m + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
async function publishedReports(db) {
  return ((await db.prepare("SELECT substr(key, 8) AS m, value AS d FROM meta WHERE key LIKE 'report:%' AND value <> '' ORDER BY key DESC").all()).results || [])
    .filter(r => /^\d{4}-\d{2}$/.test(r.m));
}
async function reportData(db, m) {
  const leads = (await db.prepare(`SELECT id, name, role_title, company, sector, move_date, brief_date, stage FROM leads
    WHERE substr(move_date, 1, 7) = ? AND stage <> 'removed' AND source_url IS NOT NULL AND source_url <> '' ORDER BY move_date, name`).bind(m).all()).results || [];
  const live = (await db.prepare(`SELECT lead_id, name, role_title, company, slug, tier, pack_id FROM orders WHERE ${LIVE} AND substr(live_at, 1, 7) = ?`).bind(m).all()).results || [];
  const briefs = new Set((await publishedBriefs(db, 500)).map(b => b.d));
  const pageOf = new Map(live.filter(isDedicated).map(o => [o.lead_id, o.slug]));
  const named = leads.map(l => pageOf.has(l.id) ? { ...l, href: '/moves/' + pageOf.get(l.id) }
    : l.brief_date && briefs.has(l.brief_date) && !['declined', 'linked'].includes(l.stage) ? { ...l, href: '/moves/brief/' + l.brief_date } : null).filter(Boolean);
  const count = key => Object.entries(leads.reduce((a, l) => ((a[key(l)] = (a[key(l)] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const dates = leads.map(l => l.move_date).filter(Boolean).sort();
  return { leads, named, byFn: count(l => fnOf(l.role_title)), bySector: count(l => sectorOf(l.sector)), first: dates[0], last: dates[dates.length - 1] };
}

export async function renderReport(env, param, request) {
  const db = env.MOVES_DB;
  await ensureSchema(db);
  const [, m, csv] = String(param).match(/^(\d{4}-\d{2})(\.csv)?$/) || [];
  if (!m) return notFound();
  const published = (await db.prepare('SELECT value FROM meta WHERE key = ?').bind('report:' + m).first() || {}).value || '';
  const draft = !published && new URL(request.url).hostname !== 'boardroomcxo.com';
  if (!published && !draft) return notFound();
  const r = await reportData(db, m);
  if (!r.leads.length) return notFound();
  if (csv) {
    const rows = [['month', 'breakdown', 'group', 'moves']].concat(r.byFn.map(([k, n]) => [m, 'function', k, n]), r.bySector.map(([k, n]) => [m, 'sector', k, n]));
    return new Response(rows.map(x => x.map(v => /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n') + '\n',
      { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, max-age=600', ...(draft ? { 'X-Robots-Tag': 'noindex' } : {}) } });
  }
  const name = monthName(m), url = `${SITE}/moves/report/${m}`, total = r.leads.length;
  const title = `Senior leadership moves in India: ${name}`;
  const day = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const span = r.first && r.last ? `between ${day(r.first)} and ${day(r.last)} ${m.slice(0, 4)}` : `in ${name}`;
  const pct = n => Math.round((n / total) * 100) + '%';
  const summary = `Boardroom Moves tracked ${total} senior leadership ${total === 1 ? 'move' : 'moves'} in India announced ${span}. ${r.byFn[0][0]} roles moved most (${r.byFn[0][1]}), and the most appointments were in ${r.bySector[0][0].replace(/^Other /, 'other ').replace(/^(?!FMCG)\w/, c => c.toLowerCase())} (${r.bySector[0][1]}).`;
  const table = (head, rows) => `<table class="mv-table"><thead><tr><th>${head}</th><th>Moves</th><th>Share</th></tr></thead><tbody>${rows.map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td><td>${pct(n)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td>${total}</td><td>100%</td></tr></tfoot></table>`;
  const namedList = r.named.length ? `<h2>Leaders featured this month</h2><ul class="mv-brief-list">${r.named.map(n => `<li><strong><a href="${esc(n.href)}">${esc(n.name)}</a></strong><span>${esc(n.role_title)} at ${esc(n.company)}</span></li>`).join('')}</ul>` : '';
  const description = summary.slice(0, 158);
  const body = `<div class="mv-wrap">
<section class="mv-hero">${draft ? '<p class="mv-draft">Draft, not published. Only the team sees this address; it goes on boardroomcxo.com once Ketul approves it.</p>' : ''}<p class="mv-crumb"><a href="/">Home</a> / <a href="/moves">Boardroom Moves</a> / Monthly report</p><p class="mv-meta">Monthly report · ${esc(name)}</p>
<h1 style="margin-top:14px">${esc(title)}</h1>
<p class="lead">${esc(summary)}</p></section>
<div class="mv-report">
<h2>By function</h2>${table('Function', r.byFn)}
<h2>By sector</h2>${table('Sector', r.bySector)}
${namedList}
<h2>How we count</h2>
<p>Each move is a senior appointment at a company in India, taken from a public LinkedIn announcement that the Boardroom Moves team recorded. It is a record of the moves we tracked, not every move in India. Functions and sectors are grouped from the job title and the company's business. We name only leaders already featured in Boardroom Moves or the weekly Brief; the rest are counted, not named.</p>
<p><a href="/moves/report/${m}.csv">Download the counts (CSV)</a>. To correct an entry, write to <a href="mailto:hire@boardroomcxo.com">hire@boardroomcxo.com</a>.</p>
</div>
${ctaBlock}</div>`;
  const pub = published || todayIst();
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: title, url, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, description, datePublished: pub, dateModified: pub,
      image: [SITE + '/images/Homepage-Meta-removebg-preview.png'],
      author: { '@type': 'Organization', name: 'Boardroom CXO', url: SITE + '/' }, publisher: { '@type': 'Organization', name: 'Boardroom CXO', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/images/logo-boardroomcxo.png' } },
      isPartOf: { '@type': 'CollectionPage', name: 'Boardroom Moves', url: SITE + '/moves' } },
    { '@type': 'Dataset', name: `Boardroom Moves: senior leadership moves in India, ${name}`, description: `Counts of senior leadership moves in India tracked by Boardroom Moves in ${name}, by function and by sector.`,
      url, temporalCoverage: m, spatialCoverage: { '@type': 'Place', name: 'India' }, creator: { '@type': 'Organization', name: 'Boardroom CXO', url: SITE + '/' },
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${url}.csv` }] },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Boardroom Moves', item: SITE + '/moves' }, { '@type': 'ListItem', position: 3, name: `Monthly report, ${name}`, item: url }] }] };
  return html(page({ title: `${title} | Boardroom Moves`, description, canonical: url, image: SITE + '/images/Homepage-Meta-removebg-preview.png', jsonld, robots: draft ? 'noindex' : 'index, follow', body }),
    200, draft ? { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } : {});
}

export async function serveProfileImage(env, slug) {
  const db = env.MOVES_DB;
  await ensureSchema(db);
  const row = await db.prepare(`SELECT i.file_key FROM images i JOIN orders o ON o.id = i.order_id WHERE o.slug = ? AND i.kind = 'website' AND ${LIVE.replace(/(status|removed_at|slug)/g, 'o.$1')}`).bind(slug).first();
  const obj = row && await env.MOVES_FILES.get(row.file_key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
}

export async function renderSitemap(env) {
  const db = env.MOVES_DB;
  await ensureSchema(db);
  const rows = (await db.prepare(`SELECT slug, tier, pack_id, live_at, updated_at FROM orders WHERE ${LIVE} ORDER BY live_at DESC`).all()).results || [];
  const urls = [`<url><loc>${SITE}/moves</loc>${rows[0] ? `<lastmod>${String(rows[0].live_at).slice(0, 10)}</lastmod>` : ''}</url>`]
    .concat(rows.filter(isDedicated).map(r => `<url><loc>${SITE}/moves/${r.slug}</loc><lastmod>${String(r.updated_at || r.live_at).slice(0, 10)}</lastmod></url>`))
    .concat((await publishedBriefs(db, 500)).map(b => `<url><loc>${SITE}/moves/brief/${b.d}</loc><lastmod>${b.d}</lastmod></url>`))
    .concat((await publishedReports(db)).map(x => `<url><loc>${SITE}/moves/report/${x.m}</loc><lastmod>${x.d}</lastmod></url>`));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

function notFound() {
  return html(page({ title: 'Not found | Boardroom Moves', description: 'This Boardroom Moves page is not available.', canonical: SITE + '/moves', image: SITE + '/images/Homepage-Meta-removebg-preview.png',
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Not found' }, robots: 'noindex',
    body: `<div class="mv-wrap"><section class="mv-hero"><p class="mv-crumb"><a href="/moves">Boardroom Moves</a></p><h1>This page is not available</h1><p class="lead">It may have been removed at the leader's request. <a href="/moves" style="border-bottom:1px solid">See all Boardroom Moves</a>.</p></section></div>` }), 404);
}
