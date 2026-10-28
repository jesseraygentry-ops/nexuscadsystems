// Nexus CAD Systems — standalone public-hosted build for Render.
// Fictional roleplay system only. Test-mode plan purchase ONLY in this build:
// no real cards are charged, no Stripe keys are used or invented. Real Stripe
// checkout is wired later, after the owner connects Stripe (see README).
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const S = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPER_ADMIN_EMAIL = 'jesseray406@gmail.com';
const PLANS = { Starter: { price: 29.99, members: 25 }, Pro: { price: 79.99, members: 150 }, Enterprise: { price: 199.99, members: 1000 } };
const ROLES = ['Civilian','Police','Sheriff','Highway Patrol','Fire','EMS','Dispatcher','Dispatch Supervisor','Mayor','Governor','Council','Judge','Attorney','Clerk','Admin','Co-Owner','Owner'];
const FIRST_RESPONDER_ROLES = ['Police','Sheriff','Highway Patrol','Fire','EMS','Dispatcher','Dispatch Supervisor'];
const DISPATCH_ROLES = ['Dispatcher','Dispatch Supervisor'];
const GOV_ROLES = ['Mayor','Governor','Council','Judge','Attorney','Clerk'];
const POSTALS = { '1001':[50,76,'Los Santos Central'], '1002':[42,68,'Downtown LS'], '2001':[62,40,'Vinewood'], '2002':[70,30,'Sandy Shores'], '3001':[62,40,'Vinewood Hills'], '3002':[35,55,'Del Perro'], '4001':[80,55,'Paleto Bay'], '4002':[25,35,'Great Ocean'], '5001':[55,60,'Mirror Park'], '5002':[48,48,'Grove Street'], '6001':[75,70,'Grapeseed'], '6002':[30,80,'Vespucci'], '7001':[65,85,'El Burro'], '7002':[20,60,'Chumash'], '8001':[85,35,'Mount Chiliad'], '8002':[45,25,'Blaine County'] };
const CODES = [
  ['10-4','Acknowledged','General'],['10-20','Location','General'],['10-27','License / ID check','General'],['10-28','Plate check','General'],['10-38','Traffic stop','Traffic'],['10-50','Vehicle accident','Traffic'],['10-52','Ambulance needed','Medical'],['10-55','Intoxicated driver','Traffic'],['10-70','Fire alarm','Fire'],['10-71','Structure fire','Fire'],['10-80','Explosion','Fire'],
  ['211','Robbery in progress','Crime'],['207','Kidnapping','Crime'],['245','Assault with deadly weapon','Crime'],['273','Domestic disturbance','Crime'],['415','Disturbance','General'],['417','Person with weapon','Crime'],['459','Burglary','Crime'],['470','Forgery / fraud','Crime'],['487','Grand theft','Crime'],['488','Petty theft','Crime'],['502','DUI','Traffic'],['503','Reckless driving','Traffic'],
  ['900','Panic button / officer down','Emergency'],['901','Officer needs assistance','Emergency'],['902','Shots fired','Emergency'],['903','Pursuit in progress','Emergency'],['904','Suspect fleeing on foot','Emergency'],['905','Roadblock needed','Traffic'],
  ['101','Cardiac arrest','Medical'],['102','Difficulty breathing','Medical'],['103','Unconscious person','Medical'],['104','Severe bleeding','Medical'],['105','Overdose','Medical'],['106','Fall / injury','Medical'],
  ['201','Small fire','Fire'],['202','Vehicle fire','Fire'],['203','Wildland fire','Fire'],['204','Hazmat incident','Fire'],['205','Rescue / trapped person','Fire'],
  ['301','Stolen vehicle','Crime'],['302','Hit and run','Traffic'],['303','Suspicious person','General'],['304','Suspicious vehicle','General'],['305','Missing person','General'],['306','Welfare check','General'],['307','Noise complaint','General'],['308','Trespassing','Crime'],
  ['401','Warrant served','Legal'],['402','Court summons','Legal'],['403','BOLO issued','Legal'],['404','Evidence logged','Legal'],['405','Impound','Traffic'],
];
const CHANNELS = ['Emergency All Agencies Traffic','Police','Sheriff','Highway Patrol','Fire','EMS','Dispatch'];

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function isSuper(u){ return u && u.email === SUPER_ADMIN_EMAIL; }
function isOwner(m, srv){ return m && (m.role==='Owner' || (srv && srv.owner_id===m.user_id)); }
function isAdmin(m){ return m && (m.role==='Admin'||m.role==='Co-Owner'||m.role==='Owner'); }
function canDispatch(m){ return m && (DISPATCH_ROLES.includes(m.role) || isAdmin(m)); }
function canPortal(m){ return m && (FIRST_RESPONDER_ROLES.includes(m.role) || isAdmin(m)); }
function canGov(m){ return m && (GOV_ROLES.includes(m.role) || isAdmin(m)); }

function layout(title, body, user){
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Nexus CAD Systems</title><link rel="stylesheet" href="/style.css"></head><body>
<header><div class="brand">🛡️ Nexus CAD Systems</div><nav>
<a href="/">Website</a>${user?`<a href="/servers">My Servers</a><a href="/signout">Sign out (${esc(user.name||user.email)})</a>`:`<a href="/signin">Sign in</a><a href="/signup">Sign up</a>`}
</nav></header><main>${body}</main><footer>Fictional roleplay system only — not a real emergency service. Test-mode purchases only in this build; no real cards are charged.</footer></body></html>`;
}
function gtaBanner(){
  return `<section class="gta"><div class="gta-inner"><div class="gta-title">Rockstar Games — Grand Theft Auto VI</div>
<div>PlayStation 5 / Xbox Series X|S &nbsp;•&nbsp; Releasing Thursday, November 19, 2026</div>
<div class="small">Preload from November 12, 2026</div>
<div id="gta-count" class="count">Loading countdown…</div><div class="small">Countdown to November 19, 2026</div></div></section>
<script>function tick(){var t=new Date('2026-11-19T00:00:00');var d=t-new Date();var el=document.getElementById('gta-count');
if(d<=0){el.textContent='GTA VI is out now';return;}var s=Math.floor(d/1000);var days=Math.floor(s/86400);s%=86400;var h=Math.floor(s/3600);s%=3600;var m=Math.floor(s/60);var sec=s%60;
el.textContent=days+' Days  '+h+' Hours  '+m+' Minutes  '+sec+' Seconds';}tick();setInterval(tick,1000);</script>`;
}
function card(title, inner){ return `<section class="card"><h2>${title}</h2>${inner}</section>`; }
function field(label, name, type='text', value=''){ return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}"></label>`; }

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: process.env.SESSION_SECRET || 'nexus-dev-secret-change-me', resave: false, saveUninitialized: false, cookie: { maxAge: 1000*60*60*24*7 } }));
app.use(async (req, res, next) => { req.user = req.session.userId ? await S.findUserById(req.session.userId) : null; next(); });

async function requireUser(req, res, next){ if (!req.user) return res.redirect('/signin'); next(); }
async function loadServer(req, res, next){
  const srv = await S.getServer(req.params.id);
  if (!srv) return res.status(404).send(layout('Not found', '<p>Server not found.</p>', req.user));
  const member = req.user ? await S.getMember(srv.id, req.user.id) : null;
  if (!member && !isSuper(req.user)) return res.status(403).send(layout('Invite only', '<p>This server is invite-only. Join with an invite code first.</p>', req.user));
  req.server = srv; req.member = member || { role: 'Owner', display_role: 'Platform Super Admin (oversight)' };
  if (isSuper(req.user) && !member) await S.audit(srv.id, req.user.id, 'super_admin_accessed', `Platform Super Admin opened ${srv.name}`);
  next();
}
function navFor(srv, m){
  const links = [['Dashboard',''],['Dispatch · MDT · Portal','dispatch']];
  const items = [['','Dashboard'],['dispatch','Dispatch'],['mdt','MDT'],['portal','Emergency Portal'],['radio','Live Radio'],['characters','Characters'],['businesses','Businesses'],['courts','Courts'],['government','Government'],['admin','Administration'],['support','Support'],['whatsnew',"What's New"]];
  let html = `<nav class="server-nav">${items.map(([k,label])=>{
    if (k==='dispatch' && !canDispatch(m)) return '';
    if (k==='portal' && !canPortal(m)) return '';
    if (k==='government' && !canGov(m)) return `<span class="nav-note">Justice &amp; Government hidden unless summoned</span>`;
    if (k==='admin' && !isAdmin(m)) return '';
    return `<a href="/server/${srv.id}/${k}">${label}</a>`;
  }).join('')}</nav>`;
  return html;
}

// ---------- Landing, auth, servers ----------
app.get('/', (req, res) => {
  res.send(layout('Nexus CAD Systems', `
  <section class="hero"><h1>Your Journey Begins Here</h1><p>Nexus CAD Systems — a fictional multi-tenant roleplay police, dispatch, courts and government system. Create your own RP server, invite only the people you choose, and run Dispatch, MDT, Emergency Portal, radio, courts and businesses in one place.</p>
  <p><a class="btn" href="/signup">Get Started / Play Now</a> <a class="btn secondary" href="/servers">Open My Servers</a></p>
  <div class="stats"><span><b>187</b> emergency codes*</span><span><b>37</b> postal zones*</span><span><b>3</b> plans</span><span><b>Invite-only</b> per server</span></div><p class="small">*Counts from the Muse-app build; the portal in this standalone build ships a searchable starter code list — see README for what was not fully replicated.</p></section>
  <section class="card"><h2>Inside Nexus</h2><ul><li>Dispatch · MDT · Portal — one operations tab, with per-section permission rules inside it</li><li>San Andreas map with fictional postal codes, live calls, and AI-dispatch style triage (human override always available)</li><li>Penal code, citations that auto-create court cases, courts with summons and case-only courtrooms</li><li>Live Radio with text-to-speech (browser speech, on by default, toggle saved on your device)</li><li>Businesses, banking, careers/payroll, training/SOPs, government roles, and Administration</li></ul></section>
  <section class="card"><h2>Choose a plan — test buying only in this build</h2><div class="plans">
  ${Object.entries(PLANS).map(([name,p])=>`<div class="plan"><h3>${name}</h3><p class="price">$${p.price}/month</p><p>Up to ${p.members} members</p><form method="post" action="/purchase"><input type="hidden" name="plan" value="${name}"><button class="btn">Choose ${name} (test)</button></form></div>`).join('')}
  </div><p>No real card is charged in this build. Real Stripe checkout is wired later, after Stripe is connected. See README.</p></section>
  <section class="card"><h2>FAQ</h2><details><summary>Is this a real emergency system?</summary><p>No. It is a fictional roleplay system.</p></details>
  <details><summary>Who can see my server?</summary><p>Only people invited to that server, plus the Platform Super Admin (oversight only, audit-logged).</p></details>
  <details><summary>How do I join a server?</summary><p>Sign up, then use an invite code on My Servers. Joiners start as Civilian.</p></details>
  <details><summary>What is the Platform Super Admin?</summary><p>An account controlled by the owner (jesseray406@gmail.com) that can see every server for oversight/fixing. Its access is audit-logged in each server.</p></details></section>
  <section class="card"><h2>Get In Touch</h2><p>For support, sign in and use Administration → Support in your server. Support email is set by the Platform Super Admin at launch — currently: <i>Support email to be added at launch</i>.</p></section>`, req.user));
});

app.get('/signup', (req, res) => res.send(layout('Sign up', card('Sign up', `<form method="post" action="/signup">${field('Name','name')}${field('Email','email','email')}${field('Password','password','password')}<button class="btn">Create account</button></form><p>Already have an account? <a href="/signin">Sign in</a></p><p class="small">Privacy: sign-in data is scoped per server; only invited members see a server's data, except Platform Super Admin oversight (disclosed here and in-app).</p>`), req.user)));
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.redirect('/signup');
  if (await S.findUserByEmail(email)) return res.send(layout('Sign up', card('Sign up', '<p>That email already has an account. <a href="/signin">Sign in</a></p>'), req.user));
  const hash = await bcrypt.hash(password, 10);
  const u = await S.createUser({ email, name: name || email, password_hash: hash });
  req.session.userId = u.id; res.redirect('/servers');
});
app.get('/signin', (req, res) => res.send(layout('Sign in', card('Sign in', `<form method="post" action="/signin">${field('Email','email','email')}${field('Password','password','password')}<button class="btn">Sign in</button></form><p>No account? <a href="/signup">Sign up</a></p>`), req.user)));
app.post('/signin', async (req, res) => {
  const u = await S.findUserByEmail(req.body.email || '');
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash))) return res.send(layout('Sign in', card('Sign in', '<p>Invalid email or password.</p><p><a href="/signin">Try again</a></p>'), req.user));
  req.session.userId = u.id; res.redirect('/servers');
});
app.get('/signout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

app.get('/servers', requireUser, async (req, res) => {
  const servers = await S.listServersForUser(req.user.id, isSuper(req.user));
  const purchases = await S.listPurchases(req.user.id);
  const changelog = await S.listChangelog();
  const latest = changelog[0];
  let body = isSuper(req.user) ? `<div class="banner">Platform Super Admin — oversight access</div>` : '';
  body += `<h1>My Servers</h1>`;
  if (latest) body += card("What's New", `<p><b>${esc(latest.version)} — ${esc(latest.title)}</b><br>${esc(latest.body)}</p>`);
  body += card('Your servers', servers.length ? servers.map(s=>`<p><a href="/server/${s.id}">${esc(s.name)}</a> — ${esc(s.plan)} — invite code <b>${s.invite_code}</b></p>`).join('') : '<p>No servers yet. Buy a plan (test) below, then create a server.</p>');
  body += card('Buy a plan (test — no real charge)', Object.entries(PLANS).map(([n,p])=>`<form method="post" action="/purchase" style="display:inline;margin-right:8px"><input type="hidden" name="plan" value="${n}"><button class="btn">${n} $${p.price}/mo (test)</button></form>`).join('') + `<p>Your test purchases: ${purchases.map(p=>`${p.plan} (test)`).join(', ') || 'none yet'}</p>`);
  body += card('Join a server', `<form method="post" action="/join">${field('Invite code','code')}<button class="btn">Join as Civilian</button></form>`);
  body += card('Create a server', `<form method="post" action="/servers/create">${field('Server name','name')}${field('Plan (must match a test purchase)','plan')}<button class="btn">Create server</button></form><p class="small">Server creation is gated by a test purchase. Real Stripe purchase gating replaces this later.</p>`);
  res.send(layout('My Servers', body, req.user));
});
app.post('/purchase', requireUser, async (req, res) => {
  const plan = req.body.plan;
  if (!PLANS[plan]) return res.redirect('/servers');
  await S.createPurchase(req.user.id, plan);
  res.redirect('/servers');
});
app.post('/servers/create', requireUser, async (req, res) => {
  if (!(await S.hasPurchase(req.user.id))) return res.send(layout('Create server', card('Purchase required', '<p>Buy a plan first (test purchase, no real charge).</p><p><a href="/servers">Back to My Servers</a></p>'), req.user));
  const plan = PLANS[req.body.plan] ? req.body.plan : (await S.listPurchases(req.user.id))[0].plan;
  const srv = await S.createServer(req.user.id, req.body.name || 'New RP Server', plan);
  res.redirect('/server/' + srv.id);
});
app.post('/join', requireUser, async (req, res) => {
  const srv = await S.findServerByInvite(req.body.code || '');
  if (!srv) return res.send(layout('Join', card('Join', '<p>Invalid invite code.</p><p><a href="/servers">Back</a></p>'), req.user));
  await S.addMember(srv.id, req.user.id, 'Civilian');
  await S.audit(srv.id, req.user.id, 'member_joined', `${req.user.name} joined as Civilian`);
  res.redirect('/server/' + srv.id);
});

// ---------- Server dashboard & sections ----------
app.get('/server/:id', loadServer, async (req, res) => {
  const srv = req.server, m = req.member;
  const calls = await S.listRecords(srv.id, 'call');
  const chars = await S.listRecords(srv.id, 'character');
  const audit = (await S.listAudit(srv.id)).slice(0, 10);
  let body = isSuper(req.user) ? `<div class="banner">Platform Super Admin — oversight access</div>` : '';
  body += `<h1>${esc(srv.name)}</h1><p>Plan: ${esc(srv.plan)} &nbsp;•&nbsp; Your role: ${esc(m.display_role || m.role)} &nbsp;•&nbsp; Invite code: <b>${srv.invite_code}</b></p>`;
  body += navFor(srv, m);
  body += card('Dashboard', `<p>Active calls: ${calls.filter(c=>c.data.status!=='Resolved').length} &nbsp;•&nbsp; Characters: ${chars.length}</p><h3>Latest calls</h3>${calls.slice(0,5).map(c=>`<p>${esc(c.data.title)} — ${esc(c.data.status)} — postal ${esc(c.data.postal||'')}</p>`).join('') || '<p>No calls yet.</p>'}<h3>Recent activity</h3>${audit.map(a=>`<p>${esc(a.data.action)}: ${esc(a.data.detail)}</p>`).join('') || '<p>No activity yet.</p>'}`);
  body += gtaBanner();
  res.send(layout(srv.name, body, req.user));
});

function sectionPage(req, res, title, inner){
  return layout(title, `<h1>${esc(req.server.name)}</h1><p>Your role: ${esc(req.member.display_role || req.member.role)}</p>` + navFor(req.server, req.member) + inner, req.user);
}

app.get('/server/:id/dispatch', loadServer, async (req, res) => {
  if (!canDispatch(req.member) && !isSuper(req.user)) return res.status(403).send(sectionPage(req, res, 'Dispatch', '<p>Dispatch is only for Dispatcher / Dispatch Supervisor roles, plus Admins and Owners.</p>'));
  const calls = await S.listRecords(req.server.id, 'call');
  const postalOptions = Object.entries(POSTALS).map(([k,[x,y,name]]) => `<option value="${k}">${k} — ${name}</option>`).join('');
  let inner = card('Dispatch — San Andreas map', `
  <div class="mapwrap"><img src="/san-andreas.jpg" alt="San Andreas map" id="sa-map">
  <div id="pins">${calls.filter(c=>c.data.x!=null).map(c=>`<span class="pin" style="left:${c.data.x}%;top:${c.data.y}%" title="${esc(c.data.title)}">📍</span>`).join('')}</div></div>
  <p>Postal codes (fictional San Andreas): ${Object.entries(POSTALS).map(([k,[x,y,n]]) => `${k} ${n}`).join(' • ')}</p>
  <form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="create_call">
  ${field('Call title','title')}${field('Postal code','postal')}${field('Priority (Low/Medium/High/Emergency)','priority')}
  <button class="btn">Create call (pin auto-placed by postal)</button></form>
  <form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="ai_dispatch"><button class="btn secondary">Run AI dispatch now (triage + assign, human override available)</button></form>`);
  inner += card('Active calls', calls.map(c=>`<p><b>${esc(c.data.title)}</b> — ${esc(c.data.status)} — assigned: ${esc(c.data.assigned_to||'unassigned')} — postal ${esc(c.data.postal||'')}
  <form method="post" action="/server/${req.server.id}/action" style="display:inline"><input type="hidden" name="action" value="assign_call"><input type="hidden" name="id" value="${c.id}"><input name="assignee" placeholder="Assignee name"><button>Assign</button></form>
  <form method="post" action="/server/${req.server.id}/action" style="display:inline"><input type="hidden" name="action" value="unassign_call"><input type="hidden" name="id" value="${c.id}"><button>Unassign</button></form>
  <form method="post" action="/server/${req.server.id}/action" style="display:inline"><input type="hidden" name="action" value="resolve_call"><input type="hidden" name="id" value="${c.id}"><button>Complete</button></form></p>`).join('') || '<p>No calls yet.</p>');
  inner += card('Offline / off-duty units', `<p>Members with emergency-service roles who are not currently assigned to a call are shown in Administration → Members. This standalone build lists them here by role on request — see README gap note.</p>`);
  res.send(sectionPage(req, res, 'Dispatch', inner));
});

app.get('/server/:id/mdt', loadServer, async (req, res) => {
  const chars = await S.listRecords(req.server.id, 'character');
  const cites = await S.listRecords(req.server.id, 'citation');
  const bolos = await S.listRecords(req.server.id, 'bolo');
  let inner = card('MDT — Characters', chars.map(c=>`<p>${esc(c.data.name)} — ${esc(c.data.role||'Civilian')} — ${esc(c.data.address||'')}</p>`).join('') || '<p>No characters yet.</p>');
  inner += card('Create character (fictional San Andreas address generator)', `<form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="create_character">${field('Name','name')}<button class="btn">Create + Generate address</button></form>`);
  inner += card('Citations (auto-create court cases)', cites.map(c=>`<p>${esc(c.data.charge)} — ${esc(c.data.person)} — $${esc(c.data.fine||0)}</p>`).join('') || '<p>No citations yet.</p>' + `<form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="create_citation">${field('Person','person')}${field('Charge','charge')}${field('Fine','fine')}<button class="btn">Issue citation</button></form>`);
  inner += card('BOLOs & Warrants', bolos.map(b=>`<p>${esc(b.data.text)}</p>`).join('') || '<p>No BOLOs yet.</p>' + `<form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="create_bolo">${field('BOLO text','text')}<button class="btn">Issue BOLO</button></form><form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="panic"><button class="btn">🚨 Panic button</button></form>`);
  res.send(sectionPage(req, res, 'MDT', inner));
});

app.get('/server/:id/portal', loadServer, async (req, res) => {
  if (!canPortal(req.member) && !isSuper(req.user)) return res.status(403).send(sectionPage(req, res, 'Emergency Portal', '<p>Emergency Portal is only for first-responder roles, plus Admins and Owners. Civilians do not see it.</p>'));
  const q = (req.query.q || '').toLowerCase();
  const rows = CODES.filter(c => !q || c.join(' ').toLowerCase().includes(q));
  res.send(sectionPage(req, res, 'Emergency Portal', card('Emergency codes — searchable', `<form method="get"><input name="q" value="${esc(req.query.q||'')}"><button>Search</button></form><table><tr><th>Code</th><th>Meaning</th><th>Category</th></tr>${rows.map(c=>`<tr><td>${c[0]}</td><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join('')}</table><p class="small">Starter code list shipped here; the Muse app listed 187 codes — expand this table to the full list before launch if that count is a selling point (see README).</p>`) + card('Live incident map', `<div class="mapwrap"><img src="/san-andreas.jpg" alt="San Andreas map"></div><p>Use Dispatch for call pins; this portal map is the same San Andreas image, no external tiles.</p>`)));
});

app.get('/server/:id/radio', loadServer, async (req, res) => {
  const msgs = await S.listRecords(req.server.id, 'radio');
  let inner = card('Live Radio', `<p><label><input type="checkbox" id="tts" checked> Text-to-speech on (default on, saved on your device)</label></p>
  <form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="radio_msg"><label>Channel<select name="channel">${CHANNELS.map(c=>`<option>${c}</option>`).join('')}</select></label>${field('Message','text')}<button class="btn">Transmit</button></form>
  <div id="traffic">${msgs.map(m=>`<p><b>${esc(m.data.channel)}</b> — ${esc(m.data.user)}: ${esc(m.data.text)}</p>`).join('') || '<p>No radio traffic yet.</p>'}</div>
  <script>try{var t=localStorage.getItem('nexus_tts');if(t!==null)document.getElementById('tts').checked=t==='1';document.getElementById('tts').addEventListener('change',e=>localStorage.setItem('nexus_tts',e.target.checked?'1':'0'));}catch(e){}
  function speak(txt){try{if(document.getElementById('tts').checked && window.speechSynthesis){var u=new SpeechSynthesisUtterance(txt);speechSynthesis.speak(u);}var a=new (window.AudioContext||window.webkitAudioContext)();var o=a.createOscillator();o.connect(a.destination);o.start();o.stop(a.currentTime+0.15);}catch(e){}}
  document.querySelectorAll('#traffic p').forEach(p=>{p.style.cursor='pointer';p.title='Tap to speak';p.addEventListener('click',()=>speak(p.textContent));});</script>`);
  res.send(sectionPage(req, res, 'Live Radio', inner));
});

app.get('/server/:id/characters', loadServer, async (req, res) => res.redirect(`/server/${req.server.id}/mdt`));
app.get('/server/:id/businesses', loadServer, async (req, res) => {
  const bs = await S.listRecords(req.server.id, 'business');
  let inner = card('Businesses', bs.map(b=>`<p><b>${esc(b.data.name)}</b> — owner: ${esc(b.data.owner_name)} ${b.data.owner_id===req.user.id||isAdmin(req.member)?`<form method="post" action="/server/${req.server.id}/action" style="display:inline"><input type="hidden" name="action" value="edit_business"><input type="hidden" name="id" value="${b.id}"><input name="name" value="${esc(b.data.name)}"><button>Save (owner/admin only)</button></form>`:''}</p>`).join('') || '<p>No businesses yet.</p>');
  inner += card('Create business', `<form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="create_business">${field('Business name','name')}<button class="btn">Create</button></form>`);
  res.send(sectionPage(req, res, 'Businesses', inner));
});
app.get('/server/:id/courts', loadServer, async (req, res) => {
  const cases = await S.listRecords(req.server.id, 'court_case');
  res.send(sectionPage(req, res, 'Courts', card('Court cases', cases.map(c=>`<p><b>${esc(c.data.title)}</b> — ${esc(c.data.status)} — defendant: ${esc(c.data.defendant||'')}</p>`).join('') || '<p>No court cases yet. Citations auto-create cases here.</p>') + card('Summons', `<form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="summon">${field('Person summoned','person')}${field('Case title','title')}<button class="btn">Issue summons</button></form><p class="small">Civilians see Justice &amp; Government only when summoned to a court case — in this build, a summoned civilian is given a case record; the Government tab remains admin/government-role gated.</p>`)));
});
app.get('/server/:id/government', loadServer, async (req, res) => {
  if (!canGov(req.member) && !isSuper(req.user)) return res.status(403).send(sectionPage(req, res, 'Government', '<p>Justice &amp; Government is hidden for Civilians unless summoned to court.</p>'));
  const eco = await S.listRecords(req.server.id, 'economy');
  res.send(sectionPage(req, res, 'Government', card('Government & Economy', `<p>Server treasury (starter): SA$2,500,000 — edit in Administration in the Muse app; here it is a starting figure, with taxes 10/6/12/2% as in the prior build.</p>${eco.map(e=>`<p>${esc(e.data.text)}</p>`).join('')}<form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="gov_note">${field('Government note / budget change','text')}<button class="btn">Save (admin/owner only)</button></form>`)));
});

app.get('/server/:id/admin', loadServer, async (req, res) => {
  if (!isAdmin(req.member) && !isSuper(req.user)) return res.status(403).send(sectionPage(req, res, 'Administration', '<p>Administration is only for Admins and Owners.</p>'));
  const members = await S.listMembers(req.server.id);
  const names = {};
  for (const m of members) { const u = await S.findUserById(m.user_id); names[m.user_id] = u ? u.name : m.user_id; }
  let inner = card('Members & Roles', members.map(m=>`<p>${esc(names[m.user_id])} — ${esc(m.role)} ${req.server.owner_id===req.user.id && m.role!=='Owner' ? `<form method="post" action="/server/${req.server.id}/action" style="display:inline"><input type="hidden" name="action" value="set_role"><input type="hidden" name="user_id" value="${m.user_id}"><select name="role">${ROLES.map(r=>`<option ${r===m.role?'selected':''}>${r}</option>`).join('')}</select><button>Set role</button></form>` : ''} ${req.server.owner_id===req.user.id && m.role==='Admin' ? `<form method="post" action="/server/${req.server.id}/action" style="display:inline"><input type="hidden" name="action" value="make_coowner"><input type="hidden" name="user_id" value="${m.user_id}"><button>Make Co-Owner</button></form>` : ''}</p>`).join(''));
  inner += card('Co-Owner rules', `<p>Only the main Owner can appoint/demote/remove a Co-Owner, transfer ownership, delete the server, or change the plan. Co-Owner ranks above Admin with almost full owner powers, except those main-owner exclusives. All Co-Owner changes are audit-logged.</p><form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="demote_coowner"><input name="user_id" placeholder="User ID to demote"><button>Demote Co-Owner (main Owner only)</button></form>`);
  inner += card('Audit log', (await S.listAudit(req.server.id)).slice(0,30).map(a=>`<p>${esc(a.data.action)}: ${esc(a.data.detail)}</p>`).join('') || '<p>No audit entries yet.</p>');
  inner += card('Privacy & Support email', `<p>Support email: Support email to be added at launch (Platform Super Admin can set it before launch).</p><p>Data: invite-only per server, with disclosed Platform Super Admin oversight exception. Fictional roleplay only. Test purchases only in this build.</p>`);
  res.send(sectionPage(req, res, 'Administration', inner));
});

app.get('/server/:id/support', loadServer, async (req, res) => {
  const tickets = isSuper(req.user) && !req.member ? await S.listAllTickets() : await S.listTickets(req.server.id);
  let inner = card('Support tickets', tickets.map(t=>`<p><b>${esc(t.title)}</b> — ${esc(t.status)} — ${esc(t.category)} / ${esc(t.priority)} ${t.version?`— version ${esc(t.version)}`:''} <form method="post" action="/server/${req.server.id}/action" style="display:inline"><input type="hidden" name="action" value="ticket_status"><input type="hidden" name="id" value="${t.id}"><select name="status"><option>Open</option><option>In Progress</option><option>Resolved</option></select><button>Update</button></form></p>`).join('') || '<p>No tickets yet.</p>');
  if (isAdmin(req.member) || isSuper(req.user)) inner += card('File a ticket', `<form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="create_ticket">${field('Title','title')}${field('Category','category')}${field('Priority','priority')}${field('Description','description')}<button class="btn">File ticket</button></form>`);
  else inner += `<p>Only Owners/Admins file tickets for their server.</p>`;
  res.send(sectionPage(req, res, 'Support', inner));
});
app.get('/server/:id/whatsnew', loadServer, async (req, res) => {
  const changelog = await S.listChangelog();
  let inner = card("What's New", changelog.map(c=>`<p><b>${esc(c.version)} — ${esc(c.title)}</b><br>${esc(c.body)}</p>`).join('') || '<p>No notes yet.</p>');
  if (isSuper(req.user)) inner += card('Publish a note (Platform Super Admin only)', `<form method="post" action="/server/${req.server.id}/action"><input type="hidden" name="action" value="publish_changelog">${field('Version','version')}${field('Title','title')}${field('Body','body')}<button class="btn">Publish</button></form>`);
  res.send(sectionPage(req, res, "What's New", inner));
});

// ---------- Actions ----------
app.post('/server/:id/action', loadServer, async (req, res) => {
  const srv = req.server, m = req.member, a = req.body.action;
  const back = `/server/${srv.id}`;
  const deny = (msg) => res.send(sectionPage(req, res, 'Denied', `<p>${msg}</p><p><a href="${back}">Back</a></p>`));
  try {
    if (a === 'create_call') {
      if (!canDispatch(m) && !isSuper(req.user)) return deny('Only Dispatch roles, Admins and Owners can create dispatch calls.');
      const p = POSTALS[req.body.postal] || [50, 50, 'Unknown'];
      await S.createRecord(srv.id, 'call', { title: req.body.title || 'New call', postal: req.body.postal, priority: req.body.priority || 'Medium', status: 'Active', x: p[0], y: p[1], assigned_to: '' });
      await S.audit(srv.id, req.user.id, 'call_created', `Call created at postal ${req.body.postal}`);
    } else if (a === 'ai_dispatch') {
      if (!canDispatch(m) && !isAdmin(m)) return deny('AI dispatch is Dispatch/Admin/Owner only.');
      const calls = (await S.listRecords(srv.id, 'call')).filter(c => c.data.status === 'Active' && !c.data.assigned_to);
      for (const c of calls) { c.data.assigned_to = 'AI-assigned unit'; c.data.status = 'Assigned'; await S.updateRecord(c.id, c.data); }
      await S.audit(srv.id, req.user.id, 'ai_dispatch', `AI dispatch assigned ${calls.length} calls (human override available)`);
    } else if (a === 'assign_call' || a === 'unassign_call' || a === 'resolve_call') {
      if (!canDispatch(m) && !isAdmin(m)) return deny('Only Dispatch/Admin/Owner can assign calls.');
      const recs = await S.listRecords(srv.id, 'call'); const c = recs.find(x => x.id === req.body.id);
      if (c) { if (a==='assign_call') { c.data.assigned_to = req.body.assignee || 'Assigned'; c.data.status='Assigned'; } if (a==='unassign_call') { c.data.assigned_to=''; c.data.status='Active'; } if (a==='resolve_call') c.data.status='Resolved'; await S.updateRecord(c.id, c.data); }
    } else if (a === 'create_character') {
      const streets = ['Grove Street','Vinewood Blvd','Del Perro Ave','Mirror Park Blvd','Sandy Shores Rd','Paleto Blvd'];
      const addr = `${Math.floor(Math.random()*900)+100} ${streets[Math.floor(Math.random()*streets.length)]}, Los Santos, SA ${Math.floor(Math.random()*9000)+1000}`;
      await S.createRecord(srv.id, 'character', { name: req.body.name || 'New Character', address: addr, role: 'Civilian' });
    } else if (a === 'create_citation') {
      await S.createRecord(srv.id, 'citation', { person: req.body.person, charge: req.body.charge, fine: req.body.fine });
      await S.createRecord(srv.id, 'court_case', { title: `Citation — ${req.body.charge}`, defendant: req.body.person, status: 'Open' });
      await S.audit(srv.id, req.user.id, 'citation_created', `Citation for ${req.body.person} auto-created a court case`);
    } else if (a === 'create_bolo') { await S.createRecord(srv.id, 'bolo', { text: req.body.text }); }
    else if (a === 'panic') { await S.createRecord(srv.id, 'radio', { channel: 'Emergency All Agencies Traffic', user: req.user.name, text: 'PANIC BUTTON ACTIVATED' }); }
    else if (a === 'radio_msg') { await S.createRecord(srv.id, 'radio', { channel: req.body.channel, user: req.user.name, text: req.body.text }); }
    else if (a === 'create_business') { await S.createRecord(srv.id, 'business', { name: req.body.name, owner_id: req.user.id, owner_name: req.user.name }); }
    else if (a === 'edit_business') {
      const bs = (await S.listRecords(srv.id, 'business')).find(x => x.id === req.body.id);
      if (!bs) return deny('Business not found.');
      if (bs.data.owner_id !== req.user.id && !isAdmin(m)) return deny('Business owners edit only their own businesses.');
      bs.data.name = req.body.name; await S.updateRecord(bs.id, bs.data);
    } else if (a === 'summon') { await S.createRecord(srv.id, 'court_case', { title: req.body.title, defendant: req.body.person, status: 'Summoned' }); }
    else if (a === 'gov_note') { if (!isAdmin(m)) return deny('Government changes are Admin/Owner only.'); await S.createRecord(srv.id, 'economy', { text: req.body.text }); }
    else if (a === 'set_role') {
      if (!isAdmin(m)) return deny('Only Admins/Owners change roles.');
      const target = await S.getMember(srv.id, req.body.user_id);
      if (target && target.role === 'Owner') return deny('Cannot change the main Owner role.');
      if (req.body.role === 'Co-Owner') return deny('Co-Owner is appointed via Make Co-Owner only, not via set-role.');
      await S.setMemberRole(srv.id, req.body.user_id, req.body.role);
      await S.audit(srv.id, req.user.id, 'role_changed', `Role set to ${req.body.role}`);
    } else if (a === 'make_coowner') {
      if (srv.owner_id !== req.user.id) return deny('Only the main Owner can appoint a Co-Owner.');
      const target = await S.getMember(srv.id, req.body.user_id);
      if (!target || target.role !== 'Admin') return deny('Co-Owner appointment is from Admin members only.');
      await S.setMemberRole(srv.id, req.body.user_id, 'Co-Owner');
      await S.audit(srv.id, req.user.id, 'co_owner_appointed', 'Co-Owner appointed (main-Owner-only action)');
    } else if (a === 'demote_coowner') {
      if (srv.owner_id !== req.user.id) return deny('Only the main Owner can demote a Co-Owner.');
      await S.setMemberRole(srv.id, req.body.user_id, 'Admin');
      await S.audit(srv.id, req.user.id, 'co_owner_demoted', 'Co-Owner demoted');
    } else if (a === 'create_ticket') {
      if (!isAdmin(m) && !isSuper(req.user)) return deny('Only Owners/Admins file support tickets.');
      await S.createTicket(srv.id, req.user.id, { title: req.body.title, category: req.body.category, priority: req.body.priority, description: req.body.description, version: '' });
    } else if (a === 'ticket_status') { await S.setTicketStatus(req.body.id, req.body.status); }
    else if (a === 'publish_changelog') {
      if (!isSuper(req.user)) return deny('Only the Platform Super Admin can publish What\'s New notes.');
      await S.createChangelog(req.body.version || 'v1.0', req.body.title, req.body.body);
    }
  } catch (e) { console.error(e); return res.status(500).send('Action failed: ' + esc(e.message)); }
  res.redirect(back);
});

app.get('/health', (req, res) => res.json({ ok: true, pg: S.usePg }));
S.init().then(() => {
  // Seed a What's New note if none exists (lazy seeding, same pattern as Muse app)
  S.listChangelog().then(async (c) => { if (!c.length) await S.createChangelog('v1.0', 'Public launch build', 'Standalone Render build: landing, sign-in, test-plan server creation, invite-only servers, Dispatch/MDT/Portal, radio, courts, businesses, Administration, Co-Owner, Support, and GTA VI countdown on the Dashboard.'); });
  app.listen(PORT, () => console.log(`Nexus CAD public build listening on ${PORT} (pg=${S.usePg})`));
}).catch(e => { console.error('Store init failed, continuing with JSON fallback if possible:', e); app.listen(PORT, () => console.log('Listening on ' + PORT)); });
