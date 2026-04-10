import { SEAT_MAP, STOPS_MAP, TRIP_MAP, type SeatClass, type TripType } from "./types.js";

/** Build a flight segment for the request payload. */
function buildSegment(
  origin: string,
  destination: string,
  date: string,
  maxStops?: number,
): unknown[] {
  const stopsFilter = maxStops != null ? (STOPS_MAP[maxStops] ?? 0) : 0;
  return [
    [[[origin, 0]]],       // [0] departure airports
    [[[destination, 0]]],  // [1] arrival airports
    null,                  // [2] time constraints
    stopsFilter,           // [3] stops filter
    null,                  // [4] airline filter
    null,                  // [5]
    date,                  // [6] travel date YYYY-MM-DD
    null,                  // [7] max duration
    null,                  // [8] selected flight
    null,                  // [9] layover airports
    null,                  // [10]
    null,                  // [11]
    null,                  // [12] layover max duration
    null,                  // [13] emissions filter
    3,                     // [14] hardcoded
  ];
}

/** Build the f.req payload for GetShoppingResults. */
export function buildPayload(
  segments: unknown[][],
  tripType: TripType = "round-trip",
  seatClass: SeatClass = "economy",
  adults: number = 1,
  children: number = 0,
): string {
  const filters = [
    [],  // outer[0]
    [
      null,                           // [0]
      null,                           // [1]
      TRIP_MAP[tripType],            // [2] trip type
      null,                           // [3]
      [],                             // [4] MUST be []
      SEAT_MAP[seatClass],           // [5] seat class
      [adults, children, 0, 0],      // [6] passengers
      null,                           // [7] max price
      null,                           // [8]
      null,                           // [9]
      null,                           // [10] bags
      null,                           // [11]
      null,                           // [12]
      segments,                       // [13] flight segments
      null,                           // [14]
      null,                           // [15]
      null,                           // [16]
      1,                              // [17] hardcoded
      null, null, null, null, null, null, null, null, null, null,  // [18-27]
      0,                              // [28] exclude basic economy
    ],
    2,  // sort by cheapest
    1,  // all results
    0,
    1,
  ];

  // Double-encode: inner filters as JSON string inside outer [null, "<json>"]
  const filtersJson = JSON.stringify(filters);
  const outer = JSON.stringify([null, filtersJson]);
  return `f.req=${encodeURIComponent(outer)}`;
}

/**
 * Build payload for a one-way query.
 */
export function buildOneWayPayload(
  origin: string,
  destination: string,
  date: string,
  options: { seatClass?: SeatClass; adults?: number; children?: number; maxStops?: number } = {},
): string {
  const segment = buildSegment(origin, destination, date, options.maxStops);
  return buildPayload(
    [segment],
    "one-way",
    options.seatClass ?? "economy",
    options.adults ?? 1,
    options.children ?? 0,
  );
}

/**
 * Build payload for a round-trip query.
 */
export function buildRoundTripPayload(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  options: { seatClass?: SeatClass; adults?: number; children?: number; maxStops?: number } = {},
): string {
  const segOut = buildSegment(origin, destination, departureDate, options.maxStops);
  const segRet = buildSegment(destination, origin, returnDate, options.maxStops);
  return buildPayload(
    [segOut, segRet],
    "round-trip",
    options.seatClass ?? "economy",
    options.adults ?? 1,
    options.children ?? 0,
  );
}

export interface MultiCityLeg {
  origin: string;
  destination: string;
  date: string;
}

/**
 * Build payload for a multi-city query.
 */
export function buildMultiCityPayload(
  legs: MultiCityLeg[],
  options: { seatClass?: SeatClass; adults?: number; children?: number; maxStops?: number } = {},
): string {
  const segments = legs.map((leg) => buildSegment(leg.origin, leg.destination, leg.date, options.maxStops));
  return buildPayload(
    segments,
    "multi-city",
    options.seatClass ?? "economy",
    options.adults ?? 1,
    options.children ?? 0,
  );
}
