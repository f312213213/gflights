import { describe, it, expect } from "vitest";
import { parseResponse } from "../parser.js";

// Build a realistic leg array matching Google's response format
function makeLeg(overrides: {
  origin?: string;
  destination?: string;
  depHour?: number;
  depMin?: number;
  arrHour?: number;
  arrMin?: number;
  duration?: number;
  aircraft?: string;
  depDate?: [number, number, number];
  arrDate?: [number, number, number];
  airline?: string;
  flightNum?: string;
  airlineName?: string;
} = {}): unknown[] {
  const leg: unknown[] = new Array(23).fill(null);
  leg[3] = overrides.origin ?? "SFO";
  leg[6] = overrides.destination ?? "LAX";
  leg[8] = [overrides.depHour ?? 8, overrides.depMin ?? 30];
  leg[10] = [overrides.arrHour ?? 10, overrides.arrMin ?? 45];
  leg[11] = overrides.duration ?? 135;
  leg[17] = overrides.aircraft ?? "Boeing 737";
  leg[20] = overrides.depDate ?? [2026, 5, 15];
  leg[21] = overrides.arrDate ?? [2026, 5, 15];
  leg[22] = [
    overrides.airline ?? "UA",
    overrides.flightNum ?? "1234",
    null,
    overrides.airlineName ?? "United Airlines",
  ];
  return leg;
}

// Build a realistic itinerary
function makeItinerary(price: number, legs: unknown[][]): unknown[] {
  return [
    [null, null, legs],       // k[0]: flight data with legs at index 2
    [[null, price], "token"], // k[1]: price info
  ];
}

// Build a full Google Flights response string
function makeResponse(itineraries: unknown[][], blockIndex: 2 | 3 = 2): string {
  const inner: unknown[] = new Array(4).fill(null);
  inner[blockIndex] = [itineraries];
  const raw = [[null, null, JSON.stringify(inner)]];
  return `)]}'\n${JSON.stringify(raw)}`;
}

describe("parseResponse", () => {
  it("parses a single nonstop itinerary", () => {
    const leg = makeLeg();
    const itin = makeItinerary(150, [leg]);
    const text = makeResponse([itin]);

    const result = parseResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(150);
    expect(result[0].stops).toBe(0);
    expect(result[0].totalDuration).toBe(135);
    expect(result[0].legs).toHaveLength(1);
  });

  it("parses leg details correctly", () => {
    const leg = makeLeg({
      origin: "JFK",
      destination: "LHR",
      depHour: 22,
      depMin: 5,
      arrHour: 10,
      arrMin: 30,
      duration: 420,
      aircraft: "Airbus A380",
      depDate: [2026, 6, 1],
      arrDate: [2026, 6, 2],
      airline: "BA",
      flightNum: "178",
      airlineName: "British Airways",
    });
    const itin = makeItinerary(500, [leg]);
    const text = makeResponse([itin]);

    const result = parseResponse(text);
    const parsed = result[0].legs[0];
    expect(parsed.origin).toBe("JFK");
    expect(parsed.destination).toBe("LHR");
    expect(parsed.departureTime).toBe("2026-06-01T22:05");
    expect(parsed.arrivalTime).toBe("2026-06-02T10:30");
    expect(parsed.durationMinutes).toBe(420);
    expect(parsed.aircraft).toBe("Airbus A380");
    expect(parsed.departureDate).toBe("2026-06-01");
    expect(parsed.arrivalDate).toBe("2026-06-02");
    expect(parsed.airline).toBe("BA");
    expect(parsed.flightNumber).toBe("178");
    expect(parsed.airlineName).toBe("British Airways");
  });

  it("parses a multi-stop itinerary", () => {
    const leg1 = makeLeg({ origin: "SFO", destination: "DEN", duration: 150 });
    const leg2 = makeLeg({ origin: "DEN", destination: "JFK", duration: 200 });
    const itin = makeItinerary(300, [leg1, leg2]);
    const text = makeResponse([itin]);

    const result = parseResponse(text);
    expect(result[0].stops).toBe(1);
    expect(result[0].totalDuration).toBe(350);
    expect(result[0].legs).toHaveLength(2);
    expect(result[0].legs[0].origin).toBe("SFO");
    expect(result[0].legs[0].destination).toBe("DEN");
    expect(result[0].legs[1].origin).toBe("DEN");
    expect(result[0].legs[1].destination).toBe("JFK");
  });

  it("parses multiple itineraries", () => {
    const itin1 = makeItinerary(150, [makeLeg()]);
    const itin2 = makeItinerary(200, [makeLeg()]);
    const itin3 = makeItinerary(99, [makeLeg()]);
    const text = makeResponse([itin1, itin2, itin3]);

    const result = parseResponse(text);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.price)).toEqual([150, 200, 99]);
  });

  it("parses itineraries from both block indices (2 and 3)", () => {
    const inner: unknown[] = new Array(4).fill(null);
    inner[2] = [[makeItinerary(100, [makeLeg()])]];
    inner[3] = [[makeItinerary(200, [makeLeg()])]];
    const raw = [[null, null, JSON.stringify(inner)]];
    const text = `)]}'\n${JSON.stringify(raw)}`;

    const result = parseResponse(text);
    expect(result).toHaveLength(2);
    expect(result[0].price).toBe(100);
    expect(result[1].price).toBe(200);
  });

  it("returns empty array for empty response", () => {
    expect(parseResponse("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseResponse("not json at all")).toEqual([]);
  });

  it("returns empty array for valid JSON with wrong structure", () => {
    expect(parseResponse(`)]}'\\n${JSON.stringify([])}`)).toEqual([]);
    expect(parseResponse(`)]}'\\n${JSON.stringify([[null, null, "[]"]])}`)).toEqual([]);
  });

  it("strips various anti-XSSI prefixes", () => {
    const leg = makeLeg();
    const itin = makeItinerary(100, [leg]);
    const inner: unknown[] = new Array(4).fill(null);
    inner[2] = [[itin]];
    const raw = [[null, null, JSON.stringify(inner)]];
    const jsonStr = JSON.stringify(raw);

    // Different prefix formats
    expect(parseResponse(`)]}'\n${jsonStr}`)).toHaveLength(1);
    expect(parseResponse(`)]}' ${jsonStr}`)).toHaveLength(1);
    expect(parseResponse(`)]}'  \n ${jsonStr}`)).toHaveLength(1);
  });

  it("skips itineraries without a price", () => {
    const leg = makeLeg();
    const noPriceItin = [
      [null, null, [leg]],
      [[null, null], "token"], // price is null
    ];
    const validItin = makeItinerary(100, [leg]);
    const text = makeResponse([noPriceItin as unknown[], validItin]);

    const result = parseResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(100);
  });

  it("handles itineraries with empty legs list", () => {
    const itin = makeItinerary(100, []);
    const text = makeResponse([itin]);

    const result = parseResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].legs).toHaveLength(0);
    expect(result[0].stops).toBe(0);
    expect(result[0].totalDuration).toBe(0);
  });

  it("skips malformed legs gracefully", () => {
    const goodLeg = makeLeg({ origin: "SFO", destination: "LAX" });
    const badLeg = "not an array";
    const itin: unknown[] = [
      [null, null, [goodLeg, badLeg]],
      [[null, 100], "token"],
    ];
    const text = makeResponse([itin]);

    const result = parseResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].legs).toHaveLength(1);
  });

  it("handles legs with missing optional fields", () => {
    const shortLeg: unknown[] = new Array(4).fill(null);
    shortLeg[3] = "SFO"; // only origin
    const itin: unknown[] = [
      [null, null, [shortLeg]],
      [[null, 50], "token"],
    ];
    const text = makeResponse([itin]);

    const result = parseResponse(text);
    expect(result).toHaveLength(1);
    const leg = result[0].legs[0];
    expect(leg.origin).toBe("SFO");
    expect(leg.destination).toBe("");
    expect(leg.airline).toBe("");
    expect(leg.durationMinutes).toBe(0);
  });

  it("pads single-digit hours and minutes", () => {
    const leg = makeLeg({ depHour: 5, depMin: 3, arrHour: 7, arrMin: 9 });
    const itin = makeItinerary(100, [leg]);
    const text = makeResponse([itin]);

    const result = parseResponse(text);
    expect(result[0].legs[0].departureTime).toBe("2026-05-15T05:03");
    expect(result[0].legs[0].arrivalTime).toBe("2026-05-15T07:09");
  });

  it("handles 3-stop itinerary", () => {
    const legs = [
      makeLeg({ origin: "SFO", destination: "DEN", duration: 100 }),
      makeLeg({ origin: "DEN", destination: "ORD", duration: 120 }),
      makeLeg({ origin: "ORD", destination: "JFK", duration: 130 }),
      makeLeg({ origin: "JFK", destination: "LHR", duration: 400 }),
    ];
    const itin = makeItinerary(800, legs);
    const text = makeResponse([itin]);

    const result = parseResponse(text);
    expect(result[0].stops).toBe(3);
    expect(result[0].totalDuration).toBe(750);
    expect(result[0].legs).toHaveLength(4);
  });
});
