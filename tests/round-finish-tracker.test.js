import { describe, expect, test } from "bun:test";
import { RoundFinishTracker } from "../src/scenes/level-builder/roundFinishTracker.ts";

describe("round finish tracker", () => {
  test("grids every marble into its team's fixed finish bay", () => {
    const tracker = new RoundFinishTracker(4, 3);

    expect(tracker.record(2)).toMatchObject({
      bayIndex: 2,
      slotIndex: 0,
      remainingMarbles: 11,
      lastMarbleRemaining: false,
    });
    expect(tracker.record(2)).toMatchObject({
      bayIndex: 2,
      slotIndex: 1,
      remainingMarbles: 10,
      lastMarbleRemaining: false,
    });

    expect(tracker.finishedMarbles).toBe(2);
    expect(tracker.eliminatedTeamIndex).toBeNull();
  });

  test("identifies the team of the single marble that does not finish", () => {
    const tracker = new RoundFinishTracker(4, 3);
    const finishOrder = [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3];

    let finalRecord;
    for (const teamIndex of finishOrder) {
      finalRecord = tracker.record(teamIndex);
    }

    expect(finalRecord).toMatchObject({
      remainingMarbles: 1,
      lastMarbleRemaining: true,
    });
    expect(tracker.eliminatedTeamIndex).toBe(1);
    expect(tracker.finishedMarbles).toBe(11);
    expect(tracker.totalMarbles).toBe(12);
  });

  test("tracks out-of-bounds marbles separately from completed marbles", () => {
    const tracker = new RoundFinishTracker(2, 2);

    tracker.record(0);
    tracker.recordLost(1);

    expect(tracker.finishedMarbles).toBe(1);
    expect(tracker.lostMarbles).toBe(1);
    expect(tracker.remainingMarbles).toBe(2);
    expect(tracker.eliminatedTeamIndex).toBe(1);

    tracker.record(0);
    expect(tracker.record(1)).toMatchObject({
      bayIndex: 1,
      slotIndex: 0,
      remainingMarbles: 0,
    });
    expect(tracker.finishedMarbles).toBe(3);
    expect(tracker.lostMarbles).toBe(1);
  });
});
