// Keep Host wiring tests independent of npm/network access. This tiny schema
// stand-in is not part of the published plugin or an integration test.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/schemastery') {
      return { url: new URL('./schema-stub.mjs', import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
