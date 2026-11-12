"""Statistics page: Leadership hiring and moves in India 2026, at /leadership-moves-india-statistics-2026.

The counts come from data/moves-archive.json (the Boardroom Moves posts on the Boardroom CXO LinkedIn page) and
the tags below: one line per move with its function, sector, city (only when the post names one) and whether
the leader was promoted inside the company or joined from outside (only as the post says it). The October 2026
figures are copied from the live monthly report at /moves/report/2026-10 (its CSV, read on 4 Nov 2026).
Run from the repo root after adding moves to the archive and tagging them here:

    python tools/stats.py

It writes leadership-moves-india-statistics-2026.html and leadership-moves-india-statistics-2026.csv.
The head, CTA block and footer come from tools/faq.py and tools/chrome.py, so the page matches the site.
"""
import csv
import html
import io
import json
import re
from collections import Counter

from chrome import header
from faq import SITE, head, tail, cta_block, crumbs

SLUG = 'leadership-moves-india-statistics-2026'
PATH = '/' + SLUG
URL = SITE + PATH
CSV_PATH = PATH + '.csv'
DATE = '2026-11-04'
TITLE = 'India Leadership Hiring & Moves 2026: Statistics | Boardroom CXO'
H1 = 'Leadership hiring and moves in India 2026'

# Function groups (what the role does, read from the title and the post, not only the title words).
CEO = 'CEO, MD and country head'
BIZ = 'Business head (CBO, business unit or P&L head)'
SALES = 'Sales and business development'
HR = 'HR and talent (including CHRO)'
OPS = 'Operations (including COO)'
MKT = 'Marketing, brand and content (including CMO)'
TECH = 'Technology, data and product'
SCM = 'Supply chain and procurement'
FIN = 'Finance, investment and credit (including CFO)'
ADV = 'Consulting and advisory practice'
LEGAL = 'Legal and company secretarial'
OTHER = 'Other (strategy, advisory, innovation)'

# Sector groups.
S_TECH = 'Technology and IT services'
S_FIN = 'Banking, financial services and insurance'
S_IND = 'Industrial, manufacturing, auto and building materials'
S_MEDIA = 'Media, advertising, entertainment and sport'
S_ENERGY = 'Energy, power and infrastructure'
S_PRO = 'Consulting, audit and staffing'
S_HEALTH = 'Healthcare and pharma'
S_FOOD = 'FMCG, food and agri'
S_RE = 'Real estate'
S_NET = 'E-commerce and internet platforms'
S_EDU = 'Education, research and public bodies'
S_HOSP = 'Hospitality, travel and food service'
S_OTHER = 'Diversified group'

INT = 'Promoted or moved up inside the same company or group'
EXT = 'Joined from another organisation'
NS = 'Not stated in the announcement'

# slug: (function, sector, city named in the post or '', move type, came back to a former employer)
TAGS = {
    'amit-dhadda-sterling-tools': (FIN, S_IND, '', EXT, False),
    'mukesh-kestwal-british-high-commission': (OTHER, S_EDU, '', EXT, False),
    'mithaleshwar-yadav-john-cockerill': (SALES, S_IND, '', INT, False),
    'jyoti-arora-hindware': (SALES, S_IND, '', EXT, True),
    'pradeep-nidamarthi-pl-capital-group': (BIZ, S_FIN, '', EXT, False),
    'sahil-sarvaiya-dohlergroup': (BIZ, S_FOOD, '', EXT, False),
    'shankar-sharan-ongc-petrochemicals-marketing': (CEO, S_ENERGY, '', INT, False),
    'shivank-gupta-kpmg-global-services': (ADV, S_PRO, '', INT, False),
    'samridhi-kumari-alliancebernstein': (LEGAL, S_FIN, '', INT, False),
    'manu-mohanan-protiviti': (ADV, S_PRO, '', EXT, False),
    'yash-jain-ey-parthenon': (ADV, S_PRO, '', INT, False),
    'praveen-kumar-patel-coupang': (OPS, S_NET, '', EXT, False),
    'yamini-m-altudo': (SALES, S_TECH, '', EXT, False),
    'pratham-rai-esds-software-solution': (SALES, S_TECH, '', EXT, False),
    'varun-jain-credit-saison': (FIN, S_FIN, '', EXT, False),
    'sambbhav-k-storytv-app': (MKT, S_MEDIA, '', EXT, False),
    'ankit-sawhney-sap': (SALES, S_TECH, '', EXT, False),
    'prakash-arunachalam-tiger-analytics': (OPS, S_TECH, '', EXT, False),
    'satish-chandra-altimetrik': (SALES, S_TECH, '', EXT, False),
    'vaanya-gupta-bhanzu': (MKT, S_EDU, '', EXT, False),
    'himanshu-rathore-anarock': (BIZ, S_RE, 'Pune', EXT, False),
    'anshul-kapur-anarock': (FIN, S_RE, 'Pune', EXT, False),
    'shubhlash-tiwari-ofbusiness': (HR, S_NET, '', EXT, False),
    'harshvardhan-singh-solanki-aggreko': (HR, S_ENERGY, '', EXT, False),
    'ashish-mishra-zee-entertainment-enterprises': (MKT, S_MEDIA, '', EXT, False),
    'naveen-kumar-rai-ofbusiness': (HR, S_NET, '', EXT, False),
    'aman-sanghrajka-invideo': (HR, S_TECH, '', EXT, False),
    'rajgopal-nair-rdash': (BIZ, S_TECH, '', EXT, False),
    'shoubhik-roy-dentsu-creative': (MKT, S_MEDIA, '', INT, False),
    'tanya-singh-vertex-group': (MKT, S_OTHER, '', EXT, False),
    'anil-sahni-art-housing-finance': (CEO, S_FIN, '', INT, False),
    'uday-harle-shilpa-biologicals': (CEO, S_HEALTH, '', EXT, False),
    'mohiit-bagla-ferrero': (SALES, S_FOOD, '', INT, False),
    'mahidhwaj-sisodia-usv': (BIZ, S_HEALTH, '', INT, False),
    'johnson-paulraj-jll': (SALES, S_RE, '', INT, False),
    'abhijit-joshi-commercial-vehicle-group': (CEO, S_IND, '', EXT, False),
    'sunil-kuswaha-zetsol-energy': (SCM, S_ENERGY, '', EXT, False),
    'mukesh-nandan-jha-transformers-rectifiers': (SCM, S_ENERGY, '', EXT, False),
    'vishal-maru-phi-commerce': (TECH, S_FIN, '', EXT, False),
    'suraj-shiva-vaigankar-uniliv': (HR, S_RE, '', EXT, False),
    'jay-shukla-nanavati-max-super': (SALES, S_HEALTH, '', INT, False),
    'arshad-mumtaz-movate': (BIZ, S_TECH, '', EXT, False),
    'saurabh-lall-kims-hospitals-hyderabad': (OPS, S_HEALTH, 'Hyderabad', EXT, False),
    'shailesh-srivastava-delhi-press': (OPS, S_MEDIA, '', EXT, False),
    'avinash-tiwary-havas-media-network': (BIZ, S_MEDIA, '', INT, False),
    'sandeep-bist-stl-sterling-tools': (HR, S_IND, '', EXT, False),
    'i-v-s-ranganath-tropolite-foods': (HR, S_FOOD, '', EXT, False),
    'karan-chhabra-seesec': (BIZ, S_TECH, '', EXT, False),
    'retesh-mathur-montra-electric-truck': (OPS, S_IND, '', EXT, False),
    'sonia-bali-businessnext': (HR, S_TECH, '', INT, False),
    'venkatesh-sarvasiddhi-royal-society-chemistry': (CEO, S_EDU, '', EXT, False),
    'divyesh-dagli-mahindra-finance': (TECH, S_FIN, '', EXT, False),
    'sudip-dasgupta-cognizant': (TECH, S_TECH, '', EXT, True),
    'abhishek-sobti-fives-digital': (OPS, S_TECH, '', EXT, False),
    'sameer-shaikh-travel-food-services': (SCM, S_HOSP, '', EXT, False),
    'ravi-ahuja-danway-electrical-mechanical': (SCM, S_ENERGY, '', EXT, False),
    'puneet-awasthie-adani-group': (BIZ, S_ENERGY, '', EXT, False),
    'ankush-raina-nxtgen-cloud-technologies': (SALES, S_TECH, '', INT, False),
    'soham-d-tailored-management': (SALES, S_PRO, '', NS, False),
    'v-r-rajessh-aurassure': (SALES, S_TECH, '', EXT, False),
    'raghavendra-kulkarni-pwc': (ADV, S_PRO, '', EXT, False),
    'shashi-kumar-affordplan': (BIZ, S_HEALTH, '', EXT, False),
    'prakash-krishnappa-megha-engineering-infrastructures': (HR, S_ENERGY, '', EXT, False),
    'amit-anand-adobe': (LEGAL, S_TECH, '', EXT, False),
    'himanshu-shekhar-mishra-ultratech-cement': (SALES, S_IND, '', EXT, False),
    'naveen-kumar-rai-pratibha-syntex': (HR, S_IND, 'Indore', EXT, False),
    'akash-mitra-kisaan-se-kitchen': (BIZ, S_FOOD, '', EXT, False),
    'pratik-bhurake-orangebits-digital-solutions': (OPS, S_TECH, '', EXT, False),
    'krc-murty-sbi-life-insurance': (TECH, S_FIN, '', EXT, False),
    'pramod-singh-bdx-data-centers': (HR, S_TECH, '', EXT, False),
    'santosh-upadhyay-flipspaces': (SCM, S_RE, '', EXT, False),
    'ayush-kumar-new-delhi-institute': (CEO, S_EDU, 'Delhi', EXT, False),
    'akshay-sial-gsr-food-factory': (CEO, S_HOSP, '', EXT, False),
    'shaji-prabhakaran-goat-tour': (OTHER, S_MEDIA, '', EXT, False),
    'mohammad-ali-jiostar': (OTHER, S_MEDIA, '', INT, False),
    'ashutosh-kumar-ceipal': (TECH, S_TECH, '', EXT, False),
    'ramaswamy-subramanian-dvara-kgfs': (CEO, S_FIN, '', EXT, True),
    'sarika-bhatt-novasol-ingredients': (HR, S_FOOD, '', EXT, False),
    'dalai-roopdhar-nanda-goutham-yesmadam': (BIZ, S_NET, '', EXT, False),
}

# Chief-level titles, read from the job title as announced.
CHIEF = [('Deputy CEO', r'\bdy\. ceo\b'), ('Chief Executive Officer (CEO)', r'\b(ceo|chief executive)\b'),
         ('Chief Business Officer (CBO)', r'chief business officer'), ('Chief Operating Officer (COO)', r'chief operating officer'),
         ('Chief Financial Officer (CFO)', r'chief financial officer'), ('Chief Marketing Officer (CMO)', r'chief marketing officer'),
         ('Chief Human Resources Officer (CHRO)', r'chief human resources officer'), ('Chief Sales Officer (CSO)', r'chief sales officer'),
         ('Other chief titles', r'\bchief\b')]

# The live monthly report for October 2026 (/moves/report/2026-10.csv, read 4 Nov 2026): 36 moves the desk tracked,
# announced 17 to 27 October 2026, grouped by title and sector rules in functions/_moves/public.js.
OCT = {'total': 36, 'from': '17 October', 'to': '27 October 2026',
       'function': [('Marketing and brand', 13), ('Business and growth heads', 11), ('Sales and business development', 5),
                    ('CEO and MD', 2), ('Operations', 2), ('Other', 1), ('Retail and merchandising', 1), ('Strategy', 1)],
       'sector': [('Technology and IT services', 9), ('Media, advertising and entertainment', 5), ('Retail, fashion and consumer brands', 5),
                  ('FMCG, food and agri', 4), ('Industrial, auto, energy and telecom', 4), ('Financial services', 3),
                  ('Other B2B and services', 3), ('Real estate', 2), ('Healthcare and pharma', 1)]}

# Market context from a public source we opened and read (figure, what it measures, source line).
NAUKRI = ('Naukri JobSpeak, October 2026 (Info Edge)', 'https://www.infoedge.in/pdfs/News_Events_pdfs/Naukri-Jobspeak-October-2026.pdf')

MONTHS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']


def month_name(m):
    y, mm = m.split('-')
    return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][int(mm) - 1] + ' ' + y


def nice(d):
    y, m, dd = d.split('-')
    return f'{int(dd)} {month_name(y + "-" + m)}'


def chief_of(role):
    r = role.lower()
    for label, pat in CHIEF:
        if re.search(pat, r):
            return label
    return ''


def pct(n, total):
    return f'{round(100 * n / total)}%'


def load():
    moves = json.load(open('data/moves-archive.json', encoding='utf-8'))
    missing = [m['slug'] for m in moves if m['slug'] not in TAGS]
    extra = set(TAGS) - {m['slug'] for m in moves}
    if missing or extra:
        raise SystemExit(f'Tag every move first. Missing: {missing} Unknown: {sorted(extra)}')
    rows = []
    for m in sorted(moves, key=lambda x: x['date']):
        fn, sector, city, kind, back = TAGS[m['slug']]
        rows.append(dict(date=m['date'], name=m['name'], role_title=m['role_title'], company=m['company'], function=fn,
                         sector=sector, city=city, move_type=kind, returned=back, chief=chief_of(m['role_title']),
                         url=f"{SITE}/moves/{m['slug']}"))
    return rows


def stats(rows):
    n = len(rows)
    by = lambda k: Counter(r[k] for r in rows).most_common()
    month = Counter(r['date'][:7] for r in rows)
    return dict(
        n=n, people=len({r['name'].lower().replace('.', '') for r in rows}), first=rows[0]['date'], last=rows[-1]['date'],
        fn=sorted(by('function'), key=lambda x: (-x[1], x[0])), sector=sorted(by('sector'), key=lambda x: (-x[1], x[0])),
        kind=[(k, sum(r['move_type'] == k for r in rows)) for k in (EXT, INT, NS)],
        returned=sum(r['returned'] for r in rows),
        city=sorted(Counter(r['city'] for r in rows if r['city']).most_common(), key=lambda x: (-x[1], x[0])),
        chief=sorted([(label, sum(r['chief'] == label for r in rows)) for label, _ in CHIEF if any(r['chief'] == label for r in rows)], key=lambda x: (x[0] == 'Other chief titles', -x[1])),
        month=[(m, month.get(m, 0)) for m in MONTHS],
        y2026=sum(r['date'].startswith('2026') for r in rows))


def table(label, items, total, share=True, caption=''):
    e = html.escape
    sh = (lambda x: x) if share else (lambda x: '')
    body = ''.join(f'<tr><td>{e(k)}</td><td>{v}</td>{sh(f"<td>{pct(v, total)}</td>")}</tr>' for k, v in items)
    cap = f'<caption>{e(caption)}</caption>' if caption else ''
    th_share = sh('<th scope="col">Share</th>')
    return (f'<div class="st-scroll"><table class="st-table">{cap}<thead><tr><th scope="col">{e(label)}</th><th scope="col">Moves</th>'
            f'{th_share}</tr></thead><tbody>{body}</tbody>'
            f'<tfoot><tr><td>Total</td><td>{sum(v for _, v in items)}</td>{sh("<td>100%</td>")}</tr></tfoot></table></div>')


STYLE = '''<style>
.st-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:15px;margin:8px 0 12px}
.st-table caption{text-align:left;font-family:var(--font-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2);padding:0 0 10px}
.st-table th,.st-table td{text-align:left;padding:11px 8px 11px 0;border-bottom:1px solid var(--line);vertical-align:top}
.st-table th:not(:first-child),.st-table td:not(:first-child){text-align:right;width:80px;white-space:nowrap}
.st-table th{font-family:var(--font-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2);font-weight:500}
.st-table tfoot td{font-weight:600;border-bottom:0}
.st-scroll{overflow-x:auto}
.st-note{font-size:15px !important;color:var(--ink-2) !important}
.st-band{margin:0 0 8px}
.st-band .stats-band-label{max-width:26ch}
@media (max-width:900px){.st-band.stats-band{grid-template-columns:1fr 1fr}.st-band .stats-band-item{padding:28px 20px;border-bottom:1px solid var(--line)}}
@media (max-width:520px){.st-band.stats-band{grid-template-columns:1fr}.st-band .stats-band-item{border-right:none}}
</style>
'''


def build(rows):
    e = html.escape
    s = stats(rows)
    n = s['n']
    ext = dict(s['kind'])[EXT]
    internal = dict(s['kind'])[INT]
    top_fn = s['fn'][:3]
    top_sector = s['sector'][0]
    chief_total = sum(v for _, v in s['chief'])
    no_city = n - sum(v for _, v in s['city'])
    span = f"{nice(s['first'])} to {nice(s['last'])}"
    between = f"{nice(s['first'])} and {nice(s['last'])}"
    answer = (f"Boardroom Moves announced {n} senior leadership moves in India between {between}. "
              f"{ext} of the {n} leaders ({pct(ext, n)}) joined from another organisation and {internal} ({pct(internal, n)}) were promoted inside their company or group. "
              f"Sales and business development ({dict(s['fn'])[SALES]}), HR and talent ({dict(s['fn'])[HR]}) and business head roles ({dict(s['fn'])[BIZ]}) moved most, "
              f"and technology and IT services was the busiest sector ({top_sector[1]} moves). These counts cover the announcements Boardroom CXO tracked, not every leadership move in India.")
    desc = (f'{n} senior leadership moves in India tracked by Boardroom Moves, Dec 2025 to Oct 2026: by function, sector, '
            'month and promotion vs outside hire. CSV download.')

    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Article', '@id': URL + '#article', 'headline': H1, 'description': desc, 'url': URL, 'inLanguage': 'en',
         'datePublished': DATE, 'dateModified': DATE, 'isPartOf': {'@id': SITE + '/#website'},
         'author': {'@id': SITE + '/#organization'}, 'publisher': {'@id': SITE + '/#organization'},
         'mainEntityOfPage': URL, 'about': ['Executive hiring in India', 'Leadership appointments in India'],
         'image': SITE + '/images/Homepage-Meta-removebg-preview.png'},
        {'@type': 'Dataset', '@id': URL + '#dataset', 'name': 'Boardroom Moves: senior leadership moves in India, 2025 to 2026',
         'description': (f'{n} senior leadership appointments in India announced on the Boardroom CXO LinkedIn page between {between}, '
                         'one row per move with job title, company, function group, sector group, city where the announcement names one, '
                         'and whether the leader was promoted internally or joined from outside. It covers the moves Boardroom CXO tracked, not all of India.'),
         'url': URL, 'creator': {'@id': SITE + '/#organization'}, 'publisher': {'@id': SITE + '/#organization'},
         'temporalCoverage': f"{s['first']}/{s['last']}", 'spatialCoverage': {'@type': 'Place', 'name': 'India'},
         'keywords': ['leadership hiring India', 'CXO appointments India', 'executive moves India', 'CEO CFO CMO CHRO appointments'],
         'isAccessibleForFree': True, 'license': 'https://creativecommons.org/licenses/by/4.0/',
         'variableMeasured': ['function', 'sector', 'city', 'move type', 'month'],
         'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'text/csv', 'contentUrl': SITE + CSV_PATH}],
         'datePublished': DATE, 'dateModified': DATE},
        crumbs(('Home', '/'), ('Boardroom Moves', '/moves'), (H1, PATH)),
    ]}

    tiles = [(str(n), 'Senior moves tracked', span),
             (pct(ext, n), 'Joined from outside', f'{ext} of {n}; {internal} promoted inside'),
             (str(chief_total), 'Chief-level titles', 'CEO, CBO, COO, CFO, CMO, CHRO and more'),
             (str(top_sector[1]), 'In technology and IT services', 'the busiest sector')]
    band = ''.join(f'''
      <div class="stats-band-item">
        <div class="stats-band-num">{e(a)}</div>
        <div class="stats-band-label">{e(b)}</div>
        <p class="st-note" style="margin:0;font-size:14px;">{e(c)}</p>
      </div>''' for a, b, c in tiles)

    fn_rows = s['fn']
    oct_total = OCT['total']
    naukri = f'<a href="{NAUKRI[1]}" target="_blank" rel="noopener">{e(NAUKRI[0])}</a>'

    main = f'''
<section class="article-hero">
  <div class="container">
    <div class="article-hero-inner">
      <div class="crumb"><a href="/" style="color:inherit;">Home</a> · <a href="/moves" style="color:inherit;">Boardroom Moves</a> · Statistics</div>
      <h1>{e(H1)}</h1>
      <div class="meta">
        <span>Boardroom Moves data</span>
        <time datetime="{DATE}">· Updated 4 November 2026</time>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:48px;padding-bottom:0;">
  <div class="container">
    <div class="stats-band st-band" data-testid="stats-band">{band}
    </div>
  </div>
</section>

<article class="article-body container">

  <p>{e(answer)}</p>

  <h2>What these numbers cover</h2>
  <p>Every count on this page is a move that <a href="/moves">Boardroom Moves</a> announced on the Boardroom CXO LinkedIn page: a senior appointment of a leader working in India, almost always at a company in India (a few roles also cover other regions), taken from the leader's own public announcement. That is a sample of the moves we tracked, not a census of leadership hiring in India. A sector or function with more moves here means we announced more of them, which may or may not match the whole market.</p>
  <p>Function and sector groups are read from the job title, the company's business and what the post says the role does. A move counts as a promotion only when the post says the leader was elevated or already worked at the company or its group; it counts as an outside hire when the post shows the leader arriving from another employer. One leader, Naveen Kumar Rai, moved twice in the period, so the {n} moves cover {s['people']} people.</p>

  <h2>Leadership moves by function</h2>
  <p>Sales and business development, HR and talent, and business head roles together make up {sum(v for _, v in top_fn)} of the {n} moves ({pct(sum(v for _, v in top_fn), n)}). Finance and marketing leadership moves were fewer in this set: {dict(s['fn'])[FIN]} finance and {dict(s['fn'])[MKT]} marketing.</p>
  {table('Function', fn_rows, n, caption=f'Moves by function, {span}')}

  <h2>Chief-level appointments</h2>
  <p>{chief_total} of the {n} moves ({pct(chief_total, n)}) carry a "Chief" or CEO title. Chief Business Officer was the most common C-suite title, ahead of COO. No Chief Technology Officer move was announced in this period.</p>
  {table('Title', s['chief'], chief_total, caption='Moves with a chief-level title')}

  <h2>Leadership moves by sector</h2>
  <p>Technology and IT services led with {top_sector[1]} moves ({pct(top_sector[1], n)}), followed by {e(s['sector'][1][0].lower())} ({s['sector'][1][1]}) and {e(s['sector'][2][0].lower())} ({s['sector'][2][1]}).</p>
  {table('Sector', s['sector'], n, caption=f'Moves by sector, {span}')}

  <h2>Promoted inside or hired from outside</h2>
  <p>Most leaders in this set changed employer. {ext} moves ({pct(ext, n)}) were outside hires and {internal} ({pct(internal, n)}) were promotions inside the same company or group. {s['returned']} of the outside hires went back to a company they had worked for before.</p>
  {table('Move type', s['kind'], n, caption='Promotion vs outside hire, as the announcement states it')}

  <h2>Moves by month</h2>
  <p>{s['y2026']} of the {n} moves were announced in 2026 and {n - s['y2026']} in December 2025. Monthly totals follow how often the page posted, so treat a quiet month as fewer announcements, not fewer appointments.</p>
  {table('Month', [(month_name(m), v) for m, v in s['month']], n, share=False, caption='Moves announced per month')}

  <h2>Moves by city</h2>
  <p>Most announcements do not name a city: {no_city} of the {n} posts give none. Where a post does name the city of the role, it was {', '.join(f'{c} ({v})' for c, v in s['city'])}. That is too few to rank cities.</p>

  <h2>October 2026: the monthly report</h2>
  <p>The Boardroom Moves desk also counts every senior move it records in a month, including leaders who were not featured. The <a href="/moves/report/2026-10">October 2026 report</a> tracked {oct_total} senior leadership moves announced between {OCT['from']} and {OCT['to']}. Marketing and brand roles moved most ({OCT['function'][0][1]}, {pct(OCT['function'][0][1], oct_total)}), and technology and IT services had the most appointments ({OCT['sector'][0][1]}). The report uses its own groups and overlaps with the moves above, so do not add the two sets together.</p>
  {table('Function', OCT['function'], oct_total, caption='October 2026 report, by function')}
  {table('Sector', OCT['sector'], oct_total, caption='October 2026 report, by sector')}

  <h2>The wider market: senior hiring demand in India</h2>
  <p>For a view of the whole market rather than the moves we tracked, {naukri} measures new white-collar job postings on Naukri.com. It reported that hiring grew 14% year on year in October 2026, and that hiring for professionals with more than 16 years of experience grew 22%, led by auto and FMCG. It also showed gems and jewellery hiring up 21% year on year. These are job postings, not appointments, so they show demand for senior people rather than who moved.</p>

  <h2>Download the data</h2>
  <p><a href="{CSV_PATH}" download>Download the {n} moves as CSV</a>: one row per move with the date, leader, title, company, function group, sector group, city where named, move type and the Boardroom Moves page. You may reuse the counts with a link to this page. To correct an entry, write to <a href="mailto:hire@boardroomcxo.com">hire@boardroomcxo.com</a>.</p>

  <div class="article-faq" data-testid="sources">
    <h2>Sources</h2>
    <ul>
      <li>Boardroom CXO, <a href="/moves">Boardroom Moves</a>, announcements from {e(span)}</li>
      <li>Boardroom CXO, <a href="/moves/report/2026-10">Senior leadership moves in India: October 2026</a> (<a href="/moves/report/2026-10.csv">CSV</a>)</li>
      <li>Info Edge, {naukri.replace(e(NAUKRI[0]), 'Naukri JobSpeak report, October 2026')}</li>
    </ul>
  </div>

  <div class="article-faq" data-testid="related">
    <h2>Related</h2>
    <ul>
      <li><a href="/moves">Boardroom Moves: the latest senior leadership moves in India</a></li>
      <li><a href="/executive-search-faq">Executive Search FAQ: how a CXO search works, what it costs and how long it takes</a></li>
      <li><a href="/executive-search">Executive search at Boardroom CXO</a></li>
    </ul>
  </div>

  <div class="article-inline-cta">
    <h3>Hiring a CXO or senior leader?</h3>
    <p>Brief us on the role and we come back with real market data, who is movable and what the role actually costs, before you commit a budget.</p>
    <a href="/schedule-a-call" class="btn" style="background:var(--bg);color:var(--ink);border-color:var(--bg);" data-door="search" data-door-at="stats-inline">Hire a Leader</a>
    <a href="/get-featured" class="link-under" style="display:block;margin-top:16px;" data-door="moves" data-door-at="stats-inline">Made a leadership move? Get featured →</a>
  </div>
</article>

'''
    page = head(TITLE, desc, URL, 'article', ld).replace('</head>', STYLE + '</head>', 1)
    return page + header('moves') + '\n' + main + cta_block() + tail(), s


def write_csv(rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(['date', 'leader', 'role_title', 'company', 'function_group', 'sector_group', 'city', 'move_type', 'returned_to_former_employer', 'chief_title', 'boardroom_moves_page'])
    for r in rows:
        w.writerow([r['date'], r['name'], r['role_title'], r['company'], r['function'], r['sector'], r['city'], r['move_type'],
                    'yes' if r['returned'] else 'no', r['chief'], r['url']])
    open(SLUG + '.csv', 'w', encoding='utf-8-sig', newline='').write(buf.getvalue())


def main():
    rows = load()
    page, s = build(rows)
    open(SLUG + '.html', 'w', encoding='utf-8', newline='\n').write(page)
    write_csv(rows)
    print(f"{s['n']} moves: outside {dict(s['kind'])[EXT]}, promoted {dict(s['kind'])[INT]}; top function {s['fn'][0]}; top sector {s['sector'][0]}")


if __name__ == '__main__':
    main()
