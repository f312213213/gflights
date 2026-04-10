#!/usr/bin/env node

import { createInterface } from "node:readline";
import { queryOneWay, queryRoundTrip, queryMultiCity, createMultiCityStepper } from "./client.js";
import type { FlightResult, Itinerary, MultiCityResult, QueryOptions, SeatClass } from "./types.js";
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
  --select [indices]                                  Multi-city step-by-step selection (e.g. --select 0,2)
  --class <economy|premium_economy|business|first>    Seat class (default: economy)
  --adults <n>                                        Number of adults (default: 1)
  --children <n>                                      Number of children (default: 0)
  --stops <0|1|2>                                     Max stops
  --airlines <codes>                                  Comma-separated airline codes (e.g. BR,CI)
  --max-duration <min>                                Max flight duration in minutes
  --depart <from-to>                                  Departure time range in hours (e.g. 8-18)
  --arrive <from-to>                                  Arrival time range in hours (e.g. 10-22)
  --layover-airports <codes>                          Comma-separated layover airport codes
  --max-layover <min>                                 Max layover duration in minutes
  --less-emissions                                    Only show lower-emission flights
  --max-price <usd>                                   Max price in USD
  --checked-bags <n>                                  Number of checked bags to include in price
  --carry-on                                          Include carry-on in price
  --no-basic-economy                                  Exclude basic economy fares
  --all                                               Show all itineraries, not just cheapest
  --json                                              Output raw JSON
  -h, --help                                          Show this help

Multi-city step-by-step (--select):
  Without --select, --multi auto-picks the cheapest at each segment.
  With --select, you control which itinerary is chosen at each step.
  Each call replays previous selections and returns the next segment's options.

  gflights --multi --select --json ...                # get segment 1 options
  gflights --multi --select 0 --json ...              # pick seg1=0, get segment 2 options
  gflights --multi --select 0,2 --json ...            # pick seg1=0 seg2=2, get segment 3 options
  gflights --multi --select 0,2,1 --json ...          # all picked, get final result

Examples:
  gflights SFO LAX 2026-05-15
  gflights JFK LHR 2026-06-01 2026-06-15 --class business --stops 0
  gflights SFO NRT 2026-07-01 --all
  gflights --multi SFO LAX 2026-05-15 LAX JFK 2026-05-18 JFK SFO 2026-05-22
  gflights --multi --select --json TPE NRT 2026-05-01 NRT ICN 2026-05-05 ICN TPE 2026-05-09`);
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
  let select: number[] | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--multi":
        multi = true;
        break;
      case "--select": {
        // --select with optional comma-separated indices
        const next = args[i + 1];
        if (next && !next.startsWith("-")) {
          select = next.split(",").map(s => parseInt(s.trim(), 10));
          i++;
        } else {
          select = [];
        }
        break;
      }
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
      case "--airlines":
        options.airlines = args[++i].split(",").map(s => s.trim().toUpperCase());
        break;
      case "--max-duration":
        options.maxDuration = parseInt(args[++i], 10);
        break;
      case "--depart": {
        const [from, to] = args[++i].split("-").map(Number);
        options.departureTime = [from, to];
        break;
      }
      case "--arrive": {
        const [from, to] = args[++i].split("-").map(Number);
        options.arrivalTime = [from, to];
        break;
      }
      case "--layover-airports":
        options.layoverAirports = args[++i].split(",").map(s => s.trim().toUpperCase());
        break;
      case "--max-layover":
        options.maxLayoverDuration = parseInt(args[++i], 10);
        break;
      case "--less-emissions":
        options.lessEmissions = true;
        break;
      case "--max-price":
        options.maxPrice = parseInt(args[++i], 10);
        break;
      case "--checked-bags":
        options.checkedBags = parseInt(args[++i], 10);
        break;
      case "--carry-on":
        options.carryOn = true;
        break;
      case "--no-basic-economy":
        options.excludeBasicEconomy = true;
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
    return { mode: "multi-city" as const, legs, options, showAll, json, select };
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

/**
 * Run multi-city step-by-step with --select.
 * Replays previous selections, then outputs the next step's options (or final result).
 */
async function runStepSelect(legs: MultiCityLeg[], selections: number[], options: QueryOptions) {
  const stepper = createMultiCityStepper(legs, options);

  // Step 1: get first segment options (no selection needed)
  let result = await stepper.next();

  // Replay previous selections
  for (let i = 0; i < selections.length; i++) {
    if ("error" in result && result.error) {
      console.log(JSON.stringify({ error: result.error }));
      process.exit(1);
    }

    // If we already got a final result, stop
    if ("totalPrice" in result) {
      console.log(JSON.stringify(result));
      return;
    }

    result = await stepper.next(selections[i]);
  }

  // Output current state
  if ("totalPrice" in result) {
    // All segments selected — final result
    console.log(JSON.stringify(result, null, 2));
  } else if ("itineraries" in result) {
    // Next segment's options
    console.log(JSON.stringify({
      step: result.segmentIndex + 1,
      totalSteps: legs.length,
      segment: result.leg,
      itineraries: result.itineraries,
    }, null, 2));
  }
}

async function main() {
  const parsed = parseArgs(process.argv);

  if (parsed.mode === "multi-city") {
    if (parsed.select != null) {
      await runStepSelect(parsed.legs, parsed.select, parsed.options);
    } else {
      const result = await queryMultiCity(parsed.legs, parsed.options);
      if (parsed.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printMultiCityResult(result, parsed.showAll);
      }
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
