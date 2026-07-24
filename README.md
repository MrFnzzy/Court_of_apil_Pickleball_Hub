# Court of Apil Pickleball Hub — Booking Website

A full booking system for an outdoor pickleball court in Talisay City, Cebu: public booking site +
password-protected admin dashboard, built with Next.js 14, Prisma, and PostgreSQL.

**👉 Start with `DEPLOYMENT.md` for the exact step-by-step guide to get this live on GitHub + Vercel for free.**

## What's included

- **Public site (`/`)** — court photo/illustration, description, expandable Google Maps location, rental
  pricing, court rates, and a live today's-schedule preview.
- **Booking flow (`/book`)** — date picker, interactive 24-hour slot grid (court is open 24/7), paddle &
  ball rental selector, customer details form, GCash/Maya/BPI payment picker with account details & QR,
  reference number + amount + proof-of-payment upload, running order total.
- **No double-booking, guaranteed** — a database-level unique constraint on `(date, hour)` inside a
  transaction means two people can never successfully book the same slot, even if they submit at the exact
  same moment.
- **Admin dashboard (`/admin`)** — password-protected. Daily calendar view of all bookings (name, contact,
  amount, proof of payment), approve/reject pending bookings (auto-sends a confirmation email on approval),
  manually add or remove bookings (walk-ins/phone bookings), and manage payment accounts (add/remove GCash,
  Maya, BPI account numbers and QR codes).
- **Auto-refresh** — the schedule grid polls every 20 seconds so everyone always sees the latest status,
  and shows a pulsing "in play now" indicator for the current hour.
- **Fully responsive** — mobile, tablet, and desktop.

## Tech stack

| Piece | Technology | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Full-stack React, API routes built in |
| Database | PostgreSQL via [Neon](https://neon.tech) | Free tier, works natively with Vercel |
| ORM | Prisma | Type-safe queries, the unique constraint that prevents double-booking |
| File storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) | Free tier, for proof-of-payment uploads & QR images |
| Email | [Resend](https://resend.com) | Free tier (100 emails/day), sends booking confirmations |
| Styling | Tailwind CSS | Custom orange/blue theme matching your brand colors |
| Hosting | [Vercel](https://vercel.com) | Free tier, deploys straight from GitHub |

## Local development

```bash
npm install
cp .env.example .env      # fill in the values — see DEPLOYMENT.md
npx prisma db push        # creates the tables in your database
npm run dev
```

Visit `http://localhost:3000`. Admin dashboard: `http://localhost:3000/admin` (password = your
`ADMIN_PASSWORD`).

## Project structure

```
src/
  app/
    page.tsx                 → homepage
    book/page.tsx             → booking flow
    admin/page.tsx             → admin dashboard
    admin/login/page.tsx      → admin login
    api/                       → all backend routes (bookings, slots, upload, admin, payment accounts)
  components/                  → shared UI (schedule grid, date picker, payment picker, admin panels)
  lib/                          → pricing rules, prisma client, auth, email
prisma/schema.prisma            → database schema (Booking, Slot, PaymentAccount)
```
