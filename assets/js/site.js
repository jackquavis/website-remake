/* ==========================================================================
   SITE.JS - shared behaviour, driven by the JSON files managed in Pages CMS
   - Builds the nav (only published galleries appear)
   - Mobile menu toggle
   - Renders gallery pages (data/galleries/<slug>.json) + lightbox
   Pages declare:  <body data-root="../" data-page="about"> (and data-gallery="slug")
   ========================================================================== */
(function () {
  const body = document.body;
  const ROOT = body.dataset.root || '';
  const PAGE = body.dataset.page || '';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const url = (p) => {
    if (!p) return ROOT || './';
    return /^(https?:|mailto:|tel:|#|\/\/)/.test(p) ? p : ROOT + String(p).replace(/^\/+/, '');
  };
  const getJSON = async (p) => {
    const r = await fetch(ROOT + p, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Failed to load ' + p);
    return r.json();
  };

  const ready = getJSON('data/site.json').catch(() => ({ galleries: [] }));
  window.Site = { ROOT, PAGE, esc, url, getJSON, ready };

  /* ---------- NAV ---------- */
  function buildNav(site) {
    const nav = document.getElementById('nav-menu');
    if (!nav) return;
    const galleries = (site.galleries || []).filter((g) => g.enabled);
    const cls = (name) => (PAGE === name ? ' class="active"' : '');
    let html = `<a href="${ROOT || './'}"${cls('work')}>Portfolio</a>`;

    if (galleries.length) {
      const inGallery = PAGE.indexOf('gallery:') === 0;
      html += `<div class="nav-dropdown${inGallery ? ' has-active' : ''}">
        <button class="nav-dropdown-trigger" type="button" aria-haspopup="true" aria-expanded="false">Galleries <span class="caret"></span></button>
        <div class="nav-dropdown-menu"><div class="nav-dropdown-panel">
          <button class="nav-back" type="button">&larr; Back</button>
          ${galleries.map((g) => `<a href="${ROOT}${esc(g.slug)}/"${PAGE === 'gallery:' + g.slug ? ' class="active"' : ''}>${esc(g.title)}</a>`).join('')}
        </div></div></div>`;
    }
    html += `<a href="${ROOT}about/"${cls('about')}>About</a>`;
    html += `<a href="${ROOT}booking/"${cls('booking')}>Booking</a>`;
    nav.innerHTML = html;

    const dd = nav.querySelector('.nav-dropdown');
    if (dd) {
      const trigger = dd.querySelector('.nav-dropdown-trigger');
      const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
      dd.querySelector('.nav-back').addEventListener('click', (e) => {
        e.stopPropagation();
        nav.classList.remove('show-galleries');
      });
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isMobile()) { nav.classList.add('show-galleries'); return; }
        const open = dd.classList.toggle('open');
        trigger.setAttribute('aria-expanded', open);
      });
      dd.addEventListener('mouseleave', () => {
        dd.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('click', () => {
        dd.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      });
    }
  }

  function initMobileMenu() {
    const btn = document.getElementById('hamburger-btn');
    const nav = document.getElementById('nav-menu');
    if (!btn || !nav) return;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      nav.classList.toggle('active');
      nav.classList.remove('show-galleries');
    });
  }

  /* ---------- GALLERY PAGES ---------- */
  async function initGallery(site) {
    const slug = body.dataset.gallery;
    if (!slug) return;

    const titleEl = document.getElementById('gallery-title');
    const introEl = document.getElementById('gallery-intro');
    const countEl = document.getElementById('gallery-count');
    const grid = document.getElementById('portfolio-gallery');
    const empty = document.getElementById('gallery-empty');
    const more = document.getElementById('gallery-more');

    const showEmpty = (msg) => { empty.textContent = msg; empty.hidden = false; };
    const meta = (site.galleries || []).find((g) => g.slug === slug);

    if (!meta || !meta.enabled) {
      titleEl.textContent = meta ? meta.title : 'Gallery';
      showEmpty("This gallery isn't published yet. Check back soon.");
      return;
    }

    document.title = `${meta.title} | Jakub Chojnowski`;
    titleEl.textContent = meta.title;
    introEl.textContent = meta.description || '';

    let photos = [];
    try { photos = await getJSON(`data/galleries/${slug}.json`); } catch (e) { photos = []; }
    photos = (photos || []).filter((p) => p && p.image);

    if (!photos.length) {
      showEmpty('Photos coming soon.');
    } else {
      countEl.textContent = `${String(photos.length).padStart(2, '0')} ${photos.length === 1 ? 'frame' : 'frames'}`;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((en) => en.target.classList.toggle('is-visible', en.isIntersecting));
      }, { threshold: 0.1 });
      photos.forEach((p, i) => {
        const img = document.createElement('img');
        img.src = url(p.image);
        img.alt = p.alt || p.title || '';
        img.addEventListener('click', () => openLightbox(i));
        grid.appendChild(img);
        observer.observe(img);
      });
    }

    // "More galleries" strip
    const others = (site.galleries || []).filter((g) => g.enabled && g.slug !== slug);
    if (more && others.length) {
      more.innerHTML = `<span class="mono">Explore more</span>` +
        others.map((g) => `<a class="pill" href="${ROOT}${esc(g.slug)}/">${esc(g.title)}</a>`).join('');
      more.hidden = false;
    }

    // Lightbox
    const lb = document.createElement('div');
    lb.id = 'lightbox'; lb.className = 'lightbox';
    lb.innerHTML = `<span class="lightbox-close" id="lightbox-close">&times;</span>
      <button class="lightbox-prev" id="lightbox-prev" aria-label="Previous">&#10094;</button>
      <img id="lightbox-img" class="lightbox-img" src="" alt="">
      <button class="lightbox-next" id="lightbox-next" aria-label="Next">&#10095;</button>`;
    body.appendChild(lb);
    const lbImg = lb.querySelector('#lightbox-img');
    let idx = 0;
    const show = () => { lbImg.src = url(photos[idx].image); lbImg.alt = photos[idx].alt || photos[idx].title || ''; };
    function openLightbox(i) { idx = i; show(); lb.classList.add('active'); body.style.overflow = 'hidden'; }
    const close = () => { lb.classList.remove('active'); body.style.overflow = ''; };
    const next = () => { idx = (idx + 1) % photos.length; show(); };
    const prev = () => { idx = (idx - 1 + photos.length) % photos.length; show(); };
    lb.querySelector('#lightbox-close').addEventListener('click', close);
    lb.querySelector('#lightbox-next').addEventListener('click', next);
    lb.querySelector('#lightbox-prev').addEventListener('click', prev);
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('active')) return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') close();
    });
  }

  initMobileMenu();
  ready.then((site) => { buildNav(site); initGallery(site); });
})();
