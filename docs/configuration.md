# Configuration

Configuration has two layers. `isystem.config.ts` is the checked-in, typed workspace/brand/module contract; `.env.example` documents runtime credentials and `.env.local` is the ignored local copy. Database workspace settings created from the typed config become the runtime overrides. Variables prefixed `NEXT_PUBLIC_` are exposed to the browser and must never contain secrets.

Run `npm run setup` to create `.env.local` safely, then `npm run doctor` to validate the starter profile without printing values or changing files.

## Core application

| Variable | Tier | Exposure | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Required | Public | Canonical application origin used for links and redirects |
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Public | Supabase anonymous key; authorization still depends on policies |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Server only | Privileged Supabase operations; never import into client code |
| `TRUSTED_CLIENT_IP_HEADER` | Recommended | Server only | Name of a custom header that the trusted reverse proxy overwrites with exactly one client IP for abuse throttling |
| `ISYSTEM_PORT` | Recommended | Host only | Loopback port published by the Docker Compose profile |
| `ISYSTEM_CPU_LIMIT` | Recommended | Host only | Docker Compose CPU ceiling; tune from the documented default after load testing |
| `ISYSTEM_MEMORY_LIMIT` | Recommended | Host only | Docker Compose memory ceiling; tune from the documented default after load testing |
| `ISYSTEM_PIDS_LIMIT` | Recommended | Host only | Docker Compose process-count ceiling |
| `ISYSTEM_SCRATCH_SIZE` | Recommended | Host only | Writable in-memory `/tmp` capacity for FFmpeg and other bounded scratch work; use whole MiB/GiB units and keep it at least 1 GiB (`1g` or `1024m`) |

## Booking management links

| Variable | Tier | Exposure | Purpose |
|---|---|---|---|
| `BOOKING_MANAGEMENT_SECRET` | Required for staged booking workflows | Server only | Independently generated secret of at least 32 UTF-8 bytes; signs all new customer-management links |
| `BOOKING_MANAGEMENT_SECRET_PREVIOUS` | Optional during rotation | Server only | Previous valid secret; verifies already-issued links but never signs new links |

For a zero-downtime rotation, first copy the old `BOOKING_MANAGEMENT_SECRET` value into `BOOKING_MANAGEMENT_SECRET_PREVIOUS`, replace the current value with a new independently generated secret of at least 32 UTF-8 bytes, and deploy both together. Remove the previous value only after every link signed with it has expired. Keep the previous variable blank outside a rotation window, and never reuse either value for another purpose.

## AI providers

| Variable | Tier | Exposure | Purpose |
|---|---|---|---|
| `AI_PROVIDER` | Optional | Server only | Explicit provider selector; blank should keep AI disabled |
| `GOOGLE_CLOUD_PROJECT` | Optional | Server only | Cloud project for Vertex AI |
| `GOOGLE_CLOUD_LOCATION` | Optional | Server only | Vertex AI location |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Optional | Server only | Service-account JSON supplied through a secret store |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | Server only | Gemini API fallback credential |
| `OPENAI_API_KEY` | Optional | Server only | Optional alternate provider credential |

## Email

| Variable | Tier | Exposure | Purpose |
|---|---|---|---|
| `NEWSLETTER_FROM_EMAIL` | Optional | Server only | Verified newsletter sender |
| `NEWSLETTER_REPLY_TO_EMAIL` | Optional | Server only | Newsletter reply address |
| `RESEND_API_KEY` | Optional | Server only | Email provider token |
| `RESEND_WEBHOOK_SECRET` | Optional | Server only | Webhook signature secret |
| `NEWSLETTER_DISPATCH_SECRET` | Optional | Server only | Protects dispatch automation |
| `LEGAL_FROM_EMAIL` | Optional | Server only | Sender for agreement workflows |
| `LEGAL_REPLY_TO_EMAIL` | Optional | Server only | Reply address for agreement workflows |

## Payments

| Variable | Tier | Exposure | Purpose |
|---|---|---|---|
| `PAYPAL_ENV` | Optional | Server only | `sandbox` during validation; `live` only after review |
| `PAYPAL_CLIENT_ID` | Optional | Server only | Server-side API client identifier |
| `PAYPAL_CLIENT_SECRET` | Optional | Server only | Server-side API secret |
| `PAYPAL_WEBHOOK_ID` | Optional | Server only | Webhook verification identifier |
| `PAYPAL_WEBHOOK_VERIFY_MODE` | Optional | Server only | Verification mode; never disable in production |
| `PAYPAL_BRAND_NAME` | Optional | Server only | Checkout display name |
| `PAYPAL_DEFAULT_CURRENCY` | Optional | Server only | Fallback currency; validate business rules |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Optional | Public | Reserved for verified browser SDK use only |

## Media runtime

| Variable | Tier | Exposure | Purpose |
|---|---|---|---|
| `FFMPEG_PATH` | Optional | Server only | Absolute path to an operator-installed FFmpeg executable; system `PATH` is used when blank |
| `FFPROBE_PATH` | Optional | Server only | Absolute path to an operator-installed FFprobe executable when it is not discoverable beside FFmpeg or on `PATH` |

## Rules

1. Keep separate credentials for development, staging, and production.
2. Do not put JSON credentials directly in committed files; use the deployment platform's secret store.
3. Rotate any secret that appears in logs, screenshots, issues, or git history.
4. Keep optional modules disabled when required variables are incomplete.
5. Fail closed on invalid configuration; do not silently substitute production credentials.
6. After changing origins, update authentication redirects, email links, CORS, webhooks, and payment return URLs together.
7. Never trust an arbitrary client-supplied forwarding header. Configure the reverse proxy to delete or overwrite the header named by `TRUSTED_CLIENT_IP_HEADER` on every request.

The final public source may add or remove variables. A release is blocked if runtime reads and this table disagree.
