"""Inside the Boardroom: the list of stories, and the page that shows them.

An Inside the Boardroom story is any article listed on resources.html under "Founder Leadership".
Run from the repo root after publishing a new story (and listing it on resources.html):

    python tools/stories.py

It writes data/stories.json (read by /moves/latest.json and the /moves page), inside-the-boardroom.html
(the full list, newest first), on index.html the Boardroom Moves ticker, faces row and band, and on each
hiring page the newest stories whose byline links to it, at the top of its Field Notes list.
"""
import html
import json
import re

from chrome import header

SITE = 'https://boardroomcxo.com'


def meta(s, attr, name):
    m = re.search(rf'<meta {attr}="{re.escape(name)}" content="([^"]*)"', s)
    return html.unescape(m.group(1)) if m else ''


def stories():
    res = open('resources.html', encoding='utf-8').read()
    rows = re.findall(r'<a href="/(article-[a-z0-9-]+)"[^>]*>\s*(?:<span class="num">[^<]*</span>\s*)?<span class="cat">Founder Leadership[^<]*</span>', res)
    out, seen = [], set()
    for slug in rows:
        if slug in seen:
            continue
        seen.add(slug)
        s = open(slug + '.html', encoding='utf-8').read()
        title = meta(s, 'property', 'og:title') or re.search(r'<h1[^>]*>([^<]+)', s).group(1)
        img = meta(s, 'property', 'og:image').replace(SITE, '')
        out.append({
            'url': '/' + slug,
            'title': title.strip(),
            'date': meta(s, 'property', 'article:published_time')[:10],
            'image': img,
            'summary': meta(s, 'name', 'description'),
        })
    out.sort(key=lambda x: x['date'], reverse=True)
    return out


def month(d):
    import datetime
    try:
        return datetime.date.fromisoformat(d).strftime('%B %Y')
    except ValueError:
        return ''


def card(st):
    e = html.escape
    return f'''      <a href="{e(st['url'])}" class="itb-card">
        <img width="1200" height="900" loading="lazy" src="{e(st['image'])}" alt="{e(st['title'])}">
        <span class="itb-date">{month(st['date'])}</span>
        <h3>{e(st['title'])}</h3>
        <p>{e(st['summary'])}</p>
      </a>'''


def page(items):
    tpl = open('resources.html', encoding='utf-8').read().replace('\r\n', '\n')
    head_end = tpl.index('</head>')
    head = tpl[:head_end]
    head = re.sub(r'<title>.*?</title>', '<title>Inside the Boardroom: Indian Business Leaders | Boardroom CXO</title>', head, flags=re.S)
    desc = 'Stories of the Indian leaders behind Taj, Mahindra, Malabar Gold, Airtel and more: how they made the hard calls, and the lesson for your business.'
    head = re.sub(r'<meta name="description" content="[^"]*"', f'<meta name="description" content="{desc}"', head)
    head = re.sub(r'<meta property="og:description" content="[^"]*"', f'<meta property="og:description" content="{desc}"', head)
    head = re.sub(r'<meta name="twitter:description" content="[^"]*"', f'<meta name="twitter:description" content="{desc}"', head)
    head = re.sub(r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"', r'\1Inside the Boardroom | Boardroom CXO"', head)
    head = head.replace(f'{SITE}/resources', f'{SITE}/inside-the-boardroom')
    if items:
        head = re.sub(r'(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*"', rf'\g<1>{SITE}{items[0]["image"]}"', head)
    ld = {
        '@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Inside the Boardroom',
        'url': f'{SITE}/inside-the-boardroom', 'isPartOf': {'@type': 'WebSite', '@id': SITE + '/#website', 'name': 'Boardroom CXO', 'url': SITE + '/'},
        'breadcrumb': {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': 'Boardroom Moves', 'item': SITE + '/moves'},
            {'@type': 'ListItem', 'position': 3, 'name': 'Inside the Boardroom', 'item': SITE + '/inside-the-boardroom'}]},
        'mainEntity': {'@type': 'ItemList', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'url': SITE + st['url'], 'name': st['title']} for i, st in enumerate(items)]},
    }
    head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)
    head += '  <script type="application/ld+json">\n' + json.dumps(ld, ensure_ascii=False, indent=2) + '\n  </script>\n'
    body_start = tpl.index('<body')
    hdr = header('moves')
    foot_start = tpl.index('<section class="cta-block"')
    tail = tpl[foot_start:]
    cards = '\n'.join(card(st) for st in items)
    main = f'''
<section class="inner-hero">
  <div class="container">
    <div class="inner-hero-grid">
      <div>
        <div class="inner-hero-crumb"><a href="/">Home</a> / <a href="/moves">Boardroom Moves</a> / Inside the Boardroom</div>
        <h1>Inside the<br><em>Boardroom.</em></h1>
      </div>
      <div class="inner-hero-side">
        <p class="lead">Stories of Indian business leaders: the hard call they made, what it cost, and the lesson for anyone running a business. New stories are added regularly. Part of Boardroom Moves.</p>
        <div class="inner-hero-facts">
          <div class="inner-hero-fact"><span class="inner-hero-fact-num">{len(items)}</span><span class="inner-hero-fact-label">Stories published</span></div>
          <div class="inner-hero-fact"><span class="inner-hero-fact-num">New</span><span class="inner-hero-fact-label">Stories added regularly</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="itb-grid">
{cards}
    </div>
  </div>
</section>

<section class="section section-alt">
  <div class="container itb-feature">
    <div>
      <span class="sec-head-index">Boardroom Moves</span>
      <h2 class="h2">Moved into a new leadership role?</h2>
      <p class="lead">We announce senior moves on the Boardroom CXO LinkedIn page and keep them on this site, where they show up when someone searches your name.</p>
    </div>
    <a href="/get-featured" class="btn" data-door="moves" data-door-at="inside-the-boardroom">Get Featured</a>
  </div>
</section>

'''
    return head + tpl[head_end:body_start] + tpl[body_start:tpl.index('<header')] + hdr + '\n' + main + tail


def ticker_item(href, name, role, company, dup=False):
    e = html.escape
    tab = ' tabindex="-1"' if dup else ''
    return (f'      <a href="{e(href)}"{tab}><strong>{e(name)}</strong>'
            f'{e(role.split(",")[0])}<span class="ht-co">, {e(company)}</span></a>')


def face(m):
    """A small round crop of the move's LinkedIn image, made once with Pillow (the full image if Pillow is missing)."""
    import os
    out = f"images/moves-archive/faces/{m['slug']}.webp"
    if not os.path.exists(out):
        try:
            from PIL import Image
            im = Image.open(m['image'].lstrip('/'))
            w, h = im.size
            # The face sits a little above the middle of these images.
            im.crop((int(w * .28), int(h * .17), int(w * .72), int(h * .61))).convert('RGB').resize((96, 96), Image.LANCZOS).save(out, 'WEBP', quality=82)
        except (ImportError, OSError):
            return m['image']
    return '/' + out


def home(items):
    """The homepage ticker, faces row and band, as plain HTML so they show without JavaScript.
    script.js adds moves published on the Moves desk since, from /moves/latest.json."""
    import os
    e = html.escape
    try:
        moves = json.load(open('data/moves-archive.json', encoding='utf-8'))
    except FileNotFoundError:
        moves = []
    moves = sorted(moves, key=lambda m: m['date'], reverse=True)
    latest = moves[:8]
    os.makedirs('images/moves-archive/faces', exist_ok=True)
    ticker = '\n'.join(ticker_item('/moves/' + m['slug'], m['name'], m['role_title'], m['company']) for m in latest)
    ticker += '\n      <span class="ht-dup" aria-hidden="true">\n' + '\n'.join(
        ticker_item('/moves/' + m['slug'], m['name'], m['role_title'], m['company'], dup=True) for m in latest) + '\n      </span>'
    pics = ''.join(f'<img src="{e(face(m))}" alt="" width="48" height="48">' for m in [m for m in moves if m['image']][:5])
    faces = (f'          <a href="/moves" class="hp-faces" tabindex="-1" aria-hidden="true">{pics}</a>\n'
             f'          <span class="hp-copy"><a href="/moves"><strong>{len(moves)} leaders featured on Boardroom Moves</strong></a>'
             f'<a href="/get-featured" data-door="moves" data-door-at="hero-faces">Moved into a new role? Get featured →</a></span>')
    band = '\n'.join(f'''      <article class="blog-item">
        <div class="blog-img-wrap"><img width="1200" height="900" src="{e(st['image'])}" alt="{e(st['title'])}" loading="lazy" style="filter:none;" /></div>
        <div class="blog-meta">
          <span class="cat">Inside the Boardroom</span>
          <span class="date">{month(st['date'])}</span>
        </div>
        <h3>{e(st['title'])}</h3>
        <p>{e(st['summary'])}</p>
        <a href="{e(st['url'])}" class="link-under">Read the story →</a>
      </article>''' for st in items[:3])
    raw = open('index.html', encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in raw else '\n'
    s = raw.replace('\r\n', '\n')
    for name, body in (('ticker', ticker), ('faces', faces), ('stories', band)):
        s, n = re.subn(rf'<!-- {name}:start -->.*?<!-- {name}:end -->',
                       lambda m: f'<!-- {name}:start -->\n{body}\n<!-- {name}:end -->', s, flags=re.S)
        assert n == 1, name
    open('index.html', 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))


HIRING_PAGES = ['marketing-leadership-hiring', 'sales-leadership-hiring', 'finance-leadership-hiring', 'hr-leadership-hiring']


def field_notes(items, per_page=4):
    """On each hiring page, list the newest stories whose byline links to that page above the
    hand-picked articles already in its Field Notes list, then renumber the rows."""
    e = html.escape
    for pg in HIRING_PAGES:
        tagged = [st for st in items
                  if f'href="/{pg}"' in re.search(r'<div class="meta">(.*?)</div>', open(st['url'].lstrip('/') + '.html', encoding='utf-8').read(), re.S).group(1)]
        shown = [st['url'] for st in tagged[:per_page]]
        rows = ''.join(f'''
      <a href="{e(st['url'])}" class="article-row reveal">
        <span class="num">R · 00</span>
        <span class="cat">Inside the Boardroom · {month(st['date'])}</span>
        <h3>{e(st['title'])}</h3>
        <span class="link-under">Read →</span>
      </a>''' for st in tagged[:per_page])
        raw = open(pg + '.html', encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in raw else '\n'
        s = raw.replace('\r\n', '\n')
        s, n = re.subn(r'(<!-- field-notes:start -->).*?(\n<!-- field-notes:end -->)', lambda m: m.group(1) + rows + m.group(2), s, flags=re.S)
        assert n == 1, pg
        # drop hand-picked rows that repeat a story now listed above
        a = s.index('<!-- field-notes:end -->')
        b = s.index('</section>', a)
        tail = re.sub(r'\n\s*<a href="(/[^"]+)" class="article-row[^"]*">.*?</a>',
                      lambda m: '' if m.group(1) in shown else m.group(0), s[a:b], flags=re.S)
        s = s[:a] + tail + s[b:]
        i = s.index('<div class="articles-list">')
        j = s.index('</section>', i)
        num = iter(range(1, 100))
        s = s[:i] + re.sub(r'<span class="num">R · \d+</span>', lambda m: f'<span class="num">R · {next(num):02d}</span>', s[i:j]) + s[j:]
        open(pg + '.html', 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))


def main():
    items = stories()
    open('data/stories.json', 'w', encoding='utf-8', newline='\n').write(json.dumps(items, ensure_ascii=False, indent=1) + '\n')
    open('inside-the-boardroom.html', 'w', encoding='utf-8', newline='\n').write(page(items))
    home(items)
    field_notes(items)
    print(len(items), 'stories; newest', items[0]['date'] if items else '-')


if __name__ == '__main__':
    main()
