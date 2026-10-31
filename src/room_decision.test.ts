import { strict as assert } from "node:assert";
import { decideRoomAccess } from "./storefront_room_service.ts";

const base = { tenantId: "shop-acme", accountId: "buyer-42", roomName: "checkout-demo", region: "us-east", maxParticipants: 4 };
assert.equal(decideRoomAccess({ ...base, accountState: "enabled" }), "allow");
assert.equal(decideRoomAccess({ ...base, accountState: "invited" }), "deny");
assert.equal(decideRoomAccess({ ...base, accountState: "suspended" }), "deny");
console.log("room access decision test passed");
