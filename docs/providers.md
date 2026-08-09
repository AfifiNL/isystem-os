# Provider integrations

Provider integrations are optional boundaries. Keep them disabled until configuration, failure behavior, data handling, and webhooks are verified in an isolated environment.

| Capability | Expected provider path | Status |
|---|---|---|
| Database, authentication, storage | Supabase | Core dependency; public migration and tenant contracts are verified, while each deployment still needs project-specific review |
| Primary AI generation | Vertex AI | Candidate; explicit enablement and metering review required |
| AI fallback | Gemini API or OpenAI | Optional candidate; behavior must fail closed |
| Transactional/newsletter email | Resend | Optional candidate; sender and webhook validation required |
| Checkout/payment events | PayPal | Optional candidate; sandbox verification required |

## Integration contract

Every adapter should:

1. validate configuration at startup or feature enablement;
2. keep credentials server-side;
3. set bounded timeouts and handle provider failure without corrupting state;
4. retry only idempotent work with bounded backoff;
5. verify inbound signatures and reject replays;
6. record a provider event identifier without logging sensitive payloads;
7. expose a safe disabled state; and
8. document data categories sent outside the deployment.

## AI

Keep AI off when no provider is configured. Minimize prompts, avoid secrets and unnecessary personal data, and treat output as untrusted. Validate structured output and require user confirmation for consequential actions. Review model availability, region, pricing, retention, and terms directly before production use.

## Email

Use a verified sender, authenticated domain, least-privilege token, unsubscribe flow where required, and signed webhook. Test bounce and complaint handling with synthetic recipients on reserved domains or provider-approved sandbox mechanisms.

## Payments

Start in sandbox. Create orders server-side, verify amount and currency from trusted records, verify webhook authenticity, use idempotency, and reconcile captured state. Never trust browser-reported payment success. Do not enable a webhook verification bypass in production.

Provider interfaces and terms change. The public source and provider's current official documentation take precedence over this overview.
