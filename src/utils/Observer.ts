export class Observer<T> {
  private _observers: ((data: T) => void)[] = [];

  register(observer: (data: T) => void) {
    this._observers.push(observer);
  }

  unregister(observer: (data: T) => void) {
    this._observers = this._observers.filter((o) => o !== observer);
  }

  notify(data: T) {
    this._observers.forEach((observer) => observer(data));
  }

  clear() {
    this._observers = [];
  }
}
