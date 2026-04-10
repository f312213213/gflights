# gflights

TypeScript client for searching Google Flights. No official API needed.

Uses Google's internal `GetShoppingResults` RPC endpoint with realistic browser headers to fetch flight prices, routes, and schedules.

## Install

### CLI (Homebrew)

```bash
brew tap f312213213/gflights https://github.com/f312213213/gflights
brew install gflights
```

### Library (npm)

```bash
pnpm add gflights
```

## CLI

```bash
# One-way
gflights SFO LAX 2026-05-15

# Round-trip
gflights JFK LHR 2026-06-01 2026-06-15

# With options
gflights JFK LHR 2026-06-01 2026-06-15 --class business --stops 0 --adults 2

# Show all results
gflights SFO LAX 2026-05-15 --all

# JSON output (pipe to jq, etc.)
gflights SFO LAX 2026-05-15 --json

# Multi-city (auto-picks cheapest at each segment)
gflights --multi SFO LAX 2026-05-15 LAX JFK 2026-05-18 JFK SFO 2026-05-22

# Multi-city step-by-step (for AI agents / programmatic use)
gflights --multi --select --json TPE NRT 2026-05-01 NRT ICN 2026-05-05  # get seg 1 options
gflights --multi --select 0 --json TPE NRT 2026-05-01 NRT ICN 2026-05-05  # pick seg1=0, get seg 2
gflights --multi --select 0,2 --json TPE NRT 2026-05-01 NRT ICN 2026-05-05  # all picked, final result

# Filter by airline
gflights TPE NRT 2026-05-01 --airlines BR,CI

# Filter by departure time (8am-6pm)
gflights TPE NRT 2026-05-01 --depart 8-18
```

### CLI Options

| Flag | Description |
|---|---|
| `--multi` | Multi-city mode (args are triplets of origin dest date) |
| `--select [indices]` | Step-by-step multi-city selection (e.g. `--select 0,2`) |
| `--class <class>` | `economy`, `premium_economy`, `business`, `first` |
| `--adults <n>` | Number of adults (default: 1) |
| `--children <n>` | Number of children (default: 0) |
| `--stops <n>` | Max stops: `0`, `1`, or `2` |
| `--airlines <codes>` | Comma-separated airline codes (e.g. `BR,CI`) |
| `--max-duration <min>` | Max flight duration in minutes |
| `--depart <from-to>` | Departure time range in hours (e.g. `8-18`) |
| `--arrive <from-to>` | Arrival time range in hours (e.g. `10-22`) |
| `--layover-airports <codes>` | Restrict layovers to specific airports |
| `--max-layover <min>` | Max layover duration in minutes |
| `--less-emissions` | Only show lower-emission flights |
| `--max-price <usd>` | Max price in USD |
| `--checked-bags <n>` | Include checked bags in price |
| `--carry-on` | Include carry-on in price |
| `--no-basic-economy` | Exclude basic economy fares |
| `--all` | Show all itineraries |
| `--json` | Output raw JSON |

## Library Usage

### One-way search

```ts
import { queryOneWay } from "gflights";

const result = await queryOneWay("SFO", "LAX", "2026-05-15");
console.log(result.priceUsd); // 65
console.log(result.airlines); // ["F9"]
```

### Round-trip search

```ts
import { queryRoundTrip } from "gflights";

const result = await queryRoundTrip("JFK", "LHR", "2026-06-01", "2026-06-15", {
  seatClass: "business",
  maxStops: 0,
  adults: 2,
});
```

### Multi-city (auto-cheapest)

```ts
import { queryMultiCity } from "gflights";

const result = await queryMultiCity([
  { origin: "TPE", destination: "NRT", date: "2026-05-01" },
  { origin: "NRT", destination: "ICN", date: "2026-05-05" },
  { origin: "ICN", destination: "TPE", date: "2026-05-09" },
]);
console.log(result.totalPrice); // 3345
console.log(result.segments);   // per-segment selected + alternatives
```

### Multi-city step-by-step

```ts
import { createMultiCityStepper } from "gflights";

const stepper = createMultiCityStepper(legs);
const step1 = await stepper.next();       // get segment 1 options
const step2 = await stepper.next(0);      // pick index 0, get segment 2 options
const step3 = await stepper.next(2);      // pick index 2, get segment 3 options
const final = await stepper.next(1);      // pick index 1, get final result
// final.totalPrice, final.segments
```

### Batch queries

```ts
import { queryBatch } from "gflights";

const results = await queryBatch([
  { type: "one-way", origin: "SFO", destination: "LAX", date: "2026-05-15" },
  {
    type: "round-trip",
    origin: "JFK",
    destination: "LHR",
    departureDate: "2026-06-01",
    returnDate: "2026-06-15",
  },
], 1500); // delay ms between requests
```

## Options

| Option | Type | Default |
|---|---|---|
| `seatClass` | `"economy" \| "premium_economy" \| "business" \| "first"` | `"economy"` |
| `adults` | `number` | `1` |
| `children` | `number` | `0` |
| `maxStops` | `0 \| 1 \| 2` | any |
| `airlines` | `string[]` | all |
| `maxDuration` | `number` (minutes) | any |
| `departureTime` | `[from, to]` (hours 0-24) | any |
| `arrivalTime` | `[from, to]` (hours 0-24) | any |
| `layoverAirports` | `string[]` | any |
| `maxLayoverDuration` | `number` (minutes) | any |
| `lessEmissions` | `boolean` | `false` |
| `maxPrice` | `number` (USD) | any |
| `checkedBags` | `number` | none |
| `carryOn` | `boolean` | `false` |
| `excludeBasicEconomy` | `boolean` | `false` |

## Result shape

```ts
interface FlightResult {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  priceUsd: number | null;
  durationMinutes: number | null;
  stops: number | null;
  airlines: string[];
  legs: FlightLeg[];
  itineraries: Itinerary[]; // all results, not just cheapest
  error: string | null;
}
```

```ts
interface MultiCityResult {
  totalPrice: number | null;
  segments: MultiCitySegment[];  // per-segment: selected itinerary + alternatives
  error: string | null;
}
```

Each `FlightLeg` includes origin, destination, departure/arrival times, duration, airline, flight number, and aircraft type.

## Caveats

- **Reverse-engineered** — relies on Google's internal API which can change without notice
- **No rate limit handling** — heavy usage may get your IP throttled or blocked
- **Not officially supported** — scraping Google may violate their Terms of Service
- **No TLS fingerprinting** — uses Node's native `fetch` with Chrome-like headers, which works today but may not forever

Best suited for personal projects, prototyping, and research.

## Requirements

Node.js 18+ (uses native `fetch`).

## License

MIT
