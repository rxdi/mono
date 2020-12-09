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
 * lit-html patch to support browsers without native web components.
 *
 * This module should be used in addition to loading the web components
 * polyfills via @webcomponents/webcomponentjs. When using those polyfills
 * support for polyfilled Shadow DOM is automatic via the ShadyDOM polyfill.
 * Scoping classes are added to DOM nodes to facilitate css scoping that
 * simulates the style scoping Shadow DOM provides. ShadyDOM does this scoping
 * to all elements added to the DOM. This module provides an important
 * optimization for this process by pre-scoping lit-html template
 * DOM. This means ShadyDOM does not have to scope each instance of the
 * template DOM. Instead, each template is scoped only once.
 *
 * Creating scoped css is not covered by this module. It is, however, integrated
 * into the LitElement and UpdatingElement packages. See the ShadyCSS docs
 * for how to apply scoping to css:
 * https://github.com/webcomponents/polyfills/tree/master/packages/shadycss#usage.
 *
 * @packageDocumentation
 */

let needsPlatformSupport = !!(
  window.ShadyCSS !== undefined &&
  (!window.ShadyCSS.nativeShadow || window.ShadyCSS.ApplyShim)
);

interface RenderOptions {
  readonly renderBefore?: ChildNode | null;
  scope?: string;
}

interface ShadyTemplateResult {
  strings: TemplateStringsArray;
  _$litType$?: string;
}

interface PatchableNodePart {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-new
  new (...args: any[]): PatchableNodePart;
  _$value: unknown;
  _$startNode: ChildNode;
  _$endNode: ChildNode | null;
  options: RenderOptions;
  _$setValue(value: unknown): void;
  _$getTemplate(
    strings: TemplateStringsArray,
    result: ShadyTemplateResult
  ): HTMLTemplateElement;
}

interface PatchableTemplate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-new
  new (...args: any[]): PatchableTemplate;
  _$createElement(html: string): HTMLTemplateElement;
  _$element: HTMLTemplateElement;
  _$options: RenderOptions;
}

interface PatchableTemplateInstance {
  _$template: PatchableTemplate;
}

// Scopes that have had styling prepared. Note, must only be done once per
// scope.
const styledScopes: Set<string> = new Set();
// Map of css per scope. This is collected during first scope render, used when
// styling is prepared, and then discarded.
const scopeCssStore: Map<string, string[]> = new Map();

/**
 * lit-html patches. These properties cannot be renamed.
 * * NodePart.prototype._$getTemplate
 * * NodePart.prototype._$setValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any)['litHtmlPlatformSupport'] = ({
  NodePart,
  Template,
}: {
  NodePart: PatchableNodePart;
  Template: PatchableTemplate;
}) => {
  if (!needsPlatformSupport) {
    return;
  }

  // console.log(
  //   '%c Making lit-html compatible with ShadyDOM/CSS.',
  //   'color: lightgreen; font-style: italic'
  // );

  const needsPrepareStyles = (name: string | undefined) =>
    name !== undefined && !styledScopes.has(name);

  const cssForScope = (name: string) => {
    let scopeCss = scopeCssStore.get(name);
    if (scopeCss === undefined) {
      scopeCssStore.set(name, (scopeCss = []));
    }
    return scopeCss;
  };

  const prepareStyles = (name: string, template: HTMLTemplateElement) => {
    // Get styles
    const scopeCss = cssForScope(name);
    if (scopeCss.length) {
      const style = document.createElement('style');
      style.textContent = scopeCss.join('\n');
      // Note, it's important to add the style to the *end* of the template so
      // it doesn't mess up part indices.
      template.content.appendChild(style);
    }
    // Mark this scope as styled.
    styledScopes.add(name);
    // Remove stored data since it's no longer needed.
    scopeCssStore.delete(name);
    // ShadyCSS removes scopes and removes the style under ShadyDOM and leaves
    // it under native Shadow DOM
    window.ShadyCSS!.prepareTemplateStyles(template, name);
  };

  const scopedTemplateCache = new Map<
    string,
    Map<TemplateStringsArray, PatchableTemplate>
  >();

  // Note, it's ok to subclass Template since it's only used via NodePart.
  class ShadyTemplate extends Template {
    /**
     * Override to extract style elements from the template
     * and store all style.textContent in the shady scope data.
     */
    _$createElement(html: string) {
      const template = super._$createElement(html);
      const scope = this._$options?.scope;
      if (scope !== undefined) {
        if (!window.ShadyCSS!.nativeShadow) {
          window.ShadyCSS!.prepareTemplateDom(template, scope);
        }
        const scopeCss = cssForScope(scope);
        // Remove styles and store textContent.
        const styles = template.content.querySelectorAll('style') as NodeListOf<
          HTMLStyleElement
        >;
        // Store the css in this template in the scope css and remove the <style>
        // from the template _before_ the node-walk captures part indices
        scopeCss.push(
          ...Array.from(styles).map((style) => {
            style.parentNode?.removeChild(style);
            return style.textContent!;
          })
        );
      }
      return template;
    }
  }

  const renderContainer = document.createDocumentFragment();
  const renderContainerMarker = document.createComment('');

  const nodePartProto = NodePart.prototype;
  /**
   * Patch to apply gathered css via ShadyCSS. This is done only once per scope.
   */
  const setValue = nodePartProto._$setValue;
  nodePartProto._$setValue = function (
    this: PatchableNodePart,
    value: unknown
  ) {
    const container = this._$startNode.parentNode!;
    const scope = this.options.scope;
    if (container instanceof ShadowRoot && needsPrepareStyles(scope)) {
      // Note, @apply requires outer => inner scope rendering on initial
      // scope renders to apply property values correctly. Style preparation
      // is tied to rendering into `shadowRoot`'s and this is typically done by
      // custom elements. If this is done in `connectedCallback`, as is typical,
      // the code below ensures the right order since content is rendered
      // into a fragment first so the hosting element can prepare styles first.
      // If rendering is done in the constructor, this won't work, but that's
      // not supported in ShadyDOM anyway.
      const startNode = this._$startNode;
      const endNode = this._$endNode;

      // Temporarily move this part into the renderContainer.
      renderContainer.appendChild(renderContainerMarker);
      this._$startNode = renderContainerMarker;
      this._$endNode = null;

      // Note, any nested template results render here and their styles will
      // be extracted and collected.
      setValue.call(this, value);

      // Get the template for this result or create a dummy one if a result
      // is not being rendered.
      const template = (value as ShadyTemplateResult)?._$litType$
        ? (this._$value as PatchableTemplateInstance)._$template._$element
        : document.createElement('template');
      prepareStyles(scope!, template);

      // Note, this is the temporary startNode.
      renderContainer.removeChild(renderContainerMarker);
      // When using native Shadow DOM, include prepared style in shadowRoot.
      if (window.ShadyCSS?.nativeShadow) {
        const style = template.content.querySelector('style');
        if (style !== null) {
          renderContainer.appendChild(style.cloneNode(true));
        }
      }
      container.insertBefore(renderContainer, endNode);
      // Move part back to original container.
      this._$startNode = startNode;
      this._$endNode = endNode;
    } else {
      setValue.call(this, value);
    }
  };

  /**
   * Patch NodePart._$getTemplate to look up templates in a cache bucketed
   * by element name.
   */
  nodePartProto._$getTemplate = function (
    strings: TemplateStringsArray,
    result: ShadyTemplateResult
  ) {
    const scope = this.options.scope!;
    let templateCache = scopedTemplateCache.get(scope);
    if (templateCache === undefined) {
      scopedTemplateCache.set(scope, (templateCache = new Map()));
    }
    let template = templateCache.get(strings);
    if (template === undefined) {
      templateCache.set(
        strings,
        (template = new ShadyTemplate(result, this.options))
      );
    }
    return template;
  };
};
