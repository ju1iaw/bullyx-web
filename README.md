# Bullyx website

Marketing site and early-access product surfaces for [bullyx.tech](https://bullyx.tech).

The public site, account experience, organization setup, and lightweight Ask/knowledge/agent-assignment surfaces live here. The full robotics product and synthetic Aegis Robotics demonstration live in the separate product repository.

## Local development

```bash
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Lead forms (Formspree)

**Request a demo** and **Join waitlist** both submit to the same Formspree form. Each submission includes a `form_type` field (`demo` or `waitlist`) so you can filter them in the Formspree inbox.

Submissions are stored in [Formspree](https://formspree.io) (inbox + email notifications). The current Bullyx form ID ships as the browser-safe default, so a fresh checkout works without a private `.env` file.

### Changing the destination

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
cp ../docs/index.html ../docs/404.html
# keep the custom domain file
cp public/CNAME ../docs/CNAME 2>/dev/null || cp ../CNAME ../docs/CNAME
```

Then commit and push `docs/` (and any source changes) to `main`.

`.env` is gitignored on purpose. `VITE_FORMSPREE_ID` overrides the built-in Bullyx form ID and is embedded into the JS bundle at build time, so rebuild `docs/` after changing it.

## Accounts and organizations (Supabase)

The account area uses Supabase Auth, Postgres, Row Level Security, and Storage. This keeps passwords out of the website and makes profile and organization data durable across devices.

### Replacing the Supabase project

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Open **SQL editor**, paste in [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. Under **Authentication → URL Configuration**, set the site URL to `https://bullyx.tech` and add `http://127.0.0.1:5173/**` as a local redirect URL.
4. Keep **Confirm email** enabled under **Authentication → Providers → Email** to require email verification.
5. Copy `frontend/.env.example` to `frontend/.env`, then add the project URL and public anonymous key from **Project Settings → API**:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

6. Rebuild and deploy `docs/` using the steps above. The repository includes the browser-safe project URL and publishable key in `frontend/index.html`, so accounts also work on a fresh checkout. A local `.env` overrides those values when needed. Access is enforced by the included database policies; never put a Supabase service-role key in this site.

## Company Brain / Ask

Run `supabase/migrations/20260719_company_brain.sql`, then `supabase/migrations/20260725_backend_hardening.sql`, in the Supabase SQL Editor after the base schema. They add organization-scoped knowledge, conversations, cited messages, answer feedback, agent assignments, and the production security rules for those records.

The Qwen key stays in Supabase Edge Function secrets—never in `frontend/.env` or the built website. Configure the provider's OpenAI-compatible endpoint, then deploy the function:

```bash
supabase secrets set QWEN_API_KEY=... QWEN_API_BASE_URL=... QWEN_MODEL=qwen-plus ALLOWED_ORIGINS=https://bullyx.tech,https://www.bullyx.tech,http://127.0.0.1:5173,http://localhost:5173
supabase functions deploy ask
```

The endpoint and key must come from the same Qwen region and billing plan. Ask uses full-text retrieval immediately; the knowledge schema also reserves vector embeddings for incremental semantic indexing once the embedding model is selected.
