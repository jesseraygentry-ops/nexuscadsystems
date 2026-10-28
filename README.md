# Nexus CAD Systems — Standalone Public Launch Build

A saving web app (not a static page) built for a public hosted launch on
Render at **nexuscadsystems.onrender.com**. This folder does NOT touch the
Muse artifact `nexus-cad-systems-app` or its data. It is a fresh, standalone
re-implementation of that app's agreed features.

**Fictional roleplay system only — not a real emergency service.**

## What is in here

- **Website landing front** — hero, Inside Nexus, plans, FAQ, Get In Touch,
  Get Started / Play Now → sign-up or My Servers.
- **Sign-up / sign-in / sign-out** — bcrypt password hashes, server sessions.
  No passwords are seeded, and no account is pre-created.
- **Test-mode plan purchase gating server creation** — Starter $29.99 /
  Pro $79.99 / Enterprise $199.99 monthly, recorded as `mode: 'test'`.
  **No real cards are charged in this build.**
- **Per-server invite-only data** — every call, character, citation, case,
  business, radio message and audit entry is scoped by `server_id`.
  Joiners always start as **Civilian**, via invite code.
- **Dispatch** — San Andreas map (`public/san-andreas.jpg`, no external
  tiles), fictional postal codes that auto-place pins, create / assign /
  unassign / complete calls, AI-dispatch triage (human override available).
  Dispatch is only for Dispatcher / Dispatch Supervisor + Admins / Owners.
- **MDT** — characters with a fictional San Andreas address generator,
  citations that auto-create court cases, BOLOs, panic button.
- **Emergency Portal** — searchable emergency-code table, live incident map.
  First-responder roles + Admins / Owners only; civilians are blocked.
- **Live Radio** — channels, transmit, tap-to-speak. Text-to-speech uses
  the browser's speech synthesis, on by default, toggle saved on device.
  A short beep is attempted via WebAudio on tap.
- **Courts / Government** — cases, summons, government roles assignable by
  admins. Civilians see Justice & Government only when summoned (see gaps).
- **Businesses** — owners edit only their own businesses (admin override).
- **Administration** — members & roles, audit log, privacy note.
- **Co-Owner** — main Owner only can appoint (from Admin), demote or
  remove a Co-Owner. Co-Owner ranks above Admin; main-Owner exclusives
  (remove/demote main Owner, transfer ownership, delete server, change
  plan, appoint/demote/remove Co-Owners) are enforced server-side.
- **Support tickets** — Owners/Admins file; Platform Super Admin sees all.
- **What's New** — changelog, only Platform Super Admin can publish.
- **Platform Super Admin** — `jesseray406@gmail.com` only. No password is
  created, changed or stored for that account here; the owner signs up
  with their own password in the app. Super Admin sees all servers, gets
  an oversight banner, and every Super Admin server open is audit-logged.
- **GTA VI banner + countdown** — at the very bottom of the server
  Dashboard, below Latest calls / Recent activity: Grand Theft Auto VI,
  Rockstar Games, PlayStation 5 / Xbox Series X|S, releasing Thursday,
  November 19, 2026, preload from November 12, 2026, with a live
  days/hours/minutes/seconds countdown that switches to "GTA VI is out now"
  after that date.

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
# /health returns { ok: true, pg: false } locally (JSON fallback)
```

Local data lives in `data/nexus.json` (git-ignored in a real repo — add it
to `.gitignore` before pushing; see checklist). On Render, set
`DATABASE_URL` and the app uses Postgres instead, with the same record
model (generic `app_records` table + users/servers/members/purchases).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Render sets it | Default 3000 |
| `DATABASE_URL` | On Render, yes | From the Render Postgres service in `render.yaml` |
| `SESSION_SECRET` | Production, yes | Long random string; Render generates one in `render.yaml` |
| `STRIPE_SECRET_KEY` | **Later, not now** | Placeholder only. Set only after Stripe is connected |
| `STRIPE_PUBLISHABLE_KEY` | **Later, not now** | Placeholder only |
| `STRIPE_MODE` | No | `test` in this build |

## What was NOT fully replicated from the Muse app

Be honest about these before calling this launch-ready:

1. **Emergency codes:** the Muse app listed 187 codes in 5 categories.
   This build ships a searchable starter table (~60 codes). Expand it to
   the full 187 before launch if that count is a selling point.
2. **Penal code:** the Muse app had ~55–57 charges. This build has
   free-text citations, not a full penal-code catalogue. Add a charge
   catalogue table if needed.
3. **Full economy:** starting treasury / department budgets / taxes are
   stated as starter figures in Government, not a full ledger with
   banking/loans/payroll/marketplace/DMV/real-estate/medical/insurance
   modules. Those Muse-app modules are not in this build.
4. **Offline tab:** the Muse app's Dispatch offline-units list is
   approximated here (members by role in Administration). A live
   on-duty/off-duty unit roster is not yet built.
5. **Real radio voice:** push-to-talk / microphone recording is not
   built; radio is text + browser TTS + tap-to-speak, as in the Muse app's
   sandbox limits.
6. **Summoned-civilian Government view:** a summoned civilian gets a
   court-case record, but the Government tab itself remains gated to
   government roles / admins. A case-only courtroom view for summoned
   civilians needs a follow-up build.
7. **Animations / app-store wrapping:** no mobile-app wrapper, icons,
   screenshots or store listings are in this folder. That is separate
   launch work, after the website is live.
8. **Real Stripe checkout:** deliberately NOT in this build. See below.

## Real payments — later, in order

1. Owner connects Stripe (merchant account, business + bank verification
   in Stripe itself — never API keys in chat or in git).
2. Create real Stripe Products/Prices: Starter $29.99, Pro $79.99,
   Enterprise $199.99, monthly.
3. Replace the `/purchase` test flow with Stripe Checkout / Payment Links,
   verify webhooks, and gate server creation on a confirmed paid
   subscription — then test end-to-end with a real (small) transaction
   and a refund test before any customer is charged.
4. Only then flip `STRIPE_MODE` to live and remove the "test only" notices.

## Security notes

- Passwords are bcrypt-hashed, never stored in plain text.
- Per-server queries always filter by `server_id`; non-members get 403.
- Role checks are server-side in the action handler, not just hidden nav.
- Do not commit `.env`, `data/nexus.json` from production, or any key.
