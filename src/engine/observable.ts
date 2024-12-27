export type Callback<EventName extends string> = (
  eventName: EventName,
  ...params: unknown[]
) => void;

export default class Observable<T extends readonly string[]> {
  private observers: Callback<T[number]>[];

  constructor() {
    this.observers = [];
  }

  subscribe(callback: Callback<T[number]>) {
    this.observers.push(callback);
  }

  unsubscribe(func: Callback<T[number]>) {
    this.observers.filter((f) => f !== func);
  }

  notify(eventName: T[number], ...data: unknown[]) {
    this.observers.forEach((observer) => observer(eventName, ...data));
  }
}
