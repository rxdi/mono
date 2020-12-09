export interface Unsubscribable {
  unsubscribe(): void;
}
export interface Subscribable<T> {
  /** @deprecated Use an observer instead of a complete callback */
  subscribe(
    next: null | undefined,
    error: null | undefined,
    complete: () => void
  ): Unsubscribable;
  /** @deprecated Use an observer instead of an error callback */
  subscribe(
    next: null | undefined,
    error: (error: any) => void,
    complete?: () => void
  ): Unsubscribable;
  /** @deprecated Use an observer instead of a complete callback */
  subscribe(
    next: (value: T) => void,
    error: null | undefined,
    complete: () => void
  ): Unsubscribable;
  subscribe(
    next?: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Unsubscribable;
}

type SubscribableOrPromiseLike<T> = Subscribable<T> | PromiseLike<T>;

interface PreviousValue<T> {
  readonly value: T;
  readonly subscribableOrPromiseLike: SubscribableOrPromiseLike<T>;
}

// For each part, remember the value that was last rendered to the part by the
// subscribe directive, and the subscribable that was last set as a value.
// The subscribable is used as a unique key to check if the last value
// rendered to the part was with subscribe. If not, we'll always re-render the
// value passed to subscribe.
const previousValues = new WeakMap<Part, PreviousValue<unknown>>();

/**
 * A directive that renders the items of a subscribable, replacing
 * previous values with new values, so that only one value is ever rendered
 * at a time.
 *
 * @param value A subscribable
 */




/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {directive, Part, noChange, _$private} from '../lit-html';
import {DisconnectableDirective} from '../disconnectable-directive';

const DEV_MODE = true;

if (DEV_MODE) {
  console.warn(
    'lit-html: The `until` directive is deprecated and will be removed in ' +
      'the next major version.'
  );
}

const isPrimitive = _$private._isPrimitive;

interface AsyncState {
  /**
   * The last rendered index of a call to until(). A value only renders if its
   * index is less than the `lastRenderedIndex`.
   */
  lastRenderedIndex: number;

  values: unknown[];
}

const isPromise = (x: unknown) => {
  return !isPrimitive(x) && typeof (x as {then?: unknown}).then === 'function';
};

const isObservable = (value) => {
  return isFunction(value.lift) && isFunction(value.subscribe);
}

const isFunction = (value) => {
  return typeof value === 'function';
}
// Effectively infinity, but a SMI.
const _infinity = 0x7fffffff;

class UntilDirective extends DisconnectableDirective {
  private _state: WeakMap<Part, AsyncState> = new WeakMap<Part, AsyncState>();

  render(...args: Array<unknown>) {
    return args.find((x) => !isPromise(x)) ?? noChange;
  }

  update(part: Part, args: Array<unknown>) {
    let state = this._state.get(part)!;
    if (state === undefined) {
      state = {
        lastRenderedIndex: _infinity,
        values: [],
      };
      this._state.set(part, state);
    }
    const previousValues = state.values;
    let previousLength = previousValues.length;
    state.values = args;

    for (let i = 0; i < args.length; i++) {
      // If we've rendered a higher-priority value already, stop.
      if (i > state.lastRenderedIndex) {
        break;
      }

      const value = args[i];

      // Render non-Promise values immediately
      if (!isPromise(value) && !isObservable(value)) {
        state.lastRenderedIndex = i;
        // Since a lower-priority value will never overwrite a higher-priority
        // synchronous value, we can stop processing now.
        return value;
      }

      // If this is a Promise we've already handled, skip it.
      if (i < previousLength && value === previousValues[i]) {
        continue;
      }

      // We have a Promise that we haven't seen before, so priorities may have
      // changed. Forget what we rendered before.
      state.lastRenderedIndex = _infinity;
      previousLength = 0;

      if (isObservable(value)) {
        value['subscribe'](resolvedValue => {
          const index = state.values.indexOf(value);

          if (index > -1 && index < state.lastRenderedIndex) {
            state.lastRenderedIndex = index;
            this.setValue(resolvedValue);
            debugger
          }
        })
      } else {
        Promise.resolve(value).then((resolvedValue: unknown) => {
          const index = state.values.indexOf(value);
          // If state.values doesn't contain the value, we've re-rendered without
          // the value, so don't render it. Then, only render if the value is
          // higher-priority than what's already been rendered.
          if (index > -1 && index < state.lastRenderedIndex) {
            state.lastRenderedIndex = index;
            this.setValue(resolvedValue);
          }
        });
      }

    }

    return noChange;
  }
}

/**
 * Renders one of a series of values, including Promises, to a Part.
 *
 * Values are rendered in priority order, with the first argument having the
 * highest priority and the last argument having the lowest priority. If a
 * value is a Promise, low-priority values will be rendered until it resolves.
 *
 * The priority of values can be used to create placeholder content for async
 * data. For example, a Promise with pending content can be the first,
 * highest-priority, argument, and a non_promise loading indicator template can
 * be used as the second, lower-priority, argument. The loading indicator will
 * render immediately, and the primary content will render when the Promise
 * resolves.
 *
 * Example:
 *
 *     const content = fetch('./content.txt').then(r => r.text());
 *     html`${until(content, html`<span>Loading...</span>`)}`
 */
export const async = directive(UntilDirective);
