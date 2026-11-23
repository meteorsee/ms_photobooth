# Moment Studio — a private online photo booth

A private, browser-based photo booth for capturing a set of photos, styling a keepsake, and downloading or printing the result. It is a static site with no backend, account, database, or build step.

## What it does

- Captures six-photo, classic-strip, or four-photo layouts
- Switches between front and rear cameras when available
- Offers frame colours, twelve looks, creative lens effects, optional film grain, countdowns, retakes, and photo uploads
- Downloads full-resolution PNG keepsakes and photo-and-note letters
- Prints finished photo sheets
- Includes a demo mode that works without a camera
- Keeps camera frames and uploaded photos in browser memory only

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow that validates and publishes the `web/` directory.

1. Create an empty repository on GitHub. Do not add another README or `.gitignore` when creating it.
2. Connect this folder and push its `main` branch:

   ```powershell
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

3. In the GitHub repository, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish. The deployment summary contains the live URL.

Every later push to `main` validates and redeploys the site automatically. You can also run the workflow manually from the Actions tab.

GitHub Pages serves the site over HTTPS, which is required for browser camera access outside `localhost`. Visitors still need to grant camera permission when prompted.

## Run locally on Windows

Python 3.9 or newer is required; no extra packages are needed.

1. Double-click `START-PhotoBooth.bat`.
2. The launcher opens `http://localhost:8080/` in the default browser.
3. Keep the launcher window open while using the booth.

If port 8080 is busy, the server tries ports 8081–8089. Command-line options are also available:

```powershell
py -3 server.py
py -3 server.py --port 8090
py -3 server.py --no-browser
```

See `READ-ME.txt` for detailed local setup and troubleshooting.

Contributors who already have Node.js can use the dependency-free preview server instead:

```powershell
node scripts/serve.mjs
node scripts/serve.mjs 8090
```

## Validate before pushing

With Node.js installed, run the same dependency-free checks used by GitHub Actions:

```powershell
node --check web/app.js
node scripts/check-site.mjs
```

The second check verifies that the entry point and referenced assets exist and that paths remain compatible with project sites such as `https://username.github.io/repository-name/`.

## Project structure

```text
.
├── .github/workflows/deploy-pages.yml  # automatic Pages deployment
├── scripts/check-site.mjs              # dependency-free site integrity check
├── scripts/serve.mjs                   # optional Node.js preview server
├── web/                                # everything published to GitHub Pages
│   ├── fonts/                          # bundled local fonts and licence
│   ├── app.js                          # photo booth behaviour
│   ├── icon.svg                        # site icon
│   ├── index.html                      # site entry point
│   └── style.css                       # responsive visual design
├── server.py                           # optional local-only web server
└── START-PhotoBooth.bat                # Windows local launcher
```

## Privacy and browser support

All photo processing happens locally in the visitor's browser using the Camera, Canvas, File, and Blob APIs. The static host receives normal page requests but never receives the captured or uploaded images.

Use a current version of Chrome, Edge, Firefox, or Safari. Camera behaviour depends on the browser and device; demo mode and photo uploads remain available when a camera cannot be used.

The bundled font licence is at `web/fonts/LICENSE`.
