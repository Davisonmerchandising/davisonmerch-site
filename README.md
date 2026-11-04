# Davlin website (davisonmerch.com)

- Site files live in `public/`.
- Pushing to `main` deploys automatically to Cloudflare (Worker `davisonmerch`, settings in `wrangler.jsonc`).
- `src/worker.js` handles payments (Stripe) and form emails (Resend). Keys go in Cloudflare > Settings > Variables and Secrets.
- `netlify/` is the older Netlify version of the same code, kept for reference.
