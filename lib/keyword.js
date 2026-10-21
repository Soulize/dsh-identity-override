import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';

/** Read a plain or Loader volatile configuration field. */
function valueOf(field) {
  return field !== null && typeof field === 'object' && typeof field.get === 'function'
    ? field.get()
    : field;
}

/** Empty search disables the rule; empty replacement intentionally deletes. */
export function configuredKeyword(config) {
  const find = valueOf(config?.keywordFind);
  const replacement = valueOf(config?.keywordReplace);
  return {
    find: typeof find === 'string' ? find : '',
    replacement: typeof replacement === 'string' ? replacement : '',
  };
}

/** Treat user-supplied search text as a literal, not a regular expression. */
function literalPattern(text) {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
}

/**
 * Apply a literal, case-insensitive find/replace to ALL system-prompt sections,
 * after the identity override has run. The official DSH renderer resolves
 * prompt variables before matching so keyword hits in interpolated values are
 * covered as well. Only sections that actually change are materialized as
 * uninterpolated text; the other sections keep their identities and metadata.
 *
 * A replacement containing {{variable}} stays literal and is not interpreted
 * as a prompt variable. The assembled tools, runtime contexts, and variables
 * remain untouched, and the input assembly is never mutated.
 *
 * DSH's registered complete-prompt policy can restore its authoritative
 * section after the waterfall; this hook deliberately does not bypass it.
 */
export function replaceSystemPromptKeywords(assembly, find, replacement) {
  if (typeof find !== 'string' || find.length === 0 ||
      typeof replacement !== 'string' || !Array.isArray(assembly?.sections)) {
    return assembly;
  }

  const pattern = literalPattern(find);
  let changed = false;
  const sections = assembly.sections.map(section => {
    const rendered = renderPrompt({ sections: [section], variables: assembly.variables });
    const text = rendered.replace(pattern, () => replacement);
    if (text === rendered) return section;
    changed = true;
    return { ...section, text, interpolate: false };
  });

  return changed ? { ...assembly, sections } : assembly;
}
