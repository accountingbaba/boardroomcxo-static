# Boardroom CXO — Site Rework PRD

## Problem statement
User owns an existing static marketing site (`accountingbaba/boardroomcxo-static` on GitHub) for **Boardroom CXO** — an executive search firm for jewelry, D2C, and consumer brands in India (Surat-based). They asked for a complete UI rework of **all 7 pages** with a modern, minimalist design that leans on **visuals and infographics** over text. All existing copy must be preserved verbatim (no content edits). Design direction chosen by main agent; delivery via live preview URL.

## Architecture
- **Pure static site** — HTML + CSS + vanilla JS, no framework, no build step.
- **Served via** Python `http.server` on port 3000 from `/app/frontend/public/`, so `REACT_APP_BACKEND_URL` returns the site.
- **Original codebase** preserved at `/app/site/` (cloned from GitHub) for reference.
- **Fonts** loaded from Google Fonts CDN.

## Design system — "The Institutional Monolith"
- **Palette:** Pearl `#F7F6F2` bg, Stone `#EAE8E1` bg-alt, Ink `#0F1110` text, Oxidized Emerald `#1A362D` primary accent, Burnished Clay `#A86F58` secondary accent, Line `#D1CFCA` hairlines.
- **Typography:** Bodoni Moda (display serif with italic italics for accents), Manrope (body sans), Space Mono (data / labels / mono UI).
- **Layout:** 1440px max-width, generous editorial padding, 1px hairline borders creating "dossier" grids, sharp 0-radius corners, no gradients, all imagery grayscale (color on hover).
- **Motion:** IntersectionObserver fade-ups (0.9s cubic-bezier), marquee glacial pace, salary result "types out" like a terminal.

## Pages built (all 7)
1. **index.html** — hero (asymmetric split with grayscale portrait + floating "350+ Ratings" badge with shadow), 3-column stat data-table (82% / 200% / 35%), monochrome logo ribbon (12 brands), "Problem We Solve" (1×4 rows with inline SVG mini-vizzes + "Fixed by:" tags), Salary Tool CTA (Bloomberg terminal preview + full modal), 4-step "How We Work" horizontal timeline, "Roles We Fill" 4-col architectural grid, "Why a Specialist" grayscale image + 4 features, editorial testimonials (giant serif quote marks), 3-card blog previews, dark CTA/footer.
2. **about-us.html** — inner hero, 4-col stats band, MVV 3-col grid, founder editorial section with grayscale portrait, values 3-col.
3. **resources.html** — inner hero, 4 topic cards, featured article, articles list, brutalist newsletter form.
4. **case-studies.html** — inner hero, 3 case studies (dossier format with metadata sidebar), dark impact-band with 4 metrics.
5. **schedule-a-call.html** — inner hero, split contact info + form (flat inputs with 1px underlines), "What You'll Get" 3-col, mini 4-step process.
6. **article-hidden-comp-gap.html** — long-form editorial with drop cap, pull blockquote, bullet list, inline dark CTA.
7. **article-performance-marketer-jewelry.html** — same editorial template with different content.

## Preserved functionality
- Salary Benchmark Tool: all 15 roles × A/B/C tiers × Tier-1/2 city logic intact (from original `script.js`)
- Marquee, sticky header, mobile menu, counter animations, WhatsApp float
- All SEO meta, canonical, OG tags, schema.org JSON-LD
- All internal navigation, external links, tel/mailto links
- Every word of body copy preserved verbatim

## Files
- `/app/frontend/public/{index,about-us,resources,case-studies,schedule-a-call,article-hidden-comp-gap,article-performance-marketer-jewelry}.html`
- `/app/frontend/public/style.css` — full design system, ~930 lines
- `/app/frontend/public/script.js` — sticky nav, mobile menu, counters, IO reveals, salary tool with typed-result animation
- `/app/frontend/public/images/` — all original assets from GitHub repo
- `/app/frontend/package.json` — `start` script switched to `python3 -m http.server 3000 --bind 0.0.0.0 --directory public` (CRA/serve replaced for reliable static serving)

## Live preview
Served on `REACT_APP_BACKEND_URL` root path.

## Status
✅ All 7 pages redesigned end-to-end with new design system
✅ Salary benchmark tool verified working
✅ All existing content preserved verbatim
✅ Mobile-nav bleed bug fixed
✅ Live preview URL functional

## Next action items
- User to review live preview and give feedback on any section they want tweaked
- Once approved, user can push changes to GitHub via the "Save to GitHub" feature
- Potential enhancement: add analytics tracking on CTA clicks + a "Download the 2026 Compensation Report" lead magnet inside the Salary Tool modal to capture emails from the highest-intent visitors (founders actively benchmarking pay)
