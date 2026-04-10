import { buildOneWayPayload, buildRoundTripPayload, buildMultiCityPayload, type MultiCityLeg } from "./payload.js";
import { parseResponse } from "./parser.js";
import type { FlightResult, Itinerary, QueryOptions } from "./types.js";

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
 * Query a multi-city flight.
 */
export async function queryMultiCity(
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
