"""Executive Search FAQ: the hub at /executive-search-faq and one page per question under /executive-search-faq/<slug>.

Every answer is built only from facts already on the site (process, fee, sectors, India and UAE, case studies)
or from a cited source. Run from the repo root after changing a question below:

    python tools/faq.py

It writes executive-search-faq.html and executive-search-faq/<slug>.html. The header and footer come from
tools/chrome.py, which also refreshes them on these pages when it runs.
"""
import html
import json
import os
import re

from chrome import header, footer

SITE = 'https://boardroomcxo.com'
HUB = '/executive-search-faq'
DATE = '2026-11-04'
CSS = '/style.css?v=20261108'
OG_IMAGE = SITE + '/images/Homepage-Meta-removebg-preview.png'

FUNCTION_PAGES = {
    'marketing': ('/marketing-leadership-hiring', 'Marketing &amp; CMO search'),
    'finance': ('/finance-leadership-hiring', 'CFO &amp; finance search'),
    'sales': ('/sales-leadership-hiring', 'Sales &amp; retail leadership search'),
    'hr': ('/hr-leadership-hiring', 'CHRO &amp; HR search'),
    'uae': ('/uae-consulting-hiring', 'UAE search'),
}

FEE = ("A Rs 10,000 service fee (including GST) starts the search, and it is adjusted against the final fee of one month's CTC, "
       "invoiced when your hire joins.")

# slug, question (H1), <title> text, meta description, one-line answer for the hub, direct answer (first paragraph),
# body HTML (H2 sections), related function pages, sources [(publisher, title, url, date)]
QUESTIONS = [
    dict(
        slug='how-executive-search-works',
        q='How does executive search work?',
        title='How Does Executive Search Work? | Boardroom CXO',
        desc='How an executive search works, stage by stage: a pay map, a role brief, a confidential headhunt and shortlist, and a realistic offer.',
        line='A search firm maps pay, defines the role, then quietly approaches people already doing the job at competitors.',
        answer=("Executive search is a way of hiring senior leaders in which a search firm researches the market and "
                "approaches people already doing the job, usually at competitors, instead of advertising the role. At "
                "Boardroom CXO a search runs in four stages: a pay map, a brief on what the role must deliver, a "
                "confidential headhunt and shortlist, and the offer."),
        body='''
  <h2>Stage 1: map the market before the mandate</h2>
  <p>In weeks 1 and 2 we confirm what the role pays across your category and city, before you lock a budget. You get category and city pay data, so the budget is set on what the market actually pays rather than on a guess.</p>

  <h2>Stage 2: define what the role must deliver</h2>
  <p>Next we agree the outcomes, the authority and the KPIs the leader must deliver over the next 12 to 24 months. This comes before any job description is written, because a CFO preparing a company for an IPO and a CFO running a steady business are different hires.</p>

  <h2>Stage 3: approach people already doing the job</h2>
  <p>In weeks 3 to 8 we approach people already working at scale inside competitor companies. The approach is intermediary-led: candidates hear about the role and choose to go further before your company's name is disclosed. The result is a confidential shortlist.</p>

  <h2>Stage 4: set an offer that closes</h2>
  <p>At the offer stage we give you a realistic uplift, usually 25 to 30%, not the 40 to 50% many companies offer. We give you that number upfront, so the offer is neither too low to close nor higher than it needs to be.</p>

  <h2>Why search works differently from a job advert</h2>
  <p>The best hires for a CXO role are usually not applying anywhere. They are already running a function for someone else, and they respond to a confidential, well-researched approach, often before any job description exists. That is the gap executive search fills.</p>

  <h2>Roles, sectors and markets</h2>
  <p>We search for CEOs, MDs and business heads, CFOs, CMOs, sales and retail heads, and CHROs, plus the layer just below the CXO. We work in five sectors: retail and jewellery, where our network is deepest; consumer and D2C; financial services; manufacturing; and technology. Searches run for companies in India and the UAE.</p>

  <h2>What it costs</h2>
  <p>''' + FEE + ''' More on this in <a href="/executive-search-faq/cxo-search-cost-india">how much a CXO search costs in India</a>.</p>
''',
        related=['marketing', 'finance', 'sales', 'hr'],
    ),
    dict(
        slug='cxo-search-cost-india',
        q='How much does a CXO search cost in India?',
        title='How Much Does a CXO Search Cost in India? | Boardroom CXO',
        desc="CXO executive search cost with Boardroom CXO: Rs 10,000 including GST to start, adjusted against a final fee of one month's CTC.",
        line="With Boardroom CXO, one month of the hire's CTC: Rs 10,000 (including GST) to start, adjusted against the final invoice when the hire joins.",
        answer=("With Boardroom CXO, a CXO search costs one month of the hire's CTC. A Rs 10,000 service fee (including GST) starts the "
                "search, and that amount is adjusted against the final fee, which is invoiced when your hire joins. Other "
                "firms price searches in other ways, so it is worth comparing what each fee covers and when it is due."),
        body='''
  <h2>How the fee works, step by step</h2>
  <ul>
    <li><strong>To start:</strong> a Rs 10,000 service fee (including GST).</li>
    <li><strong>When your hire joins:</strong> the final fee of one month's CTC is invoiced, with the Rs 10,000 already paid adjusted against it.</li>
  </ul>
  <p>So if the role's CTC works out to Rs 5 lakh a month, the final fee is Rs 5 lakh, and the invoice at joining is for that amount less the Rs 10,000 paid at the start.</p>

  <h2>What the fee covers</h2>
  <p>The search includes a map of what the role pays across your category and city before you set the budget, an agreed brief on what the role must deliver over the next 12 to 24 months, direct headhunting from competitor companies, a confidential shortlist, and guidance on a realistic offer.</p>

  <h2>The first conversation is free</h2>
  <p>Before any fee, you can brief us on the role on a free 30-minute call. We use it to understand the business and the role, and we come back with a read of the market before you commit a budget.</p>

  <h2>How this compares with other models</h2>
  <p>Search firms broadly charge in two ways. In retained search, a fee is charged at the start of the engagement. In contingency recruitment, the agency is paid only when its candidate is hired. Our model starts with a small fee and puts most of it at the point your hire joins. We explain the two models in <a href="/executive-search-faq/retained-vs-contingency-search">retained vs contingency search</a>.</p>

  <h2>Check what the role pays before you set the budget</h2>
  <p>The fee is the smaller part of the cost of a CXO hire. The bigger number is the package. Our <a href="/">compensation tool on the homepage</a> shows ranges by role, store count and city tier, built from our 2025-26 market mapping, and the pay map at the start of each search confirms it for your category and city.</p>
''',
        related=['finance', 'marketing', 'sales', 'hr'],
    ),
    dict(
        slug='time-to-hire-cmo-cfo-chro',
        q='How long does it take to hire a CMO, CFO or CHRO?',
        title='How Long Does It Take to Hire a CMO, CFO or CHRO?',
        desc='How long a CMO, CFO or CHRO search takes: about 8 weeks to a confidential shortlist with Boardroom CXO, then the notice period.',
        line='About 8 weeks to a confidential shortlist with Boardroom CXO; the start date then depends on the notice period.',
        answer=("With Boardroom CXO, a CMO, CFO or CHRO search is built to reach a confidential shortlist in about 8 weeks: "
                "weeks 1 and 2 map what the role pays in your category and city, and weeks 3 to 8 approach and shortlist "
                "people already doing the job. The start date then depends on the leader's notice period."),
        body='''
  <h2>The timeline, stage by stage</h2>
  <ul>
    <li><strong>Weeks 1 and 2:</strong> we map what the role pays across your category and city.</li>
    <li><strong>Role brief:</strong> we agree the outcomes, authority and KPIs for the next 12 to 24 months.</li>
    <li><strong>Weeks 3 to 8:</strong> we approach people already doing the job at competitor companies and build a confidential shortlist.</li>
    <li><strong>Offer stage:</strong> interviews, the offer and acceptance, with a realistic uplift of usually 25 to 30%.</li>
  </ul>

  <h2>What our case studies show</h2>
  <p>For a pre-IPO jewellery brand whose earlier CFO searches had stalled for months, we shortlisted four CFOs from listed retail companies, and the time to placement was 8 weeks. For a Singapore company entering India, a Finance Head was placed in 6 weeks. Every search is different, and both are on our <a href="/case-studies">case studies</a> page.</p>

  <h2>What changes between a CMO, CFO and CHRO search</h2>
  <p>The stages are the same. What changes is the profile we screen for. A CMO search for a retail or D2C brand needs the right mix of brand building and ROAS-literate performance marketing. A CFO search often needs pre-IPO, SEBI or cross-border experience. A CHRO search for a brand adding stores needs someone who can scale hiring and culture across a growing network. The narrower the profile, the smaller the pool of people to approach.</p>

  <h2>What adds time after the offer</h2>
  <p>The biggest variable after acceptance is the notice period. A sitting CXO has to serve the notice period in their current contract before they can join. Ask about the notice period at the first conversation with each shortlisted candidate, so the start date is planned, not a surprise.</p>

  <h2>How to keep a search moving</h2>
  <p>Searches slow down when the budget is still open, when the interview panel is not agreed, or when feedback on candidates takes weeks. Agree the budget after the pay map, name the panel at the start, and give feedback within a few days of each interview.</p>
''',
        related=['marketing', 'finance', 'hr'],
    ),
    dict(
        slug='retained-vs-contingency-search',
        q='What is the difference between retained and contingency search?',
        title='Retained vs Contingency Search: The Difference | Boardroom CXO',
        desc='Retained search is paid upfront and exclusive, for senior roles. Contingency recruitment is paid only on a hire. How Boardroom CXO charges.',
        line='Retained search is paid at the start and exclusive; contingency is paid only on a hire. We charge Rs 10,000 (including GST) upfront, the rest on joining.',
        answer=("In retained search, a company pays a search firm a fee at the start and the firm works the role "
                "exclusively, usually for senior roles. In contingency recruitment, an agency is paid only when its "
                "candidate is hired, and several agencies can work the same role. Boardroom CXO charges Rs 10,000 (including GST) at "
                "the start and the rest on joining."),
        body='''
  <h2>Retained search</h2>
  <p>The Association of Executive Search and Leadership Consultants (AESC), the global body for the profession, describes retained executive search as focused on executive and senior-level positions and board directors. A consulting fee or retainer is charged at the beginning of the relationship, and retained firms work on an exclusive basis.</p>

  <h2>Contingency recruitment</h2>
  <p>The AESC describes contingency recruiters as agencies paid after a candidate has been identified and hired. A company is not tied to one agency and may use several on the same role. Contingency recruiters typically fill entry-level to mid-level positions.</p>

  <h2>Where Boardroom CXO sits</h2>
  <p>We start each search with a Rs 10,000 service fee (including GST). It is adjusted against the final fee of one month's CTC, which is invoiced when your hire joins. Most of the fee is therefore tied to a hire, while the search itself works the way executive search does: we map pay, define the role, and headhunt directly from competitor companies rather than sending CVs from a database.</p>

  <h2>Which model fits which hire</h2>
  <p>For a high-volume or junior role, where many qualified people are actively applying, a contingency agency or a job portal can be enough. For a CXO role, the best candidate is usually already doing the job somewhere else and is not looking. Reaching them takes research and a confidential approach, which is the work a search firm is paid to do.</p>

  <h2>Questions to ask any firm before you sign</h2>
  <ul>
    <li>What do I pay before a hire is made, and what do I pay when the hire joins?</li>
    <li>Is the firm working the role alone, or alongside other agencies?</li>
    <li>Will candidates come from a database of applicants, or from a direct approach to people in role?</li>
    <li>How is the client's name kept confidential during the approach?</li>
    <li>What happens if the hire leaves early? Ask for it in writing.</li>
  </ul>
''',
        related=['finance', 'marketing'],
        sources=[('AESC', 'Retained Executive Search vs Contingency: What\'s the Difference?',
                  'https://www.aesc.org/insights/blog/retained-executive-search-vs-contingency-whats-difference', 'accessed November 2026')],
    ),
    dict(
        slug='executive-search-vs-recruitment-agency',
        q='Executive search firm vs recruitment agency vs job portal: what is the difference?',
        title='Executive Search vs Recruitment Agency vs Job Portal',
        desc='A job portal waits for applicants, an agency sends CVs of people looking, and a search firm approaches leaders who are not looking.',
        line='A portal waits for applicants, an agency sends CVs of people looking, a search firm approaches leaders who are not looking.',
        answer=("A job portal lists your opening and waits for people to apply. A generalist recruitment agency usually "
                "sends CVs of people who are already looking. An executive search firm researches the market and "
                "confidentially approaches leaders who are not job-hunting, often at competitors. For a CXO role, the "
                "best candidate is usually in that last group."),
        body='''
  <h2>Job portals: reach people who are looking</h2>
  <p>A job portal is a listing. You post the role, and the people who see it and are open to a move apply. That works well when many qualified people are actively searching, such as frontline or store roles. It does not reach the leader who is busy running a function and is not reading job listings.</p>

  <h2>Generalist recruitment agencies</h2>
  <p>A generalist agency fills roles across many functions and levels, often from applicants and job-board databases. It can be quick for roles with a large pool of active candidates. For a senior role, the risk is a stack of CVs from people who are available, not a shortlist of the people best suited to the job.</p>

  <h2>Executive search firms</h2>
  <p>An executive search firm starts from the market, not from applicants. At Boardroom CXO we map what the role pays across your category and city, agree what the role must deliver, and then approach people already doing the job at competitor companies. Candidates choose to go further before your name is disclosed, and you see a confidential shortlist.</p>

  <h2>Why it matters for CXO roles</h2>
  <p>The strongest CMOs, CFOs, CHROs and sales heads in a category are not applying anywhere. A CMO who can build brand equity and a performance marketer who is genuinely ROAS-literate are different skill sets, and people with both are already inside a competitor's growth team. The CFOs who have taken a company through an IPO are already CFOs somewhere. Reaching them takes research, timing and a confidential approach, not a job posting.</p>

  <h2>Which one to use</h2>
  <ul>
    <li><strong>Job portal:</strong> high-volume roles with many active applicants.</li>
    <li><strong>Recruitment agency:</strong> mid-level roles where speed matters more than reaching people who are not looking.</li>
    <li><strong>Executive search:</strong> CXO and senior leadership roles, confidential replacements, and roles where the right person is at a competitor.</li>
  </ul>
''',
        related=['marketing', 'sales', 'hr'],
    ),
    dict(
        slug='confidential-executive-search',
        q='How does a confidential executive search work?',
        title='How Does a Confidential Executive Search Work? | Boardroom CXO',
        desc='In a confidential search, candidates are approached without your company being named, and only those who choose to go further learn who it is.',
        line='Candidates are approached without your company being named; only those who choose to go further learn who it is.',
        answer=("In a confidential executive search, the search firm approaches candidates without naming your company. "
                "Candidates first hear what the role involves, and only those who choose to go further learn who the "
                "client is. There is no public job advert, so your team, your competitors and the market do not learn "
                "that you are hiring."),
        body='''
  <h2>Why companies run a search quietly</h2>
  <p>Many senior hires cannot be announced while the search is on. A company may be replacing a leader who is still in the role, building a function it has not announced, preparing for an IPO, or entering a new market. A public advert for any of these tells employees, competitors and investors more than the company wants them to know.</p>

  <h2>How the approach works</h2>
  <p>At Boardroom CXO the approach is intermediary-led. We research who is already doing the job at competitor companies and approach them on your behalf. The first conversation is about the role, the scope and what it must deliver. Candidates self-select in before your name is disclosed, so only serious candidates ever learn who the client is.</p>

  <h2>What you see, and when</h2>
  <p>You see the market first: what the role pays across your category and city. Then you see a confidential shortlist of people who have already said they are interested. Interviews start only at that point, so your senior team's time goes to candidates who are genuinely in play.</p>

  <h2>Discretion protects candidates too</h2>
  <p>The people approached for a CXO role are usually in senior jobs already. They are taking a risk by talking to anyone about a move, and a careless approach can reach their current employer. A confidential process lets them explore the role without that risk, which is one reason strong candidates respond to a search firm and not to a job post.</p>

  <h2>What we publish about clients</h2>
  <p>Our <a href="/case-studies">case studies</a> describe the role and the outcome, such as a CFO for a pre-IPO jewellery brand, without naming the company, and on our UAE page the client identity is kept confidential.</p>

  <h2>Starting a confidential search</h2>
  <p>You can brief us on a free 30-minute call, by WhatsApp or by email. Tell us the role, the city and any constraints on who may know about the search, and we will plan the approach around them.</p>
''',
        related=['finance', 'marketing', 'hr'],
    ),
    dict(
        slug='hiring-cxo-uae',
        q='How do you hire a CXO for a UAE company?',
        title='How to Hire a CXO for a UAE Company | Boardroom CXO',
        desc='Hiring a CXO in the UAE: local hire or India-sourced, pay mapped before the budget, a direct approach to people in role. AED 1,000 to start.',
        line='Decide local or India-sourced, map what the role pays, then approach people already doing the job. AED 1,000 starts a UAE search.',
        answer=("To hire a CXO for a UAE company, first decide whether the leader should be a local UAE hire or sourced "
                "from India or elsewhere, then check what the role pays and approach people already doing it. Boardroom "
                "CXO runs searches for companies in Dubai and across the UAE, including India-based brands building a "
                "Gulf team."),
        body='''
  <h2>Local hire or India-sourced?</h2>
  <p>We look at leaders already working in the UAE first. International sourcing, from India, the Philippines, Europe, the US or the UK, is available when a client specifically wants it, for example when the role needs experience the local pool does not have.</p>

  <h2>India-based brands building a Gulf team</h2>
  <p>For an India-based brand building a Gulf team, the question is often whether to move a trusted leader from India, hire locally, or do both: a local head with an India-sourced second line. We map both options before you decide.</p>

  <h2>Map the pay before you set the budget</h2>
  <p>Pay varies by seniority and scope, and a generic salary survey is a weak guide. We map what the role pays in the market before you commit a budget, so the offer is neither too low to close nor higher than it needs to be.</p>

  <h2>Roles we search for in the UAE</h2>
  <p>Senior and CXO roles only: CEOs, MDs and business heads, CFOs and finance heads, CMOs and marketing heads, sales and business development heads, and CHROs. We run them for companies in Dubai and across the UAE, including consulting, business-setup and corporate service firms. See our <a href="/uae-consulting-hiring">UAE search page</a>.</p>

  <h2>What a UAE search costs</h2>
  <p>AED 1,000 starts the search. It is adjusted against the final fee of one month's salary, invoiced when your hire joins.</p>

  <h2>How the search runs</h2>
  <p>The method is the same as in India. We map what the role pays, agree what it must deliver over the next 12 to 24 months, approach people already doing the job at competitor companies, and give you a confidential shortlist and a realistic offer number. Our first consultation is free.</p>

  <h2>How to start</h2>
  <p>Call or WhatsApp +91 98567 55000, which covers India and the UAE, or email hire@boardroomcxo.com with the role and the city. It helps to say at the start whether the leader must already be based in the UAE, and who inside the company may know about the search.</p>
''',
        related=['uae', 'finance', 'marketing'],
    ),
    dict(
        slug='what-is-cxo-hiring',
        q='What is CXO hiring?',
        title='What Is CXO Hiring? Meaning and How It Works | Boardroom CXO',
        desc='CXO hiring means recruiting for top roles such as CEO, CFO, CMO and CHRO. What counts as a CXO role and how CXO hiring works in India and the UAE.',
        line='Recruiting for the top roles, such as CEO, CFO, CMO and CHRO, usually through a confidential direct approach.',
        answer=("CXO hiring means recruiting for a company's top roles, the chief officers whose titles take the form "
                "\"Chief X Officer\", such as the CEO, CFO, CMO and CHRO, along with the leaders just below them. Because "
                "the best candidates for these roles are rarely job-hunting, CXO hiring is usually done through executive "
                "search rather than job adverts."),
        body='''
  <h2>Which roles count as CXO</h2>
  <p>The "X" stands for the function. The roles we search for include the CEO, MD and business heads; the CFO and finance heads; the CMO and Chief Growth Officer; chief sales officers and national sales heads; and the CHRO. Every search we run is for a role that reports to the board, the founder or the CEO, or to someone who does.</p>

  <h2>Why CXO hiring is different</h2>
  <p>A CXO hire shapes the business for years, and the pool of people who have done the job at the right scale is small. Those people are already running a function for someone else. They do not apply to adverts, and they expect a confidential, well-researched approach before they will consider a move. A wrong CXO hire is also hard to undo, so the brief, the pay benchmark and the offer matter as much as finding names.</p>

  <h2>How a CXO hire usually runs</h2>
  <p>With Boardroom CXO, a search starts with a map of what the role pays across your category and city, then an agreed brief on what the role must deliver over the next 12 to 24 months. We then approach people already doing the job at competitor companies and build a confidential shortlist, and at the offer stage we give you a realistic uplift, usually 25 to 30%. See <a href="/executive-search-faq/how-executive-search-works">how executive search works</a> for each stage.</p>

  <h2>CXO hiring with Boardroom CXO</h2>
  <p>We run CXO searches for companies in India and the UAE across five sectors: retail and jewellery, where our network is deepest; consumer and D2C; financial services, including banks, NBFCs, insurers and wealth firms; manufacturing; and technology and IT services.</p>

  <h2>What it costs</h2>
  <p>''' + FEE + ''' The first consultation is free. For a worked example, see <a href="/executive-search-faq/cxo-search-cost-india">how much a CXO search costs in India</a>.</p>
''',
        related=['finance', 'marketing', 'sales', 'hr'],
    ),
]

# The closing CTA block and the floating WhatsApp button, copied as they are from the Executive Search page.
_TPL = open('executive-search.html', encoding='utf-8').read().replace('\r\n', '\n')
CTA_BLOCK = _TPL[_TPL.index('<section class="cta-block"'):_TPL.index('</section>', _TPL.index('<section class="cta-block"')) + len('</section>')]
WA_BUTTON = re.search(r'<a href="https://wa.me/919856755000" class="whatsapp-btn".*?</a>', _TPL, re.S).group(0)


def head(title, desc, url, og_type, ld):
    e = html.escape
    return f'''<!DOCTYPE html>
<html lang="en" dir="ltr"><head>
  <!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-R2405BSX22"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', 'G-R2405BSX22');
</script>
<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="Boardroom CXO" />
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{e(title)}">
  <meta name="twitter:description" content="{e(desc)}">
  <meta name="twitter:image" content="{OG_IMAGE}">
  <link rel="icon" href="/images/favicon.png" type="image/png">
  <link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/playfair-display-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/fonts/fonts-v1.css" />
  <link rel="stylesheet" href="{CSS}">
  <script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=2)}
  </script>
</head>
<body>

'''


def cta_block():
    return CTA_BLOCK + '\n'


def tail():
    return f'''
{footer()}

{WA_BUTTON}

<script src="/script.js" defer=""></script>
</body></html>
'''


def crumbs(*items):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': name, 'item': SITE + path} for i, (name, path) in enumerate(items)]}


def question_page(item):
    e = html.escape
    path = f"{HUB}/{item['slug']}"
    url = SITE + path
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'FAQPage', '@id': url + '#faq', 'url': url, 'name': item['q'], 'description': item['desc'],
         'inLanguage': 'en', 'isPartOf': {'@id': SITE + '/#website'}, 'publisher': {'@id': SITE + '/#organization'},
         'datePublished': DATE, 'dateModified': DATE,
         'mainEntity': [{'@type': 'Question', 'name': item['q'], 'acceptedAnswer': {'@type': 'Answer', 'text': item['answer']}}]},
        crumbs(('Home', '/'), ('Executive Search', '/executive-search'), ('Executive Search FAQ', HUB), (item['q'], path)),
    ]}
    rel = ''.join(f'\n      <li><a href="{FUNCTION_PAGES[k][0]}">{FUNCTION_PAGES[k][1]}</a></li>' for k in item['related'])
    others = ''.join(f'\n      <li><a href="{HUB}/{o["slug"]}">{e(o["q"])}</a></li>' for o in QUESTIONS if o is not item)
    sources = ''
    if item.get('sources'):
        lis = ''.join(f'\n      <li>{e(p)}, <a href="{u}" target="_blank" rel="noopener">{e(t)}</a>, {e(d)}</li>' for p, t, u, d in item['sources'])
        sources = f'''
  <div class="article-faq" data-testid="sources">
    <h2>Sources</h2>
    <ul>{lis}
    </ul>
  </div>
'''
    first = FUNCTION_PAGES[item['related'][0]]
    main = f'''
<section class="article-hero">
  <div class="container">
    <div class="article-hero-inner">
      <div class="crumb"><a href="/" style="color:inherit;">Home</a> · <a href="/executive-search" style="color:inherit;">Executive Search</a> · <a href="{HUB}" style="color:inherit;">FAQ</a></div>
      <h1>{e(item['q'])}</h1>
      <div class="meta">
        <span>Executive Search FAQ</span>
        <time datetime="{DATE}">· Updated November 2026</time>
      </div>
    </div>
  </div>
</section>

<article class="article-body container">

  <p>{e(item['answer'])}</p>
{item['body']}
  <div class="article-faq" data-testid="related-search">
    <h2>Related search pages</h2>
    <ul>
      <li><a href="/executive-search">Executive search at Boardroom CXO: roles, sectors, process and fees</a></li>{rel}
    </ul>
  </div>
{sources}
  <div class="article-faq" data-testid="more-questions">
    <h2>More questions</h2>
    <ul>{others}
      <li><a href="{HUB}">All executive search questions</a></li>
    </ul>
  </div>

  <div class="article-inline-cta">
    <h3>Hiring a CXO or senior leader?</h3>
    <p>Brief us on the role and we come back with real market data, who is movable and what the role actually costs, before you commit a budget.</p>
    <a href="/schedule-a-call" class="btn" style="background:var(--bg);color:var(--ink);border-color:var(--bg);" data-door="search" data-door-at="faq-inline">Hire a Leader</a>
    <a href="{first[0]}" class="link-under" style="display:block;margin-top:16px;">{first[1]} →</a>
  </div>
</article>

'''
    return head(item['title'], item['desc'], url, 'article', ld) + header('search') + '\n' + main + cta_block() + tail()


HUB_TITLE = 'Executive Search FAQ: CXO Hiring in India &amp; UAE | Boardroom CXO'
HUB_DESC = 'Answers on executive search in India and the UAE: how a CXO search works, what it costs, how long it takes, and how a confidential search runs.'


def hub_page():
    e = html.escape
    url = SITE + HUB
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'FAQPage', '@id': url + '#faq', 'url': url, 'name': 'Executive Search FAQ', 'description': HUB_DESC,
         'inLanguage': 'en', 'isPartOf': {'@id': SITE + '/#website'}, 'publisher': {'@id': SITE + '/#organization'},
         'datePublished': DATE, 'dateModified': DATE,
         'mainEntity': [{'@type': 'Question', 'name': o['q'], 'url': f"{SITE}{HUB}/{o['slug']}",
                         'acceptedAnswer': {'@type': 'Answer', 'text': o['line']}} for o in QUESTIONS]},
        crumbs(('Home', '/'), ('Executive Search', '/executive-search'), ('Executive Search FAQ', HUB)),
    ]}
    items = '\n'.join(f'''      <div class="faq-item">
        <h3><a href="{HUB}/{o['slug']}" style="color:inherit;">{e(o['q'])}</a></h3>
        <p>{e(o['line'])}</p>
        <a href="{HUB}/{o['slug']}" class="link-under" style="display:inline-block;margin-top:12px;">Read the answer →</a>
      </div>''' for o in QUESTIONS)
    main = f'''
<section class="inner-hero">
  <div class="container">
    <div class="inner-hero-grid">
      <div>
        <div class="inner-hero-crumb"><a href="/">Home</a> / <a href="/executive-search">Executive Search</a> / FAQ</div>
        <h1>Executive search,<br><em>answered.</em></h1>
      </div>
      <div class="inner-hero-side">
        <p class="lead">Straight answers to the questions companies ask before hiring a CEO, CFO, CMO, CHRO or sales head in India or the UAE: how a search works, what it costs, how long it takes and how it stays confidential.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="sec-head">
      <div class="sec-head-left">
        <span class="sec-head-index">§01 · Questions</span>
        <h2 class="h2">{len(QUESTIONS)} questions, <em class="italic-serif" style="color:var(--clay);">one page each.</em></h2>
      </div>
      <p class="lead">Each answer starts with the short version, then the detail. For the full method, see <a href="/executive-search" style="color:inherit;border-bottom:1px solid currentColor;">how we search</a>. For who is moving, see our <a href="/leadership-moves-india-statistics-2026" style="color:inherit;border-bottom:1px solid currentColor;">leadership moves statistics for India</a>.</p>
    </div>
    <div class="article-faq" style="margin-top:0;">
{items}
    </div>
  </div>
</section>

<section class="section section-alt">
  <div class="container">
    <div class="sec-head">
      <div class="sec-head-left">
        <span class="sec-head-index">§02 · By Function</span>
        <h2 class="h2">Searching for a specific role?</h2>
      </div>
    </div>
    <div class="xs-grid">
      <a href="/marketing-leadership-hiring" class="xs-card"><span class="role-index">A / Function</span><h3>CMO &amp; Marketing</h3><p>CMOs, brand heads, growth and performance marketing leaders.</p><span class="link-under">Marketing leadership search →</span></a>
      <a href="/finance-leadership-hiring" class="xs-card"><span class="role-index">B / Function</span><h3>CFO &amp; Finance</h3><p>CFOs, finance controllers and heads of strategy, including pre-IPO and listed-company roles.</p><span class="link-under">Finance leadership search →</span></a>
      <a href="/sales-leadership-hiring" class="xs-card"><span class="role-index">C / Function</span><h3>Sales, Retail &amp; BD</h3><p>Chief sales officers, national sales heads, retail operations and franchise leaders.</p><span class="link-under">Sales leadership search →</span></a>
      <a href="/hr-leadership-hiring" class="xs-card"><span class="role-index">D / Function</span><h3>CHRO &amp; HR</h3><p>CHROs, HR heads and talent leaders.</p><span class="link-under">HR leadership search →</span></a>
      <a href="/uae-consulting-hiring" class="xs-card"><span class="role-index">E / Market</span><h3>UAE Search</h3><p>Searches for companies in Dubai and across the UAE, including India-based brands building a Gulf team.</p><span class="link-under">UAE search →</span></a>
    </div>
  </div>
</section>

'''
    return head(html.unescape(HUB_TITLE), HUB_DESC, url, 'website', ld) + header('search') + '\n' + main + cta_block() + tail()


def to_text(h):
    """The answer HTML as the plain text used in llms-full.txt."""
    h = re.sub(r'\s*<h2>(.*?)</h2>', r'\n\n## \1', h, flags=re.S)
    h = re.sub(r'\s*<p>(.*?)</p>', r'\n\n\1', h, flags=re.S)
    h = re.sub(r'\s*<li>(.*?)</li>', r'\n- \1', h, flags=re.S)
    h = re.sub(r'\s*<ul>', '\n', h)
    h = re.sub(r'\s*</ul>', '', h)
    h = re.sub(r'<[^>]+>', '', h)
    return html.unescape(h).strip()


def llms_full():
    """Rewrite the Executive Search FAQ part of llms-full.txt from QUESTIONS, so the plain text matches the pages."""
    sep = '=' * 80
    blocks = []
    for item in QUESTIONS:
        body = item['answer'] + '\n\n' + to_text(item['body'])
        if item.get('sources'):
            body += '\n\n## Sources\n\n' + '\n'.join(f'- {p}, {t}, {u}, {d}' for p, t, u, d in item['sources'])
        blocks.append(f"{sep}\n# {item['q']}\nURL: {SITE}{HUB}/{item['slug']}\nPublished: {DATE}\n"
                      f"Publisher: Boardroom CXO (https://boardroomcxo.com)\n{sep}\n\n{body}\n")
    s = open('llms-full.txt', encoding='utf-8').read()
    start = s.index(f'{sep}\n# How does executive search work?')
    end = s.index(f'{sep}\n# Leadership hiring and moves in India')
    s = s[:start] + '\n\n'.join(blocks) + '\n' + s[end:]
    open('llms-full.txt', 'w', encoding='utf-8', newline='\n').write(s)


def main():
    os.makedirs('executive-search-faq', exist_ok=True)
    for item in QUESTIONS:
        open(f"executive-search-faq/{item['slug']}.html", 'w', encoding='utf-8', newline='\n').write(question_page(item))
    open('executive-search-faq.html', 'w', encoding='utf-8', newline='\n').write(hub_page())
    llms_full()
    print(len(QUESTIONS), 'questions written; llms-full.txt FAQ part rewritten')


if __name__ == '__main__':
    main()
