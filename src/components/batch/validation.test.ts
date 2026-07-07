// Unit tests for the batch (brew-log) form's client-side validation.
//
// The validator reuses the server-side Zod schema as the single source of
// truth, so these tests are the contract between the form and the API:
// every body shape the form produces must be accepted by the schema, and
// every Zod error must be mapped back into a field-level error.

import { describe, it, expect } from "vitest";

import {
  blankBatchFormState,
  defaultBrewDate,
  toCreateBody,
  validateBatchForm,
} from "./validation";

describe("defaultBrewDate / blankBatchFormState", () => {
  it("defaultBrewDate returns a yyyy-mm-dd string for today", () => {
    const d = defaultBrewDate();
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Round-trip through Date to confirm it is interpretable as a date.
    const parsed = new Date(d);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it("blankBatchFormState seeds brewDate with today and leaves the rest blank", () => {
    const s = blankBatchFormState();
    expect(s.brewDate).toBe(defaultBrewDate());
    expect(s.measuredOg).toBe("");
    expect(s.measuredFg).toBe("");
    expect(s.volumeLiters).toBe("");
    expect(s.notes).toBe("");
  });
});

describe("toCreateBody", () => {
  it("emits just the brewDate when the optional fields are blank", () => {
    const body = toCreateBody({
      brewDate: "2026-05-01",
      measuredOg: "",
      measuredFg: "",
      volumeLiters: "",
      notes: "",
    });
    expect(body).toEqual({ brewDate: "2026-05-01" });
  });

  it("includes all optional measurements when present", () => {
    const body = toCreateBody({
      brewDate: "2026-05-01",
      measuredOg: "1.054",
      measuredFg: "1.011",
      volumeLiters: "19",
      notes: "  hit numbers  ",
    });
    expect(body).toEqual({
      brewDate: "2026-05-01",
      measuredOg: 1.054,
      measuredFg: 1.011,
      volumeLiters: 19,
      notes: "hit numbers",
    });
  });

  it("omits blank notes rather than sending empty strings", () => {
    const body = toCreateBody({
      brewDate: "2026-05-01",
      measuredOg: "1.05",
      measuredFg: "",
      volumeLiters: "",
      notes: "   ",
    });
    expect(body).toEqual({ brewDate: "2026-05-01", measuredOg: 1.05 });
  });
});

describe("validateBatchForm", () => {
  it("accepts the bare-minimum payload (brew date only)", () => {
    const result = validateBatchForm({
      brewDate: "2026-05-01",
      measuredOg: "",
      measuredFg: "",
      volumeLiters: "",
      notes: "",
    });
    expect(result.ok).toBe(true);
    expect(result.body).toEqual({ brewDate: "2026-05-01" });
  });

  it("accepts a full set of measurements", () => {
    const result = validateBatchForm({
      brewDate: "2026-05-01",
      measuredOg: "1.054",
      measuredFg: "1.011",
      volumeLiters: "19",
      notes: "tight numbers",
    });
    expect(result.ok).toBe(true);
    expect(result.body).toEqual({
      brewDate: "2026-05-01",
      measuredOg: 1.054,
      measuredFg: 1.011,
      volumeLiters: 19,
      notes: "tight numbers",
    });
  });

  it("rejects a missing brew date with a friendly message", () => {
    const result = validateBatchForm({
      brewDate: "   ",
      measuredOg: "",
      measuredFg: "",
      volumeLiters: "",
      notes: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors["brewDate"]).toBe("Brew date is required.");
  });

  it("rejects a brew date that is not ISO format", () => {
    const result = validateBatchForm({
      brewDate: "5/1/2026",
      measuredOg: "",
      measuredFg: "",
      volumeLiters: "",
      notes: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors["brewDate"]).toBeTruthy();
  });

  it("rejects measuredOg below 1.0", () => {
    const result = validateBatchForm({
      brewDate: "2026-05-01",
      measuredOg: "0.99",
      measuredFg: "",
      volumeLiters: "",
      notes: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors["measuredOg"]).toBeTruthy();
  });

  it("rejects measuredOg above 1.2", () => {
    const result = validateBatchForm({
      brewDate: "2026-05-01",
      measuredOg: "1.21",
      measuredFg: "",
      volumeLiters: "",
      notes: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors["measuredOg"]).toBeTruthy();
  });

  it("rejects a non-numeric measuredFg with a friendly message", () => {
    const result = validateBatchForm({
      brewDate: "2026-05-01",
      measuredOg: "",
      measuredFg: "abc",
      volumeLiters: "",
      notes: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors["measuredFg"]).toBe("Must be a number.");
  });

  it("rejects a zero or negative volume", () => {
    const result = validateBatchForm({
      brewDate: "2026-05-01",
      measuredOg: "",
      measuredFg: "",
      volumeLiters: "0",
      notes: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors["volumeLiters"]).toBeTruthy();
  });

  it("truncates notes longer than the schema max", () => {
    const tooLong = "x".repeat(10_001);
    const result = validateBatchForm({
      brewDate: "2026-05-01",
      measuredOg: "",
      measuredFg: "",
      volumeLiters: "",
      notes: tooLong,
    });
    expect(result.ok).toBe(false);
    expect(result.errors["notes"]).toBeTruthy();
  });

  it("returns multiple errors when multiple fields are invalid", () => {
    const result = validateBatchForm({
      brewDate: "",
      measuredOg: "0.5",
      measuredFg: "abc",
      volumeLiters: "",
      notes: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors["brewDate"]).toBeTruthy();
    expect(result.errors["measuredOg"]).toBeTruthy();
    expect(result.errors["measuredFg"]).toBe("Must be a number.");
  });
});
