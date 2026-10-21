// Minimal mirror of DSH's exported renderPrompt() from
// packages/core/system-prompt/src/index.ts. Used only by offline unit tests.
// Production code imports DSH's real @deepseek-ai/dsh-system-prompt package.
const VARIABLE_NAME = /^[a-z][a-z0-9_]*$/;
const GROUP_AT = /^\{\{([^{}]*)\}\}/;

function interpolate(input, variables) {
  const text = input.text;
  let result = '';
  let last = 0;
  for (let open = text.indexOf('{{'); open >= 0; open = text.indexOf('{{', last)) {
    const group = GROUP_AT.exec(text.slice(open));
    if (group === null) {
      if (text.indexOf('}}', open + 2) >= 0) {
        throw new Error(`malformed prompt variable reference at "${text.slice(open, open + 16)}…"`);
      }
      result += text.slice(last, open + 2);
      last = open + 2;
      continue;
    }
    const name = group[0].slice(2, -2);
    if (!VARIABLE_NAME.test(name)) {
      throw new Error(`malformed prompt variable reference "{{${name}}}"`);
    }
    if (!Object.hasOwn(variables, name)) {
      throw new Error(`unknown prompt variable "{{${name}}}"`);
    }
    const value = variables[name];
    if (value === undefined) {
      throw new Error(`prompt variable "{{${name}}}" has no value`);
    }
    result += text.slice(last, open) + value;
    last = open + group[0].length;
  }
  return result + text.slice(last);
}

export function renderPrompt(assembly) {
  return assembly.sections
    .map(section => section.interpolate === false
      ? section.text
      : interpolate(section, assembly.variables))
    .filter(text => text.length > 0)
    .join('\n\n');
}
