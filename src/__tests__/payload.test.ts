import { describe, it, expect } from "vitest";
import { buildPayload, buildOneWayPayload, buildRoundTripPayload, buildMultiCityPayload } from "../payload.js";

describe("buildPayload", () => {
  const dummySegment = [
    [[["SFO", 0]]],
    [[["LAX", 0]]],
    null, 0, null, null,
    "2026-05-15",
    null, null, null, null, null, null, null, 3,
  ];

  it("returns a string starting with f.req=", () => {
    const result = buildPayload([dummySegment]);
    expect(result).toMatch(/^f\.req=/);
  });

  it("double-encodes the payload", () => {
    const result = buildPayload([dummySegment]);
    const encoded = result.slice("f.req=".length);
    const outer = JSON.parse(decodeURIComponent(encoded));
    // outer is [null, "<json string>"]
    expect(outer[0]).toBeNull();
    expect(typeof outer[1]).toBe("string");

    const inner = JSON.parse(outer[1]);
    expect(Array.isArray(inner)).toBe(true);
  });

  it("sets trip type correctly", () => {
    const result = buildPayload([dummySegment], "one-way");
    const inner = parseInner(result);
    expect(inner[1][2]).toBe(2); // one-way = 2
  });

  it("sets round-trip type correctly", () => {
    const result = buildPayload([dummySegment], "round-trip");
    const inner = parseInner(result);
    expect(inner[1][2]).toBe(1); // round-trip = 1
  });

  it("sets seat class to economy by default", () => {
    const result = buildPayload([dummySegment]);
    const inner = parseInner(result);
    expect(inner[1][5]).toBe(1); // economy = 1
  });

  it("sets seat class to business", () => {
    const result = buildPayload([dummySegment], "round-trip", "business");
    const inner = parseInner(result);
    expect(inner[1][5]).toBe(3); // business = 3
  });

  it("sets seat class to first", () => {
    const result = buildPayload([dummySegment], "round-trip", "first");
    const inner = parseInner(result);
    expect(inner[1][5]).toBe(4);
  });

  it("sets seat class to premium_economy", () => {
    const result = buildPayload([dummySegment], "round-trip", "premium_economy");
    const inner = parseInner(result);
    expect(inner[1][5]).toBe(2);
  });

  it("sets passengers correctly", () => {
    const result = buildPayload([dummySegment], "round-trip", "economy", 2, 1);
    const inner = parseInner(result);
    expect(inner[1][6]).toEqual([2, 1, 0, 0]);
  });

  it("defaults to 1 adult, 0 children", () => {
    const result = buildPayload([dummySegment]);
    const inner = parseInner(result);
    expect(inner[1][6]).toEqual([1, 0, 0, 0]);
  });

  it("includes segments at index 13", () => {
    const result = buildPayload([dummySegment]);
    const inner = parseInner(result);
    expect(inner[1][13]).toEqual([dummySegment]);
  });

  it("sets sort by cheapest (index 2) and all results (index 3)", () => {
    const result = buildPayload([dummySegment]);
    const inner = parseInner(result);
    expect(inner[2]).toBe(2);
    expect(inner[3]).toBe(1);
  });

  it("keeps index 4 as empty array (not null)", () => {
    const result = buildPayload([dummySegment]);
    const inner = parseInner(result);
    expect(inner[1][4]).toEqual([]);
  });

  it("sets exclude basic economy at index 28", () => {
    const result = buildPayload([dummySegment]);
    const inner = parseInner(result);
    expect(inner[1][28]).toBe(0);
  });
});

describe("buildOneWayPayload", () => {
  it("builds a valid one-way payload", () => {
    const result = buildOneWayPayload("SFO", "LAX", "2026-05-15");
    const inner = parseInner(result);
    expect(inner[1][2]).toBe(2); // one-way
    expect(inner[1][13]).toHaveLength(1); // 1 segment
  });

  it("includes origin and destination in segment", () => {
    const result = buildOneWayPayload("JFK", "LHR", "2026-06-01");
    const inner = parseInner(result);
    const segment = inner[1][13][0];
    expect(segment[0]).toEqual([[["JFK", 0]]]);
    expect(segment[1]).toEqual([[["LHR", 0]]]);
    expect(segment[6]).toBe("2026-06-01");
  });

  it("applies seat class option", () => {
    const result = buildOneWayPayload("SFO", "LAX", "2026-05-15", { seatClass: "first" });
    const inner = parseInner(result);
    expect(inner[1][5]).toBe(4);
  });

  it("applies max stops filter", () => {
    const result = buildOneWayPayload("SFO", "LAX", "2026-05-15", { maxStops: 0 });
    const inner = parseInner(result);
    const segment = inner[1][13][0];
    expect(segment[3]).toBe(1); // 0 stops → filter value 1
  });

  it("applies max stops = 1", () => {
    const result = buildOneWayPayload("SFO", "LAX", "2026-05-15", { maxStops: 1 });
    const inner = parseInner(result);
    const segment = inner[1][13][0];
    expect(segment[3]).toBe(2); // 1 stop → filter value 2
  });

  it("applies max stops = 2", () => {
    const result = buildOneWayPayload("SFO", "LAX", "2026-05-15", { maxStops: 2 });
    const inner = parseInner(result);
    const segment = inner[1][13][0];
    expect(segment[3]).toBe(3); // 2 stops → filter value 3
  });

  it("defaults stops filter to 0 (any)", () => {
    const result = buildOneWayPayload("SFO", "LAX", "2026-05-15");
    const inner = parseInner(result);
    const segment = inner[1][13][0];
    expect(segment[3]).toBe(0);
  });

  it("applies adults and children", () => {
    const result = buildOneWayPayload("SFO", "LAX", "2026-05-15", { adults: 3, children: 2 });
    const inner = parseInner(result);
    expect(inner[1][6]).toEqual([3, 2, 0, 0]);
  });
});

describe("buildRoundTripPayload", () => {
  it("builds a valid round-trip payload with 2 segments", () => {
    const result = buildRoundTripPayload("SFO", "LAX", "2026-05-15", "2026-05-20");
    const inner = parseInner(result);
    expect(inner[1][2]).toBe(1); // round-trip
    expect(inner[1][13]).toHaveLength(2); // 2 segments
  });

  it("sets outbound and return segments correctly", () => {
    const result = buildRoundTripPayload("JFK", "LHR", "2026-06-01", "2026-06-15");
    const inner = parseInner(result);
    const [outbound, ret] = inner[1][13];

    expect(outbound[0]).toEqual([[["JFK", 0]]]);
    expect(outbound[1]).toEqual([[["LHR", 0]]]);
    expect(outbound[6]).toBe("2026-06-01");

    expect(ret[0]).toEqual([[["LHR", 0]]]);
    expect(ret[1]).toEqual([[["JFK", 0]]]);
    expect(ret[6]).toBe("2026-06-15");
  });

  it("applies options to both segments", () => {
    const result = buildRoundTripPayload("SFO", "LAX", "2026-05-15", "2026-05-20", { maxStops: 0 });
    const inner = parseInner(result);
    expect(inner[1][13][0][3]).toBe(1); // outbound nonstop
    expect(inner[1][13][1][3]).toBe(1); // return nonstop
  });
});

describe("buildMultiCityPayload", () => {
  it("builds a multi-city payload with correct trip type", () => {
    const result = buildMultiCityPayload([
      { origin: "SFO", destination: "LAX", date: "2026-05-15" },
      { origin: "LAX", destination: "JFK", date: "2026-05-18" },
    ]);
    const inner = parseInner(result);
    expect(inner[1][2]).toBe(3); // multi-city = 3
    expect(inner[1][13]).toHaveLength(2);
  });

  it("builds 3-leg multi-city correctly", () => {
    const result = buildMultiCityPayload([
      { origin: "SFO", destination: "LAX", date: "2026-05-15" },
      { origin: "LAX", destination: "JFK", date: "2026-05-18" },
      { origin: "JFK", destination: "SFO", date: "2026-05-22" },
    ]);
    const inner = parseInner(result);
    expect(inner[1][13]).toHaveLength(3);

    const [seg1, seg2, seg3] = inner[1][13];
    expect(seg1[0]).toEqual([[["SFO", 0]]]);
    expect(seg1[1]).toEqual([[["LAX", 0]]]);
    expect(seg1[6]).toBe("2026-05-15");

    expect(seg2[0]).toEqual([[["LAX", 0]]]);
    expect(seg2[1]).toEqual([[["JFK", 0]]]);
    expect(seg2[6]).toBe("2026-05-18");

    expect(seg3[0]).toEqual([[["JFK", 0]]]);
    expect(seg3[1]).toEqual([[["SFO", 0]]]);
    expect(seg3[6]).toBe("2026-05-22");
  });

  it("applies options to all segments", () => {
    const result = buildMultiCityPayload(
      [
        { origin: "SFO", destination: "LAX", date: "2026-05-15" },
        { origin: "LAX", destination: "JFK", date: "2026-05-18" },
      ],
      { maxStops: 0, seatClass: "business", adults: 2 },
    );
    const inner = parseInner(result);
    expect(inner[1][5]).toBe(3); // business
    expect(inner[1][6]).toEqual([2, 0, 0, 0]); // 2 adults
    expect(inner[1][13][0][3]).toBe(1); // nonstop filter
    expect(inner[1][13][1][3]).toBe(1); // nonstop filter
  });
});

// Helper to extract the inner payload from f.req string
function parseInner(payload: string): any[] {
  const encoded = payload.slice("f.req=".length);
  const outer = JSON.parse(decodeURIComponent(encoded));
  return JSON.parse(outer[1]);
}
