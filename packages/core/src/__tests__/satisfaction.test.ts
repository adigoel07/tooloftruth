import { describe, it, expect } from "vitest";
import { inferSatisfaction, SatisfactionTracker } from "../satisfaction.js";

describe("Satisfaction Inference", () => {
  it("detects positive messages", () => {
    const result = inferSatisfaction("thanks, that works great!");
    expect(result.satisfied).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("detects negative messages", () => {
    const result = inferSatisfaction("that's wrong, try again");
    expect(result.satisfied).toBe(false);
  });

  it("returns null for neutral messages", () => {
    const result = inferSatisfaction("what about the other option?");
    expect(result.satisfied).toBeNull();
  });

  it("returns null for no message", () => {
    const result = inferSatisfaction(null);
    expect(result.satisfied).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("detects strong positive", () => {
    const result = inferSatisfaction(
      "perfect, exactly what I needed. thanks!"
    );
    expect(result.satisfied).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("detects strong negative", () => {
    const result = inferSatisfaction(
      "completely wrong, that's not what I asked for. terrible"
    );
    expect(result.satisfied).toBe(false);
  });
});

describe("SatisfactionTracker", () => {
  it("tracks and infers satisfaction", () => {
    const tracker = new SatisfactionTracker();
    tracker.trackToolResult("call_1");
    const result = tracker.inferFromNextMessage("call_1", "thanks!");
    expect(result.satisfied).toBe(true);
  });

  it("returns undefined for unknown call", () => {
    const tracker = new SatisfactionTracker();
    expect(tracker.getResult("unknown")).toBeUndefined();
  });

  it("stores results", () => {
    const tracker = new SatisfactionTracker();
    tracker.trackToolResult("call_1");
    tracker.inferFromNextMessage("call_1", "nope, wrong");
    tracker.trackToolResult("call_2");
    tracker.inferFromNextMessage("call_2", "great!");

    const all = tracker.getAllResults();
    expect(all.size).toBe(2);
    expect(all.get("call_1")?.satisfied).toBe(false);
    expect(all.get("call_2")?.satisfied).toBe(true);
  });
});
