"""Inside the Boardroom: the list of stories, and the page that shows them.

An Inside the Boardroom story is any article listed on resources.html under "Founder Leadership".
Run from the repo root after publishing a new story (and listing it on resources.html):

    python tools/stories.py

It writes data/stories.json (read by /moves/latest.json and the /moves page), inside-the-boardroom.html
(the full list, newest first) and the Boardroom Moves card and band on index.html.
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
    head = re.sub(r'<title>.*?</title>', '<title>Inside the Boardroom | Stories of Indian Business Leaders | Boardroom CXO</title>', head, flags=re.S)
    desc = 'Inside the Boardroom: weekly stories of the Indian leaders behind Taj, Mahindra, Malabar Gold, Airtel and more. How they made the hard calls, and the lesson for anyone running a business.'
    head = re.sub(r'<meta name="description" content="[^"]*"', f'<meta name="description" content="{desc}"', head)
    head = re.sub(r'<meta property="og:description" content="[^"]*"', f'<meta property="og:description" content="{desc}"', head)
    head = re.sub(r'<meta name="twitter:description" content="[^"]*"', f'<meta name="twitter:description" content="{desc}"', head)
    head = re.sub(r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"', r'\1Inside the Boardroom | Boardroom CXO"', head)
    head = head.replace(f'{SITE}/resources', f'{SITE}/inside-the-boardroom')
    if items:
        head = re.sub(r'(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*"', rf'\g<1>{SITE}{items[0]["image"]}"', head)
    ld = {
        '@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Inside the Boardroom',
        'url': f'{SITE}/inside-the-boardroom', 'isPartOf': {'@type': 'WebSite', 'name': 'Boardroom CXO', 'url': SITE + '/'},
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
        <p class="lead">Every Saturday, one story of an Indian business leader: the hard call they made, what it cost, and the lesson for anyone running a business. Part of Boardroom Moves.</p>
        <div class="inner-hero-facts">
          <div class="inner-hero-fact"><span class="inner-hero-fact-num">{len(items)}</span><span class="inner-hero-fact-label">Stories published</span></div>
          <div class="inner-hero-fact"><span class="inner-hero-fact-num">Sat</span><span class="inner-hero-fact-label">New story every week</span></div>
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


def news_item(href, tag, title, sub=''):
    e = html.escape
    return (f'            <li><a href="{e(href)}"><span class="news-tag">{e(tag)}</span><strong>{e(title)}</strong>'
            + (f'<span class="news-sub">{e(sub)}</span>' if sub else '') + '</a></li>')


def home(items):
    """The homepage card and band, as plain HTML so they show without JavaScript.
    script.js swaps the card for /moves/latest.json, which also has moves added on the Moves desk since."""
    e = html.escape
    try:
        moves = json.load(open('data/moves-archive.json', encoding='utf-8'))
    except FileNotFoundError:
        moves = []
    moves = sorted(moves, key=lambda m: m['date'], reverse=True)[:4]
    news = [news_item('/moves/' + m['slug'], 'New role', m['name'], f"{m['role_title']}, {m['company']}") for m in moves]
    news += [news_item(st['url'], 'Inside the Boardroom', st['title']) for st in items[:1 if moves else 3]]
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
    for name, body in (('news', '\n'.join(news)), ('stories', band)):
        s, n = re.subn(rf'<!-- {name}:start -->.*?<!-- {name}:end -->',
                       lambda m: f'<!-- {name}:start -->\n{body}\n<!-- {name}:end -->', s, flags=re.S)
        assert n == 1, name
    import datetime
    newest = max([m['date'] for m in moves] + [st['date'] for st in items[:1]] or [''])
    if newest:
        d = datetime.date.fromisoformat(newest)
        s = re.sub(r'(data-news-when>)[^<]*', rf'\g<1>Updated {d.day} {d:%b}', s)
    open('index.html', 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))


def main():
    items = stories()
    open('data/stories.json', 'w', encoding='utf-8', newline='\n').write(json.dumps(items, ensure_ascii=False, indent=1) + '\n')
    open('inside-the-boardroom.html', 'w', encoding='utf-8', newline='\n').write(page(items))
    home(items)
    print(len(items), 'stories; newest', items[0]['date'] if items else '-')


if __name__ == '__main__':
    main()
