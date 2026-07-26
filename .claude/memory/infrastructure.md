# Infrastruktúra, deploy, tooling

## index.html base href

### `__BASE_HREF__` helyőrző használata

**Probléma:** A `index.html`-ben `<base href="/">` volt hardcodeolva, de a build script a `__BASE_HREF__` szöveget kereste a `dist/index.html`-ben. Mivel a forrásban nem volt ilyen helyőrző, a csere soha nem történt meg. A GH Pages deploy-on a script URL-ek root-relatívek maradtak → 404.

**Megoldás:** `<base href="__BASE_HREF__">` a forrásban; a build script (`package.json` build) kicseréli a megfelelő base path-re (Firebase: `/`, GH Pages: `/realtime_space_travel/`).

**Forrás:** `index.html`, `package.json` build script

## Firebase Auth + CORS

### COOP/COEP headerek blokkolják a Firebase Auth popup-ot

Lásd: `firebase.md` — Auth szekció. A dev server headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) blokkolják a Firebase Auth popup kommunikációt.

## CI/CD

### GitHub Actions env változók

A `${{ vars.VITE_FIREBASE_* }}` változókat expliciten kell átadni a build step `env:` blokkjában — a GitHub Actions a `vars`-t **nem** teszi automatikusan elérhetővé env-ként.

### Firebase deploy

- `firebase.json` `database` szekció nélkül a rules soha nem deployolódik CLI-ből
- `npx firebase-tools deploy --only hosting,database` — a workflow-ben mindkettő kell

## 🎵 Zenelejátszás — egyszerre csak 1 előnézet

**Singleton minta:** a `MusicPreviewButton` modul-szintű `globalStopPreview` függvényreferenciát használ. Amikor egy új előnézet indul, a globális stop meghívja az előzőt, így garantáltan csak 1 előnézet szól egyszerre.

```ts
let globalStopPreview: (() => void) | null = null;
```

A store-beli `activePreviewId` segít nyomon követni, melyik zene játszik éppen (munkamenet-állapot, **nem perzisztálva**).

**Háttérzene a shopban:** NEM szól — `shouldPlayMusic` kizárja a `"shop"` fázist.
