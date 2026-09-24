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
| `app/quote/`                     | Shoot quote calculator                           |
| `app/api/quote/route.js`         | Prices a shoot, server-side                      |
| `lib/pricing.js`                 | Rate card and quote arithmetic                   |
| `app/api/contact/route.js`       | Emails the admin when a message arrives          |
| `app/api/deliver/route.js`       | Emails a buyer their files once paid             |
| `app/download/[orderId]/`        | Buyer download page for larger orders            |
| `components/providers.js`        | Auth and cart context                            |
| `lib/images.js`                  | Browser-side downscale + watermark               |
| `lib/db.js`                      | Firestore reads and writes                       |
| `lib/jersey.js`                  | Jersey parsing, colours, filtering                |
| `lib/vision.js`                  | Firebase AI Logic jersey detection                |
| `components/jerseyrun.js`        | The shared AI detection run loop                  |

## Data model

```
galleries/{id}                 title, slug, sport, dateOf, venue, description,
                               tags[], published, defaultPriceCents, coverUrl,
                               photoCount, watermark, lowRes,
                               jerseysTaggedAt
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

Storage rules split `create, update` from `delete`. They have to: a delete
carries no `request.resource`, so a single `allow write` guarded by a
content-type and size check denied every delete. That is why removing a photo
used to leave its original in the bucket.

### Deleting photos

**Remove** on a photo, and **Delete all photos** on a gallery, both delete the
preview and the original from Storage as well as the Firestore record. Delete
all asks for the word DELETE to be typed rather than an OK click, because it
throws away the full-resolution originals of a whole game and the only way
back is re-uploading from the camera. It also clears `photoCount`,
`jerseysTaggedAt`, and the cover if the cover was one of the deleted previews
-- a separately uploaded cover survives.

A file that is already gone is not treated as an error; a permission error is,
and surfaces rather than being swallowed, so a rules problem cannot look like
a successful delete.

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

The **Find your player** bar lives on each game gallery, not on the gallery
index -- jersey numbers only mean anything inside one game. Its search box
narrows the chips rather than the photos, because a big game carries forty
numbers and hunting through a wall of them is the thing the box is there to
save you from. Enter picks the match when there is exactly one, so typing a
number and hitting Enter is the whole interaction. A chip you have already
picked stays on screen even when it does not match the search, or there would
be no way to unpick it.

### Entering them

Type them under each photo on the admin gallery page: `12 white`, Enter. The
order does not matter and `#` is optional. The swatch row recolours the last
chip, which is the usual correction after an AI pass -- the number is normally
right and the colour is what it got wrong.

### AI detection

**Detect jerseys with AI** on the admin gallery page reads the photos that have
no jerseys on them yet; **Re-read all** does the lot and overwrites manual
entries. There is also a **Tag jerseys** button on each row of the dashboard
Galleries table, so a night of games can be tagged without opening each one;
the Jerseys column shows progress while it runs and reads "Tagged" afterwards.
Both buttons drive the same loop (`components/jerseyrun.js`) so they cannot
drift apart. Only one run happens at a time.

It runs in the admin's browser through Firebase AI Logic, on whichever Gemini
model `MODEL` in `lib/vision.js` names, one photo at a time so the progress bar
is honest and **Stop** genuinely stops. Three consecutive failures abort the run, because a setup or
quota problem fails identically on every photo and there is no sense burning a
whole gallery to prove it.

It sends the **original**, not the preview: the tiled preview watermark sits
right over the middle of a jersey. The image is downscaled to 1280px in the
browser first -- a 24MP original is slower to upload and no more readable to
the model. Nothing is sent anywhere at upload time; this only ever runs when
the button is pressed.

**One-time setup, three things**, and each one fails in a completely
different place:

1. Firebase console > Build > AI Logic > Get started, Gemini Developer API.
2. A CORS policy on the Storage bucket -- see **Storage CORS** below. Without
   it the browser cannot read the photo at all and detection fails before the
   model is ever called.
3. Gemini credit on whichever project makes the calls, at
   <https://ai.studio/projects>. With none, every call comes back 429
   "prepayment credits are depleted".
4. App Check registered on that same project, if a reCAPTCHA site key is
   configured -- see **App Check on the AI project** below.

**The model name is not forever.** Google retires them: `gemini-2.5-flash`
stopped being available to new projects mid-flight, and the API answered with a
404 naming its replacement. `MODEL` in `lib/vision.js` is the one line to
change when that happens, and the panel says so rather than making it look like
a setup problem.

Both failures are reported by the stage they happened in, so the panel says
whether it could not read the photo or could not reach the model rather than
passing on the browser's bare "Failed to fetch". No API key goes in the bundle
-- the call is authorised by the Firebase app itself, which is the whole point
of AI Logic over calling Gemini directly.

**Check its work.** The model is told to skip any number it cannot genuinely
read, but it still gets some wrong, and a wrong number sends a parent to the
wrong photos. Photos it filled in say "Read by AI" under the chips until you
edit them.

### A separate project for the AI

Gemini's free tier is reached by a project having **no billing account**. App
Hosting requires one. Both cannot be true of `photography-c16ff`, and
disabling billing on it to get the free tier takes the live site down with it
-- that is not a trade worth making.

The way round it is a second Firebase project, on the no-cost Spark plan, used
for nothing but the model call. Photos are still read from the main project's
Storage bucket; only the Gemini request moves.

1. Firebase console > **Add project**. Any name (`homick-flicks-ai`). Decline
   Analytics. Do **not** upgrade it to Blaze -- staying on Spark is the entire
   point.
2. In it: **Build > AI Logic > Get started**, choose the **Gemini Developer
   API**.
3. **Project settings > Your apps > Web**, register an app, and copy the
   config.
4. Put four of those values in `.env.local` and in `apphosting.yaml` (BUILD and
   RUNTIME, same as the other `NEXT_PUBLIC_` vars):

```
NEXT_PUBLIC_AI_FIREBASE_API_KEY
NEXT_PUBLIC_AI_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_AI_FIREBASE_PROJECT_ID
NEXT_PUBLIC_AI_FIREBASE_APP_ID
```

Leave them unset and everything runs on the main project, which is the right
answer if that project has Gemini credit. `usingSeparateAiProject` in
`lib/firebase.js` is the switch, and it is driven entirely by whether those
values exist -- there is no flag to forget to flip.

**The free tier trades privacy for the money.** Google's pricing page says
free-tier content may be used to improve their products and paid-tier content
is excluded, and what gets sent here is photographs of other people's children.
That is a real decision, not a formality. The paid alternative is credit on the
main project at <https://ai.studio/projects>, minimum $5, and no second project
at all.

### App Check on the AI project

The AI project's Firebase config ships in the browser bundle -- it has to, the
model call is made from the client. Without App Check, anyone who reads the JS
can spend that project's Gemini budget. App Check has reCAPTCHA Enterprise
score the browser and attaches a token the API checks.

`NEXT_PUBLIC_AI_RECAPTCHA_SITE_KEY` holds the site key. A site key is public by
design -- it identifies the site to reCAPTCHA and the secret half never leaves
Google -- and it belongs to **one project**, so it must be a key created in the
same project as `NEXT_PUBLIC_AI_FIREBASE_PROJECT_ID`. A key from the other
project fails with an App Check error that looks like a code bug and is not.

**Initialized on first use, not on import.** `ensureAppCheck()` in
`lib/firebase.js` runs the first time a detection call needs it. Doing it at
import would pull reCAPTCHA into every buyer's browser on every page -- slower,
and third-party scoring of visitors who are only looking at photos. Nothing
else in this app is App Check enforced, so no token needs to be sitting ready.
A failure there is logged and swallowed: the galleries, cart and checkout must
not break because reCAPTCHA had a bad day, and the AI call reports its own App
Check error properly.

**There is no reCAPTCHA `<script>` tag in this app, deliberately.**
`initializeAppCheck` loads reCAPTCHA itself. Google's generic "add this to your
`<head>`" snippet is for using reCAPTCHA directly, and pasting it in as well
just loads the library twice.

Console setup, in the AI project, **in this order**:

1. **Build > App Check > Apps**, register the web app, provider **reCAPTCHA
   Enterprise**, paste the same site key.
2. Make sure the reCAPTCHA key's allowed domains include the live host.
3. Only then **App Check > APIs > Firebase AI Logic > Enforce**. Enforcing
   before step 1 breaks every call.

For `npm run dev`: localhost cannot be scored by reCAPTCHA, so in development
the SDK prints an App Check debug token to the browser console. Paste it into
**App Check > Apps > Manage debug tokens**. Each browser gets its own, and the
whole branch is compiled out of the production bundle.

## Storage CORS

The AI pass reads photo bytes in the admin's browser, and a browser will not
hand a script bytes from another origin unless that origin says it may. The
Firebase Storage download endpoint sends no `Access-Control-Allow-Origin` on a
GET until the bucket has a CORS policy, so every read fails with the browser's
bare `TypeError: Failed to fetch`.

What makes this one worth a section: the endpoint answers the **preflight**
with `Access-Control-Allow-Origin: *`, so a quick look says CORS is fine. It
is the actual GET that carries nothing. `<img>` tags keep working throughout,
because a plain image load is not subject to the check -- which is why the
galleries look healthy while the AI button does not work.

`cors.json` in the repo root is the policy. Apply it once, from
[Cloud Shell](https://console.cloud.google.com/) (the `>_` icon, top right --
`gcloud` is already installed and signed in there):

```bash
printf '[{"origin":["https://photography-web--photography-c16ff.us-central1.hosted.app","http://localhost:3000"],"method":["GET"],"responseHeader":["Content-Type"],"maxAgeSeconds":3600}]' > cors.json && gcloud storage buckets update gs://photography-c16ff.firebasestorage.app --cors-file=cors.json
```

With `gcloud` installed locally, `gcloud storage buckets update
gs://photography-c16ff.firebasestorage.app --cors-file=cors.json` from the repo
root does the same thing.

It is a bucket setting, not part of a deploy -- `firebase deploy` does not
touch it, and it survives every rollout. Adding a new origin (a custom domain,
say) means editing `cors.json` and running the command again.

## Shoot quotes

`/quote` prices a shoot from details a buyer types in: arena, sport, roster
size, photos per player, number of games, plus a team photo and rush
turnaround. The number appears immediately, itemised, and contact details are
only asked for once there is a price on screen -- nobody wants to hand over an
email to find out a number. Sending it writes a `quotes` document; Admin >
Quotes lists them.

### The AI does not set the price

`lib/pricing.js` does, from a rate card, so the same inputs always give the
same number. That matters: a quote is a figure a customer holds you to, and a
model asked to price a job directly will say $80 one morning and $400 the next
for identical details.

The model answers the one question the card genuinely cannot -- how far the
named arena is from Midland -- and may apply a bounded adjustment
(`maxAdjustPct`) for something in the notes the card does not model, like two
teams in one visit. It is told not to adjust for players, photos, games,
travel or the extras, because the card already charges for those and doing it
twice is how a quote silently doubles.

### Calibration

The card is fitted to two prices Noah has actually named:

```
Barrie,  ~45km, 15 players, 3 each  ->  $175   (quoted and agreed)
Midland,    0km, 15 players, 3 each  ->  $135   (what he would charge)

base 30 + (15 x 7)                   =  135   local
base 30 + (15 x 7) + ((45 - 5) x 1)  =  175   Barrie
```

Those two fix the travel weight between them: the same roster costs $40 more
once it is a 45km drive, which is why the card charges $1/km beyond the first
5 rather than treating the drive as a rounding error.

They do not fix the split between the session fee and the per-player rate,
though -- both anchors are 15-player jobs, so any pair summing to $135 fits
them and they only disagree about roster size. It is weighted towards the
per-player rate on purpose: thirty players is closer to twice the work than
to half again, and the booking minimum is what protects the small end.

```bash
npm run check:pricing
```

asserts both, plus a few invariants -- the minimum holds, the model cannot
move a total more than `maxAdjustPct`, more players never costs less. Run it
after touching `RATE_CARD`, and add a case whenever a real job is agreed.

**Two points still do not pin down four levers.** Both sit close to home with
small rosters, which is where the card is least likely to be wrong; a
40-player tournament an hour away is extrapolation. Totals round to the
nearest $5, because a quote reading $187 looks like it came from a
spreadsheet.

### Why the model call is server-side

`/quote` is public. A browser-side call would put the AI project's
credentials in reach of anyone who opens devtools, and they would be spending
a real prepaid balance. The route holds `GEMINI_API_KEY` server-side and rate
limits per IP -- crude, since App Hosting can run several instances, but
enough to stop one person holding down refresh.

Without a key the page still works: it falls back to the distance table in
`lib/pricing.js` and applies no adjustment. An unrecognised location quotes
with no travel and says so, rather than inventing a drive.

```bash
firebase apphosting:secrets:set GEMINI_API_KEY
```

Create the key in AI Studio, on the same project that holds the Gemini
credit. The secret must exist before a push that references it.

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

Both emails are sent from `no-reply@homickflicks.com`, set as `CONTACT_FROM`
and `DELIVERY_FROM` in `apphosting.yaml`. Neither wants replies to the sending
address: the contact notification sets `reply_to` to whoever filled the form
in, and a delivery email sets it to `CONTACT_TO`.

**That address only works once `homickflicks.com` is verified in Resend** --
resend.com/domains, Add domain, then add the DNS records it gives you at
Hover, where the domain is registered. Until it is, Resend refuses to send to
anyone but the account owner and says so. With the variables unset the code
falls back to Resend's shared `onboarding@resend.dev`, which has exactly the
same restriction.

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

**Delivery depends on a verified sending domain.** `DELIVERY_FROM` is set to
`no-reply@homickflicks.com`; until that domain is verified in Resend, Resend
refuses to deliver to anyone but the account owner. Marking an order paid
still works and the links are still generated correctly -- only the email to
a real buyer is blocked, and the failure is reported to the admin rather than
being silent.

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
