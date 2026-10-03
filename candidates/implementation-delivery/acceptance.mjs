import assert from "node:assert/strict";
import { mapTickets, restoreSnapshot } from "./adapter.mjs";

export function acceptance(intake) {
  const original = structuredClone(intake);
  const mapped = mapTickets(intake.tickets, intake.mappings);
  assert.deepEqual(mapped.map((t) => t.assigneeId), ["person-101", "person-102", "person-101"]);
  for (const userId of ["unknown", "", "__proto__"]) {
    assert.throws(() => mapTickets([{ id: "negative-user", userId, status: "NEW" }], intake.mappings), /Unmapped/);
  }
  const missingUser = structuredClone(intake.mappings);
  delete missingUser.users["u-02"];
  assert.throws(() => mapTickets(intake.tickets, missingUser), /Unmapped/);
  const blankUser = structuredClone(intake.mappings);
  blankUser.users["u-01"] = "";
  assert.throws(() => mapTickets(intake.tickets, blankUser), /Invalid/);
  assert.deepEqual(mapped.map((t) => t.state), ["open", "pending", "closed"]);
  assert.throws(() => mapTickets([{ id: "negative-status", userId: "u-01", status: "UNKNOWN" }], intake.mappings), /Unmapped/);
  const restored = restoreSnapshot(intake.targetBefore);
  assert.deepEqual(restored, intake.targetBefore);
  restored[0].state = "open";
  assert.deepEqual(intake, original);
  return intake.requirements.map((r) => ({ requirementId: r.id, result: "passed", kind: "local-in-memory-assertions" }));
}
