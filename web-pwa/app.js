/* Capsule web app: live camera, Snapchat-style chat, snaps sealed until a set date. */
const $ = (s, r = document) => r.querySelector(s);
const phone = $('#phone');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#f23c57', '#0ea5e9', '#9b55e5', '#16a34a', '#ff6a13', '#e5367f', '#0f9d9a', '#4f46e5'];
const colorOf = (id) => { let h = 0; for (const c of String(id || 'x')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
const EMOJIS = ['🎆', '📸', '🌙', '🔥', '🌴', '🎉', '❄️', '🍾'];
const MAX_VIDEO_SEC = 60;
const MAX_BYTES = 95 * 1024 * 1024;
const I = {
  chev: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  x: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  cam: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="12.5" r="3.6"/></svg>',
  send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"/></svg>',
  info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  T: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M5 6h14M12 6v13"/></svg>',
  lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" style="display:inline;vertical-align:-1px"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  group: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.7"/><path d="M16 14.2a5 5 0 0 1 5.5 5.8"/></svg>',
  key: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/></svg>',
  share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
};

const S = { D: null, me: null, myName: '', groups: [], loaded: false, err: '', data: {}, subs: {}, names: {}, tab: 'camera', thread: null, q: '', preselect: null };

/* ---------- small helpers ---------- */
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; phone.appendChild(t); setTimeout(() => t.remove(), 2400); }
const isOpen = (g) => Date.now() >= g.unlockAt;
function left(ms) { let d = Math.max(0, ms - Date.now()); const D = Math.floor(d / 864e5); d -= D * 864e5; const H = Math.floor(d / 36e5); d -= H * 36e5; const M = Math.floor(d / 6e4); d -= M * 6e4; return { D, H, M, S: Math.floor(d / 1e3) }; }
const shortLeft = (ms) => { const l = left(ms); return l.D > 0 ? l.D + 'd' : l.H > 0 ? l.H + 'h' : l.M > 0 ? l.M + 'm' : l.S + 's'; };
const longLeft = (ms) => { const l = left(ms); return l.D > 0 ? `${l.D}d ${l.H}h ${l.M}m` : `${l.H}h ${l.M}m ${l.S}s`; };
function ago(ms) { const d = (Date.now() - ms) / 1000; if (d < 60) return 'now'; if (d < 3600) return Math.floor(d / 60) + 'm'; if (d < 86400) return Math.floor(d / 3600) + 'h'; if (d < 604800) return Math.floor(d / 86400) + 'd'; return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
const fmtDate = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const who = (id) => (id && id === S.me ? 'Me' : S.names[id] || 'Friend');
const initial = (id) => ((id === S.me ? S.myName : who(id)) || '?').trim().slice(0, 1).toUpperCase();
const avatar = (id, cls = '') => `<span class="av ${cls}" style="background:${colorOf(id)}">${esc(initial(id))}</span>`;
const groupAvatar = (g, cls = '') => `<span class="av ${cls}" style="background:${colorOf(g.id)}"><span class="emo">${esc(g.emoji || '📸')}</span></span>`;
async function resolveNames(ids) { try { Object.assign(S.names, await S.D.names(ids.filter(Boolean))); } catch { /* fine */ } }
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const inviteLink = (code) => `${location.origin}${location.pathname}?join=${code}`;

/* ---------- boot ---------- */
async function boot() {
  Camera.start();
  render();
  try {
    const demo = location.hash === '#demo';
    S.D = demo ? await import('./data-demo.js') : await import(window.CAPSULE_BACKEND || './data-firebase.js');
    S.me = await S.D.init();
    S.myName = (await S.D.getMyName()) || '';
  } catch (e) {
    console.error(e);
    const msg = String((e && (e.code || e.message)) || '');
    fatal(msg === 'missing-config'
      ? ['Almost there', 'The app isn’t connected to its database yet. Follow the setup steps in the README, then reload.']
      : /anonymous/i.test(msg)
      ? ['Sign-up is switched off', 'Guest sign-ins aren’t enabled on the server yet. Ask the app owner to turn on “Allow anonymous sign-ins” in Supabase.']
      : ['Can’t connect', 'Check your internet connection and try again.']);
    return;
  }
  if (!S.myName) await onboarding();
  S.names[S.me] = S.myName;
  paintMe();
  S.D.onGroups((list) => {
    S.groups = list.sort((a, b) => a.unlockAt - b.unlockAt);
    S.loaded = true; S.err = '';
    S.groups.forEach(watchGroup);
    resolveNames(S.groups.flatMap((g) => g.members)).then(render);
    render();
  }, () => { S.loaded = true; S.err = 'Couldn’t load your chats. Pull down or reopen the app.'; render(); });
  setInterval(tick, 1000);
  const code = new URLSearchParams(location.search).get('join');
  if (code) { history.replaceState(null, '', location.pathname); joinFlow(code); }
}

function fatal([title, body]) {
  const el = document.createElement('div'); el.className = 'fatal';
  el.innerHTML = `<h2>${esc(title)}</h2><p>${esc(body)}</p><button class="pillbtn" onclick="location.reload()">Try again</button>`;
  phone.appendChild(el);
}

function onboarding() {
  return new Promise((resolve) => {
    const el = document.createElement('section'); el.className = 'screen onb';
    el.innerHTML = `<div><div class="logo"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
      <h1>Snaps that open later.</h1><p>Shoot all year with your friends. Everything stays sealed until the day your group picks. Then you open it together.</p></div>
      <form id="onbf" novalidate style="display:flex;flex-direction:column;gap:12px">
        <label class="field" for="onbname"><span>What do your friends call you?</span><input id="onbname" maxlength="30" placeholder="Your name" autocomplete="given-name"></label>
        <div class="err" id="onberr"></div>
        <button class="pillbtn" id="onbgo">Let’s go</button>
      </form>`;
    phone.appendChild(el);
    const inp = $('#onbname', el);
    setTimeout(() => inp.focus(), 100);
    $('#onbf', el).onsubmit = async (e) => {
      e.preventDefault();
      const n = inp.value.trim(); if (!n) return;
      const b = $('#onbgo', el); b.disabled = true; b.textContent = 'Saving…';
      try { await S.D.setMyName(n); S.myName = n; el.remove(); resolve(); }
      catch { b.disabled = false; b.textContent = 'Let’s go'; $('#onberr', el).textContent = 'Couldn’t save. Check your connection and try again.'; }
    };
  });
}

function watchGroup(g) {
  if (S.subs[g.id]) return;
  S.data[g.id] = { snaps: [], msgs: [] };
  const a = S.D.onSnaps(g.id, (list) => { S.data[g.id].snaps = list; resolveNames(list.map((x) => x.by)).then(render); render(); });
  const b = S.D.onMsgs(g.id, (list) => { S.data[g.id].msgs = list; resolveNames(list.map((x) => x.by)).then(render); render(); });
  S.subs[g.id] = [a, b];
}

function paintMe() { ['#meav', '#meav2'].forEach((s) => { const e = $(s); if (!e) return; e.textContent = initial(S.me); e.style.background = colorOf(S.me); }); }

/* ---------- navigation ---------- */
function go(tab) { S.tab = tab; S.thread = null; render(); }
document.querySelectorAll('#nav [data-tab]').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
function render() {
  const tab = S.thread ? 'thread' : S.tab;
  ['camera', 'chat', 'memories', 'thread'].forEach((t) => $('#s-' + t).classList.toggle('hidden', t !== tab));
  const nav = $('#nav'); nav.classList.toggle('hidden', tab === 'thread'); nav.classList.toggle('light', tab !== 'camera');
  nav.querySelectorAll('[data-tab]').forEach((b) => { if (b.dataset.tab === S.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const sealed = S.groups.filter((g) => !isOpen(g)).length;
  const dot = $('#navdot'); dot.classList.toggle('hidden', !sealed); dot.textContent = sealed;
  if (tab === 'camera') Camera.start(); else if (!phone.querySelector('.preview')) Camera.stop();
  if (tab === 'chat') renderChat();
  if (tab === 'memories') renderMemories();
  if (tab === 'thread') renderThread();
  const h = nav.classList.contains('hidden') ? 0 : nav.offsetHeight;
  ['camera', 'chat', 'memories'].forEach((t) => ($('#s-' + t).style.bottom = h + 'px'));
}
function tick() {
  if (S.thread) {
    const lb = $('#lockbar'); const g = S.groups.find((x) => x.id === S.thread);
    if (lb && g) { if (isOpen(g) && !lb.classList.contains('open')) renderThread(); else if (!isOpen(g)) lb.querySelector('span').textContent = longLeft(g.unlockAt); }
  } else if (new Date().getSeconds() === 0 && S.tab !== 'camera' && !phone.querySelector('.scrim')) render();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) Camera.stop(); else if (S.tab === 'camera' && !S.thread) Camera.start(); });

/* ---------- live camera ---------- */
const Camera = (() => {
  const video = $('#viewfinder');
  let stream = null, audio = null, facing = 'environment', starting = false, torch = false;
  let rec = null, chunks = [], recTimer = null, recStart = 0, holdTimer = null, held = false;

  async function start() {
    if (stream || starting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showPerm('unsupported'); return; }
    starting = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      video.srcObject = stream;
      video.classList.toggle('mirror', facing === 'user');
      await video.play().catch(() => {});
      hidePerm();
      const caps = stream.getVideoTracks()[0].getCapabilities?.() || {};
      $('#camflash').classList.toggle('hidden', !caps.torch);
      if (S.tab !== 'camera' || S.thread || document.hidden) stop();
    } catch (e) {
      showPerm(e && e.name === 'NotAllowedError' ? 'denied' : 'error');
    } finally { starting = false; }
  }
  function stop() {
    if (rec && rec.state === 'recording') return;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; video.srcObject = null; }
  }
  function showPerm(kind) {
    const p = $('#camperm'); p.classList.remove('hidden');
    $('#campermmsg').textContent = kind === 'denied'
      ? 'Camera access is off. Allow it in your browser or phone settings, then tap Try again.'
      : kind === 'unsupported' ? 'This browser can’t use the camera. You can still send photos from your library.'
      : 'Couldn’t start the camera. Tap Try again.';
  }
  function hidePerm() { $('#camperm').classList.add('hidden'); }
  async function flip() { facing = facing === 'user' ? 'environment' : 'user'; torch = false; $('#camflash').classList.remove('on'); stop(); await start(); }
  async function toggleTorch() {
    if (!stream) return; torch = !torch;
    try { await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch }] }); $('#camflash').classList.toggle('on', torch); } catch { torch = false; }
  }

  function photo() {
    if (!stream || !video.videoWidth) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    const box = video.getBoundingClientRect(); const target = box.width / box.height;
    let sw = vw, sh = vh;
    if (vw / vh > target) sw = vh * target; else sh = vw / target;
    const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    const scale = Math.min(1, 2160 / Math.max(sw, sh));
    const c = document.createElement('canvas'); c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
    const ctx = c.getContext('2d');
    if (facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const fx = document.createElement('div'); fx.className = 'flashfx'; $('#s-camera').appendChild(fx); setTimeout(() => fx.remove(), 300);
    c.toBlob((b) => b && openPreview([new File([b], 'snap.jpg', { type: 'image/jpeg' })]), 'image/jpeg', 0.88);
  }

  function pickMime() {
    const opts = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
  }
  async function startRec() {
    if (!stream || !window.MediaRecorder) { toast('Video recording isn’t supported in this browser'); return; }
    if (!audio) { try { audio = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { audio = null; } }
    if (!held) return; // let go while the mic prompt was open
    const tracks = [...stream.getVideoTracks(), ...(audio ? audio.getAudioTracks() : [])];
    const mime = pickMime();
    try { rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined); }
    catch { rec = new MediaRecorder(new MediaStream(tracks)); }
    chunks = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      clearInterval(recTimer); setRecUI(false);
      const type = (rec.mimeType || mime || 'video/mp4').split(';')[0];
      const blob = new Blob(chunks, { type });
      if (blob.size > 0 && Date.now() - recStart > 500) openPreview([new File([blob], 'snap.' + (type.includes('webm') ? 'webm' : 'mp4'), { type })]);
    };
    rec.start(250); recStart = Date.now(); setRecUI(true);
    recTimer = setInterval(() => {
      const sec = (Date.now() - recStart) / 1000;
      $('#recsec').textContent = Math.floor(sec) + 's';
      $('#ringc').style.strokeDashoffset = String(251.3 * (1 - Math.min(1, sec / MAX_VIDEO_SEC)));
      if (sec >= MAX_VIDEO_SEC) stopRec();
    }, 200);
  }
  function stopRec() { if (rec && rec.state === 'recording') rec.stop(); }
  function setRecUI(on) {
    $('#shutter').classList.toggle('rec', on);
    $('#recpill').classList.toggle('hidden', !on);
    $('#camtip').classList.toggle('hidden', on);
    if (!on) { $('#ringc').style.strokeDashoffset = '251.3'; $('#recsec').textContent = '0s'; }
  }

  // Tap = photo, press and hold = video (like Snapchat)
  const sh = $('#shutter');
  sh.addEventListener('pointerdown', (e) => {
    e.preventDefault(); held = true; sh.setPointerCapture?.(e.pointerId);
    holdTimer = setTimeout(() => { holdTimer = null; startRec(); }, 280);
  });
  const release = () => {
    if (!held) return; held = false;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; photo(); } else stopRec();
  };
  sh.addEventListener('pointerup', release);
  sh.addEventListener('pointercancel', release);
  sh.addEventListener('contextmenu', (e) => e.preventDefault());
  sh.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photo(); } });

  $('#camflip').onclick = flip;
  $('#camflash').onclick = toggleTorch;
  $('#campermretry').onclick = () => { stop(); start(); };
  return { start, stop };
})();

const openPick = (id) => { const p = $(id); p.value = ''; p.click(); };
$('#camgal').onclick = $('#camgal2').onclick = $('#campermlib').onclick = () => openPick('#pickLib');
$('#camsearch').onclick = () => { go('chat'); $('#chatsearch').classList.remove('hidden'); $('#chatq').focus(); };
$('#meav').onclick = $('#meav2').onclick = () => toast(`You’re ${S.myName || 'signed in'}`);
$('#pickLib').addEventListener('change', (e) => { const f = [...e.target.files]; if (f.length) openPreview(f); });

/* ---------- chat list ---------- */
$('#chatsearchbtn').onclick = () => { const s = $('#chatsearch'); s.classList.toggle('hidden'); if (!s.classList.contains('hidden')) $('#chatq').focus(); };
$('#chatq').oninput = (e) => { S.q = e.target.value.toLowerCase(); renderChat(); };
$('#newchat').onclick = newChatSheet;

function lastActivity(g) { const d = S.data[g.id] || {}; return [...(d.snaps || []), ...(d.msgs || [])].reduce((a, b) => (!a || b.at > a.at ? b : a), null); }
function statusLine(g) {
  const d = S.data[g.id] || { snaps: [], msgs: [] }; const last = lastActivity(g); const n = d.snaps.length;
  const L = (sq, html) => `<span class="sq ${sq}"></span><span class="st">${html}</span>`;
  if (isOpen(g)) return n ? L('open', `<b style="color:var(--open)">Opened</b> · ${n} snap${n === 1 ? '' : 's'} to watch`) : L('empty', 'Opened · nothing was sealed');
  if (last && last.type === 'msg') return L('chat', `<b style="color:var(--chat)">${esc(who(last.by))}:</b> ${esc(last.text)} · ${ago(last.at)}`);
  if (n) return L('sealed', `<b style="color:var(--accent)">${n} sealed</b> · opens in ${shortLeft(g.unlockAt)}${last ? ' · ' + ago(last.at) : ''}`);
  return L('empty', `Tap to snap · opens in ${shortLeft(g.unlockAt)}`);
}
function renderChat() {
  const el = $('#chatlist');
  if (!S.loaded) { el.innerHTML = '<p class="fine" style="padding:20px 16px">Loading…</p>'; return; }
  let list = S.groups.slice().sort((a, b) => ((lastActivity(b) || {}).at || b.createdAt || 0) - ((lastActivity(a) || {}).at || a.createdAt || 0));
  if (S.q) list = list.filter((g) => g.name.toLowerCase().includes(S.q));
  let h = '';
  if (!isStandalone() && !localStorage.getItem('capsule:installHidden')) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    h += `<div class="install"><span>📲</span><span>${ios ? 'Tap <b>Share</b> then <b>Add to Home Screen</b>' : 'Open the browser menu and tap <b>Install app</b> / <b>Add to Home screen</b>'} to use Capsule like a real app.</span><button id="instx" aria-label="Hide">×</button></div>`;
  }
  if (S.err) h += `<div class="banner">${esc(S.err)}</div>`;
  if (!S.groups.length && !S.err) {
    h += `<div class="empty"><span class="av" style="width:72px;height:72px;background:var(--soft);color:var(--text)">${I.group}</span><h2>No groups yet</h2><p style="margin:0">Make a group, pick when it opens, and snap away. Nobody sees anything until then.</p><button class="pillbtn" id="emptynew">New Group</button><button class="pillbtn ghost" id="emptyjoin">Join with Code</button></div>`;
  } else {
    h += list.map((g) => `<button class="row" data-g="${esc(g.id)}">${groupAvatar(g)}<span class="meta"><span class="txt"><div class="name">${esc(g.name)}</div><div class="status">${statusLine(g)}</div></span>${!isOpen(g) ? `<span class="camb" data-snap="${esc(g.id)}" role="button" aria-label="Snap to ${esc(g.name)}">${I.cam}</span>` : ''}</span></button>`).join('');
    if (S.q && !list.length) h += '<p class="fine" style="padding:20px 16px">No groups match.</p>';
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-g]').forEach((b) => (b.onclick = (e) => { const c = e.target.closest('[data-snap]'); if (c) { S.preselect = c.dataset.snap; go('camera'); return; } openThread(b.dataset.g); }));
  const en = $('#emptynew'); if (en) en.onclick = newGroupSheet;
  const ej = $('#emptyjoin'); if (ej) ej.onclick = joinSheet;
  const ix = $('#instx'); if (ix) ix.onclick = (e) => { e.stopPropagation(); localStorage.setItem('capsule:installHidden', '1'); renderChat(); };
}

/* ---------- sheets ---------- */
function sheet(inner) {
  const sc = document.createElement('div'); sc.className = 'scrim';
  sc.innerHTML = `<div class="sheet" role="dialog"><div class="grab"></div>${inner}</div>`;
  phone.appendChild(sc); sc.onclick = (e) => { if (e.target === sc) sc.remove(); }; return sc;
}
const sheetHead = (title, closeLeft) => `<div class="head" style="padding-top:6px"><div class="l">${closeLeft ? `<button type="button" class="ib" data-x aria-label="Close">${I.x}</button>` : ''}</div><h1>${esc(title)}</h1><div class="r">${closeLeft ? '' : `<button type="button" class="ib" data-x aria-label="Close">${I.x}</button>`}</div></div>`;
function newChatSheet() {
  const sc = sheet(`${sheetHead('New Chat')}<div class="body" style="gap:0">
      <button class="opt" id="o-new"><span class="oi" style="background:#fff4ec;color:var(--accent)">${I.group}</span><span>New Group<small>Pick a name and when it opens</small></span></button>
      <button class="opt" id="o-join"><span class="oi">${I.key}</span><span>Join with Code<small>Got a 6-letter code from a friend?</small></span></button></div>`);
  sc.querySelector('[data-x]').onclick = () => sc.remove();
  $('#o-new', sc).onclick = () => { sc.remove(); newGroupSheet(); };
  $('#o-join', sc).onclick = () => { sc.remove(); joinSheet(); };
}
function joinSheet(prefill = '') {
  const sc = sheet(`<form id="jf" novalidate>${sheetHead('Join with Code', true)}<div class="body">
    <p class="fine" style="margin:0;text-align:center">Enter the 6-letter code a friend sent you.</p>
    <input id="jcode" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters" value="${esc(prefill)}" style="border:0;outline:0;text-align:center;font-size:40px;font-weight:900;letter-spacing:10px;color:var(--accent);padding:8px;text-transform:uppercase" aria-label="Invite code">
    <div class="err" id="jerr"></div><button class="pillbtn" id="jgo">Join Group</button></div></form>`);
  sc.querySelector('[data-x]').onclick = () => sc.remove();
  const inp = $('#jcode', sc); setTimeout(() => inp.focus(), 60);
  $('#jf', sc).onsubmit = async (e) => {
    e.preventDefault(); const code = inp.value.trim(); if (code.length < 6) return;
    const b = $('#jgo', sc); b.disabled = true; b.textContent = 'Joining…';
    try { const gid = await S.D.joinByCode(code); sc.remove(); S.tab = 'chat'; openThread(gid); toast('You’re in!'); }
    catch (err) { b.disabled = false; b.textContent = 'Join Group'; $('#jerr', sc).textContent = err && err.message === 'not-found' ? 'No group found with that code.' : 'Couldn’t join. Check your connection and try again.'; }
  };
}
async function joinFlow(code) {
  try { const gid = await S.D.joinByCode(code); S.tab = 'chat'; openThread(gid); toast('You’re in!'); }
  catch { joinSheet(code); }
}
function newGroupSheet() {
  const now = new Date(), pad = (n) => String(n).padStart(2, '0');
  const nye = () => { let t = new Date(now.getFullYear(), 11, 31, 23, 59); if (t < now) t = new Date(now.getFullYear() + 1, 11, 31, 23, 59); return t; };
  const mid = () => { const mk = (y) => { for (let d = 19; d <= 25; d++) { const x = new Date(y, 5, d, 18, 0); if (x.getDay() === 5) return x; } }; let t = mk(now.getFullYear()); if (t < now) t = mk(now.getFullYear() + 1); return t; };
  const yr = () => { const t = new Date(now); t.setFullYear(t.getFullYear() + 1); return t; };
  const toVal = (t) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
  let emoji = EMOJIS[0];
  const sc = sheet(`<form id="gf" novalidate>${sheetHead('New Group', true)}<div class="body">
    <label class="field" for="gname"><span>Group name</span><input id="gname" maxlength="40" placeholder="The gang ${now.getFullYear() + 1}" autocomplete="off"></label>
    <div class="field"><span>Icon</span><div class="emos">${EMOJIS.map((e, i) => `<button type="button" data-e="${e}" aria-pressed="${i === 0}">${e}</button>`).join('')}</div></div>
    <div class="field"><span>Opens</span><div class="chips"><button type="button" class="chip" data-q="nye" aria-pressed="true">New Year’s Eve</button><button type="button" class="chip" data-q="mid" aria-pressed="false">Midsummer</button><button type="button" class="chip" data-q="yr" aria-pressed="false">In 1 year</button></div>
      <input type="datetime-local" id="gdate" value="${toVal(nye())}" aria-label="Open date and time"></div>
    <p class="fine" style="margin:0">${I.lock} Everything sent to this group stays sealed for everyone until then. The date can’t be changed later.</p>
    <div class="err" id="gerr"></div><button class="pillbtn" id="gsave">Create Group</button></div></form>`);
  const d = $('#gdate', sc);
  sc.querySelector('[data-x]').onclick = () => sc.remove();
  sc.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { d.value = toVal({ nye, mid, yr }[b.dataset.q]()); sc.querySelectorAll('[data-q]').forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
  d.oninput = () => sc.querySelectorAll('[data-q]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
  sc.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => { emoji = b.dataset.e; sc.querySelectorAll('[data-e]').forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
  $('#gf', sc).onsubmit = async (e) => {
    e.preventDefault(); const er = $('#gerr', sc);
    const name = $('#gname', sc).value.trim(); const t = new Date(d.value).getTime();
    if (!name) { er.textContent = 'Give the group a name.'; return; }
    if (!t || isNaN(t) || t <= Date.now() + 60000) { er.textContent = 'Pick a time in the future.'; return; }
    const btn = $('#gsave', sc); btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const { id, code } = await S.D.createGroup(name, emoji, t);
      sc.remove(); createdSheet(id, name, code, t);
    } catch { btn.disabled = false; btn.textContent = 'Create Group'; er.textContent = 'Couldn’t create the group. Check your connection and try again.'; }
  };
  setTimeout(() => $('#gname', sc).focus(), 60);
}
function shareInvite(name, code, unlockAt) {
  const text = `Join "${name}" on Capsule. Everything we snap stays sealed until ${fmtDate(unlockAt)} 🔒`;
  const url = inviteLink(code);
  if (navigator.share) navigator.share({ title: 'Capsule', text, url }).catch(() => {});
  else navigator.clipboard?.writeText(`${text}\n${url}`).then(() => toast('Invite link copied'), () => toast(url));
}
function createdSheet(id, name, code, unlockAt) {
  const sc = sheet(`${sheetHead(name)}<div class="body">
    <p class="fine" style="margin:0;text-align:center">Send the invite to your friends so they can join.</p>
    <div class="codebox"><b>${esc(code)}</b></div>
    <button class="pillbtn" id="cshare">${'Share invite link'}</button>
    <button class="pillbtn ghost" id="cchat">Chat with Group</button></div>`);
  const close = () => { sc.remove(); S.tab = 'chat'; openThread(id); };
  sc.querySelector('[data-x]').onclick = close;
  $('#cshare', sc).onclick = () => shareInvite(name, code, unlockAt);
  $('#cchat', sc).onclick = close;
}

/* ---------- thread ---------- */
function openThread(id) { S.thread = id; render(); const sc = $('#tscroll'); if (sc) sc.scrollTop = sc.scrollHeight; }
function renderThread() {
  const g = S.groups.find((x) => x.id === S.thread); const el = $('#s-thread');
  if (!g) { el.innerHTML = `<div class="thead"><button class="ib" id="tback" aria-label="Back">${I.chev}</button><div class="t"><b>Loading…</b></div></div>`; $('#tback').onclick = () => go('chat'); return; }
  const open = isOpen(g); const d = S.data[g.id] || { snaps: [], msgs: [] };
  const items = [...d.snaps, ...d.msgs].sort((a, b) => a.at - b.at);
  const typed = $('#tmsg') ? $('#tmsg').value : ''; const hadFocus = document.activeElement && document.activeElement.id === 'tmsg';
  const prev = $('#tscroll'); const atBottom = !prev || prev.scrollHeight - prev.scrollTop - prev.clientHeight < 40; const prevTop = prev ? prev.scrollTop : 0;
  let body = ''; let lastDay = '', lastBy = null, openBlk = false;
  for (const it of items) {
    const day = new Date(it.at).toDateString();
    if (day !== lastDay) { if (openBlk) { body += '</div></div>'; openBlk = false; } body += `<div class="day">${esc(fmtDay(it.at))}</div>`; lastDay = day; lastBy = null; }
    if (it.by !== lastBy) { if (openBlk) body += '</div></div>'; body += `<div class="blk"><div class="who" style="color:${colorOf(it.by)}">${esc(who(it.by))}</div><div class="lines" style="color:${colorOf(it.by)}">`; openBlk = true; lastBy = it.by; }
    if (it.type === 'msg') body += `<div class="mtext">${esc(it.text)}</div>`;
    else if (open) { const k = d.snaps.indexOf(it); body += `<button class="snapline open" data-v="${k}"><span class="sq open"></span>${it.kind === 'video' ? 'Video' : 'Snap'}<span class="sub">· tap to view</span></button>${it.caption ? `<div class="mtext" style="color:var(--muted)">“${esc(it.caption)}”</div>` : ''}`; }
    else body += `<div class="snapline sealed"><span class="sq sealed"></span>Sealed ${it.kind === 'video' ? 'Video' : 'Snap'}<span class="sub">· opens ${esc(new Date(g.unlockAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))}</span></div>`;
  }
  if (openBlk) body += '</div></div>';
  if (!items.length) body = `<div class="empty">${groupAvatar(g)}<h2>${esc(g.name)}</h2><p style="margin:0">${open ? 'This group is open, but nothing was sealed.' : 'Send the first snap. It stays sealed until ' + esc(fmtDate(g.unlockAt)) + '.'}</p>${open ? '' : `<button class="pillbtn ghost" id="tinv">${'Invite friends'}</button>`}</div>`;
  el.innerHTML = `<div class="thead"><button class="ib" id="tback" aria-label="Back">${I.chev}</button>${groupAvatar(g, 'sm')}<div class="t" id="tname"><b>${esc(g.name)}</b><span>${g.members.length} ${g.members.length === 1 ? 'member' : 'members'} · ${d.snaps.length} snap${d.snaps.length === 1 ? '' : 's'}</span></div>${open && d.snaps.length ? `<button class="ib" id="tplay" aria-label="Play all" style="background:var(--open);color:#fff">${I.play}</button>` : ''}<button class="ib" id="tinfo" aria-label="Group info">${I.info}</button></div>
    <div class="lockbar ${open ? 'open' : ''}" id="lockbar">${open ? 'Opened ' + esc(fmtDate(g.unlockAt)) + ' · tap a snap to watch' : I.lock + ' Opens in <span>' + longLeft(g.unlockAt) + '</span>'}</div>
    <div class="scroll msgs" id="tscroll">${body}</div>
    <form class="composer" id="tform">${!open ? `<button type="button" class="cbtn hot" id="tcam" aria-label="Send a snap">${I.cam}</button>` : ''}<input id="tmsg" placeholder="Send a chat" maxlength="500" autocomplete="off" aria-label="Message"><button class="send" aria-label="Send">${I.send}</button></form>`;
  $('#tback').onclick = () => go('chat');
  $('#tinfo').onclick = $('#tname').onclick = () => groupInfo(g);
  const ti = $('#tinv'); if (ti) ti.onclick = () => shareInvite(g.name, g.code, g.unlockAt);
  const tp = $('#tplay'); if (tp) tp.onclick = () => openViewer(d.snaps, 0);
  el.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => openViewer(d.snaps, +b.dataset.v)));
  const tc = $('#tcam'); if (tc) tc.onclick = () => { S.preselect = g.id; go('camera'); };
  const inp = $('#tmsg'); inp.value = typed; if (hadFocus) inp.focus();
  $('#tform').onsubmit = async (e) => {
    e.preventDefault(); const text = inp.value.trim(); if (!text) return; inp.value = '';
    try { await S.D.sendMsg(g.id, text); } catch { inp.value = text; toast('Message didn’t send'); }
  };
  const sc = $('#tscroll'); sc.scrollTop = atBottom ? sc.scrollHeight : prevTop;
}
function groupInfo(g) {
  const sc = sheet(`${sheetHead(g.name)}<div class="body">
    <div class="field"><span>${isOpen(g) ? 'Opened' : 'Opens'}</span><div style="font-weight:800;font-size:17px">${esc(fmtDate(g.unlockAt))}</div></div>
    ${g.code ? `<div class="field"><span>Invite code</span><div class="codebox"><b>${esc(g.code)}</b></div><button class="pillbtn" id="ishare" style="margin-top:8px">Share invite link</button></div>` : ''}
    <div class="field"><span>Members</span>${g.members.map((m) => `<div style="display:flex;align-items:center;gap:10px;padding:4px 0">${avatar(m, 'sm')}<b>${esc(who(m))}</b>${m === g.createdBy ? '<span class="fine">· made the group</span>' : ''}</div>`).join('')}</div></div>`);
  sc.querySelector('[data-x]').onclick = () => sc.remove();
  const s = $('#ishare', sc); if (s) s.onclick = () => shareInvite(g.name, g.code, g.unlockAt);
}

/* ---------- preview + send to ---------- */
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return file;
  if (file.size < 1.5e6 && file.type === 'image/jpeg') return file;
  try {
    const bmp = await createImageBitmap(file); const k = Math.min(1, 2160 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b || file), 'image/jpeg', 0.86));
  } catch { return file; }
}
function openPreview(files) {
  const urls = files.map((f) => URL.createObjectURL(f)); let i = 0, caption = '', editing = false;
  const v = document.createElement('section'); v.className = 'screen preview'; phone.appendChild(v);
  Camera.stop();
  const close = () => { urls.forEach((u) => URL.revokeObjectURL(u)); v.remove(); if (S.tab === 'camera' && !S.thread) Camera.start(); };
  function draw() {
    const f = files[i];
    v.innerHTML = `<div class="media">${f.type.startsWith('video') ? `<video src="${urls[i]}" autoplay loop playsinline></video>` : `<img src="${urls[i]}" alt="Your snap">`}
      ${files.length > 1 ? '<button class="tap l" id="pl" aria-label="Previous"></button><button class="tap r" id="pr" aria-label="Next"></button>' : ''}</div>
      <div class="pv-top"><button class="glass" id="px" aria-label="Discard">${I.x}</button><div class="rail" style="background:rgba(0,0,0,.3)"><button id="pt" aria-label="Add caption">${I.T}</button></div></div>
      ${caption || editing ? `<input class="pv-cap" id="pcap" maxlength="120" value="${esc(caption)}" aria-label="Caption">` : ''}
      <div class="pv-bottom"><span class="pv-count">${files.length > 1 ? `${i + 1} of ${files.length} · ` : ''}${I.lock} sealed when sent</span><button class="sendto" id="psend">Send To ${I.send}</button></div>`;
    $('#px', v).onclick = close;
    $('#pt', v).onclick = () => { editing = true; draw(); $('#pcap', v).focus(); };
    const pc = $('#pcap', v); if (pc) { pc.oninput = (e) => (caption = e.target.value); pc.onkeydown = (e) => { if (e.key === 'Enter') pc.blur(); }; }
    const pl = $('#pl', v), pr = $('#pr', v); if (pl) { pl.onclick = () => { if (i > 0) { i--; draw(); } }; pr.onclick = () => { if (i < files.length - 1) { i++; draw(); } }; }
    $('#psend', v).onclick = () => sendTo(files, caption.trim(), () => { urls.forEach((u) => URL.revokeObjectURL(u)); v.remove(); });
  }
  draw();
}
function sendTo(files, caption, closePreview) {
  const locked = S.groups.filter((g) => !isOpen(g));
  let picked = S.preselect && locked.find((g) => g.id === S.preselect) ? [S.preselect] : locked.length === 1 ? [locked[0].id] : [];
  const v = document.createElement('section'); v.className = 'screen light-screen'; v.style.zIndex = 26; phone.appendChild(v);
  let q = '';
  function draw() {
    const list = locked.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));
    v.innerHTML = `<div class="head"><div class="l"><button class="ib" id="sb" aria-label="Back">${I.chev}</button></div><h1>Send To</h1><div class="r"></div></div>
      <div class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="stq" placeholder="Search" value="${esc(q)}" aria-label="Search groups"></div>
      <div class="scroll">${locked.length ? '<div class="sect">Groups</div>' : ''}
      ${list.map((g) => `<button class="row" data-p="${esc(g.id)}">${groupAvatar(g)}<span class="meta"><span class="txt"><div class="name">${esc(g.name)}</div><div class="status"><span class="sq sealed"></span><span class="st">opens in ${shortLeft(g.unlockAt)} · ${(S.data[g.id] || { snaps: [] }).snaps.length} sealed</span></div></span><span class="pick ${picked.includes(g.id) ? 'on' : ''}">${picked.includes(g.id) ? I.check : ''}</span></span></button>`).join('')}
      ${!locked.length ? '<div class="empty"><h2>No groups yet</h2><p style="margin:0">Make a group first, then send your snap to it.</p><button class="pillbtn" id="snew">New Group</button></div>' : ''}</div>
      ${picked.length ? `<div class="prog hidden" id="sprog"><i></i></div><div class="sendbar"><span class="names">${esc(picked.map((id) => (S.groups.find((g) => g.id === id) || {}).name).join(', '))}</span><button id="sgo" aria-label="Seal and send">${I.send}</button></div>` : ''}`;
    $('#sb', v).onclick = () => v.remove();
    const stq = $('#stq', v); stq.oninput = () => { q = stq.value; const pos = stq.selectionStart; draw(); const n = $('#stq', v); n.focus(); n.setSelectionRange(pos, pos); };
    v.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { const id = b.dataset.p; picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]; draw(); }));
    const sn = $('#snew', v); if (sn) sn.onclick = () => { v.remove(); newGroupSheet(); };
    const sg = $('#sgo', v); if (sg) sg.onclick = doSend;
  }
  async function doSend() {
    const btn = $('#sgo', v), prog = $('#sprog', v), bar = prog.firstElementChild; btn.disabled = true; prog.classList.remove('hidden');
    const total = files.length * picked.length; let done = 0; const fails = [];
    for (const f of files) {
      const isVid = f.type.startsWith('video');
      let blob;
      try { blob = isVid ? f : await shrinkImage(f); } catch { blob = f; }
      if (blob.size > MAX_BYTES) { fails.push('a video that’s too long'); done += picked.length; continue; }
      for (const gid of picked) {
        try { await S.D.sendSnap(gid, blob, isVid ? 'video' : 'image', caption, (p) => (bar.style.width = ((done + p) / total) * 100 + '%')); }
        catch { fails.push('a snap'); }
        done++; bar.style.width = (done / total) * 100 + '%';
      }
    }
    const target = picked.length === 1 ? picked[0] : null;
    S.preselect = null; v.remove(); closePreview();
    if (fails.length) toast(`Couldn’t send ${fails.length === 1 ? fails[0] : fails.length + ' snaps'}. Try again.`); else toast(files.length > 1 ? `${files.length} snaps sealed 🔒` : 'Snap sealed 🔒');
    S.tab = 'chat'; if (target) openThread(target); else go('chat');
  }
  draw();
}

/* ---------- memories ---------- */
function renderMemories() {
  const el = $('#memlist');
  if (!S.groups.length) { el.innerHTML = '<div class="empty"><h2>Nothing here yet</h2><p style="margin:0">When a group opens, its snaps show up here to watch back.</p></div>'; return; }
  const openG = S.groups.filter(isOpen).sort((a, b) => b.unlockAt - a.unlockAt), lockG = S.groups.filter((g) => !isOpen(g));
  let h = '';
  if (openG.length) h += '<div class="sect">Opened</div><div class="mem">' + openG.map((g) => { const sn = (S.data[g.id] || { snaps: [] }).snaps; return `<button class="memcard" data-m="${esc(g.id)}"><div style="height:100%;display:grid;place-items:center" class="big" data-cover="${esc(g.id)}">${esc(g.emoji || '📸')}</div><div class="ov"><b>${esc(g.name)}</b><span>${sn.length} snaps · ${esc(new Date(g.unlockAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }))}</span></div></button>`; }).join('') + '</div>';
  if (lockG.length) h += '<div class="sect">Still sealed</div><div class="mem">' + lockG.map((g) => { const n = (S.data[g.id] || { snaps: [] }).snaps.length; return `<button class="memcard locked" data-t="${esc(g.id)}"><span class="big">${esc(g.emoji || '📸')}</span><div class="ov"><b>${esc(g.name)}</b><span style="color:var(--accent)">${I.lock} ${n} sealed · ${shortLeft(g.unlockAt)} left</span></div></button>`; }).join('') + '</div>';
  el.innerHTML = h;
  el.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { const sn = (S.data[b.dataset.m] || { snaps: [] }).snaps; if (sn.length) openViewer(sn, 0); }));
  el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { S.tab = 'chat'; openThread(b.dataset.t); }));
  // covers load async (locked media can't be fetched, opened can)
  openG.forEach(async (g) => {
    const first = (S.data[g.id] || { snaps: [] }).snaps.find((s) => s.kind === 'image'); if (!first) return;
    try { const url = await S.D.mediaUrl(first); const slot = el.querySelector(`[data-cover="${CSS.escape(g.id)}"]`); if (slot) slot.outerHTML = `<img src="${esc(url)}" alt="" loading="lazy">`; } catch { /* keep emoji */ }
  });
}

/* ---------- viewer ---------- */
function openViewer(snaps, start) {
  if (!snaps.length) return; let i = start, timer = null, token = 0;
  const v = document.createElement('section'); v.className = 'screen viewer'; v.setAttribute('role', 'dialog'); phone.appendChild(v);
  async function draw() {
    clearTimeout(timer); const my = ++token; const s = snaps[i];
    v.innerHTML = `<div class="stage"><p style="opacity:.6">Loading…</p></div>
      <button class="tap l" id="vl" aria-label="Previous"></button><button class="tap r" id="vr" aria-label="Next"></button>
      ${snaps.length <= 80 ? `<div class="bars">${snaps.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      <div class="vtop">${avatar(s.by, 'sm')}<div class="t"><b>${esc(who(s.by))}</b><span>${esc(fmtDate(s.at))} · ${i + 1}/${snaps.length}</span></div><button class="glass" id="vx" aria-label="Close">${I.x}</button></div>
      ${s.caption ? `<div class="vcap">${esc(s.caption)}</div>` : ''}`;
    $('#vx', v).onclick = close; $('#vl', v).onclick = () => { if (i > 0) { i--; draw(); } }; $('#vr', v).onclick = next;
    let url;
    try { url = await S.D.mediaUrl(s); } catch { if (my === token) $('.stage', v).innerHTML = '<p>This snap couldn’t load.</p>'; return; }
    if (my !== token) return;
    const stage = $('.stage', v);
    if (s.kind === 'video') {
      stage.innerHTML = `<video src="${esc(url)}" autoplay playsinline></video>`;
      const vid = $('video', stage); vid.onended = next; vid.onerror = () => (stage.innerHTML = '<p>This video can’t play here.</p>');
    } else {
      stage.innerHTML = `<img src="${esc(url)}" alt="Snap from ${esc(who(s.by))}">`;
      const im = $('img', stage); im.onerror = () => (stage.innerHTML = '<p>This snap couldn’t load.</p>');
      timer = setTimeout(next, 5000);
    }
    const n = snaps[i + 1]; if (n && n.kind === 'image') S.D.mediaUrl(n).then((u) => { const p = new Image(); p.src = u; }).catch(() => {});
  }
  const next = () => { if (i < snaps.length - 1) { i++; draw(); } else close(); };
  const close = () => { clearTimeout(timer); token++; document.removeEventListener('keydown', key); v.remove(); };
  const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); } };
  document.addEventListener('keydown', key); draw();
}

boot();

/* ---------- offline shell ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
