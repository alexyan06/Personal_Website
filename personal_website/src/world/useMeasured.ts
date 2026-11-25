// A value read from an element's layout and kept up to date: the stage's scale, the status bar's fit.
import { useCallback, useLayoutEffect, useState } from 'react';
import { watchDpr } from './pixels';

class Measured<T> {
  private element: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private stopDpr: (() => void) | null = null;
  private listeners = new Set<() => void>();
  /** A measurement nobody has been told about yet. */
  private unseen = false;
  private value: T;
  private read: (element: HTMLElement) => T | null;
  private same: (a: T, b: T) => boolean;

  constructor(guess: T, read: (element: HTMLElement) => T | null, same: (a: T, b: T) => boolean) {
    this.value = guess;
    this.read = read;
    this.same = same;
  }

  /**
   * The element is measured as it mounts, which is before its reader has subscribed. That first
   * measurement is handed over at once on subscribing, so (from a layout effect) it is rendered
   * before the browser paints and the guess is never shown.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.unseen) {
      this.unseen = false;
      listener();
    }
    return () => this.listeners.delete(listener);
  };

  get = (): T => this.value;

  /** Ref callback for the measured element. */
  attach = (element: HTMLElement | null): void => {
    this.observer?.disconnect();
    this.stopDpr?.();
    window.removeEventListener('resize', this.measure);
    this.observer = null;
    this.stopDpr = null;
    this.element = element;
    if (!element) return;
    this.observer = new ResizeObserver(this.measure);
    this.observer.observe(element);
    this.stopDpr = watchDpr(this.measure);
    // What is read may follow the window (a media query, a custom property) without the box changing.
    window.addEventListener('resize', this.measure);
    this.measure();
  };

  private measure = (): void => {
    if (!this.element) return;
    const next = this.read(this.element);
    if (next === null || this.same(next, this.value)) return;
    this.value = next;
    if (this.listeners.size === 0) this.unseen = true;
    for (const listener of this.listeners) listener();
  };
}

export type MeasuredValue<T> = {
  /** Put this on the element to measure. */
  ref: (element: HTMLElement | null) => void;
  value: T;
};

/**
 * `read(element)` now and after every resize of the element or the window and every change of
 * devicePixelRatio. `guess` is the value for the first render, before the element exists; `read`
 * may return null to keep the last value (an element with no box). The three arguments are used
 * as first given.
 */
export function useMeasured<T>(guess: () => T, read: (element: HTMLElement) => T | null, same: (a: T, b: T) => boolean): MeasuredValue<T> {
  const [store] = useState(() => new Measured(guess(), read, same));
  const [value, setValue] = useState(store.get);
  useLayoutEffect(() => store.subscribe(() => setValue(store.get())), [store]);
  const ref = useCallback((element: HTMLElement | null) => store.attach(element), [store]);
  return { ref, value };
}
