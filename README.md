# Bullyx website

Marketing site for [bullyx.tech](https://bullyx.tech).

This repo is **website-only**. The product/demo lives in a separate repository.

## Local development

```bash
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Demo request form (Formspree)

Submissions are stored in [Formspree](https://formspree.io) (inbox + email notifications). You need a free Formspree account and form ID before the live form works.

### One-time setup

1. Create an account at [https://formspree.io](https://formspree.io).
2. Click **New Form**, name it something like `Bullyx demo requests`, and set the notification email to an inbox you check.
3. Copy the form ID from the endpoint URL:
   - Endpoint looks like `https://formspree.io/f/xyzabcde`
   - Form ID is the last part: `xyzabcde`
4. In `frontend/`, copy the example env file and paste your ID:

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:

```bash
VITE_FORMSPREE_ID=xyzabcde
```

5. Confirm the form domain in Formspree (when prompted): allow `bullyx.tech` and `127.0.0.1` / `localhost` for local testing.
6. Restart the Vite dev server after changing `.env`.

### Where to read submissions

- Formspree dashboard → your form → **Submissions**
- Email notifications to the address you configured on the form

Free Formspree plans include a monthly submission limit; upgrade there if you outgrow it.

## Deploy to GitHub Pages

The live site is the static build in `docs/` (GitHub Pages source: `main` / `/docs`).

After changing the site **or** your Formspree ID:

```bash
cd frontend
npm run build
rm -rf ../docs/*
cp -R dist/* ../docs/
touch ../docs/.nojekyll
# keep the custom domain file
cp public/CNAME ../docs/CNAME 2>/dev/null || cp ../CNAME ../docs/CNAME
```

Then commit and push `docs/` (and any source changes) to `main`.

`.env` is gitignored on purpose. The Formspree ID is embedded into the JS bundle at build time, so you must rebuild `docs/` on a machine that has `.env` set before deploying.
