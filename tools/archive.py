"""Boardroom Moves posts published on LinkedIn before the Moves desk, shown on /moves as an archive.

New moves come from the Moves desk (the D1 database). This archive is fixed: the posts #78 to #92,
copied from the Boardroom CXO LinkedIn page on 2 Nov 2026. To fix a name or a typo, edit
data/moves-archive.json and run, from the repo root:

    python tools/archive.py

It writes functions/_moves/archive.js (read by the /moves pages and /moves/latest.json) and,
through tools/stories.py, the homepage card. The first import also took the post images:

    python tools/archive.py --import <posts.json from the LinkedIn copy>
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
             if w not in {'limited', 'ltd', 'pvt', 'private', 'member', 'firm', 'india', 'the', 'in'}]
    return '-'.join(words[:3])


def clean_text(text):
    """The post as published, without the 'Boardroom Moves #N' first line and the hashtag lines."""
    lines = text.replace('\r', '').split('\n')
    if lines and re.match(r'Boardroom Moves #\d+', lines[0].strip()):
        lines = lines[1:]
    while lines and (not lines[-1].strip() or re.fullmatch(r'(#\w+\s*)+', lines[-1].strip())):
        lines.pop()
    return '\n'.join(l.rstrip() for l in lines).strip()


def import_posts(src):
    from PIL import Image
    posts = json.load(open(src, encoding='utf-8'))
    out = []
    for p in posts:
        name = p['leader_name'].strip()
        slug = slugify(re.sub(r'^Dr\.?\s+', '', name)) + '-' + company_slug(p['company'])
        prev = ' at '.join(x for x in (p.get('previous_role'), p.get('previous_company')) if x) if p.get('previous_role') else ''
        Image.open(p['local_image']).convert('RGB').resize((900, 900), Image.LANCZOS).save(f'{IMG_DIR}/{slug}.webp', 'WEBP', quality=80, method=6)
        out.append({
            'no': p['moves_no'], 'slug': slug, 'name': name, 'role_title': p['new_role'], 'company': p['company'],
            'prev_role': prev, 'date': p['date'], 'published_at': p['published_at'],
            'post_url': p['post_url'], 'profile': p.get('linkedin_profile_url') or '',
            'company_linkedin': p.get('company_linkedin_url') or '', 'image': f'/{IMG_DIR}/{slug}.webp',
            'text': clean_text(p['post_text']),
        })
    out.sort(key=lambda m: m['no'], reverse=True)
    open(DATA, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')


def main():
    import os
    if '--import' in sys.argv:
        os.makedirs(IMG_DIR, exist_ok=True)
        import_posts(sys.argv[sys.argv.index('--import') + 1])
    moves = json.load(open(DATA, encoding='utf-8'))
    open('functions/_moves/archive.js', 'w', encoding='utf-8', newline='\n').write(
        '// Written by tools/archive.py from data/moves-archive.json: Boardroom Moves posts from before the Moves desk.\n'
        f'export const ARCHIVE = {json.dumps(moves, ensure_ascii=False, indent=1)};\n')
    print(len(moves), 'archived moves')
    import subprocess
    subprocess.run([sys.executable, 'tools/stories.py'], check=True)


if __name__ == '__main__':
    main()
