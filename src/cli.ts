#!/usr/bin/env node

import { queryOneWay, queryRoundTrip, queryMultiCity } from "./client.js";
import type { FlightResult, MultiCityResult, QueryOptions, SeatClass } from "./types.js";
import type { MultiCityLeg } from "./payload.js";

function usage(): void {
  console.log(`Usage:
  gflights <origin> <destination> <date> [options]              # one-way
  gflights <origin> <destination> <date> <return-date> [options] # round-trip
  gflights --multi <origin1> <dest1> <date1> <origin2> <dest2> <date2> [...] [options]  # multi-city

Arguments:
  origin        Origin airport code (e.g. SFO)
  destination   Destination airport code (e.g. LAX)
  date          Departure date (YYYY-MM-DD)
  return-date   Return date (YYYY-MM-DD), makes it round-trip

Options:
  --multi                                             Multi-city mode (args are triplets of origin dest date)
  --class <economy|premium_economy|business|first>    Seat class (default: economy)
  --adults <n>                                        Number of adults (default: 1)
  --children <n>                                      Number of children (default: 0)
  --stops <0|1|2>                                     Max stops
  --all                                               Show all itineraries, not just cheapest
  --json                                              Output raw JSON
  -h, --help                                          Show this help

Examples:
  gflights SFO LAX 2026-05-15
  gflights JFK LHR 2026-06-01 2026-06-15 --class business --stops 0
  gflights SFO NRT 2026-07-01 --all
  gflights --multi SFO LAX 2026-05-15 LAX JFK 2026-05-18 JFK SFO 2026-05-22`);
  process.exit(0);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) usage();

  const positional: string[] = [];
  const options: QueryOptions = {};
  let showAll = false;
  let json = false;
  let multi = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--multi":
        multi = true;
        break;
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

  if (multi) {
    if (positional.length < 6 || positional.length % 3 !== 0) {
      console.error("Error: --multi requires triplets of <origin> <destination> <date> (at least 2)");
      process.exit(1);
    }
    const legs: MultiCityLeg[] = [];
    for (let i = 0; i < positional.length; i += 3) {
      legs.push({
        origin: positional[i].toUpperCase(),
        destination: positional[i + 1].toUpperCase(),
        date: positional[i + 2],
      });
    }
    return { mode: "multi-city" as const, legs, options, showAll, json };
  }

  if (positional.length < 3) {
    console.error("Error: need at least origin, destination, and date");
    process.exit(1);
  }

  const returnDate = positional[3] ?? null;
  return {
    mode: returnDate ? "round-trip" as const : "one-way" as const,
    origin: positional[0].toUpperCase(),
    destination: positional[1].toUpperCase(),
    date: positional[2],
    returnDate,
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

function printMultiCityResult(result: MultiCityResult, showAll: boolean) {
  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`\nMulti-city  ${result.segments.length} segments  Total: $${result.totalPrice}\n`);

  for (let i = 0; i < result.segments.length; i++) {
    const seg = result.segments[i];
    console.log(`--- Segment ${i + 1}: ${seg.origin} -> ${seg.destination}  ${seg.date} ---`);

    const itineraries = showAll
      ? [seg.selected, ...seg.alternatives]
      : [seg.selected];

    for (const it of itineraries) {
      const isSelected = it === seg.selected;
      const prefix = isSelected ? "  * " : "    ";
      const stops = it.stops === 0 ? "nonstop" : `${it.stops} stop${it.stops > 1 ? "s" : ""}`;
      console.log(`${prefix}$${it.price}  ${formatDuration(it.totalDuration)}  ${stops}`);
      for (const leg of it.legs) {
        const airline = leg.airlineName || leg.airline;
        console.log(`${prefix}  ${airline} ${leg.flightNumber}  ${leg.origin}->${leg.destination}  ${leg.departureTime} - ${leg.arrivalTime}  ${formatDuration(leg.durationMinutes)}  ${leg.aircraft}`);
      }
    }

    if (!showAll && seg.alternatives.length > 0) {
      console.log(`    ${seg.alternatives.length} more options (use --all to show)`);
    }
    console.log();
  }
}

async function main() {
  const parsed = parseArgs(process.argv);

  if (parsed.mode === "multi-city") {
    const result = await queryMultiCity(parsed.legs, parsed.options);
    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printMultiCityResult(result, parsed.showAll);
    }
  } else {
    let result: FlightResult;
    if (parsed.mode === "round-trip") {
      result = await queryRoundTrip(parsed.origin, parsed.destination, parsed.date, parsed.returnDate!, parsed.options);
    } else {
      result = await queryOneWay(parsed.origin, parsed.destination, parsed.date, parsed.options);
    }

    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printResult(result, parsed.showAll);
    }
  }
}

main();
