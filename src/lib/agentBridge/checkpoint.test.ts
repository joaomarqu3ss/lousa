import { describe, expect, it } from "vitest";
import { isNewTurn, TURN_IDLE_MS } from "./checkpoint";

describe("isNewTurn", () => {
  it("is a new turn on the very first mutation", () => {
    expect(isNewTurn(null, 1000)).toBe(true);
  });

  it("stays in the same turn inside the idle window", () => {
    expect(isNewTurn(1000, 1000 + TURN_IDLE_MS)).toBe(false);
  });

  it("starts a new turn after the idle window passes", () => {
    expect(isNewTurn(1000, 1001 + TURN_IDLE_MS)).toBe(true);
  });
});
