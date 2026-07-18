# Yardshtick — Design Spec

**Chosen direction:** Clay palette · Tap-on-photo selection flow
**Product:** Camera-first mobile web app. Snap one scene → detect items → confirm & price → publish a shareable storefront → buyers reserve → seller sees live status.
**Tagline:** *Your camera becomes a sell button.*

---

## 1. Palette — "Clay"

Warm, neutral base with a single terracotta accent. Neutrals stay low-saturation; the accent carries all the color. Values are `oklch(L C H)`.

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.98 0.003 95)` | App background (warm off-white) |
| `--card` | `#fff` | Cards, sheets, top bars |
| `--ink` | `oklch(0.24 0.008 265)` | Primary text |
| `--muted` | `oklch(0.56 0.006 265)` | Secondary text, labels |
| `--faint` | `oklch(0.72 0.005 265)` | Tertiary / hint text |
| `--line` | `oklch(0.915 0.004 265)` | Borders, dividers |
| `--accent` | `oklch(0.63 0.1 45)` | Primary actions, selected state, price |
| `--accent-ink` | `oklch(0.42 0.07 45)` | Accent text on soft backgrounds |
| `--accent-soft` | `oklch(0.955 0.03 48)` | Accent fills (badges, banners, reserved pill) |
| `--warn` | `oklch(0.72 0.13 70)` | Low-confidence border |
| `--warn-soft` | `oklch(0.955 0.05 75)` | Low-confidence banner fill |

**Rules**
- Accent holds L ≈ 0.63 / C ≈ 0.1 — hue 45 is the only thing that changes vs. the other palettes (sage 155, cobalt 262). Swapping palettes = swapping hue.
- One accent, used sparingly: primary buttons, the selected/tapped state, and prices. Everything else is neutral.
- Text on `--accent` is `#fff`; secondary text on accent (button subtitles) is `rgba(255,255,255,.82)`.
- Placeholder imagery = diagonal striped fill (`repeating-linear-gradient(45deg, #e9e7e1, #f3f1ec)`) with a monospace caption. No decorative color.

---

## 2. Typography

| Role | Font | Weight |
|---|---|---|
| Wordmark, headings, prices, numbers | **Space Grotesk** | 600–700 |
| UI, body, labels | **Hanken Grotesk** | 400–600 |

- Approximation of the Yardstick Coffee house grotesk (a licensed webfont) — swap in the exact file later if desired.
- Screen titles: Space Grotesk 700, 23px, letter-spacing −0.01em.
- Prices: Space Grotesk 700, 19–26px.
- Body: Hanken Grotesk 14–15px. Labels: 11px uppercase, letter-spacing 0.12–0.14em, `--faint`.

---

## 3. Selection flow — "Tap-on-photo" (idea C)

After the scan, the captured scene is shown full-frame with detected bounding boxes overlaid. **The seller taps items directly on the photo** to include them — the most spatial, lowest-friction of the three explored flows (vs. A · Checklist, B · Gallery).

**Behavior**
- Each detected object renders as a dashed box positioned by percentage over the scene image.
- Unselected: dashed neutral border, translucent fill, label on a white chip (`--card`).
- Selected: box fills `--accent`, border turns white, label chip inverts to accent (`[data-tag="true"]`).
- A running count drives the footer CTA: **"Confirm N items →"**.
- Helper line under the photo: *"Tap the items on your scene to include them."*

**Why it wins:** the seller reasons about *the pile in front of them*, not an abstract list — selection maps 1:1 to what they see through the camera. Trade-off: dense scenes can crowd boxes, so keep hit targets ≥ 44px and let taps toggle.

---

## 4. Screen flow

Seller: `capture → scanning → detect (tap-on-photo) → confirm → publish`
Buyer: `storefront → reserve` · Seller returns to `dashboard (live)`

1. **Capture** — dark viewfinder, corner brackets, single shutter. Copy: *"Point at a room, table, closet, or pile."*
2. **Scanning** — captured scene with an accent scan-line and boxes popping in (`scanln` + `popin`). ~1.9s, GPT-4o vision caption.
3. **Detect** — tap-on-photo selection (§3).
4. **Confirm** — one card per kept item: editable title, condition segmented control (Like new / Good / Worn), comparable range + big ask price, and three price strategies — **Sell today / Fair price / Try your luck**. Low-confidence items get a warn banner (*"Low match — double-check the model"*). Delete removes.
5. **Publish** — success state, storefront link (`yard.sh/mika-8f3`), copy button, and a scannable QR (25×25 with finder patterns).
6. **Buyer storefront** — no sign-in. Accent-soft "BUYER VIEW" banner, seller header (avatar, location, item count), item rows with condition, price, and **Reserve** → flips to a **Reserved** pill. Copy: *"Reserving is a promise, not a payment. Bring cash on pickup."*
7. **Seller dashboard** — live header (blinking dot), stats (views / reserved / available), per-item status. A reservation arrives ~2.2s after opening to demo realtime.

---

## 5. Components & states

- **Buttons** — primary: `--accent` fill, white text, 15px radius, Space Grotesk 600. Secondary: `--card` + `--line` border.
- **Toggle/selected** — `[data-on="true"]` fills accent; `[data-sel="true"]` = accent ring; `[data-tag="true"]` = accent photo box.
- **Cards** — `--card`, 1px `--line`, 16–18px radius. No shadow except the phone frame and the toast.
- **Chips / pills** — 10–11px radius; reserved uses `--accent-soft` + `--accent-ink`.
- **Toast** — dark `#141416`, white text, bottom-anchored, auto-dismiss 2.4s.
- **Motion** — `popin` (badges, success), `fadeup` (cards, toast), `scanln` (scan line), `blink` (live dot). Keep short (0.28–0.4s) and functional.

---

## 6. Geometry

- Device frame 390 × 844, 46px outer radius, 36px screen radius.
- Content gutters 16–22px. Sticky footers with a 1px top divider on `--card`.
- Currency: Philippine peso (₱), grouped thousands. Prototype data is illustrative.
- Minimum tap target 44px.
