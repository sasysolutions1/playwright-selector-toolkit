import type { LocatorSpec } from '../../types/locator.js';
import { quoteJavaScript } from './escaping.js';

export function serializeRelativeLocator(spec: LocatorSpec): string {
  switch (spec.type) {
    case 'role': {
      const options = [
        ...(spec.name === undefined ? [] : [`name: ${quoteJavaScript(spec.name)}`]),
        `exact: ${String(spec.exact)}`,
      ];
      return `getByRole(${quoteJavaScript(spec.role)}, { ${options.join(', ')} })`;
    }
    case 'label':
      return `getByLabel(${quoteJavaScript(spec.value)}, { exact: ${String(spec.exact)} })`;
    case 'placeholder':
      return `getByPlaceholder(${quoteJavaScript(spec.value)}, { exact: ${String(spec.exact)} })`;
    case 'text':
      return `getByText(${quoteJavaScript(spec.value)}, { exact: ${String(spec.exact)} })`;
    case 'test-id':
      return spec.attribute === 'data-testid'
        ? `getByTestId(${quoteJavaScript(spec.value)})`
        : `locator(${quoteJavaScript(`[${spec.attribute}=${JSON.stringify(spec.value)}]`)})`;
    case 'attribute':
    case 'css':
      return `locator(${quoteJavaScript(spec.selector)})`;
    case 'xpath':
      return `locator(${quoteJavaScript(`xpath=${spec.selector}`)})`;
  }
}

export function serializePlaywrightLocator(spec: LocatorSpec, framePath: string): string {
  return `${framePath === 'main' ? 'page' : 'frame'}.${serializeRelativeLocator(spec)}`;
}
