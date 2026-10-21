# dsh-identity-override

A DeepSeek Harness plugin with **two independently configurable system-prompt transforms**. Its configuration lives on DSH's **Plugins** page, without patching DSH core files:

1. **HARNESS_IDENTITY override:** replace the text of the built-in `harness:identity` section only.
2. **System-prompt keyword replacement:** find and replace text across **all assembled system-prompt sections**, case-insensitively, after the identity override.

## Install

For the default Web profile:

```sh
dsh plugin --profile web add "github:Soulize/dsh-identity-override#main"
```

If you use another profile, replace `web` with its name. If the plugin is already installed, update/reinstall its GitHub source through the DSH plugin manager so the new version and client UI are loaded; follow any restart prompt shown by DSH.

Open **Plugins → dsh-identity-override → identity-override → Configure** in Web/Desktop. The two features are on the same page and share one **Save** button. Edits are persisted in the current profile and take effect on subsequent prompt assemblies without remounting the plugin.

## 1. HARNESS_IDENTITY override

The default identity text is:

```text
You are a capable, task-oriented AI agent that proactively uses available tools, researches existing projects and proven solutions when relevant, and delivers correct and complete results.
```

The multiline editor supports custom text and literal `{{variable}}` sequences. **Use recommended default** restores the editor's original suggested identity; press **Save** to persist.

The identity override changes the text of the **existing** `harness:identity` section, retaining its position in the prompt. It never creates a second identity, overwrites `personaPrefix`, or modifies other sections. Keep the official `@deepseek-ai/dsh-system-prompt` plugin enabled with `includeHarnessIdentity: true` if you want this feature active.

## 2. Case-insensitive keyword replacement

The second setting shows **two side-by-side text inputs** on desktop (stacked vertically on narrow screens):

| Left: Find (case-insensitive) | Right: Replace with |
| --- | --- |
| `DeepSeek harness` | `harness` |

With these values, every `DeepSeek Harness`, `deepseek harness`, `DEEPSEEK HARNESS`, etc. in system-prompt text becomes `harness`. All occurrences are replaced, not just the first. The rule is applied **after** the HARNESS_IDENTITY override, so it can also replace text in the configured identity.

- The rule is **disabled by default**. Leave **Find** empty to disable it; the text in **Replace with** is then ignored.
- Leave **Replace with** empty to **remove** matching text.
- Matching is **literal**, not regular-expression based. Characters such as `+`, `*`, `(`, `$`, and `.` have no special meaning.
- The official DSH prompt renderer expands prompt variables first, so a keyword also matches text originating from `{{model}}` or other registered prompt variables. Inserted replacement text containing `{{...}}` stays literal.
- The transform covers the **system-role prompt sections**, not the separately supplied tool JSON schemas or runtime-context user messages. Unmatched sections retain their original metadata and ordering. **Clear keyword rule** resets both editors; press **Save** to persist.

### Profile YAML

For a managed profile you can also configure the same fields directly:

```yaml
- id: identity-override
  config:
    identityText: >-
      You are a capable, task-oriented AI agent that proactively uses
      available tools, researches existing projects and proven solutions
      when relevant, and delivers correct and complete results.
    keywordFind: 'DeepSeek harness'
    keywordReplace: 'harness'
```

`identityText` uses the default text above when omitted. `keywordFind` and `keywordReplace` both default to empty strings.

## Behavior and limitations

- The Host uses the official `system-prompt/assemble` waterfall; it first edits the named identity section, then applies the keyword replacement across the assembled sections. These are **system-prompt text** transforms, not modifications to the model's tools or runtime context.
- Changes to each field are **volatile**. Once saved, new prompt assemblies read the values; a `system-prompt/change` notification is emitted. Requests already dispatched do not change.
- Disabling or uninstalling this plugin restores the original DSH behavior for future assemblies. No core file or system-prompt configuration row is modified.
- DSH's authoritative `complete: true` system-prompt mode can restore its complete section **after** the assembly waterfall. That upstream policy overrides both plugin transforms in such a scope; this plugin deliberately does not bypass DSH's complete-prompt enforcement.
- Matching is performed within each rendered prompt section; a search term spanning the blank-line separator between two different sections is not matched. Ordinary keywords and phrases are unaffected by this distinction.
- Changing the leading prompt text can reduce KV-cache reuse temporarily. After the configuration stops changing, cache behavior is again prefix-stable under DSH's normal rules.

## Compatibility

- DeepSeek Harness `>=0.2.0-rc.1` with the official system-prompt service and Web plugin configuration UI.
- Node.js `>=22.19.0`, per DSH requirements.
- Runtime peer: `@deepseek-ai/dsh-system-prompt`, used for its official `renderPrompt` interpolation logic. DSH must make this package available to the external plugin.
- DSH is in developer preview; breaking changes to its plugin interfaces may require an update.
- The visual configuration panel requires the Web client module system and a managed profile. Headless profiles can set the YAML fields directly.

## Verify

1. Start a new agent step and inspect its assembled system prompt. Confirm the identity override appears exactly once.
2. Set **Find** to `DeepSeek harness` and **Replace with** to `harness`, then save. Inspect a new step's system prompt. Verify every occurrence in system-prompt text has changed regardless of case.
3. Confirm unrelated text, model-facing tool schemas, and runtime-context messages are unchanged.
4. Clear the keyword rule and save; then disable the plugin and confirm the standard DSH identity returns on subsequent assemblies.

Run the offline unit, Host-contract, and UI-contract tests:

```sh
npm run check
```

These tests use mocks for DSH and React. An end-to-end test in a running DSH instance is still necessary before claiming production compatibility.

## Design references

- [DSH system-prompt source](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/system-prompt/src/index.ts)
- [DSH prompt assembly API](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/system-prompt.md)
- [DSH Plugins configuration UI](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md)

MIT license.
