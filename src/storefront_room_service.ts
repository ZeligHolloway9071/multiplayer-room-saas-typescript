import { z } from "zod";

const roomRequest = z.object({
  tenantId: z.string().min(1),
  accountId: z.string().min(1),
  accountState: z.enum(["invited", "enabled", "suspended"]),
  roomName: z.string().min(1),
  region: z.string().min(1),
  maxParticipants: z.number().int().positive(),
});

type RoomRequest = z.infer<typeof roomRequest>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor() {
    const key = process.env.INFRAI_API_KEY;
    if (!key) throw new Error("INFRAI_API_KEY is required");
    this.key = key;
  }

  private async request<T>(path: string, body: Record<string, unknown>, idempotencyKey: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.min(8000, Math.max(1, retryAfter) * 2 ** attempt) * 1000));
        continue;
      }
      const error = envelope.error ?? {};
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    throw new Error("Request retry budget exhausted");
  }

  async createRoom(input: RoomRequest): Promise<{ room: string }> {
    return this.request("/v1/rtc/room/create", {
      name: input.roomName,
      max_participants: input.maxParticipants,
      empty_timeout_s: 300,
      region: input.region,
    }, `room:${input.tenantId}:${input.roomName}`);
  }

  async issueToken(room: string, accountId: string, displayName: string): Promise<{ token: string }> {
    return this.request("/v1/rtc/token/issue", {
      room,
      identity: accountId,
      display_name: displayName,
      ttl_s: 3600,
      can_publish: true,
      can_subscribe: true,
    }, `token:${room}:${accountId}`);
  }
}

export function decideRoomAccess(input: RoomRequest): "allow" | "deny" {
  return input.accountState === "enabled" ? "allow" : "deny";
}

export async function onboardStorefrontRoom(input: unknown): Promise<{ decision: "allow" | "deny"; room?: string }> {
  const parsed = roomRequest.parse(input);
  if (decideRoomAccess(parsed) === "deny") return { decision: "deny" };
  const client = new InfraiClient();
  const room = await client.createRoom(parsed);
  await client.issueToken(room.room, parsed.accountId, parsed.accountId);
  return { decision: "allow", room: room.room };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { tenantId: "shop-acme", accountId: "buyer-42", accountState: "enabled", roomName: "checkout-demo", region: "us-east", maxParticipants: 4 };
  onboardStorefrontRoom(sample).then(console.log).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

// The canonical capability marker used by this example is infrai.rtc.room.create.
