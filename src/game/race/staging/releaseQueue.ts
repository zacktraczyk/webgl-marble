import { MAX_TEAMS, MIN_TEAMS } from "./constants";

/** Fairly interleaves team queues and supports a rotated first team per round. */
export class RoundRobinReleaseQueue<T> {
  private readonly _queues: T[][];
  private _nextTeam: number;
  private _remaining: number;

  constructor(queues: readonly (readonly T[])[], startingTeam = 0) {
    if (queues.length < MIN_TEAMS || queues.length > MAX_TEAMS) {
      throw new Error(`Release queues must contain 1 to ${MAX_TEAMS} teams`);
    }
    if (!Number.isInteger(startingTeam)) {
      throw new Error("Starting team must be an integer");
    }
    this._queues = queues.map((queue) => [...queue]);
    this._nextTeam =
      ((startingTeam % queues.length) + queues.length) % queues.length;
    this._remaining = this._queues.reduce(
      (total, queue) => total + queue.length,
      0
    );
  }

  takeNext(): T | null {
    if (this._remaining === 0) {
      return null;
    }
    for (let offset = 0; offset < this._queues.length; offset++) {
      const teamIndex = (this._nextTeam + offset) % this._queues.length;
      const item = this._queues[teamIndex].shift();
      if (item !== undefined) {
        this._nextTeam = (teamIndex + 1) % this._queues.length;
        this._remaining--;
        return item;
      }
    }
    return null;
  }

  get remaining() {
    return this._remaining;
  }
}
