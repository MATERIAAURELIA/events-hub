/* Volunteer layer for the Events Hub — loads only with ?volunteer in the URL.
   Same cards as the public hub; adds a helper strip under each card.
   Back end is shared with the old board: Apps Script store (meta / signups / blurb),
   FormSubmit → Marcus's inbox for private details, launchd reminders on the Mac mini.
   Admin: ?volunteer&admin=1  (Marcus, Oct 12 2026: "use the events hub format") */
(() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbzzu1jXVtwDuHyBThe62Ipc10UzBJkDQDACGZfe5oEF9jXIUl3qtGjbJD2c3IW_q4EjKQ/exec';
  const FORM = 'https://formsubmit.co/ajax/68bf44fd6c680760a90740f0fc752510';
  const META_KEY = 'volunteer-events-meta', SIGNUPS_KEY = 'volunteer-signups', BLURB_KEY = 'volunteer-board-blurb', GIGS_KEY = 'volunteer-private-gigs';
  const FACE = 'https://events.earthharmonysoundwellness.com/photos/marcus-face-gong-halo.jpg?v=2';
  const DEFAULT_BLURB = 'Hi friends — these are the next gigs where I welcome support. Come give your gift of presence. Exchange for a session, <em>learn</em>, <em>assist</em>, and <em>shadow</em> the work. 🌹';
  const ROLE_PRESETS = ['Host: sweep, set up mats & blankets, welcome guests', 'Welcome hosts · move + set up equipment', 'Greet + welcome guests', 'Room setup: candles, mats, blankets', 'Roving / small percussion', 'Snore patrol', 'Load drums in + out'];
  const EX_PRESETS = ['A spot in the session', 'Sound therapy mentoring: serve one session, sit the other', 'Community Sound Bath pass', 'A session trade: a Harmonic OM or Community Sound Bath spot'];
  const TYPE_LABEL = { home: '🏠 Home studio', sound: '🔔 Public sound bath', drum: '🥁 Drumming', other: '✨ Other' };
  const FULL_WORD = 'Positions filled';

  const urlAdmin = new URLSearchParams(location.search).get('admin') === '1';
  let admin = urlAdmin;
  let meta = {}, signups = {}, blurb = '', gigs = [];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = async k => { try { const r = await fetch(`${API_URL}?key=${encodeURIComponent(k)}`); return r.ok ? await r.json() : {}; } catch { return {}; } };
  const save = async (k, v) => { try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ key: k, value: v }) }); } catch {} };
  const evById = id => (typeof EVENTS !== 'undefined' ? EVENTS : []).find(e => e.id === id) || gigs.find(g => g.id === id);
  const typeOf = ev => (meta[ev.id] || {}).type || (ev.venue === 'home' ? 'home'
    : /drum|circle|rhythm|pulse/i.test(ev.title) ? 'drum' : /sound|bath|gong|bowl/i.test(ev.title) ? 'sound' : 'other');
  const info = ev => {
    const m = meta[ev.id] || {}, d = (meta.__defaults || {})[typeOf(ev)] || {};
    const people = (signups[ev.id] || []).map(s => s.name).filter(Boolean);
    const need = m.need ?? d.need ?? 0;
    return { m, d, people, need, role: m.role || d.role || '', exchange: m.exchange || d.exchange || '', notes: m.notes || '', full: need && people.length >= need };
  };
  const startISO = ev => ev.date ? `${ev.date}T${ev.time || '00:00'}:00` : '';

  /* ---------- styles (hub is dark navy + gold; strip is warm cream) ---------- */
  const css = document.createElement('style');
  css.textContent = `
    /* palette: hub navy + gold (gold = service as a gift) */
    :root{--vh-gold:#d2a44e;--vh-gold-soft:rgba(210,164,78,.38);--vh-panel:#18213a;--vh-ink:#f3ebdd;--vh-dim:rgba(243,235,221,.7);}
    .vh-head{max-width:640px;margin:0 auto 14px;display:flex;gap:12px;align-items:center;}
    .vh-face{width:92px;height:92px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 0 0 2px #0e1522,0 0 0 3px var(--vh-gold);}
    .vh-blurb{flex:1;background:var(--vh-panel);color:var(--vh-ink);border:1px solid var(--vh-gold-soft);border-radius:14px;padding:14px 16px;font-size:15px;line-height:1.6;}
    .vh-blurb em{color:var(--vh-gold);}
    .vh-blurb [style*="text-align:center"]{color:var(--vh-gold);}
    .vh-blurb[contenteditable=true]{outline:1px dashed var(--vh-gold);cursor:text;}
    .vh-title{text-align:center;color:var(--vh-gold);font-family:var(--heading-font);font-size:1.5rem;margin:6px 0 10px;letter-spacing:.02em;}
    .vh-ask{max-width:640px;margin:0 auto 16px;text-align:center;}
    .vh-ask summary{display:inline-block;list-style:none;cursor:pointer;background:transparent;color:var(--vh-ink);border:1px solid var(--vh-gold-soft);border-radius:999px;padding:7px 16px;font-size:14px;}
    .vh-ask summary::-webkit-details-marker{display:none;}
    .vh-ask form,.vh-modal form{display:flex;flex-direction:column;gap:7px;margin-top:8px;background:var(--vh-panel);border:1px solid var(--vh-gold-soft);border-radius:12px;padding:12px;text-align:left;}
    .vh-ask input,.vh-ask textarea,.vh-modal input,.vh-strip input,.vh-defaults input{padding:9px 11px;border:1px solid var(--vh-gold-soft);border-radius:8px;font-size:16px;font-family:inherit;background:#0e1522;color:var(--vh-ink);min-width:0;}
    .vh-ask input::placeholder,.vh-ask textarea::placeholder,.vh-modal input::placeholder,.vh-strip input::placeholder,.vh-defaults input::placeholder{color:rgba(243,235,221,.4);}
    .vh-ask textarea{min-height:70px;}
    .vh-btn{background:linear-gradient(180deg,#e0b65e,#c99a3f);color:#0e1522;border:0;border-radius:999px;padding:8px 18px;font-weight:700;font-size:14px;cursor:pointer;align-self:flex-end;box-shadow:0 4px 14px -6px rgba(210,164,78,.7);}
    .link-btn:has(+ .vh-strip){margin-bottom:0 !important;border-bottom-left-radius:0 !important;border-bottom-right-radius:0 !important;}
    .vh-strip{margin:0 0 calc(var(--btn-gap,12px) + 14px);background:radial-gradient(120% 90% at 50% 0%, rgba(232,190,100,.20) 0%, rgba(232,190,100,.06) 45%, rgba(232,190,100,0) 75%), var(--vh-panel);box-shadow:0 0 0 1px rgba(210,164,78,.35), 0 0 22px -2px rgba(232,190,100,.28), 0 14px 30px -10px rgba(232,190,100,.45), inset 0 1px 0 rgba(255,225,160,.25);border:1px solid var(--vh-gold-soft);border-top:2px solid var(--vh-gold);border-radius:0 0 14px 14px;padding:10px 12px;display:flex;flex-wrap:wrap;gap:7px;align-items:center;color:var(--vh-ink);font-size:14px;}
    .vh-pill{display:inline-flex;align-items:center;gap:4px;background:transparent;border:1px solid var(--vh-gold-soft);border-radius:999px;padding:5px 11px;font-size:13.5px;color:var(--vh-ink);}
    .vh-need{font-weight:700;color:var(--vh-gold);border-color:var(--vh-gold);}
    .vh-filled{background:linear-gradient(180deg,#76a86d,#5a8c52);color:#fff;border-color:transparent;padding:7px 16px;box-shadow:0 4px 14px -6px rgba(118,168,109,.7);}
    .vh-who{background:rgba(210,164,78,.14);border-color:transparent;color:var(--vh-gold);}
    .vh-more{background:transparent;border:1px solid var(--vh-gold-soft);border-radius:999px;padding:5px 12px;font-size:13px;color:var(--vh-dim);cursor:pointer;}
    .vh-row{flex-basis:100%;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
    .vh-row .vh-btn{margin-left:auto;}
    .vh-details{display:none;flex-basis:100%;background:rgba(255,255,255,.04);border-radius:10px;padding:9px 11px;line-height:1.6;color:var(--vh-ink);}
    .vh-details b{color:var(--vh-gold);font-weight:600;}
    .vh-strip.open .vh-details{display:block;}
    .vh-strip.edit{border-style:dashed;}
    .vh-strip.edit .vh-grow{flex:1 1 220px;}
    .vh-strip.edit .vh-n{width:64px;}
    .vh-strip.edit .vh-notes{flex-basis:100%;}
    .vh-hide{border:0;border-radius:999px;padding:6px 12px;font-weight:700;font-size:12px;color:#0e1522;cursor:pointer;background:var(--vh-dim);}
    .vh-hide.off{background:var(--vh-gold);}
    .link-btn.vh-hidden{opacity:.35;}
    body.vh-guest .link-btn.vh-hidden,body.vh-guest .vh-strip.vh-hidden,.vh-gone{display:none !important;}
    .vh-defaults{max-width:640px;margin:0 auto 14px;background:var(--vh-panel);border:1px dashed var(--vh-gold-soft);border-radius:12px;padding:10px 12px;color:var(--vh-ink);font-size:13px;}
    .vh-defaults b{color:var(--vh-gold);}
    .vh-defaults .dr{display:grid;grid-template-columns:140px 56px 1fr 1fr;gap:6px;align-items:center;margin-top:5px;}
    .vh-defaults input{padding:6px 8px;font-size:14px;}
    @media(max-width:600px){.vh-head{flex-direction:column;text-align:left}.vh-face{width:104px;height:104px}}
    @media(max-width:600px){.vh-defaults .dr{grid-template-columns:1fr 56px}.vh-defaults .dr .full{grid-column:1/-1}}
    .vh-modal{position:fixed;inset:0;background:rgba(4,8,16,.72);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px;}
    .vh-modal .box{background:#141c2e;color:var(--vh-ink);border:1px solid var(--vh-gold-soft);border-radius:16px;max-width:460px;width:100%;padding:18px;max-height:90vh;overflow:auto;box-shadow:0 30px 60px -20px rgba(0,0,0,.7);}
    .vh-modal h3{margin:0 0 4px;font-family:var(--heading-font);font-size:1.25rem;color:var(--vh-gold);}
    .vh-modal .when{font-weight:700;margin-bottom:8px;}
    .vh-modal .duties{background:rgba(255,255,255,.04);border-radius:10px;padding:10px 12px;line-height:1.6;margin-bottom:6px;font-size:14px;}
    .vh-modal .duties b{color:var(--vh-gold);font-weight:600;}
    .vh-modal form{padding:0;background:none;border:0;}
    .vh-modal .note{font-size:11.5px;color:var(--vh-dim);font-style:italic;}
    .vh-modal .cal a{display:inline-block;margin:4px;background:transparent;border:1px solid var(--vh-gold);border-radius:999px;padding:7px 14px;color:var(--vh-gold);font-weight:700;text-decoration:none;cursor:pointer;}
    .vh-modal .x{float:right;background:none;border:0;font-size:22px;cursor:pointer;color:var(--vh-dim);}
    .vh-filter{max-width:640px;margin:0 auto 16px;display:flex;flex-wrap:wrap;gap:7px;align-items:center;justify-content:center;}
    @media(max-width:600px){.vh-filter{gap:5px}.vh-filter button{padding:6px 9px;font-size:12.5px}.vh-filter .lb{flex-basis:100%;text-align:center}}
    .vh-filter .lb{color:var(--vh-gold);font-weight:700;letter-spacing:.14em;font-size:12px;margin-right:2px;}
    .vh-filter button{background:transparent;border:1px solid var(--vh-gold-soft);color:var(--vh-ink);border-radius:999px;padding:7px 14px;font-size:13.5px;cursor:pointer;font-family:inherit;}
    .vh-filter button.on{background:var(--vh-gold);color:#0e1522;border-color:var(--vh-gold);font-weight:700;}
    body.vf-private #view-list,body.vf-private #view-calendar,body.vf-public .vh-pg{display:none !important;}
    body.vf-still .vf-full{display:none !important;}
    .vh-pg{max-width:640px;margin:0 auto 22px;}
    .vh-pg-h{color:var(--vh-gold);font-family:var(--heading-font);font-size:1.15rem;margin:0 0 4px;text-align:center;}
    .vh-pg-sub{color:var(--vh-dim);font-size:13.5px;text-align:center;margin:0 0 10px;}
    .vh-pg-card{background:#141c2e;border:1px solid var(--vh-gold);border-bottom:0;border-radius:14px 14px 0 0;padding:12px 14px;color:var(--vh-ink);}
    .vh-pg-card .t{font-weight:700;font-size:16px;}
    .vh-pg-card .w{color:var(--vh-gold);font-size:14px;margin-top:2px;}
    .vh-pg-card .pl{color:var(--vh-dim);font-size:13.5px;}
    .vh-pg-card input{width:100%;margin-top:5px;padding:7px 9px;border:1px solid var(--vh-gold-soft);border-radius:8px;background:#0e1522;color:var(--vh-ink);font-size:15px;font-family:inherit;box-sizing:border-box;}
    .vh-pg-card .two{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
    .vh-pg-del{float:right;background:none;border:0;color:var(--vh-dim);cursor:pointer;font-size:13px;}
    .vh-pg-add{display:block;margin:4px auto 0;background:transparent;border:1px dashed var(--vh-gold);color:var(--vh-gold);border-radius:999px;padding:8px 16px;cursor:pointer;font-weight:700;}
    .vh-pg .vh-strip{margin-bottom:14px;}
    #vh-switch{position:fixed;left:16px;bottom:16px;z-index:150;background:var(--vh-gold);color:#0e1522;border:0;border-radius:999px;padding:11px 18px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer;}
  `;
  document.head.appendChild(css);
  document.title = 'Earth Harmony · Team Service Exchange';

  /* ---------- header: title, face + editable intro, ask box, defaults ---------- */
  const list = document.getElementById('view-list');
  const head = document.createElement('div');
  head.innerHTML = `<div class="vh-title">Team Service Exchange</div>
    <div class="vh-filter" id="vh-filter"><span class="lb">SHOW</span><button data-f="all">All</button><button data-f="public">Public events</button><button data-f="private">Private events</button><button data-f="still">Still needed</button></div>
    <div class="vh-head"><img class="vh-face" src="${FACE}" alt="Marcus"><div class="vh-blurb" id="vh-blurb"></div></div>
    <details class="vh-ask"><summary>❓ Ask Marcus a question</summary>
      <form id="vh-ask"><input name="name" placeholder="Your name" required><input name="email" type="email" placeholder="Your email (so he can reply)" required>
      <textarea name="q" placeholder="Your question…" required></textarea><button class="vh-btn">Send question</button><div class="vh-ok" style="display:none;color:#d2a44e">🙏 Sent! Marcus will get back to you.</div></form></details>
    <div class="vh-defaults" id="vh-defaults" style="display:none"></div>`;
  const label = document.querySelector('.section-label');
  if (label) { label.replaceWith(head); } else { list.parentNode.insertBefore(head, list); }
  let vf = 'all'; try { vf = localStorage.getItem('eh-vol-filter') || 'all'; } catch {}
  const setFilter = f => {
    vf = f; try { localStorage.setItem('eh-vol-filter', f); } catch {}
    ['public', 'private', 'still'].forEach(k => document.body.classList.toggle('vf-' + k, k === f));
    head.querySelectorAll('#vh-filter button').forEach(b => b.classList.toggle('on', b.dataset.f === f));
  };
  head.querySelectorAll('#vh-filter button').forEach(b => b.onclick = () => setFilter(b.dataset.f));
  setFilter(vf);
  const tl = document.getElementById('top-links'); if (tl) tl.style.display = 'none';
  const me = (() => { try { return JSON.parse(localStorage.getItem('eh-volunteer') || 'null') || {}; } catch { return {}; } })();
  const remember = o => { try { localStorage.setItem('eh-volunteer', JSON.stringify({ ...me, ...o })); Object.assign(me, o); } catch {} };
  const ask = head.querySelector('#vh-ask');
  ask.name.value = me.name || ''; ask.email.value = me.email || '';
  ask.addEventListener('submit', async e => {
    e.preventDefault(); remember({ name: ask.name.value.trim(), email: ask.email.value.trim() });
    try { await fetch(FORM, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ _subject: `❓ Volunteer question from ${ask.name.value.trim()}`, _template: 'table', _captcha: 'false', _replyto: ask.email.value.trim(),
        name: ask.name.value.trim(), email: ask.email.value.trim(), question: ask.q.value.trim() }) }); } catch {}
    ask.q.value = ''; ask.querySelector('.vh-ok').style.display = '';
  });

  function paintHeader() {
    const b = document.getElementById('vh-blurb');
    if (document.activeElement !== b) b.innerHTML = blurb || DEFAULT_BLURB;
    b.contentEditable = admin ? 'true' : 'false';
    const dp = document.getElementById('vh-defaults');
    dp.style.display = admin ? '' : 'none';
    if (admin && !dp.dataset.built) {
      dp.dataset.built = '1';
      const d = meta.__defaults || {};
      dp.innerHTML = `<b>⚙ Default helpers by type</b> — set once, every event of that type uses it (override any card below)` +
        Object.keys(TYPE_LABEL).map(k => `<div class="dr" data-k="${k}"><span>${TYPE_LABEL[k]}</span>
          <input class="n" type="number" min="0" value="${d[k]?.need ?? ''}" placeholder="#">
          <input class="r full" list="vh-roles" value="${esc(d[k]?.role)}" placeholder="🧹 role">
          <input class="x full" list="vh-ex" value="${esc(d[k]?.exchange)}" placeholder="⭐ exchange"></div>`).join('');
      dp.querySelectorAll('input').forEach(el => el.addEventListener('change', async () => {
        const row = el.closest('.dr'), n = row.querySelector('.n').value;
        meta.__defaults = { ...(meta.__defaults || {}), [row.dataset.k]: { need: n === '' ? undefined : +n, role: row.querySelector('.r').value.trim(), exchange: row.querySelector('.x').value.trim() } };
        await save(META_KEY, meta);
      }));
      dp.addEventListener('focusout', e => { if (!dp.contains(e.relatedTarget)) decorate(true); });
    }
  }
  document.getElementById('vh-blurb').addEventListener('blur', async e => { if (!admin) return; blurb = e.target.innerHTML.trim(); await save(BLURB_KEY, { html: blurb }); });

  /* ---------- private gigs: not on the public hub; Marcus adds them here (Oct 28 2026) ---------- */
  const pg = document.createElement('section'); pg.className = 'vh-pg'; pg.id = 'private';
  head.after(pg);
  const whenOf = g => {
    if (!g.date) return g.dateNote || 'Date TBC';
    const d = new Date(g.date + 'T00:00:00');
    return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) + (g.time ? ' · ' + (typeof fTime === 'function' ? fTime(g.time) : g.time) : '') + (g.timeNote ? ' ' + g.timeNote : '');
  };
  const saveGigs = () => save(GIGS_KEY, { list: gigs });
  function paintGigs() {
    const today = new Date().toISOString().slice(0, 10);
    const shown = gigs.filter(g => !g.date || g.date >= today).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    if (!shown.length && !admin) { pg.innerHTML = ''; return; }
    pg.innerHTML = `<div class="vh-pg-h">🔒 Private gigs · team needed</div><div class="vh-pg-sub">Bookings that aren't on the public calendar. Details go to you privately once you sign up.</div>`;
    shown.forEach(g => {
      const c = document.createElement('div'); c.className = 'vh-pg-card' + (info(g).full ? ' vf-full' : '');
      if (admin) {
        c.innerHTML = `<button class="vh-pg-del">🗑 remove</button><input data-f="title" value="${esc(g.title)}" placeholder="Title (what helpers see)">
          <div class="two"><input data-f="date" type="date" value="${esc(g.date)}"><input data-f="time" type="time" value="${esc(g.time)}"></div>
          <div class="two"><input data-f="dateNote" value="${esc(g.dateNote)}" placeholder="If no date: e.g. early Dec, TBC"><input data-f="timeNote" value="${esc(g.timeNote)}" placeholder="e.g. (arrive 2:15)"></div>
          <input data-f="place" value="${esc(g.place)}" placeholder="Area (keep client private)">`;
        c.querySelectorAll('input').forEach(el => el.addEventListener('change', async () => { g[el.dataset.f] = el.value.trim(); await saveGigs(); }));
        c.querySelector('.vh-pg-del').onclick = async () => { if (!confirm('Remove this gig?')) return; gigs = gigs.filter(x => x !== g); await saveGigs(); paintGigs(); };
      } else {
        c.innerHTML = `<div class="t">${esc(g.title)}</div><div class="w">${esc(whenOf(g))}</div>${g.place ? `<div class="pl">📍 ${esc(g.place)}</div>` : ''}`;
      }
      pg.appendChild(c);
      const st = stripFor(g); if (!admin && st.classList.contains('vh-hidden')) st.style.display = 'none';
      pg.appendChild(st);
    });
    if (admin) {
      const b = document.createElement('button'); b.className = 'vh-pg-add'; b.textContent = '+ Add a private gig';
      b.onclick = async () => { const id = 'pg-' + Date.now().toString(36); gigs.push({ id, title: '', date: '', time: '' }); meta[id] = { ...(meta[id] || {}), type: 'private' }; await Promise.all([saveGigs(), save(META_KEY, meta)]); paintGigs(); };
      pg.appendChild(b);
    }
    if (location.hash === '#private' && !pg.dataset.jumped) { pg.dataset.jumped = '1'; setTimeout(() => pg.scrollIntoView({ behavior: 'smooth' }), 300); }
  }

  const dl = (id, items) => { const x = document.getElementById(id) || document.body.appendChild(Object.assign(document.createElement('datalist'), { id })); x.innerHTML = items.map(v => `<option value="${esc(v)}">`).join(''); };

  /* ---------- strip under every hub card ---------- */
  function stripFor(ev) {
    const s = document.createElement('div');
    s.className = 'vh-strip'; s.dataset.id = ev.id;
    const I = info(ev);
    if (I.full) s.classList.add('vf-full');
    if (I.m.hidden) s.classList.add('vh-hidden');
    if (admin) {
      s.classList.add('edit');
      s.innerHTML = `<button class="vh-hide ${I.m.hidden ? 'off' : ''}">${I.m.hidden ? 'Hidden · show' : 'Hide'}</button>
        <span class="vh-pill">🙋 <input class="vh-n" type="number" min="0" value="${I.need || ''}" placeholder="#"> helpers</span>
        <input class="vh-grow r" list="vh-roles" value="${esc(I.role)}" placeholder="🧹 role">
        <input class="vh-grow x" list="vh-ex" value="${esc(I.exchange)}" placeholder="⭐ exchange">
        <input class="vh-notes" value="${esc(I.notes)}" placeholder="📝 notes (e.g. arrive 5:45)">
        ${I.people.length ? `<div class="vh-row">${I.people.map(p => `<span class="vh-pill vh-who">✅ ${esc(p)}</span>`).join('')}</div>` : ''}`;
      s.querySelector('.vh-hide').onclick = async () => { meta[ev.id] = { ...(meta[ev.id] || {}), hidden: !I.m.hidden }; await save(META_KEY, meta); decorate(true); };
      const store = async () => {
        const n = s.querySelector('.vh-n').value, r = s.querySelector('.r').value.trim(), x = s.querySelector('.x').value.trim();
        meta[ev.id] = { ...(meta[ev.id] || {}), need: n === '' ? undefined : +n,
          role: r && r !== I.d.role ? r : undefined, exchange: x && x !== I.d.exchange ? x : undefined, notes: s.querySelector('.vh-notes').value.trim() };
        await save(META_KEY, meta);
      };
      s.querySelectorAll('input').forEach(el => el.addEventListener('change', store));
    } else {
      if (I.m.locked) {
        s.innerHTML = `<span class="vh-pill vh-need">🔒 ${I.need ? I.need + ' ' : ''}${esc(I.m.lockedLabel || 'spots by invitation')}</span>
          <button class="vh-more">Show role description ▾</button>
          <div class="vh-details"><div><b>🧹 Role:</b> ${esc(I.role) || 'TBA'}</div>${I.notes ? `<div><b>📝</b> ${esc(I.notes)}</div>` : ''}</div>`;
        s.querySelector('.vh-more').onclick = () => { const o = s.classList.toggle('open'); s.querySelector('.vh-more').textContent = o ? 'Hide role description ▴' : 'Show role description ▾'; };
        return s;
      }
      s.innerHTML = `<span class="vh-pill vh-need${I.full ? ' vh-filled' : ''}">${I.full ? '✓ ' : '🙋 '}${I.need ? (I.full ? FULL_WORD : `${I.people.length} / ${I.need} helpers`) : (I.people.length ? `${I.people.length} helping` : 'Helpers welcome')}</span>
        <button class="vh-more">Show role description ▾</button>
        <div class="vh-details"><div><b>🧹 Role:</b> ${esc(I.role) || 'TBA'}</div><div><b>⭐ Exchange:</b> ${esc(I.exchange) || 'TBA'}</div>${I.notes ? `<div><b>📝</b> ${esc(I.notes)}</div>` : ''}</div>
        <div class="vh-row">${I.people.map(p => `<span class="vh-pill vh-who">✅ ${esc(p)}</span>`).join('')}${I.full ? '' : '<button class="vh-btn vh-go">Sign up to help</button>'}</div>`;
      s.querySelector('.vh-more').onclick = () => { const o = s.classList.toggle('open'); s.querySelector('.vh-more').textContent = o ? 'Hide role description ▴' : 'Show role description ▾'; };
      const go = s.querySelector('.vh-go'); if (go) go.onclick = () => openSignup(ev);
    }
    return s;
  }

  let busy = false;
  function decorate(force) {
    if (busy) return; busy = true;
    try {
      document.body.classList.toggle('vh-guest', !admin);
      const used = Object.values(meta).filter(m => m && typeof m === 'object');
      dl('vh-roles', [...new Set([...ROLE_PRESETS, ...used.map(m => m.role).filter(Boolean)])]);
      dl('vh-ex', [...new Set([...EX_PRESETS, ...used.map(m => m.exchange).filter(Boolean)])]);
      list.querySelectorAll('.link-btn').forEach(card => {
        const id = ((card.getAttribute('onclick') || '').match(/showPopup\('([^']+)'\)/) || [])[1];
        const ev = id && evById(id);
        let next = card.nextElementSibling;
        if (!ev || card.classList.contains('cta-event')) { card.classList.add('vh-gone'); return; }
        card.classList.toggle('vh-hidden', !!(meta[id] || {}).hidden);
        card.classList.toggle('vf-full', !!info(ev).full);
        if (next && next.classList.contains('vh-strip')) { if (!force && next.dataset.id === id) return; next.remove(); }
        card.after(stripFor(ev));
      });
      paintHeader();
      paintGigs();
    } finally { busy = false; }
  }
  new MutationObserver(() => decorate(false)).observe(list, { childList: true });

  /* ---------- sign-up pop-up ---------- */
  function openSignup(ev) {
    const I = info(ev), d = new Date(ev.date + 'T00:00:00');
    const when = !ev.date ? (ev.dateNote || 'Date TBC') : `${d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}${ev.time ? ' · ' + (typeof fTime === 'function' ? fTime(ev.time) : ev.time) : ''}${ev.timeNote ? ' ' + ev.timeNote : ''}`;
    const w = document.createElement('div'); w.className = 'vh-modal';
    w.innerHTML = `<div class="box"><button class="x">×</button><h3>${esc(ev.title)}</h3><div class="when">${when}</div>
      <div class="duties"><div><b>🙋 Helpers:</b> ${I.need ? `${I.people.length} of ${I.need}` : 'welcome'}</div><div><b>🧹 Role:</b> ${esc(I.role) || 'TBA'}</div>
      <div><b>⭐ Exchange:</b> ${esc(I.exchange) || 'TBA'}</div>${I.notes ? `<div><b>📝</b> ${esc(I.notes)}</div>` : ''}</div>
      <form><input name="name" placeholder="Your name" required value="${esc(me.name)}"><input name="email" type="email" placeholder="Email (for your reminder)" required value="${esc(me.email)}">
      <input name="phone" type="tel" placeholder="Phone (optional)" value="${esc(me.phone)}"><button class="vh-btn">Sign up</button>
      <div class="note">Only your first name shows on the board. Your email goes privately to Marcus.</div></form></div>`;
    document.body.appendChild(w);
    const close = () => w.remove();
    w.querySelector('.x').onclick = close; w.addEventListener('click', e => { if (e.target === w) close(); });
    const f = w.querySelector('form');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const full = f.name.value.trim(), email = f.email.value.trim(), phone = f.phone.value.trim();
      const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = '…';
      remember({ name: full, email, phone });
      signups = await load(SIGNUPS_KEY) || {};               // re-read so we never overwrite someone else
      (signups[ev.id] = signups[ev.id] || []).push({ name: full.split(/\s+/)[0], ts: new Date().toISOString() });
      await save(SIGNUPS_KEY, signups);
      try { await fetch(FORM, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: `🙋 Volunteer sign-up — ${ev.title} — ${ev.date || ev.dateNote || 'date TBC'}`, _template: 'table', _captcha: 'false',
          name: full, email, phone, event: ev.title, event_id: ev.id, start: startISO(ev), location: ev.place || (typeof VENUES !== 'undefined' && VENUES[ev.venue]?.name) || '',
          role: I.role, exchange: I.exchange, notes: I.notes }) }); } catch {}
      if (!ev.date) { f.outerHTML = `<div style="text-align:center;margin-top:8px"><b style="color:#d2a44e;font-size:1.1rem">🙏 You're on the team!</b><div style="margin-top:4px;font-size:14px">Marcus will send you the date and details.</div></div>`; decorate(true); return; }
      const st = new Date(startISO(ev)), en = new Date(st.getTime() + 90 * 60000);
      const z = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const det = [I.role && 'Role: ' + I.role, I.exchange && 'Exchange: ' + I.exchange, I.notes].filter(Boolean).join('\n');
      const g = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Helping: ' + ev.title) + '&dates=' + z(st) + '/' + z(en) + '&details=' + encodeURIComponent(det);
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Earth Harmony//Team Service//EN', 'BEGIN:VEVENT', 'UID:' + ev.id + '-' + Date.now() + '@earthharmony',
        'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(st), 'DTEND:' + z(en), 'SUMMARY:Helping: ' + ev.title, 'DESCRIPTION:' + det.replace(/\n/g, '\\n'),
        'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      f.outerHTML = `<div style="text-align:center;margin-top:8px"><b style="color:#d2a44e;font-size:1.1rem">🙏 You're on the team!</b>
        <div style="margin:4px 0 8px;font-size:14px">You'll get a reminder email the day before. Add it to your calendar:</div>
        <div class="cal"><a href="${g}" target="_blank" rel="noopener">📅 Google Calendar</a><a href="${URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))}" download="earth-harmony-helping.ics">🍎 Apple / Outlook</a></div></div>`;
      decorate(true);
    });
  }

  /* ---------- calendar view: tapping a day shows the helper info, not "Book" ---------- */
  window.showDayPopup = ds => {
    const evs = (typeof EVENTS !== 'undefined' ? EVENTS : []).filter(e => e.date === ds && e.vis === 'public' && !(meta[e.id] || {}).hidden);
    if (!evs.length) return;
    const w = document.createElement('div'); w.className = 'vh-modal';
    w.innerHTML = `<div class="box"><button class="x">×</button>` + evs.map(ev => {
      const I = info(ev);
      return `<div style="margin-bottom:14px"><h3>${esc(ev.title)}</h3><div class="when">${ev.time ? (typeof fTime === 'function' ? fTime(ev.time) : ev.time) : ''}${(typeof VENUES !== 'undefined' && VENUES[ev.venue]?.name) ? ' · ' + esc(VENUES[ev.venue].name) : ''}</div>
        <div class="duties"><div><b>🙋 Helpers:</b> ${I.need ? (I.full ? FULL_WORD : `${I.people.length} of ${I.need}`) : 'welcome'}</div><div><b>🧹 Role:</b> ${esc(I.role) || 'TBA'}</div>
        <div><b>⭐ Exchange:</b> ${esc(I.exchange) || 'TBA'}</div>${I.notes ? `<div><b>📝</b> ${esc(I.notes)}</div>` : ''}${I.people.length ? `<div><b>✓ Team:</b> ${I.people.map(esc).join(', ')}</div>` : ''}</div>
        ${I.full ? '' : `<button class="vh-btn" data-id="${ev.id}" style="float:right">Sign up to help</button>`}<div style="clear:both"></div></div>`;
    }).join('') + '</div>';
    document.body.appendChild(w);
    w.querySelector('.x').onclick = () => w.remove(); w.addEventListener('click', e => { if (e.target === w) w.remove(); });
    w.querySelectorAll('.vh-btn[data-id]').forEach(b => b.onclick = () => { w.remove(); openSignup(evById(b.dataset.id)); });
  };

  /* ---------- admin: edit / guest-view switch ---------- */
  if (urlAdmin) {
    const sw = document.createElement('button'); sw.id = 'vh-switch';
    const paint = () => sw.textContent = admin ? '👁 See guest view' : '✏️ Back to editing';
    sw.onclick = () => { admin = !admin; paint(); decorate(true); }; paint();
    document.body.appendChild(sw);
  }

  (async () => {
    const [m, s, b, g] = await Promise.all([load(META_KEY), load(SIGNUPS_KEY), load(BLURB_KEY), load(GIGS_KEY)]);
    meta = m || {}; signups = s || {}; blurb = (b && b.html) || ''; gigs = (g && g.list) || [];
    decorate(true);
  })();
  decorate(true);
})();
