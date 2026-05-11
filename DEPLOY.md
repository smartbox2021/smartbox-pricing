# Smartbox Pricing Dashboard — Deployment Guide

When you're ready to go live, this takes about 15 minutes.

---

## What you'll need
- A free GitHub account (github.com)
- A free Vercel account (vercel.com) — sign up with GitHub
- A Gmail account with an App Password

---

## Step 1 — Put the code on GitHub

1. Go to github.com → New repository → name it "smartbox-pricing" → Create
2. Download GitHub Desktop (desktop.github.com) if you don't have it
3. Clone your new repo, copy all these files into it, commit and push

Or ask your IT person — this takes them 2 minutes.

---

## Step 2 — Deploy to Vercel

1. Go to vercel.com → Add New Project
2. Import your GitHub repository
3. Click Deploy — Vercel builds it automatically

Your dashboard will be live at: `smartbox-pricing.vercel.app`

---

## Step 3 — Add your secrets (email + cron)

In Vercel → your project → Settings → Environment Variables, add:

| Key | Value |
|---|---|
| GMAIL_USER | your-gmail@gmail.com |
| GMAIL_APP_PASSWORD | your 16-char app password |
| EMAIL_TO | alex@smartboxselfstorage.uk,roger@smartboxselfstorage.uk |
| CRON_SECRET | smartbox-corby-2026 (or any random string) |

**Gmail App Password:**
1. myaccount.google.com → Security
2. 2-Step Verification → enable if not already
3. App passwords → create one → copy the 16 characters

---

## Step 4 — Test it

Go to: `https://smartbox-pricing.vercel.app/api/scrape?secret=smartbox-corby-2026`

This triggers the first scrape manually. Refresh the dashboard — you should see live data.

---

## Daily automation

The `vercel.json` file already tells Vercel to run the scraper every day at 7am.
No further setup needed.

---

## Custom domain (optional)

If you want `pricing.smartboxselfstorage.uk` instead of the Vercel URL:
- Vercel → your project → Settings → Domains → add your domain
- Add a CNAME record in your domain registrar pointing to `cname.vercel-dns.com`
- Takes about 10 minutes to propagate
