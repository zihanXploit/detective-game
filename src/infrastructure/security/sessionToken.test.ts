import { describe, expect, it } from "vitest";
import { createSessionToken, readCookie, verifySessionToken } from "./sessionToken";

const secret = "a".repeat(32);

describe("session token", () => {
  it("round-trips a player id", () => {
    expect(verifySessionToken(createSessionToken("player-1", secret), secret)).toBe("player-1");
  });

  it("rejects a tampered id, a wrong secret and garbage", () => {
    const token = createSessionToken("player-1", secret);
    expect(verifySessionToken(token.replace("player-1", "player-2"), secret)).toBeNull();
    expect(verifySessionToken(token, "b".repeat(32))).toBeNull();
    expect(verifySessionToken("nonsense", secret)).toBeNull();
  });
});

describe("readCookie", () => {
  it("finds a cookie among several", () => {
    expect(readCookie("a=1; dt_session=abc.def; b=2", "dt_session")).toBe("abc.def");
    expect(readCookie("a=1", "dt_session")).toBeNull();
    expect(readCookie(undefined, "dt_session")).toBeNull();
  });
});
