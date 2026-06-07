import { describe, it, expect } from "vitest";
import { isInQuietWindow } from "./quietWindow";

describe("isInQuietWindow", () => {
  // Simple (non-wrapping) range: 08:00–20:00
  describe("non-wrapping range (from < to)", () => {
    it("returns true when now is inside the window", () => {
      expect(isInQuietWindow("08:00", "20:00", 8 * 60)).toBe(true); // exactly at from
      expect(isInQuietWindow("08:00", "20:00", 12 * 60)).toBe(true); // midday
      expect(isInQuietWindow("08:00", "20:00", 20 * 60 - 1)).toBe(true); // one minute before to
    });

    it("returns false when now is before the window", () => {
      expect(isInQuietWindow("08:00", "20:00", 7 * 60 + 59)).toBe(false);
      expect(isInQuietWindow("08:00", "20:00", 0)).toBe(false);
    });

    it("returns false when now is at or after the end of the window", () => {
      expect(isInQuietWindow("08:00", "20:00", 20 * 60)).toBe(false); // exactly at to
      expect(isInQuietWindow("08:00", "20:00", 23 * 60)).toBe(false);
    });
  });

  // Wrapping range: 22:00–08:00
  describe("midnight-wrapping range (from > to)", () => {
    it("returns true when now is after from (evening side)", () => {
      expect(isInQuietWindow("22:00", "08:00", 22 * 60)).toBe(true); // exactly at from
      expect(isInQuietWindow("22:00", "08:00", 23 * 60)).toBe(true);
      expect(isInQuietWindow("22:00", "08:00", 23 * 60 + 59)).toBe(true);
    });

    it("returns true when now is before to (early-morning side)", () => {
      expect(isInQuietWindow("22:00", "08:00", 0)).toBe(true); // midnight
      expect(isInQuietWindow("22:00", "08:00", 7 * 60 + 59)).toBe(true);
    });

    it("returns false when now is in the gap between to and from", () => {
      expect(isInQuietWindow("22:00", "08:00", 8 * 60)).toBe(false); // exactly at to
      expect(isInQuietWindow("22:00", "08:00", 12 * 60)).toBe(false);
      expect(isInQuietWindow("22:00", "08:00", 21 * 60 + 59)).toBe(false);
    });
  });

  // Edge: from === to (zero-length window — never quiet)
  it("returns false for a zero-length window (from === to)", () => {
    expect(isInQuietWindow("12:00", "12:00", 12 * 60)).toBe(false);
    expect(isInQuietWindow("00:00", "00:00", 0)).toBe(false);
  });
});
