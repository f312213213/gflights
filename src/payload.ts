import { SEAT_MAP, STOPS_MAP, TRIP_MAP, type SeatClass, type TripType } from "./types.js";

export interface SelectedFlightInfo {
  originAirport: string;
  date: string;
  destinationAirport: string;
  airlineCode: string;
  flightNumber: string;
}

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

/**
 * Build a segment with a selected flight for step 2+ of multi-city.
 */
function buildSegmentWithSelection(
  origin: string,
  destination: string,
  date: string,
  selectedFlight: SelectedFlightInfo,
  maxStops?: number,
): unknown[] {
  const seg = buildSegment(origin, destination, date, maxStops);
  seg[8] = [[
    selectedFlight.originAirport,
    selectedFlight.date,
    selectedFlight.destinationAirport,
    null,
    selectedFlight.airlineCode,
    selectedFlight.flightNumber,
  ]];
  return seg;
}

/**
 * Build payload for step 2+ of a multi-city query.
 * Includes the booking token and selected flight info from previous steps.
 */
export function buildMultiCityStepPayload(
  legs: MultiCityLeg[],
  bookingToken: string,
  selectedFlights: SelectedFlightInfo[],
  options: { seatClass?: SeatClass; adults?: number; children?: number; maxStops?: number } = {},
): string {
  const seatClass = options.seatClass ?? "economy";
  const adults = options.adults ?? 1;
  const children = options.children ?? 0;

  const segments = legs.map((leg, i) => {
    if (i < selectedFlights.length) {
      // Already selected segment — include selection in [8]
      return buildSegmentWithSelection(
        leg.origin, leg.destination, leg.date,
        selectedFlights[i],
        options.maxStops,
      );
    }
    // Not yet selected — normal segment
    return buildSegment(leg.origin, leg.destination, leg.date, options.maxStops);
  });

  const filters = [
    [null, bookingToken],  // outer[0] — contains booking token
    [
      null,                           // [0]
      null,                           // [1]
      TRIP_MAP["multi-city"],         // [2] trip type
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
    0,  // sort (was 2)
    0,  // results (was 1)
    0,
    1,
  ];

  const filtersJson = JSON.stringify(filters);
  const outer = JSON.stringify([null, filtersJson]);
  return `f.req=${encodeURIComponent(outer)}`;
}
