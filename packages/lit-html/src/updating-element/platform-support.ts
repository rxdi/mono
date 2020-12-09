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
 * UpdatingElement patch to support browsers without native web components.
 *
 * This module should be used in addition to loading the web components
 * polyfills via @webcomponents/webcomponentjs. When using those polyfills
 * support for polyfilled Shadow DOM is automatic via the ShadyDOM polyfill, but
 * support for Shadow DOM like css scoping is opt-in. This module uses ShadyCSS
 * to scope styles defined via the `static styles` property.
 *
 * @packageDocumentation
 */

let needPlatformSupport = !!(
  window.ShadyCSS !== undefined &&
  (!window.ShadyCSS.nativeShadow || window.ShadyCSS.ApplyShim)
);

interface RenderOptions {
  readonly renderBefore?: ChildNode | null;
  scope?: string;
}

const SCOPED = '__scoped';

type CSSResults = Array<{cssText: string} | CSSStyleSheet>;

interface PatchableUpdatingElementConstructor {
  [SCOPED]: boolean;
  elementStyles: CSSResults;
  shadowRootOptions: ShadowRootInit;
  _$handlesPrepareStyles?: boolean;
}

interface PatchableUpdatingElement extends HTMLElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-new
  new (...args: any[]): PatchableUpdatingElement;
  constructor: PatchableUpdatingElementConstructor;
  connectedCallback(): void;
  hasUpdated: boolean;
  _$didUpdate(changedProperties: unknown): void;
  createRenderRoot(): Element | ShadowRoot;
  _$renderOptions: RenderOptions;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any)['updatingElementPlatformSupport'] = ({
  UpdatingElement,
}: {
  UpdatingElement: PatchableUpdatingElement;
}) => {
  if (!needPlatformSupport) {
    return;
  }

  // console.log(
  //   '%c Making UpdatingElement compatible with ShadyDOM/CSS.',
  //   'color: lightgreen; font-style: italic'
  // );

  const elementProto = UpdatingElement.prototype;

  /**
   * Patch to apply adoptedStyleSheets via ShadyCSS
   */
  const createRenderRoot = elementProto.createRenderRoot;
  elementProto.createRenderRoot = function (this: PatchableUpdatingElement) {
    // Pass the scope to render options so that it gets to lit-html for proper
    // scoping via ShadyCSS.
    const name = this.localName;
    // If using native Shadow DOM must adoptStyles normally,
    // otherwise do nothing.
    if (window.ShadyCSS!.nativeShadow) {
      return createRenderRoot.call(this);
    } else {
      if (!this.constructor.hasOwnProperty(SCOPED)) {
        (this.constructor as PatchableUpdatingElementConstructor)[
          SCOPED
        ] = true;
        // Use ShadyCSS's `prepareAdoptedCssText` to shim adoptedStyleSheets.
        const css = (this
          .constructor as PatchableUpdatingElementConstructor).elementStyles.map(
          (v) =>
            v instanceof CSSStyleSheet
              ? Array.from(v.cssRules).reduce(
                  (a: string, r: CSSRule) => (a += r.cssText),
                  ''
                )
              : v.cssText
        );
        window.ShadyCSS?.ScopingShim?.prepareAdoptedCssText(css, name);
        if (this.constructor._$handlesPrepareStyles === undefined) {
          window.ShadyCSS!.prepareTemplateStyles(
            document.createElement('template'),
            name
          );
        }
      }
      return (
        this.shadowRoot ??
        this.attachShadow(
          (this.constructor as PatchableUpdatingElementConstructor)
            .shadowRootOptions
        )
      );
    }
  };

  /**
   * Patch connectedCallback to apply ShadyCSS custom properties shimming.
   */
  const connectedCallback = elementProto.connectedCallback;
  elementProto.connectedCallback = function (this: PatchableUpdatingElement) {
    connectedCallback.call(this);
    // Note, must do first update separately so that we're ensured
    // that rendering has completed before calling this.
    if (this.hasUpdated) {
      window.ShadyCSS!.styleElement(this);
    }
  };

  /**
   * Patch update to apply ShadyCSS custom properties shimming for first
   * update.
   */
  const didUpdate = elementProto._$didUpdate;
  elementProto._$didUpdate = function (
    this: PatchableUpdatingElement,
    changedProperties: unknown
  ) {
    const isFirstUpdate = !this.hasUpdated;
    didUpdate.call(this, changedProperties);
    // Note, must do first update here so rendering has completed before
    // calling this and styles are correct by updated/firstUpdated.
    if (isFirstUpdate) {
      window.ShadyCSS!.styleElement(this);
    }
  };
};
