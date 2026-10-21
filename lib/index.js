import z from '@deepseek-ai/schemastery';
import { configuredIdentity, DEFAULT_IDENTITY, overrideHarnessIdentity } from './identity.js';
import { configuredKeyword, replaceSystemPromptKeywords } from './keyword.js';

export const name = 'identity-override';

export const Config = z.object({
  // Each field updates without remounting; one prompt assembly sees one
  // consistent snapshot captured before delegating to the other hooks.
  identityText: z.string().min(1).default(DEFAULT_IDENTITY).volatile(),
  keywordFind: z.string().default('').volatile(),
  keywordReplace: z.string().default('').volatile(),
});

export function apply(ctx, config = {}) {
  // Expose this fiber to DSH's Plugins configuration page. The browser-side
  // editor below owns the form and its explicit Save action.
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });

  // The outer waterfall listener runs after downstream assemblers. First
  // replace the named identity section, then search the entire rendered
  // system-prompt section set (not tool schemas or runtime user context).
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const identity = configuredIdentity(config);
    const { find, replacement } = configuredKeyword(config);
    const assembly = await next();
    const withIdentity = overrideHarnessIdentity(assembly, identity);
    return replaceSystemPromptKeywords(withIdentity, find, replacement);
  }, { prepend: true });

  // Both features use volatile config. Notify prompt consumers on either field
  // changing so the following assembly observes the newly saved profile.
  ctx.on('loader/volatile-update', (paths) => {
    if (!Array.isArray(paths) || !paths.some(path =>
      Array.isArray(path) && [
        'identityText', 'keywordFind', 'keywordReplace',
      ].includes(path[0]))) return;
    ctx.emit('system-prompt/change');
  });
}

export default { name, Config, apply };
