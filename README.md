# dsh-identity-override

A DeepSeek Harness plugin that **replaces only the built-in `HARNESS_IDENTITY` prompt section** (`harness:identity`) with text configured on the **Plugins** page. It does not modify DSH source files or prepend/append a second identity instruction.

## Install

Install into the same DSH profile you normally use:

```sh
dsh plugin --profile web add "github:Soulize/dsh-identity-override#main"
```

If you use a different profile, replace `web` with that profile name. Restart DSH if requested. In Web/Desktop, open **Plugins -> dsh-identity-override -> identity-override -> Configure**.

Enter your replacement in the multiline text field and click **Save**. **Use recommended default** fills the editor with the plugin default; click **Save** to persist the reset. The value is stored in the active profile, and changes apply to subsequent prompt assemblies without remounting the plugin.

## Default identity

```text
You are a capable, task-oriented AI agent that proactively uses available tools, researches existing projects and proven solutions when relevant, and delivers correct and complete results.
```

You can also edit the plugin's own profile row directly:

```yaml
- id: identity-override
  config:
    identityText: >-
      You are a capable, task-oriented AI agent that proactively uses
      available tools, researches existing projects and proven solutions
      when relevant, and delivers correct and complete results.
```

Leave the official `@deepseek-ai/dsh-system-prompt` row and its `includeHarnessIdentity: true` setting intact. The plugin **does not** need to disable the official section or change `personaPrefix`.

## How it works

- The Host plugin hooks the official `system-prompt/assemble` waterfall and replaces the **text of the existing named section**, preserving its position and every other section, context, tool schema, and variable.
- It uses `interpolate: false` **only for that section**, allowing literal `{{variable}}` text and multiline identity messages without strict DSH prompt-variable interpolation.
- Its settings field is volatile: saving a different value updates the active Host without a remount and emits `system-prompt/change` to signal the updated prompt.
- When disabled or uninstalled, the hook disappears; DSH's original identity is again used on subsequent prompt assemblies. No core files are patched.
- If the built-in identity is absent (for example, `includeHarnessIdentity: false`), the plugin does not inject a new section. If a scope uses `complete: true`, DSH's complete-prompt contract remains authoritative.
- A blank editor value cannot be saved. If an invalid value reaches the Host through external configuration, the Host uses the recommended default instead.

Changing the first system-prompt tokens can reduce prefix cache reuse across the change; a stable replacement is cache-friendly. Existing in-flight model requests are unaffected.

## Compatibility

- DeepSeek Harness `>=0.2.0-rc.1` (its `system-prompt/assemble`, Plugins config form, and client module APIs).
- Node.js `>=22.19.0` for DSH.
- DSH is in developer preview and may introduce breaking plugin API changes. This plugin requires the built-in section name `harness:identity`.
- The config page requires DSH's Web client module system and a managed profile. No configuration page is available in headless-only deployments; the plugin still works with the profile YAML field.

## Verify

1. Start a fresh agent session and inspect the **assembled system prompt** at the first model step. The built-in identity should appear once, with the replacement text.
2. Confirm the original `You are an AI agent powered by DeepSeek Harness.` is absent and other system-prompt sections remain unchanged.
3. Save a different identity through **Configure**, then initiate a new model step or new session and inspect the assembled prompt again.
4. Disable the plugin: the original identity should return when DSH next assembles the prompt.

Run local unit and UI-contract tests:

```sh
npm test
npm run check
```

These tests mock the Host service and UI framework; they do not substitute for an integration test against a running DSH installation.

## Design references

- [DSH system prompt source](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/system-prompt/src/index.ts)
- [DSH prompt assembly API](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/system-prompt.md)
- [DSH plugin configuration UI](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md)

MIT license.
