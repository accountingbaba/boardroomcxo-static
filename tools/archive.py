"""Boardroom Moves posts published on LinkedIn before the Moves desk, shown on /moves as an archive.

New moves come from the Moves desk (the D1 database). This archive is fixed: the posts #78 to #92,
copied from the Boardroom CXO LinkedIn page on 2 Nov 2026. To fix a name or a typo, edit
data/moves-archive.json and run, from the repo root:

    python tools/archive.py

It writes functions/_moves/archive.js (read by the /moves pages and /moves/latest.json) and,
through tools/stories.py, the homepage ticker and faces row. Importing a LinkedIn copy adds its posts (and their images) to the archive, skipping posts already there:

    python tools/archive.py --import <posts.json> [<more.json> ...]
"""
import json
import re
import sys
import unicodedata

DATA = 'data/moves-archive.json'
IMG_DIR = 'images/moves-archive'


def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s)).strip('-')


def company_slug(company):
    words = [w for w in slugify(re.sub(r'\(.*?\)', '', company)).split('-')
             if w not in {'limited', 'ltd', 'pvt', 'private', 'member', 'firm', 'india', 'the', 'in', 'of', 'and', 'for', 'by', 'co'}]
    return '-'.join(words[:3])


def clean_text(text):
    """The post as published, without the 'Boardroom Moves #N' first line and the hashtag lines."""
    lines = text.replace('\r', '').split('\n')
    if lines and re.match(r'Boardroom Moves #\d+', lines[0].strip()):
        lines = lines[1:]
    while lines and (not lines[-1].strip() or re.fullmatch(r'(#\w+\s*)+', lines[-1].strip())):
        lines.pop()
    return '\n'.join(l.rstrip() for l in lines).strip()


def import_posts(srcs):
    """Add posts from one or more LinkedIn copies; a post already in the archive (same post_url) is skipped."""
    from PIL import Image
    try:
        out = json.load(open(DATA, encoding='utf-8'))
    except FileNotFoundError:
        out = []
    seen = {m['post_url'] for m in out}
    slugs = {m['slug'] for m in out}
    for src in srcs:
        for p in json.load(open(src, encoding='utf-8')):
            if p['post_url'] in seen:
                continue
            seen.add(p['post_url'])
            name = p['leader_name'].strip()
            if name.isupper():  # a few posts write the name in capitals
                name = name.title()
            base = slugify(re.sub(r',?\s*Ph\.?\s?D\.?$', '', re.sub(r'^Dr\.?\s+', '', name))) + '-' + company_slug(p['company'])
            slug, n = base, 2
            while slug in slugs:
                slug, n = f'{base}-{n}', n + 1
            slugs.add(slug)
            prev = ' at '.join(x for x in (p.get('previous_role'), p.get('previous_company')) if x) if p.get('previous_role') else ''
            image = ''
            if p.get('local_image'):
                Image.open(p['local_image']).convert('RGB').resize((900, 900), Image.LANCZOS).save(f'{IMG_DIR}/{slug}.webp', 'WEBP', quality=80, method=6)
                image = f'/{IMG_DIR}/{slug}.webp'
            out.append({
                'no': p['moves_no'], 'slug': slug, 'name': name, 'role_title': p['new_role'], 'company': p['company'],
                'prev_role': prev, 'date': p['date'], 'published_at': p['published_at'],
                'post_url': p['post_url'], 'profile': p.get('linkedin_profile_url') or '',
                'company_linkedin': p.get('company_linkedin_url') or '', 'image': image,
                'text': clean_text(p['post_text']),
            })
    out.sort(key=lambda m: m['published_at'], reverse=True)
    open(DATA, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')


def small_images(moves):
    """480px copies for the /moves cards and phones (the 900px originals stay for the profile pages)."""
    import os
    from PIL import Image
    os.makedirs(f'{IMG_DIR}/sm', exist_ok=True)
    for m in moves:
        if m['image'] and not os.path.exists(f"{IMG_DIR}/sm/{m['slug']}.webp"):
            Image.open(m['image'].lstrip('/')).resize((480, 480), Image.LANCZOS).save(f"{IMG_DIR}/sm/{m['slug']}.webp", 'WEBP', quality=78, method=6)


def main():
    import os
    if '--import' in sys.argv:
        os.makedirs(IMG_DIR, exist_ok=True)
        import_posts(sys.argv[sys.argv.index('--import') + 1:])
    moves = json.load(open(DATA, encoding='utf-8'))
    small_images(moves)
    open('functions/_moves/archive.js', 'w', encoding='utf-8', newline='\n').write(
        '// Written by tools/archive.py from data/moves-archive.json: Boardroom Moves posts from before the Moves desk.\n'
        f'export const ARCHIVE = {json.dumps(moves, ensure_ascii=False, indent=1)};\n')
    print(len(moves), 'archived moves')
    import subprocess
    subprocess.run([sys.executable, 'tools/stories.py'], check=True)


if __name__ == '__main__':
    main()
