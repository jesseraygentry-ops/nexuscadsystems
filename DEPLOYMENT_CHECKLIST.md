# Deployment Checklist — Nexus CAD Systems → nexuscadsystems.onrender.com

**Status: code ready for review/deploy preparation. NOT deployed, NOT
registered, NOT paid for. Nothing in this folder has contacted Render.**

## 1. Before you push anything
- [ ] Review this folder: `server.js`, `store.js`, `render.yaml`, `Dockerfile`, `public/`
- [ ] Add a `.gitignore` with: `node_modules/`, `data/`, `.env` — do NOT push local test data or secrets
- [ ] Decide: is the test-purchase launch acceptable first, with real Stripe later? (Recommended — see README § Real payments)

## 2. GitHub repo (REQUIRED for Render Blueprint — missing piece)
- [ ] Create a GitHub repo (private is fine; Render can read private repos you authorise)
- [ ] Push this folder to that repo, e.g.:
  ```bash
  cd ~/workspace/nexus-public-launch
  git init && git add . && git commit -m "Nexus CAD public launch build"
  git remote add origin <YOUR-GITHUB-REPO-URL>
  git push -u origin main
  ```
- [ ] **This step was NOT done by the builder** — no GitHub account was created or used, and no repo URL exists yet. Render cannot deploy from a local folder alone.

## 3. Render — create the service (browser, with your Render account)
- [ ] Sign in / create a free Render account (you complete identity/payment if Render asks — nothing was signed up here)
- [ ] New → Blueprint → connect the GitHub repo above
- [ ] Render will read `render.yaml` and propose:
  - Web service: `nexuscadsystems` (Node, free plan, `npm install` / `npm start`, health check `/health`)
  - Database: `nexus-db` (Postgres, free plan)
- [ ] Confirm the service name is exactly `nexuscadsystems` — that gives `nexuscadsystems.onrender.com`
- [ ] Check `SESSION_SECRET` was generated, `DATABASE_URL` is linked from `nexus-db`, `STRIPE_MODE=test`, Stripe keys left unset
- [ ] Deploy, wait for "Live", then open `https://nexuscadsystems.onrender.com/health` — expect `{"ok":true,"pg":true}`

## 4. End-to-end test on the live URL (test buying only, no real charge)
- [ ] Sign up → buy a plan (test) → create a server → check invite code
- [ ] Join as a second account via invite code → confirm joiner starts as Civilian and sees only that server
- [ ] Dispatch: create a call with a postal code → pin appears on the San Andreas map → assign / unassign / complete
- [ ] MDT: create a character (address generates) → issue a citation → court case auto-creates
- [ ] Emergency Portal: blocked for Civilian, visible for first responders / admins
- [ ] Live Radio: transmit, tap-to-speak, TTS toggle saves
- [ ] Dashboard bottom: GTA VI banner + countdown ticking (Nov 19, 2026)
- [ ] Sign out → sign back in → data still there (this proves Postgres, not ephemeral disk)
- [ ] Super Admin: sign in as jesseray406@gmail.com → oversight banner, all servers visible, audit entry written

## 5. Real payments (only after Stripe is connected)
- [ ] Connect Stripe in Muse / Stripe dashboard, complete business + bank verification
- [ ] Create real Products/Prices ($29.99 / $79.99 / $199.99 monthly)
- [ ] Wire Stripe Checkout into `/purchase`, verify webhooks, test a real transaction + refund
- [ ] Flip `STRIPE_MODE` to live, remove test-only notices, re-test server-creation gating
- [ ] Set a real support email (Platform Super Admin) and publish a Privacy Policy / Terms page before taking customer money

## 6. After website launch
- [ ] App-store wrapping (Apple/Google developer accounts — owner completes identity/payment personally)
- [ ] Overwolf: still an open question — overlay app vs. account link vs. download link (not built here)
- [ ] Expand emergency codes to 187 and penal code to ~55 charges if those counts are advertised
- [ ] Free-tier note: Render free web services sleep after inactivity and free Postgres has limits — if traffic grows, upgrade plans before launch marketing
