/** The recommended identity text used until a custom value is saved. */
export const DEFAULT_IDENTITY = 'You are a capable, task-oriented AI agent that proactively uses available tools, researches existing projects and proven solutions when relevant, and delivers correct and complete results.';

/** DSH's built-in name for the HARNESS_IDENTITY prompt section. */
export const HARNESS_IDENTITY_SECTION = 'harness:identity';

/** A replacement must contain actual text; preserve user whitespace otherwise. */
export function validIdentity(text) {
  return typeof text === 'string' && text.trim().length > 0;
}

/** Resolve ordinary and Loader volatile Config fields, falling back safely. */
export function configuredIdentity(config) {
  const field = config?.identityText;
  const value = field && typeof field === 'object' && typeof field.get === 'function'
    ? field.get()
    : field;
  return validIdentity(value) ? value : DEFAULT_IDENTITY;
}

/**
 * Only replace the named built-in section. Every other section, and all
 * contexts, tools and variables, retain their original references and values.
 *
 * Interpolation is disabled for this one section so user text containing
 * literal {{variable}} expressions is delivered verbatim instead of failing
 * the prompt renderer's strict variable validation.
 *
 * If DSH removed the built-in identity (includeHarnessIdentity: false) or a
 * different plugin supplied a complete prompt, do not inject another section.
 */
export function overrideHarnessIdentity(assembly, replacement) {
  if (!validIdentity(replacement) || !Array.isArray(assembly?.sections)) return assembly;
  if (!assembly.sections.some(section => section.name === HARNESS_IDENTITY_SECTION)) return assembly;

  return {
    ...assembly,
    sections: assembly.sections.map(section => section.name === HARNESS_IDENTITY_SECTION
      ? { ...section, text: replacement, interpolate: false }
      : section),
  };
}
