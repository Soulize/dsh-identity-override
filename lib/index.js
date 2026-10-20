import z from '@deepseek-ai/schemastery';
import { configuredIdentity, DEFAULT_IDENTITY, overrideHarnessIdentity } from './identity.js';

export const name = 'identity-override';

export const Config = z.object({
  // Settings writes this field through ConfigEditor. Volatile updates do not
  // remount the plugin, and each prompt assembly reads the latest value.
  identityText: z.string().min(1).default(DEFAULT_IDENTITY).volatile(),
});

export function apply(ctx, config = {}) {
  // Expose this fiber to DSH's Plugins configuration page. The browser-side
  // editor below owns the form and its explicit Save action.
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });

  // A waterfall is the public, supported way to transform an assembled prompt.
  // As an outer listener, the replacement is applied after downstream hooks.
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const replacement = configuredIdentity(config);
    const assembly = await next();
    return overrideHarnessIdentity(assembly, replacement);
  }, { prepend: true });

  // A changed volatile config is visible on the next assembly. Notify prompt
  // consumers that a globally effective prompt fragment has changed, too.
  ctx.on('loader/volatile-update', (paths) => {
    if (!Array.isArray(paths) || !paths.some(path =>
      Array.isArray(path) && path[0] === 'identityText')) return;
    ctx.emit('system-prompt/change');
  });
}

export default { name, Config, apply };
