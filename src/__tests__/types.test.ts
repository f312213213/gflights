import { describe, it, expect } from "vitest";
import { SEAT_MAP, TRIP_MAP, STOPS_MAP } from "../types.js";

describe("SEAT_MAP", () => {
  it("maps economy to 1", () => expect(SEAT_MAP.economy).toBe(1));
  it("maps premium_economy to 2", () => expect(SEAT_MAP.premium_economy).toBe(2));
  it("maps business to 3", () => expect(SEAT_MAP.business).toBe(3));
  it("maps first to 4", () => expect(SEAT_MAP.first).toBe(4));
});

describe("TRIP_MAP", () => {
  it("maps round-trip to 1", () => expect(TRIP_MAP["round-trip"]).toBe(1));
  it("maps one-way to 2", () => expect(TRIP_MAP["one-way"]).toBe(2));
  it("maps multi-city to 3", () => expect(TRIP_MAP["multi-city"]).toBe(3));
});

describe("STOPS_MAP", () => {
  it("maps 0 (nonstop) to filter value 1", () => expect(STOPS_MAP[0]).toBe(1));
  it("maps 1 stop to filter value 2", () => expect(STOPS_MAP[1]).toBe(2));
  it("maps 2 stops to filter value 3", () => expect(STOPS_MAP[2]).toBe(3));
});
