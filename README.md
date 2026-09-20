# Photography — Firebase hello world

Next.js (App Router) running on **Firebase App Hosting**, wired to
**Authentication** (Google + email/password), **Cloud Firestore** and
**Cloud Storage**.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000.

Fill `.env.local` from:

```bash
firebase apps:sdkconfig WEB
```

## Layout

| Path                    | What it is                                              |
| ----------------------- | ------------------------------------------------------- |
| `app/page.js`           | The hello-world page: auth, Firestore, Storage demos     |
| `lib/firebase.js`       | Client SDK initialization                                |
| `apphosting.yaml`       | App Hosting runtime + build env vars                     |
| `firestore.rules`       | Firestore security rules                                 |
| `storage.rules`         | Storage security rules                                   |
| `firebase.json`         | Tells the CLI where the rules files live                 |

## Deploying

App Hosting builds from GitHub: push to the connected branch and a rollout
starts automatically.

```bash
git push
```

Security rules are *not* part of that rollout — deploy them separately when
they change:

```bash
firebase deploy --only firestore:rules,storage
```
