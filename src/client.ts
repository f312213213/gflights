import { buildOneWayPayload, buildRoundTripPayload, buildMultiCityPayload, buildMultiCityStepPayload, type MultiCityLeg, type SelectedFlightInfo } from "./payload.js";
import { parseResponse } from "./parser.js";
import type { FlightResult, Itinerary, MultiCityResult, MultiCitySegment, QueryOptions } from "./types.js";

const ENDPOINT =
  "https://www.google.com/_/FlightsFrontendUi/data/" +
  "travel.frontend.flights.FlightsFrontendService/GetShoppingResults";

const HEADERS: Record<string, string> = {
  "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.google.com",
  Referer: "https://www.google.com/travel/flights",
  Connection: "close",
};

async function makeRequest(payload: string): Promise<string> {
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: HEADERS,
    body: payload,
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }
  return resp.text();
}

function bestItinerary(itineraries: Itinerary[]): Itinerary | null {
  if (itineraries.length === 0) return null;
  return itineraries.reduce((best, curr) =>
    curr.price < best.price ? curr : best,
  );
}

/**
 * Query a one-way flight.
 */
export async function queryOneWay(
  origin: string,
  destination: string,
  date: string,
  options: QueryOptions = {},
): Promise<FlightResult> {
  const payload = buildOneWayPayload(origin, destination, date, options);

  try {
    const text = await makeRequest(payload);
    const itineraries = parseResponse(text);

    if (itineraries.length === 0) {
      return {
        origin, destination, departureDate: date, returnDate: null,
        priceUsd: null, durationMinutes: null, stops: null,
        airlines: [], legs: [], itineraries: [],
        error: "NO_RESULTS",
      };
    }

    const best = bestItinerary(itineraries)!;
    return {
      origin, destination, departureDate: date, returnDate: null,
      priceUsd: best.price,
      durationMinutes: best.totalDuration,
      stops: best.stops,
      airlines: [...new Set(best.legs.map((l) => l.airline).filter(Boolean))],
      legs: best.legs,
      itineraries,
      error: null,
    };
  } catch (e) {
    return {
      origin, destination, departureDate: date, returnDate: null,
      priceUsd: null, durationMinutes: null, stops: null,
      airlines: [], legs: [], itineraries: [],
      error: String(e),
    };
  }
}

/**
 * Query a round-trip flight.
 */
export async function queryRoundTrip(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  options: QueryOptions = {},
): Promise<FlightResult> {
  const payload = buildRoundTripPayload(origin, destination, departureDate, returnDate, options);

  try {
    const text = await makeRequest(payload);
    const itineraries = parseResponse(text);

    if (itineraries.length === 0) {
      return {
        origin, destination, departureDate, returnDate,
        priceUsd: null, durationMinutes: null, stops: null,
        airlines: [], legs: [], itineraries: [],
        error: "NO_RESULTS",
      };
    }

    const best = bestItinerary(itineraries)!;
    return {
      origin, destination, departureDate, returnDate,
      priceUsd: best.price,
      durationMinutes: best.totalDuration,
      stops: best.stops,
      airlines: [...new Set(best.legs.map((l) => l.airline).filter(Boolean))],
      legs: best.legs,
      itineraries,
      error: null,
    };
  } catch (e) {
    return {
      origin, destination, departureDate, returnDate,
      priceUsd: null, durationMinutes: null, stops: null,
      airlines: [], legs: [], itineraries: [],
      error: String(e),
    };
  }
}

/**
 * Query a multi-city flight (legacy single-request mode).
 */
export async function queryMultiCityLegacy(
  legs: MultiCityLeg[],
  options: QueryOptions = {},
): Promise<FlightResult> {
  const payload = buildMultiCityPayload(legs, options);
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];

  try {
    const text = await makeRequest(payload);
    const itineraries = parseResponse(text);

    if (itineraries.length === 0) {
      return {
        origin: firstLeg.origin, destination: lastLeg.destination,
        departureDate: firstLeg.date, returnDate: null,
        priceUsd: null, durationMinutes: null, stops: null,
        airlines: [], legs: [], itineraries: [],
        error: "NO_RESULTS",
      };
    }

    const best = bestItinerary(itineraries)!;
    return {
      origin: firstLeg.origin, destination: lastLeg.destination,
      departureDate: firstLeg.date, returnDate: null,
      priceUsd: best.price,
      durationMinutes: best.totalDuration,
      stops: best.stops,
      airlines: [...new Set(best.legs.map((l) => l.airline).filter(Boolean))],
      legs: best.legs,
      itineraries,
      error: null,
    };
  } catch (e) {
    return {
      origin: firstLeg.origin, destination: lastLeg.destination,
      departureDate: firstLeg.date, returnDate: null,
      priceUsd: null, durationMinutes: null, stops: null,
      airlines: [], legs: [], itineraries: [],
      error: String(e),
    };
  }
}

/**
 * Extract SelectedFlightInfo from an itinerary's first leg.
 */
function extractSelectedFlightInfo(itinerary: Itinerary, leg: MultiCityLeg): SelectedFlightInfo {
  const firstLeg = itinerary.legs[0];
  return {
    originAirport: firstLeg.origin,
    date: leg.date,
    destinationAirport: firstLeg.destination,
    airlineCode: firstLeg.airline,
    flightNumber: firstLeg.flightNumber,
  };
}

/**
 * Query multi-city flights step-by-step, automatically picking cheapest at each step.
 * Each step depends on the previous selection's booking token.
 */
export async function queryMultiCity(
  legs: MultiCityLeg[],
  options: QueryOptions = {},
): Promise<MultiCityResult> {
  if (legs.length < 2) {
    return { totalPrice: null, segments: [], error: "Multi-city requires at least 2 legs" };
  }

  const segments: MultiCitySegment[] = [];
  const selectedFlights: SelectedFlightInfo[] = [];
  let bookingToken: string | null = null;

  try {
    for (let step = 0; step < legs.length; step++) {
      let payload: string;

      if (step === 0) {
        // First step: normal multi-city payload
        payload = buildMultiCityPayload(legs, options);
      } else {
        // Step 2+: include booking token and selected flights
        payload = buildMultiCityStepPayload(legs, bookingToken!, selectedFlights, options);
      }

      const text = await makeRequest(payload);
      const itineraries = parseResponse(text);

      if (itineraries.length === 0) {
        return {
          totalPrice: null,
          segments,
          error: `NO_RESULTS for segment ${step + 1}: ${legs[step].origin} -> ${legs[step].destination}`,
        };
      }

      // Pick cheapest
      const best = bestItinerary(itineraries)!;

      if (!best.bookingToken) {
        return {
          totalPrice: null,
          segments,
          error: `No booking token in response for segment ${step + 1}`,
        };
      }

      segments.push({
        origin: legs[step].origin,
        destination: legs[step].destination,
        date: legs[step].date,
        selected: best,
        alternatives: itineraries.filter((it) => it !== best),
      });

      // Prepare for next step
      bookingToken = best.bookingToken;
      selectedFlights.push(extractSelectedFlightInfo(best, legs[step]));

      // Small delay between requests to avoid rate limiting
      if (step < legs.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const totalPrice = segments.reduce((sum, seg) => sum + seg.selected.price, 0);
    return { totalPrice, segments, error: null };
  } catch (e) {
    return { totalPrice: null, segments, error: String(e) };
  }
}

/**
 * Step result yielded by the multi-city stepper.
 */
export interface MultiCityStepResult {
  /** Which segment index (0-based) this result is for */
  segmentIndex: number;
  leg: MultiCityLeg;
  itineraries: Itinerary[];
}

/**
 * Create a manual multi-city stepper where the caller chooses which itinerary to select at each step.
 *
 * Usage:
 *   const stepper = createMultiCityStepper(legs, options);
 *   let result = await stepper.next();       // get segment 1 options
 *   result = await stepper.next(chosenIdx);  // select itinerary, get segment 2 options
 *   ...
 */
export function createMultiCityStepper(
  legs: MultiCityLeg[],
  options: QueryOptions = {},
): { next: (selectedIndex?: number) => Promise<MultiCityStepResult | MultiCityResult> } {
  let step = 0;
  let lastItineraries: Itinerary[] = [];
  const selectedFlights: SelectedFlightInfo[] = [];
  const segments: MultiCitySegment[] = [];
  let bookingToken: string | null = null;

  return {
    async next(selectedIndex?: number): Promise<MultiCityStepResult | MultiCityResult> {
      // If we got a selection from previous step, record it
      if (step > 0 && selectedIndex != null) {
        const chosen = lastItineraries[selectedIndex];
        if (!chosen) {
          return { totalPrice: null, segments, error: `Invalid selection index ${selectedIndex}` };
        }
        if (!chosen.bookingToken) {
          return { totalPrice: null, segments, error: `No booking token for selected itinerary` };
        }

        const prevLeg = legs[step - 1];
        segments.push({
          origin: prevLeg.origin,
          destination: prevLeg.destination,
          date: prevLeg.date,
          selected: chosen,
          alternatives: lastItineraries.filter((_, i) => i !== selectedIndex),
        });

        bookingToken = chosen.bookingToken;
        selectedFlights.push(extractSelectedFlightInfo(chosen, prevLeg));
      }

      // If all segments are done, return final result
      if (step >= legs.length) {
        const totalPrice = segments.reduce((sum, seg) => sum + seg.selected.price, 0);
        return { totalPrice, segments, error: null } as MultiCityResult;
      }

      // Make request for current step
      let payload: string;
      if (step === 0) {
        payload = buildMultiCityPayload(legs, options);
      } else {
        payload = buildMultiCityStepPayload(legs, bookingToken!, selectedFlights, options);
      }

      const text = await makeRequest(payload);
      const itineraries = parseResponse(text);
      lastItineraries = itineraries;

      const result: MultiCityStepResult = {
        segmentIndex: step,
        leg: legs[step],
        itineraries,
      };

      step++;
      return result;
    },
  };
}

/**
 * Run a batch of queries with delay between each.
 */
export async function queryBatch(
  queries: Array<
    | { type: "one-way"; origin: string; destination: string; date: string } & QueryOptions
    | { type?: "round-trip"; origin: string; destination: string; departureDate: string; returnDate: string } & QueryOptions
  >,
  delay: number = 1500,
): Promise<FlightResult[]> {
  const results: FlightResult[] = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    if (q.type === "one-way") {
      results.push(await queryOneWay(q.origin, q.destination, q.date, q));
    } else {
      const rt = q as { origin: string; destination: string; departureDate: string; returnDate: string } & QueryOptions;
      results.push(await queryRoundTrip(rt.origin, rt.destination, rt.departureDate, rt.returnDate, rt));
    }
    if (i < queries.length - 1 && delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return results;
}
