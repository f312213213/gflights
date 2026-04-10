import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(import.meta.dirname, "../../dist/cli.js");

function run(...args: string[]): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf-8",
      timeout: 30_000,
    });
    return { stdout, stderr: "", code: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      code: e.status ?? 1,
    };
  }
}

describe("CLI argument parsing", () => {
  it("shows help with --help", () => {
    const { stdout } = run("--help");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("gflights");
    expect(stdout).toContain("--class");
    expect(stdout).toContain("--stops");
    expect(stdout).toContain("--json");
    expect(stdout).toContain("--all");
  });

  it("shows help with -h", () => {
    const { stdout } = run("-h");
    expect(stdout).toContain("Usage:");
  });

  it("shows help with no arguments", () => {
    const { stdout } = run();
    expect(stdout).toContain("Usage:");
  });

  it("errors with only 2 positional args", () => {
    const { stderr, code } = run("SFO", "LAX");
    expect(code).not.toBe(0);
    expect(stderr).toContain("need at least");
  });

  it("errors with unknown option", () => {
    const { stderr, code } = run("SFO", "LAX", "2026-05-15", "--bogus");
    expect(code).not.toBe(0);
    expect(stderr).toContain("Unknown option");
  });
});

describe("CLI integration", () => {
  it("returns valid JSON for a one-way query", () => {
    const { stdout, code } = run("SFO", "LAX", "2026-05-15", "--json");
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.origin).toBe("SFO");
    expect(data.destination).toBe("LAX");
    expect(data.departureDate).toBe("2026-05-15");
    expect(data.returnDate).toBeNull();
    // May be rate-limited, so check structure not values
    expect("priceUsd" in data).toBe(true);
    expect("itineraries" in data).toBe(true);
    expect("error" in data).toBe(true);
  });

  it("returns valid JSON for a round-trip query", () => {
    const { stdout, code } = run("JFK", "LHR", "2026-06-01", "2026-06-15", "--json");
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.origin).toBe("JFK");
    expect(data.destination).toBe("LHR");
    expect(data.departureDate).toBe("2026-06-01");
    expect(data.returnDate).toBe("2026-06-15");
  });
});
