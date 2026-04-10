import type { FlightLeg, Itinerary } from "./types.js";

/**
 * Parse a single leg from the response array.
 *
 * Field indices:
 *   [3]=origin, [6]=dest, [8]=dep_time [h,m], [10]=arr_time [h,m],
 *   [11]=duration_min, [17]=aircraft, [20]=dep_date, [21]=arr_date,
 *   [22]=[airline_code, flight_num, ?, airline_name]
 */
function parseLeg(fl: unknown[]): FlightLeg | null {
  try {
    const airlineInfo = (fl.length > 22 && Array.isArray(fl[22])) ? fl[22] : [];

    const depTime = fl.length > 8 && Array.isArray(fl[8]) ? fl[8] : [];
    const arrTime = fl.length > 10 && Array.isArray(fl[10]) ? fl[10] : [];
    const depDate = fl.length > 20 && Array.isArray(fl[20]) ? fl[20] : [];
    const arrDate = fl.length > 21 && Array.isArray(fl[21]) ? fl[21] : [];

    return {
      origin: (fl.length > 3 ? String(fl[3] ?? "") : ""),
      destination: (fl.length > 6 ? String(fl[6] ?? "") : ""),
      departureTime: formatTime(depTime, depDate),
      arrivalTime: formatTime(arrTime, arrDate),
      durationMinutes: (fl.length > 11 ? Number(fl[11]) || 0 : 0),
      aircraft: (fl.length > 17 ? String(fl[17] ?? "") : ""),
      departureDate: formatDate(depDate),
      arrivalDate: formatDate(arrDate),
      airline: (airlineInfo.length > 0 ? String(airlineInfo[0] ?? "") : ""),
      flightNumber: (airlineInfo.length > 1 ? String(airlineInfo[1] ?? "") : ""),
      airlineName: (airlineInfo.length > 3 ? String(airlineInfo[3] ?? "") : ""),
    };
  } catch {
    return null;
  }
}

function formatTime(time: unknown[], date: unknown[]): string {
  if (time.length >= 2 && date.length >= 3) {
    const h = String(time[0]).padStart(2, "0");
    const m = String(time[1]).padStart(2, "0");
    const y = date[0];
    const mo = String(date[1]).padStart(2, "0");
    const d = String(date[2]).padStart(2, "0");
    return `${y}-${mo}-${d}T${h}:${m}`;
  }
  if (time.length >= 2) {
    const h = String(time[0]).padStart(2, "0");
    const m = String(time[1]).padStart(2, "0");
    return `${h}:${m}`;
  }
  return "";
}

function formatDate(date: unknown[]): string {
  if (date.length >= 3) {
    const y = date[0];
    const mo = String(date[1]).padStart(2, "0");
    const d = String(date[2]).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return "";
}

/**
 * Parse a single itinerary from the response.
 * Structure:
 *   k[0] = [carrier_code, [carrier_names], [[leg0], [leg1], ...], ...]
 *   k[1] = [[null, price_usd], booking_token]
 */
function parseItinerary(k: unknown[]): Itinerary | null {
  try {
    const priceArr = k[1] as unknown[];
    const priceInner = priceArr?.[0] as unknown[];
    const price = priceInner?.[1];
    if (price == null) return null;

    const legs: FlightLeg[] = [];
    let totalDuration = 0;

    const flightData = k[0] as unknown[];
    const legsList = flightData?.[2] as unknown[][] | undefined;

    if (Array.isArray(legsList)) {
      for (const fl of legsList) {
        if (!Array.isArray(fl)) continue;
        const leg = parseLeg(fl);
        if (leg) {
          legs.push(leg);
          totalDuration += leg.durationMinutes;
        }
      }
    }

    // Extract booking token from k[1][1]
    const bookingToken = priceArr?.[1];

    return {
      price: Number(price),
      legs,
      totalDuration,
      stops: Math.max(0, legs.length - 1),
      bookingToken: typeof bookingToken === "string" ? bookingToken : undefined,
    };
  } catch {
    return null;
  }
}

/** Parse the GetShoppingResults response into itineraries. */
export function parseResponse(text: string): Itinerary[] {
  const cleaned = text.replace(/^\)\]\}'[\s]*/, "");

  let raw: unknown[];
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return [];
  }

  let inner: unknown[];
  try {
    const first = raw[0] as unknown[];
    inner = JSON.parse(first[2] as string);
  } catch {
    return [];
  }

  const itineraries: Itinerary[] = [];

  for (const blockIdx of [2, 3]) {
    try {
      const block = inner[blockIdx] as unknown[][];
      if (!block?.[0]) continue;
      for (const entry of block[0] as unknown[][]) {
        const itinerary = parseItinerary(entry as unknown[]);
        if (itinerary) {
          itineraries.push(itinerary);
        }
      }
    } catch {
      continue;
    }
  }

  return itineraries;
}
