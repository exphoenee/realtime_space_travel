# Privacy Notice — draft (English, informational)

> **Status:** AI draft → **GDPR/legal review required**
> **Related plan:** `plans/023-gdpr-compliance.md`
> **Last updated:** 2026-08-06
> **Version:** `v0.1-draft`
>
> ⚠️ **This document is NOT legal advice.** It is a technical/organizational draft that must be finalized and approved by a data protection expert / lawyer before go-live (`plans/024-stripe-go-live.md`). Uncertain points are marked `⚠️ [legal confirmation required]`; company-specific data appears as `{{...}}` placeholders.
>
> **Authoritative language:** the **Hungarian** version is authoritative. This English text is for information only; in case of any discrepancy, the Hungarian version prevails (mirrors the in-app `legal.authoritativeNote`).

---

## 1. The data controller

| Field | Value |
|---|---|
| Controller name | `{{ev_nev}}` (sole proprietor / egyéni vállalkozó) |
| Registered seat | `{{szekhely}}` (Hungary) |
| Tax number | `{{adoszam}}` |
| Sole proprietor registration no. | `{{ev_nyilvantartasi_szam}}` |
| Contact e-mail | `{{kapcsolat_email}}` |
| Website | `{{weboldal_url}}` |

**Data Protection Officer (DPO):** `{{dpo}}` — **likely not required** for this processing (reasoning: `dpo-ertekeles.md`). ⚠️ [legal confirmation required].

---

## 2. The service in brief

**Realtime Space Travel** is a browser-based, real-time space travel simulator game. It uses **webcam face detection** to monitor the player's attention (processing happens entirely locally in the browser — see section 8), and offers **real-money** purchases of virtual credit packs.

---

## 3. Data categories, purposes and legal bases

| # | Category | Data | Purpose | Legal basis (GDPR Art. 6) |
|---|---|---|---|---|
| 1 | Account / profile | display name, avatar (Google), nickname, provider, timestamps | Login, identification, saving progress | **6(1)(b)** — contract |
| 2 | Game settings | active ship/music, volume, difficulty, language, camera consent state | Providing the service, preferences | **6(1)(b)** — contract |
| 3 | Wallet / inventory / purchases | credit balance, owned content, purchase history | Purchases and entitlements | **6(1)(b)** — contract |
| 4 | Stats / mission log | records, "Wall of Shame" log | Records / gameplay log | **6(1)(b)** / ⚠️ [possibly 6(1)(f)] |
| 5 | Public profile | nickname, online status | Friend searchability, presence | **6(1)(a)** — consent ⚠️ |
| 6 | Social graph | friends, requests, notifications, chats | Social features | **6(1)(a)** — consent ⚠️ |
| 7 | Device identifier | `deviceId`, `device_map` | Guest continuity, guest→Google merge | **6(1)(f)** — legitimate interest |
| 8 | Webcam face detection | camera image — **local only**, never stored/transmitted | Attention monitoring (core mechanic) | **6(1)(a)** — explicit consent (section 8) |
| 9 | Anti-cheat, stability | technical events | Service protection and reliability | **6(1)(f)** — legitimate interest |
| 10 | Payment data | **Stripe hosted checkout** — card data never touches the app | Real-money purchase | **6(1)(b)** — contract |

---

## 4. Processors and recipients

- **Google (Firebase)** — processor: Realtime Database, Firebase Authentication, Firebase Hosting.
- **Stripe** — payment controller/processor: card data on the **hosted** checkout; only the transaction id (`session_id`) returns to the app.
- **`{{szamlazo}}`** — invoicing processor if introduced (`plans/022-stripe-tax-compliance.md`).

⚠️ [legal confirmation required]: exact legal entities and DPA references.

---

## 5. International transfers

Firebase/Google and Stripe infrastructure partly operates **outside the EU (USA)**. Transfer basis: **EU–US Data Privacy Framework** and/or **Standard Contractual Clauses (SCC)**. ⚠️ [legal confirmation required] — legally evolving area.

---

## 6. Retention

- Account / profile / settings / game state: until account deletion (Art. 17).
- Purchase / invoicing data: for the statutory (tax/accounting) retention period — ⚠️ [legal/accounting confirmation].
- Webcam image: **not stored** (discarded immediately after processing).

---

## 7. Your rights

Access (15), rectification (16), erasure (17), portability (20), restriction (18), objection (21), and withdrawal of consent (7).

**In-app:**
- **Access + portability:** Settings → Privacy / GDPR → **"Export my data"** (JSON download).
- **Erasure:** Settings → Privacy / GDPR → **"Delete account and data"** (with confirmation).
- **Rectification:** edit nickname in Settings.
- **Withdraw camera consent:** in Settings anytime.

⚠️ Limitation (`plans/023-gdpr-compliance.md` 4.3): full erasure of content in other users' data (e.g. sent chat messages) may require server-side processing; until available, request via `{{kapcsolat_email}}`. Response deadline: up to 1 month.

---

## 8. Webcam and face detection — highlighted section

- Camera image is processed **entirely locally in your browser** (TensorFlow.js / MediaPipe).
- **No image, video or facial keypoint ever leaves your browser**, is stored or transmitted.
- Requires **explicit consent**, revocable anytime in Settings (`plans/014-camera-consent.md`).
- Only the **consent state** is stored, never the camera image.

> The controller's position: **likely no special-category (biometric) processing under Art. 9** arises — see `webkamera-9cikk-allaspont.md`. ⚠️ [legal confirmation required].

---

## 9. Cookies / storage

Only **functional** `localStorage` (game state, language, pending purchase). **No** analytics or advertising tracking. ⚠️ [legal confirmation]: a consent banner is **likely not required** (ePrivacy).

---

## 10. Age

Purchases require the **age of majority** (18) or parental consent. ⚠️ [legal confirmation]: application of the child-consent age (GDPR Art. 8).

---

## 11. Complaints

You may lodge a complaint with the Hungarian supervisory authority **NAIH** (`https://naih.hu`) or go to court.

---

## 12. Changes

The controller may amend this notice; the current version and effective date appear in the header and in-app (`legal.lastUpdated`).
