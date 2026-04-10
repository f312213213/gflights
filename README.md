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
```

### CLI Options

| Flag | Description |
|---|---|
| `--class <class>` | `economy`, `premium_economy`, `business`, `first` |
| `--adults <n>` | Number of adults (default: 1) |
| `--children <n>` | Number of children (default: 0) |
| `--stops <n>` | Max stops: `0`, `1`, or `2` |
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
