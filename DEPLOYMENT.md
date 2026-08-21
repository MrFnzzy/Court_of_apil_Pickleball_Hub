# Deploying Heide's Pickleball Hub — Step by Step

Total time: ~15 minutes. Everything used here is free tier, no credit card required.

## 0. What you'll need
- A GitHub account (free) — https://github.com/signup
- A Vercel account (free) — https://vercel.com/signup (sign up **with your GitHub account**, it's easiest)
- A Neon account (free) — https://neon.tech (for the database)
- A Resend account (free) — https://resend.com (for confirmation emails)

---

## 1. Push the code to GitHub

Unzip the project I gave you, open a terminal inside the folder, then run:

```bash
git init
git add .
git commit -m "Initial commit — Heide's Pickleball Hub"
```

Go to https://github.com/new, create a new **empty** repository (don't check "add a README" — you already
have one), name it e.g. `heides-pickleball-hub`. GitHub will show you commands like these — run them:

```bash
git remote add origin https://github.com/YOUR-USERNAME/heides-pickleball-hub.git
git branch -M main
git push -u origin main
```

Refresh the GitHub page — your code should now be there.

---

## 2. Create your free database (Neon)

1. Go to https://neon.tech → sign up → **Create a project**. Name it `heides-pickleball-hub`.
2. Once created, go to the project's **Dashboard** → **Connection Details**.
3. You'll see a connection string like:
   `postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. Copy **two** versions of it:
   - The **pooled** connection string (usually the default shown, has `-pooler` in the hostname) → this is
     your `DATABASE_URL`.
   - The **direct** connection string (toggle "Pooled connection" off, or find "Direct connection") → this
     is your `DIRECT_URL`.
   - If Neon only shows you one string, it's fine to use the same value for both.

Keep this tab open — you'll paste these into Vercel in step 4.

---

## 3. Create your Vercel project

1. Go to https://vercel.com/new
2. Click **Import** next to your `heides-pickleball-hub` GitHub repo (authorize Vercel to access GitHub if asked).
3. Vercel will auto-detect it as a Next.js project. **Don't click Deploy yet** — first expand
   **Environment Variables** and add the variables from the next step.

---

## 4. Set environment variables

In the Vercel import screen (or later under **Project → Settings → Environment Variables**), add:

| Key | Value |
|---|---|
| `DATABASE_URL` | the pooled Neon connection string from step 2 |
| `DIRECT_URL` | the direct Neon connection string from step 2 |
| `ADMIN_PASSWORD` | any password you'll use to log into `/admin` |
| `ADMIN_SESSION_SECRET` | any random long string (32+ characters — mash your keyboard) |
| `RESEND_API_KEY` | see step 5 below |
| `EMAIL_FROM` | `Heide's Pickleball Hub <onboarding@resend.dev>` (works immediately, no domain setup needed) |
| `NEXT_PUBLIC_SITE_URL` | optional — your live site URL, e.g. `https://your-project-name.vercel.app` (or your custom domain once connected). Used to build the link in the post-play "thanks for playing" feedback email. If left unset, it falls back to Vercel's own deployment URL automatically, so this is only needed if you want full control over the link (e.g. after connecting a custom domain in step 8). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | optional — enables real push notifications (new-booking alerts) in the admin dashboard. See "Push notifications" below for how to get one. |
| `VAPID_PRIVATE_KEY` | required alongside the key above — keep this one secret, never expose it to the browser. |
| `VAPID_SUBJECT` | optional — a `mailto:you@example.com` address push services can use to contact you if something's wrong. Defaults to a placeholder if left unset. |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | optional — enables a visible "I'm not a robot" checkbox (reCAPTCHA v2, with an image puzzle as a fallback challenge) on the booking form. See "Bot protection" below for how to get one. |
| `RECAPTCHA_SECRET_KEY` | required alongside the key above — keep this one secret, never expose it to the browser. Without it, the site key alone does nothing (verification is skipped). |
| `ANTHROPIC_API_KEY` | optional — upgrades the "Ask us anything" AI box in the homepage FAQ section from simple keyword matching to a real Claude-powered assistant that can handle rephrased/looser questions. Works fine without it. See "FAQ AI assistant" below. |

Leave `BLOB_READ_WRITE_TOKEN` for now — you'll add it in step 6, it gets created automatically.

---

## FAQ AI assistant (optional)

The homepage FAQ section (`/#faq`) includes an "Ask us anything" box where visitors can type a question in
their own words instead of scanning the accordion. It always works, even with zero setup:

- **Without `ANTHROPIC_API_KEY`** — it matches the question against your FAQ list using keyword overlap. Good
  enough for most phrasings, free, and has no external dependency.
- **With `ANTHROPIC_API_KEY`** — it calls Claude to understand rephrased or looser questions, but is still
  strictly limited to answering from your FAQ list only (it's instructed to never invent policies, prices, or
  details) and falls back to the Facebook link for anything it isn't confident about.

To turn on the upgraded version:

1. Get an API key from https://console.anthropic.com (Settings → API Keys). This is a paid, usage-based API —
   each question costs a small fraction of a cent with the fast model this uses, but it isn't free like the
   default keyword matching.
2. Add `ANTHROPIC_API_KEY` in Vercel's environment variables, then redeploy.

The FAQ list itself lives in one place — `src/lib/faqData.ts` — edit it there and both the accordion and the
AI assistant pick up the change automatically.

---

## Bot protection (optional)

The public booking form (`/book`) can require a Google reCAPTCHA v2 check on the payment step before a
submission is accepted — the customer ticks an **"I'm not a robot" checkbox**, and if Google's risk analysis
isn't confident enough from that alone, it follows up with an **image puzzle** (e.g. "select all squares with
a traffic light") before letting them through. Skipped entirely (every submission passes, no widget shown)
until you configure it. To turn it on:

1. Go to https://www.google.com/recaptcha/admin/create
2. Pick **reCAPTCHA v2 → "I'm not a robot" Checkbox**, add your site's domain (and `localhost` if you want it
   active in local dev too).
3. Copy the **Site key** into `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and the **Secret key** into
   `RECAPTCHA_SECRET_KEY` in Vercel's environment variables, then redeploy.

The checkbox widget appears at the bottom of the payment step (step 5) once it's active, and "Reserve my
spot" stays disabled until it's checked (and any puzzle, if one appears, is solved).

---

## Push notifications (optional)

The admin dashboard can show a real notification — right in your phone or computer's notification tray,
even if the dashboard isn't open — the moment a new booking comes in. To turn this on:

1. On your own computer, inside the project folder, run:
   ```bash
   npx web-push generate-vapid-keys
   ```
   This prints a **Public Key** and a **Private Key**. Keep the Private Key secret — never share it or
   commit it to GitHub.
2. In Vercel → your project → **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = the Public Key
   - `VAPID_PRIVATE_KEY` = the Private Key
   - `VAPID_SUBJECT` = `mailto:` + your email
3. Redeploy.
4. Log into `/admin` on whichever phone/computer you want alerts on, and click **Enable on this device**
   under "Push notifications" near the top of the dashboard. Do this separately on every device you want
   to hear from.
5. On iPhone specifically: install the admin app to your Home Screen first (see the Install button at the
   top of `/admin`) — Apple only allows push notifications for an installed PWA, not a regular Safari tab.

---

## 5. Get your Resend API key (for confirmation emails)

1. Go to https://resend.com → sign up (free, no card).
2. Dashboard → **API Keys** → **Create API Key** → copy it.
3. Paste it as `RESEND_API_KEY` in Vercel (step 4 above).
4. You can send from `onboarding@resend.dev` immediately with no setup — good enough to launch. Later, if
   you want emails to come from your own domain, Resend → **Domains** → add your domain and follow their
   DNS instructions, then update `EMAIL_FROM`.

---

## 6. Deploy, then add Vercel Blob storage

1. Back in Vercel, click **Deploy**. First deploy takes ~2 minutes.
2. Once deployed, go to your project → **Storage** tab → **Create Database** → choose **Blob** → **Create**.
3. Vercel automatically adds a `BLOB_READ_WRITE_TOKEN` environment variable to your project — you don't
   need to copy anything manually.
4. Go to **Deployments** → click the ⋯ menu on the latest deployment → **Redeploy** (so it picks up the new
   Blob token).

Your site is now live at `https://your-project-name.vercel.app` 🎉

---

## 7. First-time setup on the live site

1. Visit `https://your-project-name.vercel.app/admin/login` and log in with your `ADMIN_PASSWORD`.
2. Go to the **Payment accounts** tab and add your GCash, Maya, and/or BPI account details (and QR code
   images if you have them). Customers won't see payment options at checkout until you've added at least
   one account here.
3. Try a test booking yourself on the public site to confirm everything works end-to-end, then approve it
   from `/admin` and check that the confirmation email arrives.

---

## 7b. Admin two-factor login, trusted devices, and passkeys

The admin login now has three layers on top of the password:

- **Email code (2FA)** — after the password, a 6-digit code is emailed before login completes. It's sent
  to whatever you set as **Security → Two-factor email**; if you leave that blank it falls back to your
  `GMAIL_USER` inbox. If neither is set, login skips straight through (so this never locks you out of your
  own dashboard) — set an email in the Security tab to actually turn it on.
- **Trusted devices** — checking "trust this device" on the code screen skips the email code on that
  browser for 30 days. Manage/revoke them from **Security → Trusted devices**.
- **Passkeys** — Face ID / Touch ID / Windows Hello / a security key. A passkey replaces the password *and*
  the email code in one step. Register one from **Security → Passkeys** once you're already logged in (you
  can't register the first one from the login screen — you have to already be signed in once).

No new environment variables or third-party accounts are needed — it reuses `ADMIN_SESSION_SECRET` (already
required) and the same Gmail sending account as the rest of the site's emails.

**One-time step after deploying this update:** the feature adds two new database tables. If you deploy via
the same `git push` flow as before, Vercel's build already runs `prisma db push` for you (check the
Deployments tab build log to confirm it ran cleanly). If you ever apply schema changes manually, run:

```bash
npx prisma db push
```

Passkeys are tied to the exact domain you register them on (this is a WebAuthn security requirement, not a
bug) — if you add a custom domain later (step 8 below), you'll need to re-register any passkeys from that
domain.

---

## 8. Connect your own domain (optional)

Vercel → your project → **Settings → Domains** → add your domain (e.g. `heidespickleballhub.com`) and follow the
on-screen DNS instructions (usually just adding one or two records at your domain registrar).

---

## Updating the site later

Any time you want to change something: edit the code, then:

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel automatically redeploys within about a minute of every push to `main`.

## Troubleshooting

- **"Something went wrong" on booking submit** → check Vercel → your project → **Logs** for the exact
  error; almost always a missing/incorrect environment variable.
- **Emails not arriving** → double-check `RESEND_API_KEY` is set and check the Resend dashboard's
  **Logs** tab, and check the customer's spam folder.
- **Photo/QR uploads fail** → confirm the Blob store was created (step 6) and you redeployed afterward.
- **Can't log into `/admin`** → confirm `ADMIN_PASSWORD` is set exactly as you expect in Vercel's
  environment variables (case-sensitive).
