import { SEAT_MAP, STOPS_MAP, TRIP_MAP, type QueryOptions, type SeatClass, type TripType } from "./types.js";

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
  options: QueryOptions = {},
): unknown[] {
  const stopsFilter = options.maxStops != null ? (STOPS_MAP[options.maxStops] ?? 0) : 0;

  // Time constraints: [depEarliest, depLatest, arrEarliest, arrLatest] in hours 0-24
  let timeConstraints: number[] | null = null;
  if (options.departureTime || options.arrivalTime) {
    const [depFrom, depTo] = options.departureTime ?? [0, 24];
    const [arrFrom, arrTo] = options.arrivalTime ?? [0, 24];
    timeConstraints = [depFrom, depTo, arrFrom, arrTo];
  }

  return [
    [[[origin, 0]]],                                                    // [0] departure airports
    [[[destination, 0]]],                                               // [1] arrival airports
    timeConstraints,                                                    // [2] time constraints
    stopsFilter,                                                        // [3] stops filter
    options.airlines?.length ? options.airlines.sort() : null,          // [4] airline filter
    null,                                                               // [5]
    date,                                                               // [6] travel date YYYY-MM-DD
    options.maxDuration != null ? [options.maxDuration] : null,         // [7] max duration [minutes]
    null,                                                               // [8] selected flight
    options.layoverAirports?.length ? options.layoverAirports : null,   // [9] layover airports
    null,                                                               // [10]
    null,                                                               // [11]
    options.maxLayoverDuration ?? null,                                  // [12] layover max duration (minutes)
    options.lessEmissions ? [1] : null,                                 // [13] emissions filter
    3,                                                                  // [14] hardcoded
  ];
}

/** Build the f.req payload for GetShoppingResults. */
export function buildPayload(
  segments: unknown[][],
  tripType: TripType = "round-trip",
  options: QueryOptions = {},
): string {
  const seatClass = options.seatClass ?? "economy";
  const adults = options.adults ?? 1;
  const children = options.children ?? 0;

  const maxPrice = options.maxPrice != null ? [null, options.maxPrice] : null;
  const bags = (options.checkedBags != null || options.carryOn != null)
    ? [options.checkedBags ?? 0, options.carryOn ? 1 : 0]
    : null;

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
      maxPrice,                       // [7] max price
      null,                           // [8]
      null,                           // [9]
      bags,                           // [10] bags
      null,                           // [11]
      null,                           // [12]
      segments,                       // [13] flight segments
      null,                           // [14]
      null,                           // [15]
      null,                           // [16]
      1,                              // [17] hardcoded
      null, null, null, null, null, null, null, null, null, null,  // [18-27]
      options.excludeBasicEconomy ? 1 : 0,  // [28] exclude basic economy
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
  options: QueryOptions = {},
): string {
  const segment = buildSegment(origin, destination, date, options);
  return buildPayload([segment], "one-way", options);
}

/**
 * Build payload for a round-trip query.
 */
export function buildRoundTripPayload(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  options: QueryOptions = {},
): string {
  const segOut = buildSegment(origin, destination, departureDate, options);
  const segRet = buildSegment(destination, origin, returnDate, options);
  return buildPayload([segOut, segRet], "round-trip", options);
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
  options: QueryOptions = {},
): string {
  const segments = legs.map((leg) => buildSegment(leg.origin, leg.destination, leg.date, options));
  return buildPayload(segments, "multi-city", options);
}

/**
 * Build a segment with a selected flight for step 2+ of multi-city.
 */
function buildSegmentWithSelection(
  origin: string,
  destination: string,
  date: string,
  selectedFlight: SelectedFlightInfo,
  options: QueryOptions = {},
): unknown[] {
  const seg = buildSegment(origin, destination, date, options);
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
  options: QueryOptions = {},
): string {
  const seatClass = options.seatClass ?? "economy";
  const adults = options.adults ?? 1;
  const children = options.children ?? 0;

  const maxPrice = options.maxPrice != null ? [null, options.maxPrice] : null;
  const bags = (options.checkedBags != null || options.carryOn != null)
    ? [options.checkedBags ?? 0, options.carryOn ? 1 : 0]
    : null;

  const segments = legs.map((leg, i) => {
    if (i < selectedFlights.length) {
      return buildSegmentWithSelection(
        leg.origin, leg.destination, leg.date,
        selectedFlights[i],
        options,
      );
    }
    return buildSegment(leg.origin, leg.destination, leg.date, options);
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
      maxPrice,                       // [7] max price
      null,                           // [8]
      null,                           // [9]
      bags,                           // [10] bags
      null,                           // [11]
      null,                           // [12]
      segments,                       // [13] flight segments
      null,                           // [14]
      null,                           // [15]
      null,                           // [16]
      1,                              // [17] hardcoded
      null, null, null, null, null, null, null, null, null, null,  // [18-27]
      options.excludeBasicEconomy ? 1 : 0,  // [28] exclude basic economy
    ],
    0,  // sort
    0,  // results
    0,
    1,
  ];

  const filtersJson = JSON.stringify(filters);
  const outer = JSON.stringify([null, filtersJson]);
  return `f.req=${encodeURIComponent(outer)}`;
}
