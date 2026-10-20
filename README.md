# dsh-identity-override

A DeepSeek Harness plugin to replace **only** the built-in `HARNESS_IDENTITY` (`harness:identity`) prompt section. It does not modify core files, change tool schemas, or add a duplicate identity section.

## Install

```sh
dsh plugin --profile web add "github:Soulize/dsh-identity-override#main"
```

After installing, open **Plugins > dsh-identity-override > identity-override > Configure**. Enter the replacement in the multiline editor, then click **Save**. **Use recommended default** resets the editor; click **Save** to persist. Values are saved to the active DSH profile, and subsequent prompt assemblies use the new value without restarting the plugin.

## Default identity

```text
You are a capable, task-oriented AI agent that proactively uses available tools, researches existing projects and proven solutions when relevant, and delivers correct and complete results.
```

Alternatively, edit the plugin's own profile row:

```yaml
- id: identity-override
  config:
    identityText: 'Your custom agent identity.'
```

**Leave the official system-prompt plugin enabled with `includeHarnessIdentity: true`.** This plugin uses DSH's supported `system-prompt/assemble` waterfall to replace just the existing identity text. It retains the original section's position and all other sections, contexts, tools, and variables. Literal `{{variable}}` expressions and line breaks are preserved by disabling interpolation for the replaced identity section.

If the upstream identity is disabled/absent, no section is added. Registered complete system prompts remain authoritative. Disabling this plugin restores the original behavior for subsequent assemblies. Changes to the first system-prompt tokens may affect KV-cache reuse until stable.

Requires DeepSeek Harness >=0.2.0-rc.1 and Node.js >=22.19.0. DSH is in developer preview; future APIs may change. The Web configuration page requires a managed profile; headless deployments can use YAML.

## Verify

Run `npm run check` for local unit and UI-contract tests. These use lightweight mocks, not a running DSH instance. To verify end-to-end, inspect a fresh session's assembled system prompt, save a different identity, start another model step, and disable the plugin to confirm the original text returns.

Source references: [system-prompt source](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/system-prompt/src/index.ts), [prompt API](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/system-prompt.md), and [Plugins UI](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md).

License: MIT.
