declare module 'rxjs' {
  export class BehaviorSubject<T> {
    constructor(initialValue: T);
    next(value: T): void;
    asObservable(): Observable<T>;
    getValue(): T;
    complete(): void;
    value: T; // Add value property to fix TypeScript errors
  }

  export class Subject<T> {
    constructor();
    next(value: T): void;
    asObservable(): Observable<T>;
    complete(): void;
  }

  export class Observable<T> {
    subscribe(observer: Observer<T> | ((value: T) => void)): Subscription;
    pipe(...operators: any[]): Observable<any>;
  }

  export interface Observer<T> {
    next: (value: T) => void;
    error?: (err: any) => void;
    complete?: () => void;
  }

  export interface Subscription {
    unsubscribe(): void;
  }
}
