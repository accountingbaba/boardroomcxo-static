# Boardroom CXO — Site Rework PRD

## Problem statement
Full UI rework of the existing 7-page static executive-search site (accountingbaba/boardroomcxo-static). Modern, minimalist, visual/infographic-heavy design, all copy preserved verbatim, live preview URL.

## Architecture
- Pure static HTML + CSS + vanilla JS (no framework, no build step)
- Served via `python3 -m http.server 3000` from /app/frontend/public/
- Live at REACT_APP_BACKEND_URL

## Design system — "The Institutional Monolith"
- **Palette base:** Pearl `#F7F6F2`, Stone `#EAE8E1`, Ink `#0F1110`, Oxidized Emerald `#1A362D`, Burnished Clay `#A86F58`
- **Family accent system:** Marketing (Emerald), Sales & Retail (Ink/Slate), BD & Franchise (Warm Tan), Strategy & Ops (Slate Blue)
- **Typography:** Bodoni Moda (display) + Manrope (body) + Space Mono (data)
- **Layout:** 1440px max, 1px hairline dossier grids, sharp corners, grayscale imagery, no gradients (except colored family bars)

## Family-color system spans (as of latest iteration)
- Roles We Fill (homepage) — color-coded family cards with salary spectrum charts per family
- Salary Benchmark Modal — dynamically re-tints per selected role's family
- Case Studies page — 3 cases each tinted by family
- Resources page topics — 4 topics each in a family color
- About page — stats band, MVV, values all tinted per family
- Footer practice legend — 4-swatch strip on every page linking back to `index.html#roles`

## Pages (7)
1. index.html — hero, ribbon, problems (infographic), salary, process (progress bars), roles (family colors + salary), why, testimonials, blog, CTA
2. about-us.html — hero, family-colored stats band, MVV, founder, family-colored values
3. resources.html — hero, family-colored topics, featured, articles list, newsletter
4. case-studies.html — hero, 3 family-tinted cases, impact band
5. schedule-a-call.html — hero, contact form + info, what-you-get, process
6. article-hidden-comp-gap.html — long-form editorial
7. article-performance-marketer-jewelry.html — long-form editorial

## Salary Tool
15 roles × 3 store tiers × 2 city tiers logic preserved. Modal now dynamically tints per family and displays typed-out result.

## Files
- /app/frontend/public/*.html, style.css, script.js, images/
- /app/site/ — original GitHub codebase for reference
- /app/frontend/package.json start script: `python3 -m http.server 3000 --bind 0.0.0.0 --directory public`

## Status
✅ All 7 pages redesigned
✅ Family-color system unified across Roles, Modal, Case Studies, Resources, About, Footer
✅ Brand logo colors preserved in marquee
✅ Infographic-heavy treatments on Problems, Process, Roles, About stats, Resources topics
✅ Live preview working

## Next action items
- User to review all pages and give feedback
- Once approved, push to GitHub via "Save to GitHub" button
- Potential enhancements: family-color mapping on Salary Modal salary select options (via colored SVG icons injected next to labels), animated bar-chart entrance on Problems section, family-tinted Blog category chips on homepage/resources
