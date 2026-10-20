// DSH's external browser module format. No build-time React bundling needed.
window.__ModuleLoader__.load({
  id: 'dsh-identity-override',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    // Keep in sync with lib/identity.js (covered by tests).
    const DEFAULT_IDENTITY = 'You are a capable, task-oriented AI agent that proactively uses available tools, researches existing projects and proven solutions when relevant, and delivers correct and complete results.';
    const CSS = [
      '.dio-wrap{display:flex;flex-direction:column;gap:14px;max-width:800px}',
      '.dio-label{font-size:14px;font-weight:600}',
      '.dio-help,.dio-summary{font-size:13px;line-height:1.6;color:var(--dsw-alias-fg-muted,#77736d)}',
      '.dio-field{display:flex;flex-direction:column;gap:8px}',
      '.dio-textarea{width:100%;min-height:145px;resize:vertical;box-sizing:border-box;padding:12px;border:1px solid var(--dsw-alias-border-subtle,#cacaca);border-radius:10px;background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;font:inherit;font-size:14px;line-height:1.55}',
      '.dio-textarea:focus{outline:2px solid var(--dsw-alias-accent,#0071e3);outline-offset:1px}',
      '.dio-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.dio-button{padding:9px 15px;border:1px solid var(--dsw-alias-border-subtle,#cacaca);border-radius:9px;background:transparent;color:inherit;cursor:pointer;font:inherit}',
      '.dio-save{background:var(--dsw-alias-accent,#0071e3);border-color:transparent;color:white}',
      '.dio-button:disabled{opacity:.5;cursor:default}',
      '.dio-ok{font-size:13px;color:#278644}',
      '.dio-error{font-size:13px;color:#cd3b3b}',
    ].join('\n');

    function IdentityForm({ form }) {
      const state = form?.state;
      const saved = typeof state?.value?.identityText === 'string'
        ? state.value.identityText : DEFAULT_IDENTITY;
      const [draft, setDraft] = React.useState(saved);
      const [busy, setBusy] = React.useState(false);
      const [notice, setNotice] = React.useState('');
      const [error, setError] = React.useState('');

      React.useEffect(() => {
        setDraft(saved);
        setNotice('');
        setError('');
      }, [state?.revision, saved]);

      const editable = Boolean(form) && state?.status === 'ready' && state.writable !== false;
      const valid = draft.trim().length > 0;
      const changed = draft !== saved;

      const save = async () => {
        if (!editable || !valid || !changed || busy) return;
        setBusy(true);
        setNotice('');
        setError('');
        try {
          const ok = await form.mutate([
            { op: 'set', path: ['identityText'], value: draft },
          ], state?.revision);
          if (!ok) throw new Error('The profile rejected this settings update.');
          setNotice('Saved. The new identity takes effect on subsequent prompt assemblies.');
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setBusy(false);
        }
      };

      if (!form || state?.status === 'unavailable') {
        return h('p', { className: 'dio-error' }, 'The profile settings form is unavailable.');
      }

      return h('div', { className: 'dio-wrap' },
        h('div', { className: 'dio-field' },
          h('label', { htmlFor: 'dio-identity', className: 'dio-label' }, 'HARNESS_IDENTITY replacement'),
          h('textarea', {
            id: 'dio-identity', className: 'dio-textarea', rows: 6,
            value: draft, disabled: busy || !editable, spellCheck: false,
            onChange: event => {
              setDraft(event.target.value);
              setNotice('');
              setError('');
            },
          }),
          h('p', { className: 'dio-help' },
            'Replaces only the built-in harness:identity section. Other system prompt ',
            'sections, tool definitions, and ordering are not modified. ',
            'Line breaks and literal {{variable}} text are preserved.'),
        ),
        h('div', { className: 'dio-actions' },
          h('button', {
            type: 'button', className: 'dio-button',
            disabled: busy || !editable || draft === DEFAULT_IDENTITY,
            onClick: () => { setDraft(DEFAULT_IDENTITY); setNotice(''); setError(''); },
          }, 'Use recommended default'),
          h('button', {
            type: 'button', className: 'dio-button dio-save',
            disabled: busy || !editable || !valid || !changed,
            onClick: save,
          }, busy ? 'Saving...' : 'Save'),
        ),
        !valid ? h('span', { className: 'dio-error' }, 'Identity text cannot be empty.') : null,
        notice ? h('span', { className: 'dio-ok' }, notice) : null,
        error ? h('span', { className: 'dio-error' }, error) : null,
        h('p', { className: 'dio-help' },
          'Changing the text affects subsequent model steps, not requests already sent. ',
          'A scope using a complete system prompt is not overridden.'),
      );
    }

    function apply(ctx) {
      ctx.effect(() => {
        const id = 'dsh-identity-override/settings.css';
        if (document.querySelector('style[data-plugin-css="' + id + '"]')) return () => {};
        const style = document.createElement('style');
        style.dataset.pluginCss = id;
        style.textContent = CSS;
        document.head.appendChild(style);
        return () => style.remove();
      }, 'identity-override: client styles');

      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config',
        key: 'dsh-identity-override#identity-override',
      }, ({ view, form }) => view === 'summary'
        ? h('span', { className: 'dio-summary' }, 'Customize the built-in HARNESS_IDENTITY text')
        : h(IdentityForm, { form })));
    }

    return { inject: ['slots'], apply };
  },
});
