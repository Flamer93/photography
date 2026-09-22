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
| `app/admin/galleries/[id]/`      | Upload photos, set prices, tags, publish         |
| `app/contact/`                   | Contact form, writes to `enquiries`              |
| `app/api/contact/route.js`       | Emails the admin when a message arrives          |
| `app/api/deliver/route.js`       | Emails a buyer their files once paid             |
| `app/download/[orderId]/`        | Buyer download page for larger orders            |
| `components/providers.js`        | Auth and cart context                            |
| `lib/images.js`                  | Browser-side downscale + watermark               |
| `lib/db.js`                      | Firestore reads and writes                       |
| `lib/jersey.js`                  | Jersey parsing, colours, filtering                |
| `lib/vision.js`                  | Firebase AI Logic jersey detection                |

## Data model

```
galleries/{id}                 title, slug, sport, dateOf, venue, description,
                               tags[], published, defaultPriceCents, coverUrl,
                               photoCount, watermark, lowRes
galleries/{id}/photos/{id}     previewUrl, previewPath, originalPath,
                               width, height, priceCents, filename,
                               watermarked, lowRes,
                               players[{number,color}], playersSource
orders/{id}                    buyerUid, buyerEmail, buyerName, buyerPhone,
                               note, items[], subtotalCents, status, createdAt
enquiries/{id}                 name, email, phone, reason, team, message,
                               handled, createdAt
deliveries/{orderId}           items[], buyerName, orderRef, createdAt
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

## Team tags

Galleries carry a free-text `tags` array of team names. The buyer-facing
filter on `/galleries` is built from the tags that actually exist on
published galleries, so it never offers a team with nothing behind it.
Selecting several teams reads as OR. Filtering and search are done in the
browser over the already-loaded gallery list, which is fine at this scale but
would need real queries past a few hundred galleries.

## Jersey numbers and colours

Every photo can carry a `players` array -- one `{ number, color }` per player
whose jersey is readable in the frame, because most action shots have two or
three in them. Buyers then filter a gallery down to their own kid instead of
scrolling a 300-photo game.

Colours are normalised to a fixed vocabulary in `lib/jersey.js` ("royal blue"
and "royal" both become `blue`), and leading zeros are stripped from numbers
so `07` and `7` are one jersey -- except an all-zero number, since hockey
treats `0` and `00` as two different players. Without that, the filter would
offer three chips for the same thing.

Filtering is client-side over the photos already loaded for that gallery, so
there is no index or query to deploy. Picking a number **and** a colour means
"that number wearing that colour" -- one player has to satisfy both -- while
several numbers, or several colours, read as OR.

### Entering them

Type them under each photo on the admin gallery page: `12 white`, Enter. The
order does not matter and `#` is optional. The swatch row recolours the last
chip, which is the usual correction after an AI pass -- the number is normally
right and the colour is what it got wrong.

### AI detection

**Detect jerseys with AI** on the admin gallery page reads the photos that have
no jerseys on them yet; **Re-read all** does the lot and overwrites manual
entries. It runs in the admin's browser through Firebase AI Logic (Gemini
2.5 Flash), one photo at a time so the progress bar is honest and **Stop**
genuinely stops. Three consecutive failures abort the run, because a setup or
quota problem fails identically on every photo and there is no sense burning a
whole gallery to prove it.

It sends the **original**, not the preview: the tiled preview watermark sits
right over the middle of a jersey. The image is downscaled to 1280px in the
browser first -- a 24MP original is slower to upload and no more readable to
the model. Nothing is sent anywhere at upload time; this only ever runs when
the button is pressed.

**One-time setup:** open the Firebase console > Build > AI Logic > Get started
and pick the Gemini Developer API. Until that is done every call fails with a
permission error, which the panel translates into a sentence saying exactly
that. No API key goes in the bundle -- the call is authorised by the Firebase
app itself, which is the whole point of AI Logic over calling Gemini directly.

**Check its work.** The model is told to skip any number it cannot genuinely
read, but it still gets some wrong, and a wrong number sends a parent to the
wrong photos. Photos it filled in say "Read by AI" under the chips until you
edit them.

## Contact form

Anyone can create an `enquiries` document without signing in; only the admin
can read, update or delete them. The only spam brake is field-size validation
in the rules -- if it gets abused it needs a captcha or an auth requirement.

## Contact email notifications

The browser writes the message to Firestore, then posts the same payload to
`/api/contact`, which emails the admin through Resend. The order matters: the
message is stored first, so a failed email loses the notification but never
the message.

The key lives in Secret Manager, referenced from `apphosting.yaml` as
`RESEND_API_KEY` with `RUNTIME` availability only. It has no `NEXT_PUBLIC_`
prefix and must never get one -- that would ship it to the browser.

Create or rotate it with:

```bash
firebase apphosting:secrets:set RESEND_API_KEY
```

The secret must exist **before** a push that references it, or the rollout
fails. Without a key the route returns `emailed: false` and the form still
works.

Sending currently uses Resend's shared `onboarding@resend.dev` domain, which
only delivers to the address the Resend account was created with. To send
from a real address, verify a domain in Resend and set `CONTACT_FROM`.

## File delivery

Marking an order paid in Admin > Orders automatically emails the buyer their
full-resolution files. There is also a manual **Send files** / **Resend
files** button on any paid order, for retries.

**How it works:** the admin's browser (which already has Storage read access
to `originals/` per `storage.rules`) generates a download URL for each
purchased photo, gets a Firebase ID token for the signed-in admin, and posts
both to `/api/deliver`. That route verifies the token really belongs to
`NEXT_PUBLIC_ADMIN_UID` using `firebase-admin` (`verifyIdToken`, which works
on App Hosting with zero extra setup via Application Default Credentials --
no service account key needed), then emails the links through Resend.

Orders of **more than three photos** get one link to a download page
(`/download/{orderId}`) instead of a wall of per-photo links. That page
lists every purchased photo with its own Download button plus a Download
all. Three or fewer still get direct links in the email.

The page reads a `deliveries/{orderId}` document, written by the admin
browser when files are sent. That collection is publicly readable: the order
id is a 20-character random Firestore id and acts as the access secret,
the same trust model as the emailed links it contains. No buyer email is
stored in it. Deleting an order deletes its download page too.

Originals are uploaded with `contentDisposition: attachment`, which is what
makes a download link save the file instead of opening it in a tab. It has
to be set at upload time -- the HTML `download` attribute is ignored
cross-origin. **This only applies to photos uploaded after this change;**
anything already in Storage will still open in a tab rather than download.

Download all fires the saves in sequence, 500ms apart. Browsers typically
ask permission before saving several files at once -- that prompt is
expected browser behaviour, not a fault.

**Known limitation -- delivery links do not expire.** These are ordinary
Firebase Storage download URLs, which are bearer links: anyone holding the
URL can open it, the same as any shared file link. There is no built-in
expiry. Fixing that means switching to `bucket.file(path).getSignedUrl()`
with an expiry, which needs the runtime service account to hold "Service
Account Token Creator" on itself -- a real but deliberately deferred piece of
work, to avoid an IAM permission that is easy to misconfigure and hard to
debug without live testing.

**Known limitation -- Resend's shared sending domain only delivers to the
account's own address.** Until `homick.com` (or a subdomain) is verified in
Resend, delivery emails sent to any buyer other than the Resend account
owner will likely be rejected or silently dropped by Resend, same as the
contact-form notification email. Marking an order paid will still work and
the links are still generated correctly; only the automatic email to a real
buyer is blocked until a domain is verified. Once verified, set
`DELIVERY_FROM` (or reuse `CONTACT_FROM`) to an address on that domain and
this starts working for real buyers with no other changes.

If email delivery fails for any reason, the order's paid status is
unaffected -- payment truth and email delivery are tracked as two separate
fields (`status` and `filesSentAt`/`deliveryError`) precisely so a failed
send never makes a paid order look unpaid, or blocks marking it paid.

## Known limitations

- **Payments are not wired up.** Orders are created with status `pending`; the
  admin marks them paid by hand. Stripe Checkout is the intended next step.
- **Order totals are client-supplied.** A determined buyer could post an order
  with a wrong price. It is visible to the admin before anything is delivered,
  and the fix lands with payments: create the checkout session server-side from
  the prices in Firestore.
