import { describe, it, expect } from "vitest";
import { queryOneWay, queryRoundTrip, queryBatch } from "../client.js";

// These tests hit the real Google Flights API.
// They may fail due to rate limiting (429). Use `pnpm test:e2e` to run them separately.

function skipIfRateLimited(result: { error: string | null }) {
  if (result.error?.includes("429")) {
    console.warn("Skipping assertion — rate limited by Google");
    return true;
  }
  return false;
}

describe("queryOneWay", () => {
  it("returns a valid FlightResult for a real query", async () => {
    const result = await queryOneWay("SFO", "LAX", "2026-05-15");
    expect(result.origin).toBe("SFO");
    expect(result.destination).toBe("LAX");
    expect(result.departureDate).toBe("2026-05-15");
    expect(result.returnDate).toBeNull();
    if (skipIfRateLimited(result)) return;
    expect(result.error).toBeNull();
    expect(typeof result.priceUsd).toBe("number");
    expect(result.priceUsd!).toBeGreaterThan(0);
    expect(typeof result.durationMinutes).toBe("number");
    expect(typeof result.stops).toBe("number");
    expect(result.airlines.length).toBeGreaterThan(0);
    expect(result.legs.length).toBeGreaterThan(0);
    expect(result.itineraries.length).toBeGreaterThan(0);
  });

  it("returns cheapest itinerary as the primary result", async () => {
    const result = await queryOneWay("SFO", "LAX", "2026-05-15");
    if (skipIfRateLimited(result)) return;
    if (result.itineraries.length > 1) {
      const cheapest = Math.min(...result.itineraries.map(i => i.price));
      expect(result.priceUsd).toBe(cheapest);
    }
  });

  it("returns all legs with required fields", async () => {
    const result = await queryOneWay("SFO", "LAX", "2026-05-15");
    if (skipIfRateLimited(result)) return;
    for (const leg of result.legs) {
      expect(leg.origin).toBeTruthy();
      expect(leg.destination).toBeTruthy();
      expect(leg.departureTime).toBeTruthy();
      expect(leg.arrivalTime).toBeTruthy();
      expect(typeof leg.durationMinutes).toBe("number");
      expect(leg.airline).toBeTruthy();
    }
  });

  it("handles invalid airport gracefully", async () => {
    const result = await queryOneWay("ZZZ", "YYY", "2026-05-15");
    expect(result.origin).toBe("ZZZ");
    expect(result.destination).toBe("YYY");
    // Should not throw — returns error or NO_RESULTS
    expect(result.priceUsd === null || typeof result.priceUsd === "number").toBe(true);
  });
});

describe("queryRoundTrip", () => {
  it("returns a valid FlightResult for a real query", async () => {
    const result = await queryRoundTrip("JFK", "LHR", "2026-06-01", "2026-06-15");
    expect(result.origin).toBe("JFK");
    expect(result.destination).toBe("LHR");
    expect(result.departureDate).toBe("2026-06-01");
    expect(result.returnDate).toBe("2026-06-15");
    if (skipIfRateLimited(result)) return;
    expect(result.error).toBeNull();
    expect(typeof result.priceUsd).toBe("number");
    expect(result.priceUsd!).toBeGreaterThan(0);
    expect(result.itineraries.length).toBeGreaterThan(0);
  });
});

describe("queryBatch", () => {
  it("returns results for multiple queries", async () => {
    const results = await queryBatch([
      { type: "one-way", origin: "SFO", destination: "LAX", date: "2026-05-15" },
      { type: "one-way", origin: "JFK", destination: "MIA", date: "2026-05-15" },
    ], 2000);

    expect(results).toHaveLength(2);
    expect(results[0].origin).toBe("SFO");
    expect(results[0].destination).toBe("LAX");
    expect(results[1].origin).toBe("JFK");
    expect(results[1].destination).toBe("MIA");
  }, 30_000);

  it("handles mixed one-way and round-trip queries", async () => {
    const results = await queryBatch([
      { type: "one-way", origin: "SFO", destination: "LAX", date: "2026-05-15" },
      { type: "round-trip", origin: "JFK", destination: "LHR", departureDate: "2026-06-01", returnDate: "2026-06-15" },
    ], 2000);

    expect(results).toHaveLength(2);
    expect(results[0].returnDate).toBeNull();
    expect(results[1].returnDate).toBe("2026-06-15");
  }, 30_000);

  it("returns empty array for empty input", async () => {
    const results = await queryBatch([]);
    expect(results).toEqual([]);
  });
});
