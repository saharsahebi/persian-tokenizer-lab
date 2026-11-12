# Validation record

Validation performed for the initial local delivery on 2026-11-12.

## Environment

| Component | Verified version |
| --- | --- |
| Python | 3.12.10, Windows 64-bit |
| Node.js | 24.6.0 |
| Vite | 8.3.8 |
| Browser | Microsoft Edge through Playwright (`PLAYWRIGHT_CHANNEL=msedge`) |

## Results

- **21 backend tests passed:** tokenizer and vocabulary behavior, BPE training and encoding, and API validation.
- **6 end-to-end browser tests passed** against the running Python API (five main scenarios plus a separate delayed-response regression).
- **TypeScript checking and the production frontend build passed.**
- Desktop layout at **1440 px** and mobile layout at **390 px** were inspected; neither viewport had horizontal overflow.
- No browser JavaScript errors were observed during the checked flows.

The browser tests use the real local application and API rather than mocked tokenization responses. They expect both servers to be running. The checked local copy uses the optional project-local Python runtime; a fresh Git clone uses the setup script and a virtual environment.

## Repeat the checks

Run `scripts/check.ps1` on Windows for the backend tests and frontend build. Start the application in another terminal before invoking `npm.cmd --prefix frontend run test:e2e` with `PLAYWRIGHT_CHANNEL=msedge` for installed Edge. The default Chromium channel requires `npx playwright install chromium` from the `frontend` directory once.

The GitHub Actions workflow runs backend tests and the frontend build. It does not run the browser suite automatically.
