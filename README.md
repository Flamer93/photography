# Noah Homick — Sports Photography

Game-day photo galleries with a cart and checkout, built on Next.js and
Firebase App Hosting.

Live: https://photography-web--photography-c16ff.us-central1.hosted.app

## How it works

**Buyers** browse published game galleries, open photos in a lightbox, add the
ones they want to a cart, sign in, and place an order. Previews are downscaled
and watermarked; the full-resolution originals are never served to them.

**The admin** (a single Firebase account) creates galleries, uploads photos,
sets prices per photo or per gallery, publishes galleries, and sees revenue and
orders on a dashboard.

## Local development

```bash
npm install
npm run dev
```

`.env.local` holds the Firebase web config and `NEXT_PUBLIC_ADMIN_UID`. It is
gitignored — see `.env.example` for the shape, and `apphosting.yaml` for the
deployed values.

## Layout

| Path                             | What it is                                      |
| -------------------------------- | ----------------------------------------------- |
| `app/page.js`                    | Home — hero, recent galleries, how it works      |
| `app/galleries/`                 | Gallery index and individual game galleries      |
| `app/cart/`                      | Cart, sign-in gate, checkout                     |
| `app/admin/`                     | Dashboard: galleries, orders, revenue            |
| `app/admin/galleries/[id]/`      | Upload photos, set prices, publish               |
| `components/providers.js`        | Theme, auth and cart context                     |
| `lib/images.js`                  | Browser-side downscale + watermark               |
| `lib/db.js`                      | Firestore reads and writes                       |

## Data model

```
galleries/{id}                 title, slug, sport, dateOf, venue, description,
                               published, defaultPriceCents, coverUrl, photoCount,
                               watermark, lowRes
galleries/{id}/photos/{id}     previewUrl, previewPath, originalPath,
                               width, height, priceCents, filename,
                               watermarked, lowRes
orders/{id}                    buyerUid, buyerEmail, buyerName, buyerPhone,
                               note, items[], subtotalCents, status, createdAt
```

Storage: `previews/{galleryId}/{photoId}` and `covers/{galleryId}` are
world-readable, `originals/{galleryId}/{photoId}` is admin-only.

### Preview settings

Each gallery carries `watermark` and `lowRes` flags, toggled on the admin
gallery page. They are read when a photo is uploaded, because that is when the
preview is generated -- changing a flag does not rewrite previews that already
exist. Each photo records the settings it was made with.

## Admin access

There is one admin, identified by UID. That UID appears in three places and
must match in all of them:

- `NEXT_PUBLIC_ADMIN_UID` in `.env.local` (local) and `apphosting.yaml` (deployed)
- `firestore.rules`
- `storage.rules`

The env var only hides UI. The rules are what actually enforce access.

## Deploying

Pushing to `main` triggers an App Hosting rollout. Security rules and indexes
deploy separately:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## Known limitations

- **Payments are not wired up.** Orders are created with status `pending`; the
  admin marks them paid by hand. Stripe Checkout is the intended next step.
- **Order totals are client-supplied.** A determined buyer could post an order
  with a wrong price. It is visible to the admin before anything is delivered,
  and the fix lands with payments: create the checkout session server-side from
  the prices in Firestore.
- **Purchased downloads are not automated.** Originals stay admin-only; files
  are sent manually. Automating this means a server route that verifies a paid
  order and issues a signed URL.
