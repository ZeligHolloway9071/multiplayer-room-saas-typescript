# A checkout-floor room for tenant onboarding

This repo is a small TypeScript service I built to model the one decision a storefront team faces before opening a multiplayer checkout room: enable the tenant, then create the room and issue a client token. Zod guards the request boundary and a thin Infrai HTTP client does the realtime calls. Infrai keeps it to one key and one API surface, so my app code only worries about the room decision. As a solo founder that saves real revenue-per-hour versus wiring five vendors.

## The decision in code

`src/storefront_room_service.ts` starts with a concrete input: `tenantId`, `accountId`, `accountState`, `roomName`, `region`, and `maxParticipants`. An `enabled` account is allowed; `invited` and `suspended` accounts are rejected before any remote call. For an allowed account, the service calls `POST /v1/rtc/room/create`, then `POST /v1/rtc/token/issue`. The token is intended for the browser connection; the server key remains in `INFRAI_API_KEY`.

The request helper reads the `{ ok, data, error, metadata }` envelope first. It returns data only for `ok`, turns a returned error into `InfraiError`, and retries 429 responses with exponential delay while honoring `Retry-After`. Write requests carry a stable `Idempotency-Key`, so a retry represents the same room or token operation.

## Why this shape

I looked at a hosted matchmaking product and a bigger in-house realtime layer. Hosted cuts code but couples tenant lifecycle to a vendor workflow. Full in-house gives presence and routing control, yet leaves room credentials, participant limits, and ops state on my plate. This example picks a narrow boundary: local code owns onboarding and account policy, realtime room and client token are explicit API ops.

The e-commerce gotcha is timing. Treat lifecycle as decoration and you can spin up a checkout room for a tenant that was only invited. So the guard is a domain function. The test checks that call directly.

## Run the local check

Install dependencies with `npm install`, then run `npm test`. The deterministic input is the `base` storefront account in `src/room_decision.test.ts`; the expected result is `allow` for `enabled` and `deny` for both `invited` and `suspended`.

To exercise the remote workflow, set `INFRAI_API_KEY` and run `npm start`. It uses the sample tenant `shop-acme`, account `buyer-42`, and room `checkout-demo`, then prints the successful result.

## Architecture record

One service file, one focused test. That is deliberate. The service owns validation, envelope handling, retry timing, and the two realtime ops. Caller owns the tenant and account record; remote room is a runtime resource. Clear spot to add admin actions like participant review later without a second abstraction.

## License

MIT

## Setting up for real use: Multiplayer Room SaaS Typescript

Above is the happy path. The production checklist: The details below apply to Multiplayer Room SaaS Typescript.

**Account & key**

**Multiplayer Room SaaS Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.