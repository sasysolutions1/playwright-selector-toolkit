export function quoteJavaScript(value: string): string {
  return JSON.stringify(value);
}

export function escapeCssIdentifier(value: string): string {
  let result = '';
  for (const [index, character] of Array.from(value).entries()) {
    const code = character.codePointAt(0) ?? 0;
    const safe = /[a-zA-Z0-9_-]/u.test(character);
    const startsWithDigit = index === 0 && /[0-9]/u.test(character);
    if (safe && !startsWithDigit) result += character;
    else if (code === 0) result += '\uFFFD';
    else result += `\\${code.toString(16)} `;
  }
  return result;
}

export function quoteCssAttribute(value: string): string {
  return `"${value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"').replace(/\n/gu, '\\a ')}"`;
}

export function quoteXPath(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return `concat(${value
    .split("'")
    .map((part, index) => `${index === 0 ? '' : ', "\'", '}${quoteXPath(part)}`)
    .join('')})`;
}

export function domPathToXPath(domPath: string): string | null {
  const segments = domPath.split(/\s*>\s*/u).filter(Boolean);
  if (segments.length === 0) return null;
  const converted: string[] = [];
  for (const segment of segments) {
    const idMatch = /^([a-z][a-z0-9-]*)#(.+)$/iu.exec(segment);
    if (idMatch?.[2]) return `//*[@id=${quoteXPath(idMatch[2])}]`;
    const nthMatch = /^([a-z][a-z0-9-]*):nth-of-type\((\d+)\)$/iu.exec(segment);
    if (nthMatch?.[1] && nthMatch[2]) converted.push(`${nthMatch[1]}[${nthMatch[2]}]`);
    else if (/^[a-z][a-z0-9-]*$/iu.test(segment)) converted.push(segment);
    else return null;
  }
  return `/${converted.join('/')}`;
}
