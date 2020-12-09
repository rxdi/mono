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

/**
 * The main LitElement module, which defines the [[`LitElement`]] base class and
 * related APIs.
 *
 *  LitElement components can define a template and a set of observed
 * properties. Changing an observed property triggers a re-render of the
 * element.
 *
 *  Import [[`LitElement`]] and [[`html`]] from this module to create a
 * component:
 *
 *  ```js
 * import {LitElement, html} from 'lit-element';
 *
 * class MyElement extends LitElement {
 *
 *   // Declare observed properties
 *   static get properties() {
 *     return {
 *       adjective: {}
 *     }
 *   }
 *
 *   constructor() {
 *     this.adjective = 'awesome';
 *   }
 *
 *   // Define the element's template
 *   render() {
 *     return html`<p>your ${adjective} template here</p>`;
 *   }
 * }
 *
 * customElements.define('my-element', MyElement);
 * ```
 *
 * `LitElement` extends [[`UpdatingElement`]] and adds lit-html templating.
 * The `UpdatingElement` class is provided for users that want to build
 * their own custom element base classes that don't use lit-html.
 *
 * @packageDocumentation
 */
import {PropertyValues, UpdatingElement} from '../updating-element/updating-element';
import {render, RenderOptions, noChange, NodePart} from '../lit-html';
export * from '../updating-element/updating-element';
export * from '../lit-html';

const DEV_MODE = true;

declare global {
  interface Window {
    litElementVersions: string[];
  }
}

// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for LitElement usage.
// TODO(justinfagnani): inject version number at build time
(window['litElementVersions'] || (window['litElementVersions'] = [])).push(
  '3.0.0-pre.1'
);

/**
 * Base element class that manages element properties and attributes, and
 * renders a lit-html template.
 *
 * To define a component, subclass `LitElement` and implement a
 * `render` method to provide the component's template. Define properties
 * using the [[`properties`]] property or the [[`property`]] decorator.
 */
export class LitElement extends UpdatingElement {
  /**
   * Ensure this class is marked as `finalized` as an optimization ensuring
   * it will not needlessly try to `finalize`.
   *
   * Note this property name is a string to prevent breaking Closure JS Compiler
   * optimizations. See updating-element for more information.
   */
  protected static ['finalized'] = true;

  readonly _$renderOptions: RenderOptions = {eventContext: this};

  private _nodePart: NodePart | undefined = undefined;

  protected createRenderRoot() {
    const renderRoot = super.createRenderRoot();
    // When adoptedStyleSheets are shimmed, they are inserted into the
    // shadowRoot by createRenderRoot. Adjust the renderBefore node so that
    // any styles in Lit content render before adoptedStyleSheets. This is
    // important so that adoptedStyleSheets have precedence over styles in
    // the shadowRoot.
    this._$renderOptions.renderBefore = renderRoot!.firstChild as ChildNode;
    return renderRoot;
  }

  /**
   * Updates the element. This method reflects property values to attributes
   * and calls `render` to render DOM via lit-html. Setting properties inside
   * this method will *not* trigger another update.
   * @param changedProperties Map of changed properties with old values
   */
  protected update(changedProperties: PropertyValues) {
    // Setting properties in `render` should not trigger an update. Since
    // updates are allowed after super.update, it's important to call `render`
    // before that.
    const value = this.render();
    super.update(changedProperties);
    this._nodePart = render(value, this.renderRoot, this._$renderOptions);
  }

  // TODO(kschaaf): Consider debouncing directive disconnection so element moves
  // do not thrash directive callbacks
  // https://github.com/Polymer/lit-html/issues/1457
  connectedCallback() {
    super.connectedCallback();
    this._nodePart?.setConnected(true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._nodePart?.setConnected(false);
  }

  /**
   * Invoked on each update to perform rendering tasks. This method may return
   * any value renderable by lit-html's `NodePart` - typically a
   * `TemplateResult`. Setting properties inside this method will *not* trigger
   * the element to update.
   */
  protected render(): unknown {
    return noChange;
  }
}

// Install hydration if available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any)['litElementHydrateSupport']?.({LitElement});

// Apply polyfills if available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any)['litElementPlatformSupport']?.({LitElement});

// DEV mode warnings
if (DEV_MODE) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (LitElement as any).finalize = function () {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalized = (UpdatingElement as any).finalize.call(this);
    if (!finalized) {
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const warnRemoved = (obj: any, name: string) => {
      if (obj[name] !== undefined) {
        console.warn(
          `\`${name}\` is implemented. It ` +
            `has been removed from this version of LitElement. `
          // TODO(sorvell): add link to changelog when location has stabilized.
          // + See the changelog at https://github.com/Polymer/lit-html/blob/lit-next/packages/lit-element/CHANGELOG.md`
        );
      }
    };
    [`render`, `getStyles`].forEach((name: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      warnRemoved(this as any, name)
    );
    [`adoptStyles`].forEach((name: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      warnRemoved(this.prototype as any, name)
    );
    return true;
  };
}
