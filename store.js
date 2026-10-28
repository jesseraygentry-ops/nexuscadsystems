// Generic store: Postgres when DATABASE_URL is set (Render), JSON file fallback locally.
// All per-server data is stored as typed records scoped by server_id, so
// invite-only visibility is enforced by querying only that server's records.
// Users / servers / members / purchases have their own tables/collections
// because they are cross-server (auth) or ownership records.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'nexus.json');
const usePg = !!process.env.DATABASE_URL;
let pool = null;
if (usePg) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function nowIso() { return new Date().toISOString(); }

let json = null;
function loadJson() {
  if (json) return json;
  try { json = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { json = { users: [], servers: [], members: [], purchases: [], records: [], changelog: [], tickets: [] }; }
  for (const k of ['users','servers','members','purchases','records','changelog','tickets']) if (!Array.isArray(json[k])) json[k] = [];
  return json;
}
function saveJson() { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(loadJson(), null, 2)); }

async function init() {
  if (!usePg) { loadJson(); return; }
  await pool.query(`CREATE TABLE IF NOT EXISTS app_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, password_hash TEXT NOT NULL, created_at TEXT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS app_servers (id TEXT PRIMARY KEY, name TEXT, owner_id TEXT, plan TEXT, invite_code TEXT UNIQUE, created_at TEXT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS app_members (id TEXT PRIMARY KEY, server_id TEXT, user_id TEXT, role TEXT, display_role TEXT, created_at TEXT, UNIQUE(server_id, user_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS app_purchases (id TEXT PRIMARY KEY, user_id TEXT, plan TEXT, amount_cents INT, mode TEXT, created_at TEXT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS app_records (id TEXT PRIMARY KEY, server_id TEXT, type TEXT, data JSONB, created_at TEXT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS app_changelog (id TEXT PRIMARY KEY, version TEXT, title TEXT, body TEXT, created_at TEXT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS app_tickets (id TEXT PRIMARY KEY, server_id TEXT, user_id TEXT, title TEXT, category TEXT, priority TEXT, status TEXT, description TEXT, version TEXT, created_at TEXT)`);
}

// ---- Users ----
async function findUserByEmail(email) {
  email = String(email).toLowerCase().trim();
  if (usePg) { const r = await pool.query('SELECT * FROM app_users WHERE email=$1', [email]); return r.rows[0] || null; }
  return loadJson().users.find(u => u.email === email) || null;
}
async function findUserById(id) {
  if (usePg) { const r = await pool.query('SELECT * FROM app_users WHERE id=$1', [id]); return r.rows[0] || null; }
  return loadJson().users.find(u => u.id === id) || null;
}
async function createUser({ email, name, password_hash }) {
  const u = { id: uid(), email: String(email).toLowerCase().trim(), name, password_hash, created_at: nowIso() };
  if (usePg) await pool.query('INSERT INTO app_users VALUES ($1,$2,$3,$4,$5)', [u.id, u.email, u.name, u.password_hash, u.created_at]);
  else { loadJson().users.push(u); saveJson(); }
  return u;
}

// ---- Purchases (test mode only) ----
async function createPurchase(userId, plan) {
  const prices = { Starter: 2999, Pro: 7999, Enterprise: 19999 };
  const p = { id: uid(), user_id: userId, plan, amount_cents: prices[plan] || 0, mode: 'test', created_at: nowIso() };
  if (usePg) await pool.query('INSERT INTO app_purchases VALUES ($1,$2,$3,$4,$5,$6)', [p.id, p.user_id, p.plan, p.amount_cents, p.mode, p.created_at]);
  else { loadJson().purchases.push(p); saveJson(); }
  return p;
}
async function listPurchases(userId) {
  if (usePg) { const r = await pool.query('SELECT * FROM app_purchases WHERE user_id=$1 ORDER BY created_at DESC', [userId]); return r.rows; }
  return loadJson().purchases.filter(p => p.user_id === userId);
}
async function hasPurchase(userId) { return (await listPurchases(userId)).length > 0; }

// ---- Servers & members ----
async function createServer(ownerId, name, plan) {
  const s = { id: uid(), name, owner_id: ownerId, plan, invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(), created_at: nowIso() };
  if (usePg) await pool.query('INSERT INTO app_servers VALUES ($1,$2,$3,$4,$5,$6)', [s.id, s.name, s.owner_id, s.plan, s.invite_code, s.created_at]);
  else { loadJson().servers.push(s); saveJson(); }
  await addMember(s.id, ownerId, 'Owner');
  await audit(s.id, ownerId, 'server_created', `Server ${name} created on ${plan} (test purchase)`);
  return s;
}
async function getServer(id) {
  if (usePg) { const r = await pool.query('SELECT * FROM app_servers WHERE id=$1', [id]); return r.rows[0] || null; }
  return loadJson().servers.find(s => s.id === id) || null;
}
async function findServerByInvite(code) {
  code = String(code).trim().toUpperCase();
  if (usePg) { const r = await pool.query('SELECT * FROM app_servers WHERE invite_code=$1', [code]); return r.rows[0] || null; }
  return loadJson().servers.find(s => s.invite_code === code) || null;
}
async function listServers() {
  if (usePg) { const r = await pool.query('SELECT * FROM app_servers ORDER BY created_at DESC'); return r.rows; }
  return [...loadJson().servers].reverse();
}
async function listServersForUser(userId, isSuper) {
  if (isSuper) return listServers();
  const all = await listServers();
  const mine = [];
  for (const s of all) { if (await getMember(s.id, userId)) mine.push(s); }
  return mine;
}
async function addMember(serverId, userId, role) {
  const existing = await getMember(serverId, userId);
  if (existing) return existing;
  const m = { id: uid(), server_id: serverId, user_id: userId, role, display_role: role, created_at: nowIso() };
  if (usePg) await pool.query('INSERT INTO app_members VALUES ($1,$2,$3,$4,$5,$6)', [m.id, m.server_id, m.user_id, m.role, m.display_role, m.created_at]);
  else { loadJson().members.push(m); saveJson(); }
  return m;
}
async function getMember(serverId, userId) {
  if (usePg) { const r = await pool.query('SELECT * FROM app_members WHERE server_id=$1 AND user_id=$2', [serverId, userId]); return r.rows[0] || null; }
  return loadJson().members.find(m => m.server_id === serverId && m.user_id === userId) || null;
}
async function listMembers(serverId) {
  if (usePg) { const r = await pool.query('SELECT * FROM app_members WHERE server_id=$1 ORDER BY created_at', [serverId]); return r.rows; }
  return loadJson().members.filter(m => m.server_id === serverId);
}
async function setMemberRole(serverId, userId, role) {
  if (usePg) await pool.query('UPDATE app_members SET role=$1, display_role=$1 WHERE server_id=$2 AND user_id=$3', [role, serverId, userId]);
  else { const m = loadJson().members.find(x => x.server_id === serverId && x.user_id === userId); if (m) { m.role = role; m.display_role = role; saveJson(); } }
}

// ---- Generic per-server records ----
async function createRecord(serverId, type, data) {
  const rec = { id: uid(), server_id: serverId, type, data, created_at: nowIso() };
  if (usePg) await pool.query('INSERT INTO app_records VALUES ($1,$2,$3,$4,$5)', [rec.id, rec.server_id, rec.type, JSON.stringify(rec.data), rec.created_at]);
  else { loadJson().records.push(rec); saveJson(); }
  return rec;
}
async function listRecords(serverId, type) {
  if (usePg) { const r = await pool.query('SELECT * FROM app_records WHERE server_id=$1 AND type=$2 ORDER BY created_at DESC', [serverId, type]); return r.rows.map(x => ({ ...x, data: typeof x.data === 'string' ? JSON.parse(x.data) : x.data })); }
  return loadJson().records.filter(r => r.server_id === serverId && r.type === type).reverse();
}
async function updateRecord(id, data) {
  if (usePg) await pool.query('UPDATE app_records SET data=$1 WHERE id=$2', [JSON.stringify(data), id]);
  else { const r = loadJson().records.find(x => x.id === id); if (r) { r.data = data; saveJson(); } }
}
async function deleteRecord(id) {
  if (usePg) await pool.query('DELETE FROM app_records WHERE id=$1', [id]);
  else { loadJson().records = loadJson().records.filter(x => x.id !== id); saveJson(); }
}
async function audit(serverId, userId, action, detail) {
  return createRecord(serverId, 'audit', { user_id: userId, action, detail, at: nowIso() });
}
async function listAudit(serverId) { return listRecords(serverId, 'audit'); }

// ---- Changelog & tickets ----
async function listChangelog() {
  if (usePg) { const r = await pool.query('SELECT * FROM app_changelog ORDER BY created_at DESC'); return r.rows; }
  return [...loadJson().changelog].reverse();
}
async function createChangelog(version, title, body) {
  const c = { id: uid(), version, title, body, created_at: nowIso() };
  if (usePg) await pool.query('INSERT INTO app_changelog VALUES ($1,$2,$3,$4,$5)', [c.id, c.version, c.title, c.body, c.created_at]);
  else { loadJson().changelog.push(c); saveJson(); }
  return c;
}
async function createTicket(serverId, userId, t) {
  const tk = { id: uid(), server_id: serverId, user_id: userId, ...t, status: 'Open', created_at: nowIso() };
  if (usePg) await pool.query('INSERT INTO app_tickets VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [tk.id, tk.server_id, tk.user_id, tk.title, tk.category, tk.priority, tk.status, tk.description, tk.version || '', tk.created_at]);
  else { loadJson().tickets.push(tk); saveJson(); }
  return tk;
}
async function listTickets(serverId) {
  if (usePg) { const r = await pool.query('SELECT * FROM app_tickets WHERE server_id=$1 ORDER BY created_at DESC', [serverId]); return r.rows; }
  return loadJson().tickets.filter(t => t.server_id === serverId).reverse();
}
async function listAllTickets() {
  if (usePg) { const r = await pool.query('SELECT * FROM app_tickets ORDER BY created_at DESC'); return r.rows; }
  return [...loadJson().tickets].reverse();
}
async function setTicketStatus(id, status) {
  if (usePg) await pool.query('UPDATE app_tickets SET status=$1 WHERE id=$2', [status, id]);
  else { const t = loadJson().tickets.find(x => x.id === id); if (t) { t.status = status; saveJson(); } }
}

module.exports = { init, usePg, uid, nowIso, findUserByEmail, findUserById, createUser, createPurchase, listPurchases, hasPurchase, createServer, getServer, findServerByInvite, listServers, listServersForUser, addMember, getMember, listMembers, setMemberRole, createRecord, listRecords, updateRecord, deleteRecord, audit, listAudit, listChangelog, createChangelog, createTicket, listTickets, listAllTickets, setTicketStatus };
