#!/usr/bin/env node

import { queryOneWay, queryRoundTrip } from "./client.js";
import type { FlightResult, QueryOptions, SeatClass } from "./types.js";

function usage(): void {
  console.log(`Usage:
  gflights <origin> <destination> <date> [options]              # one-way
  gflights <origin> <destination> <date> <return-date> [options] # round-trip

Arguments:
  origin        Origin airport code (e.g. SFO)
  destination   Destination airport code (e.g. LAX)
  date          Departure date (YYYY-MM-DD)
  return-date   Return date (YYYY-MM-DD), makes it round-trip

Options:
  --class <economy|premium_economy|business|first>  Seat class (default: economy)
  --adults <n>                                      Number of adults (default: 1)
  --children <n>                                    Number of children (default: 0)
  --stops <0|1|2>                                   Max stops
  --all                                             Show all itineraries, not just cheapest
  --json                                            Output raw JSON
  -h, --help                                        Show this help

Examples:
  gflights SFO LAX 2026-05-15
  gflights JFK LHR 2026-06-01 2026-06-15 --class business --stops 0
  gflights SFO NRT 2026-07-01 --all`);
  process.exit(0);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) usage();

  const positional: string[] = [];
  const options: QueryOptions = {};
  let showAll = false;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--class":
        options.seatClass = args[++i] as SeatClass;
        break;
      case "--adults":
        options.adults = parseInt(args[++i], 10);
        break;
      case "--children":
        options.children = parseInt(args[++i], 10);
        break;
      case "--stops":
        options.maxStops = parseInt(args[++i], 10) as 0 | 1 | 2;
        break;
      case "--all":
        showAll = true;
        break;
      case "--json":
        json = true;
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        positional.push(arg);
    }
  }

  if (positional.length < 3) {
    console.error("Error: need at least origin, destination, and date");
    process.exit(1);
  }

  return {
    origin: positional[0].toUpperCase(),
    destination: positional[1].toUpperCase(),
    date: positional[2],
    returnDate: positional[3] ?? null,
    options,
    showAll,
    json,
  };
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function printResult(result: FlightResult, showAll: boolean) {
  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  const trip = result.returnDate
    ? `${result.origin} → ${result.destination} → ${result.origin}`
    : `${result.origin} → ${result.destination}`;

  const dates = result.returnDate
    ? `${result.departureDate} to ${result.returnDate}`
    : result.departureDate;

  console.log(`\n${trip}  ${dates}\n`);

  const itineraries = showAll ? result.itineraries : result.itineraries.slice(0, 1);

  for (const it of itineraries) {
    const stops = it.stops === 0 ? "nonstop" : `${it.stops} stop${it.stops > 1 ? "s" : ""}`;
    console.log(`  $${it.price}  ${formatDuration(it.totalDuration)}  ${stops}`);
    for (const leg of it.legs) {
      const airline = leg.airlineName || leg.airline;
      console.log(`    ${airline} ${leg.flightNumber}  ${leg.origin}→${leg.destination}  ${leg.departureTime} - ${leg.arrivalTime}  ${formatDuration(leg.durationMinutes)}  ${leg.aircraft}`);
    }
    console.log();
  }

  if (!showAll && result.itineraries.length > 1) {
    console.log(`  ${result.itineraries.length - 1} more results (use --all to show)`);
  }
}

async function main() {
  const { origin, destination, date, returnDate, options, showAll, json } = parseArgs(process.argv);

  const result = returnDate
    ? await queryRoundTrip(origin, destination, date, returnDate, options)
    : await queryOneWay(origin, destination, date, options);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result, showAll);
  }
}

main();
