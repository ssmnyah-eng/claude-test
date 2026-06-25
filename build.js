/**
 * VYV Blog Build Script
 * Reads _posts/*.md → generates /posts/{slug}/index.html + /blog.html
 */
const fs   = require('fs');
const path = require('path');
const { marked } = require('marked');

/* ── Helpers ─────────────────────────────────────────────────────── */

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  const data = {};
  match[1].split('\n').forEach(line => {
    const colon = line.indexOf(':');
    if (colon === -1) return;
    const key = line.slice(0, colon).trim();
    let   val = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    if (val.startsWith('[')) {
      try { val = JSON.parse(val.replace(/'/g, '"')); } catch(_) { val = []; }
    }
    data[key] = val;
  });
  return { data, content: match[2] };
}

function slugify(filename) {
  return filename
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/\.md$/, '');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function sharedHead(title, description, canonical) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description || ''}" />
  ${canonical ? `<link rel="canonical" href="${canonical}" />` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --primary:#210D46; --bg-dark:#190E2A; --accent:#4A237A;
      --lavender:#8B5BC7; --text:#ECEBEE; --text-muted:rgba(236,235,238,0.68);
      --text-dim:rgba(236,235,238,0.35); --border:rgba(139,91,199,0.22);
      --font-display:'Sora',sans-serif; --font-body:'Inter',sans-serif;
      --max-w:1160px; --ease:0.25s ease;
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{scroll-behavior:smooth;}
    body{font-family:var(--font-body);background:var(--bg-dark);color:var(--text);-webkit-font-smoothing:antialiased;}
    a{text-decoration:none;color:inherit;}
    img{display:block;max-width:100%;}
    .container{width:100%;max-width:var(--max-w);margin:0 auto;padding:0 24px;}
    /* Nav */
    nav{position:sticky;top:0;z-index:100;background:rgba(25,14,42,0.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);padding:16px 24px;}
    .nav-inner{display:flex;align-items:center;justify-content:space-between;max-width:var(--max-w);margin:0 auto;}
    .nav-brand{font-family:var(--font-display);font-weight:900;font-size:1.4rem;color:var(--text);letter-spacing:-0.03em;}
    .nav-back{font-size:0.85rem;color:var(--text-muted);transition:color var(--ease);}
    .nav-back:hover{color:var(--lavender);}
    /* Page shell */
    .page-wrap{max-width:720px;margin:0 auto;padding:80px 24px;}
    /* Prose */
    .prose h1,.prose h2,.prose h3{font-family:var(--font-display);font-weight:700;color:var(--text);margin:2rem 0 1rem;line-height:1.2;}
    .prose h1{font-size:clamp(2rem,4vw,2.8rem);letter-spacing:-0.02em;}
    .prose h2{font-size:1.5rem;}
    .prose h3{font-size:1.2rem;}
    .prose p{font-size:1.05rem;line-height:1.85;color:var(--text-muted);margin-bottom:1.4rem;}
    .prose ul,.prose ol{padding-left:1.5rem;color:var(--text-muted);margin-bottom:1.4rem;}
    .prose li{font-size:1.05rem;line-height:1.75;margin-bottom:.4rem;}
    .prose a{color:var(--lavender);text-decoration:underline;text-decoration-color:rgba(139,91,199,0.4);}
    .prose a:hover{color:#c09ee0;}
    .prose blockquote{border-left:3px solid var(--lavender);padding:.8rem 1.2rem;margin:1.5rem 0;background:rgba(139,91,199,0.07);border-radius:0 8px 8px 0;}
    .prose blockquote p{margin:0;font-style:italic;}
    .prose img{border-radius:12px;margin:2rem auto;}
    .prose code{background:rgba(139,91,199,0.15);border-radius:4px;padding:2px 6px;font-size:0.9em;}
    .prose pre{background:rgba(139,91,199,0.1);border:1px solid var(--border);border-radius:10px;padding:1.2rem;overflow-x:auto;margin:1.5rem 0;}
    .prose pre code{background:none;padding:0;}
    /* Card */
    .post-meta{display:flex;flex-wrap:wrap;gap:8px 20px;margin:16px 0 48px;font-size:0.8rem;color:var(--text-dim);}
    .post-tag{background:rgba(139,91,199,0.12);border:1px solid var(--border);border-radius:100px;padding:3px 12px;font-size:0.72rem;font-weight:600;color:var(--lavender);}
    .feat-img{width:100%;border-radius:16px;margin-bottom:48px;max-height:420px;object-fit:cover;}
    /* CTA */
    .post-cta{margin:64px 0 0;padding:40px;background:var(--primary);border:1px solid var(--border);border-radius:16px;text-align:center;}
    .post-cta h3{font-family:var(--font-display);font-weight:800;font-size:1.4rem;color:var(--text);margin-bottom:12px;}
    .post-cta p{font-size:0.95rem;color:var(--text-muted);margin-bottom:24px;}
    .btn{display:inline-block;font-family:var(--font-body);font-weight:700;font-size:0.95rem;padding:13px 30px;border-radius:8px;background:var(--lavender);color:#fff;box-shadow:0 4px 20px rgba(139,91,199,.35);transition:background var(--ease),transform var(--ease);}
    .btn:hover{background:#a070d4;transform:translateY(-2px);}
    /* Footer */
    footer{border-top:1px solid var(--border);padding:36px 24px;text-align:center;font-size:0.8rem;color:var(--text-dim);}
    footer a{color:var(--lavender);}
  </style>
</head>
<body>`;
}

function sharedNav(backHref, backLabel) {
  return `<nav>
  <div class="nav-inner">
    <a href="/" class="nav-brand">VYV</a>
    <a href="${backHref}" class="nav-back">← ${backLabel}</a>
  </div>
</nav>`;
}

function sharedFooter() {
  return `<footer>
  <div class="container">
    <p>© 2026 VYV — Validate Your Vision · Fredericksburg, VA · <a href="/">Home</a> · <a href="/blog.html">Blog</a></p>
  </div>
</footer>
</body>
</html>`;
}

/* ── Read posts ──────────────────────────────────────────────────── */

const postsDir   = path.join(__dirname, '_posts');
const outPostDir = path.join(__dirname, 'posts');

if (!fs.existsSync(postsDir)) {
  console.log('No _posts/ directory found — nothing to build.');
  process.exit(0);
}

const mdFiles = fs.readdirSync(postsDir)
  .filter(f => f.endsWith('.md'))
  .sort()
  .reverse(); // newest first

const posts = mdFiles.map(filename => {
  const raw  = fs.readFileSync(path.join(postsDir, filename), 'utf8');
  const { data, content } = parseFrontmatter(raw);
  const slug = slugify(filename);
  const html = marked.parse(content);
  return { slug, filename, data, content, html };
});

/* ── Generate individual post pages ─────────────────────────────── */

posts.forEach(({ slug, data, html }) => {
  const dir = path.join(outPostDir, slug);
  fs.mkdirSync(dir, { recursive: true });

  const tags    = Array.isArray(data.tags) ? data.tags : [];
  const tagPills = tags.map(t => `<span class="post-tag">${t}</span>`).join(' ');
  const imgHtml  = data.image
    ? `<img class="feat-img" src="${data.image}" alt="${data.title || ''}" />`
    : '';

  const pageHtml =
    sharedHead(
      `${data.title || 'Blog Post'} | VYV Moving — Fredericksburg, VA`,
      data.description || '',
      `https://vyvmoves.com/posts/${slug}/`
    ) +
    sharedNav('/blog.html', 'All Posts') +
    `
<main>
  <div class="page-wrap">
    ${imgHtml}
    <article class="prose">
      <h1>${data.title || 'Untitled'}</h1>
      <div class="post-meta">
        <span>${formatDate(data.date)}</span>
        ${tagPills}
      </div>
      ${html}
    </article>
    <div class="post-cta">
      <h3>Ready to plan your move?</h3>
      <p>Book a free consultation — no pressure, no commitment. Just a real conversation.</p>
      <a href="/#cta" class="btn">Book Your Free Consultation</a>
    </div>
  </div>
</main>` +
    sharedFooter();

  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml);
  console.log(`  ✓ posts/${slug}/index.html`);
});

/* ── Generate blog.html listing ─────────────────────────────────── */

const cardHtml = posts.map(({ slug, data }) => {
  const tags     = Array.isArray(data.tags) ? data.tags.slice(0, 3) : [];
  const tagPills = tags.map(t => `<span class="card-tag">${t}</span>`).join('');
  const imgHtml  = data.image
    ? `<img class="card-img" src="${data.image}" alt="${data.title || ''}" loading="lazy" />`
    : `<div class="card-img-placeholder" aria-hidden="true"></div>`;
  return `
  <article class="post-card">
    <a href="/posts/${slug}/" class="card-img-wrap">${imgHtml}</a>
    <div class="card-body">
      <div class="card-tags">${tagPills}</div>
      <h2 class="card-title"><a href="/posts/${slug}/">${data.title || 'Untitled'}</a></h2>
      <p class="card-date">${formatDate(data.date)}</p>
      <p class="card-desc">${data.description || ''}</p>
      <a href="/posts/${slug}/" class="card-link">Read more →</a>
    </div>
  </article>`;
}).join('\n');

const emptyState = posts.length === 0
  ? '<p style="color:rgba(236,235,238,0.5);text-align:center;padding:80px 0;">No posts yet — check back soon.</p>'
  : '';

const blogHtml =
  sharedHead(
    'Blog | VYV Moving — Packing &amp; Moving Tips, Fredericksburg VA',
    'Moving tips, packing guides, and local knowledge from VYV — your locally owned moving and organizing company in Fredericksburg, VA.',
    'https://vyvmoves.com/blog.html'
  ) +
  sharedNav('/', 'Back to Home') +
  `
<main>
  <div class="page-wrap" style="max-width:900px;">
    <div class="blog-header">
      <span class="blog-label">Tips &amp; Guides</span>
      <h1 class="blog-title">The VYV Blog</h1>
      <p class="blog-sub">Packing tips, moving guides, and local knowledge from a team that does this every day in Fredericksburg, VA.</p>
    </div>
    <div class="posts-grid">
      ${cardHtml || emptyState}
    </div>
  </div>
</main>` +
  `
<style>
  .blog-header{text-align:center;margin-bottom:64px;}
  .blog-label{font-size:.7rem;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--lavender);}
  .blog-title{font-family:var(--font-display);font-weight:900;font-size:clamp(2rem,5vw,3.2rem);letter-spacing:-.025em;color:var(--text);margin:14px 0 18px;}
  .blog-sub{font-size:1.05rem;color:var(--text-muted);line-height:1.75;max-width:560px;margin:0 auto;}
  .posts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:28px;}
  .post-card{background:var(--primary);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:border-color var(--ease),transform var(--ease);}
  .post-card:hover{border-color:rgba(139,91,199,.5);transform:translateY(-5px);}
  .card-img-wrap{display:block;height:200px;overflow:hidden;}
  .card-img{width:100%;height:100%;object-fit:cover;transition:transform .4s ease;}
  .post-card:hover .card-img{transform:scale(1.04);}
  .card-img-placeholder{width:100%;height:100%;background:linear-gradient(135deg,var(--accent),var(--primary));}
  .card-body{padding:24px;display:flex;flex-direction:column;flex:1;}
  .card-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}
  .card-tag{font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:rgba(139,91,199,.12);border:1px solid var(--border);color:var(--lavender);border-radius:100px;padding:3px 10px;}
  .card-title{font-family:var(--font-display);font-weight:700;font-size:1.1rem;color:var(--text);margin-bottom:6px;line-height:1.3;}
  .card-title a:hover{color:var(--lavender);}
  .card-date{font-size:.78rem;color:var(--text-dim);margin-bottom:10px;}
  .card-desc{font-size:.9rem;line-height:1.7;color:var(--text-muted);flex:1;margin-bottom:16px;}
  .card-link{font-size:.85rem;font-weight:700;color:var(--lavender);transition:color var(--ease);}
  .card-link:hover{color:#c09ee0;}
</style>` +
  sharedFooter();

fs.writeFileSync(path.join(__dirname, 'blog.html'), blogHtml);
console.log('  ✓ blog.html');
console.log(`\nBuild complete — ${posts.length} post(s) generated.`);
