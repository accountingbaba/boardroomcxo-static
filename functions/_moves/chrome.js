// Written by tools/chrome.py: the site header and footer, shared with the static pages.
export const HEADER = `<header class="site-header" id="site-header" data-testid="site-header">
  <div class="nav-inner">
    <a href="/" class="nav-brand" data-testid="nav-brand" aria-label="Boardroom CXO"><img width="341" height="150" src="/images/logo-boardroomcxo-transparent.png" alt="Boardroom CXO" /></a>
    <nav class="nav-menu" data-testid="nav-menu" aria-label="Main">
      <a href="/executive-search" class="nav-link">Executive Search</a>
      <a href="/moves" class="nav-link active">Boardroom Moves</a>
    </nav>
    <div class="nav-ctas">
      <a href="/get-featured" class="nav-cta nav-cta-ghost" data-door="moves" data-door-at="header">Get Featured</a>
      <a href="/schedule-a-call" class="nav-cta" data-testid="nav-cta" data-door="search" data-door-at="header">Hire a Leader</a>
    </div>
    <button class="hamburger" id="hamburger" aria-label="Toggle menu" data-testid="hamburger"><span></span><span></span><span></span></button>
  </div>
  <div class="nav-menu-mobile" id="nav-menu-mobile">
    <a href="/executive-search">Executive Search</a>
    <a href="/moves">Boardroom Moves</a>
    <a href="/inside-the-boardroom">Inside the Boardroom</a>
    <a href="/about-us">About</a>
    <a href="https://accountingbaba.com/portal/?brand=boardroom">Employer Login</a>
    <a href="/schedule-a-call" class="nav-cta-mobile" data-testid="mnav-cta" data-door="search" data-door-at="menu">Hire a Leader →</a>
    <a href="/get-featured" class="nav-cta-mobile nav-cta-mobile-ghost" data-door="moves" data-door-at="menu">Get Featured →</a>
  </div>
</header>`;
export const footer = year => `<footer class="footer">
  <div class="container">
    <div class="footer-practice">
      <span class="fp-label">// Executive Search</span>
      <div class="fp-strip">
        <a href="/marketing-leadership-hiring" class="fp-item fp-item--marketing"><span class="fp-dot"></span>CMO &amp; Marketing</a>
        <a href="/finance-leadership-hiring" class="fp-item fp-item--bd"><span class="fp-dot"></span>CFO &amp; Finance</a>
        <a href="/sales-leadership-hiring" class="fp-item fp-item--sales"><span class="fp-dot"></span>Sales &amp; Retail</a>
        <a href="/hr-leadership-hiring" class="fp-item fp-item--strategy"><span class="fp-dot"></span>CHRO &amp; HR</a>
      </div>
    </div>
    <div class="footer-grid">
      <div>
        <div class="footer-brand"><img width="341" height="150" src="/images/logo-boardroomcxo-transparent.png" alt="Boardroom CXO" /></div>
        <p class="footer-tag">Executive search for CXO and senior leadership roles in India and the UAE, deepest in retail and jewellery. Home of Boardroom Moves.</p>
        <div class="footer-socials">
          <a href="https://www.linkedin.com/company/boardroom-cxo" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg></a>
        </div>
      </div>
      <div class="footer-col"><p class="footer-h5">Executive Search</p><ul><li><a href="/executive-search">How we search</a></li><li><a href="/executive-search-faq">Search FAQ</a></li><li><a href="/case-studies">Case Studies</a></li><li><a href="/uae-consulting-hiring">UAE Search</a></li><li><a href="/resources">Hiring Insights</a></li><li><a href="/schedule-a-call" data-door="search" data-door-at="footer">Hire a Leader</a></li></ul></div>
      <div class="footer-col"><p class="footer-h5">Boardroom Moves</p><ul><li><a href="/moves">Latest Moves</a></li><li><a href="/inside-the-boardroom">Inside the Boardroom</a></li><li><a href="/get-featured" data-door="moves" data-door-at="footer">Get Featured</a></li><li><a href="https://accountingbaba.com/portal/?brand=boardroom">Employer Login</a></li></ul></div>
      <div class="footer-col footer-contact"><p class="footer-h5">Contact</p><p><a href="/about-us">About Boardroom CXO</a></p><p><a href="tel:+919856755000">+91 98567 55000</a></p><p><a href="mailto:hire@boardroomcxo.com">hire@boardroomcxo.com</a></p><p>Mon–Sat · 10am–6pm IST</p><p>Surat, India &amp; <a href="/uae-consulting-hiring" style="color:inherit;border-bottom:1px solid currentColor;">UAE</a></p><p><a href="https://wa.me/919856755000" target="_blank" rel="noopener">WhatsApp</a></p></div>
    </div>
    <div class="footer-bottom"><span>© Boardroom CXO · ${year}</span><span><a href="/privacy-policy">Privacy Policy</a> · All Rights Reserved</span></div>
  </div>
</footer>`;
