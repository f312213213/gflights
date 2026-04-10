export const SEAT_MAP = {
  economy: 1,
  premium_economy: 2,
  business: 3,
  first: 4,
} as const;

export type SeatClass = keyof typeof SEAT_MAP;

export const TRIP_MAP = {
  "round-trip": 1,
  "one-way": 2,
  "multi-city": 3,
} as const;

export type TripType = keyof typeof TRIP_MAP;

// Maps max_stops input to the API filter value
// 0 (nonstop) → 1, 1 stop → 2, 2 stops → 3, undefined → 0 (any)
export const STOPS_MAP: Record<number, number> = {
  0: 1,
  1: 2,
  2: 3,
};

export interface FlightLeg {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  airline: string;
  airlineName: string;
  flightNumber: string;
  aircraft: string;
  departureDate: string;
  arrivalDate: string;
}

export interface Itinerary {
  price: number;
  legs: FlightLeg[];
  totalDuration: number;
  stops: number;
  bookingToken?: string;
}

export interface MultiCitySegment {
  origin: string;
  destination: string;
  date: string;
  selected: Itinerary;
  alternatives: Itinerary[];
}

export interface MultiCityResult {
  totalPrice: number | null;
  segments: MultiCitySegment[];
  error: string | null;
}

export interface FlightResult {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  priceUsd: number | null;
  durationMinutes: number | null;
  stops: number | null;
  airlines: string[];
  legs: FlightLeg[];
  itineraries: Itinerary[];
  error: string | null;
}

export interface QueryOptions {
  seatClass?: SeatClass;
  adults?: number;
  children?: number;
  maxStops?: 0 | 1 | 2;
  /** IATA airline codes to filter by, e.g. ["BR", "CI"] */
  airlines?: string[];
  /** Max flight duration in minutes */
  maxDuration?: number;
  /** Departure time range [earliest_hour, latest_hour] (0-24) */
  departureTime?: [number, number];
  /** Arrival time range [earliest_hour, latest_hour] (0-24) */
  arrivalTime?: [number, number];
  /** Restrict layovers to specific airports, e.g. ["NRT", "ICN"] */
  layoverAirports?: string[];
  /** Max layover duration in minutes */
  maxLayoverDuration?: number;
  /** Only show flights with less-than-average emissions */
  lessEmissions?: boolean;
  /** Max price in USD */
  maxPrice?: number;
  /** Number of checked bags to include in price */
  checkedBags?: number;
  /** Include carry-on in price */
  carryOn?: boolean;
  /** Exclude basic economy fares */
  excludeBasicEconomy?: boolean;
}
