# Gia Huy · Personal workspace

This React application replaces the portfolio homepage. The existing legacy Codex Presence route remains available with its installation, download and FAQ panels.

To prepare the static website in the GitHub Pages checkout, first build the sibling `lumen-crm` project, then run:

```sh
npm ci
npm run build
node stage-pages.mjs
```

The staging script copies the portfolio build to the site root and the CRM build to `/crm/`. Serve the GitHub Pages checkout root to verify both pages with their assets.
