// Repo folders and files that are not part of the website. Pages publishes the whole repo,
// so these are answered with the site's 404 page instead of being served.
const BLOCKED_DIRS = ['/frontend/', '/backend/', '/memory/', '/tests/', '/test_reports/'];
const BLOCKED_FILES = new Set(['/README.md', '/test_result.md', '/design_guidelines.json']);

async function notFound(context, url) {
  const page = await context.env.ASSETS.fetch(new URL('/404', url));
  return new Response(page.body, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'www.boardroomcxo.com') {
    url.hostname = 'boardroomcxo.com';
    return Response.redirect(url.toString(), 301);
  }

  const path = url.pathname;

  // Old copies of the articles from the original app build: send them to the real page.
  const old = path.match(/^\/frontend\/public\/([a-z0-9-]+?)(?:\.html)?$/);
  if (old) {
    const target = old[1] === 'index' ? '/' : '/' + old[1];
    return Response.redirect(new URL(target, url).toString(), 301);
  }

  // Dotfiles and dot-folders (.gitconfig, .htaccess, .claude, .emergent), except .well-known.
  const hidden = path.startsWith('/.') && !path.startsWith('/.well-known/');
  if (hidden || BLOCKED_FILES.has(path) || BLOCKED_DIRS.some((dir) => path === dir.slice(0, -1) || path.startsWith(dir))) {
    return notFound(context, url);
  }

  return context.next();
}
