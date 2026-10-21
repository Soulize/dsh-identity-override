// DSH's external browser module format. No build-time React bundling needed.
window.__ModuleLoader__.load({
  id: 'dsh-identity-override',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    // Keep in sync with lib/identity.js (covered by tests).
    const DEFAULT_IDENTITY = 'You are a capable, task-oriented AI agent that proactively uses available tools, researches existing projects and proven solutions when relevant, and delivers correct and complete results.';
    const CSS = [
      '.dio-wrap{display:flex;flex-direction:column;gap:18px;max-width:840px}',
      '.dio-heading{font-size:15px;font-weight:650;margin:0}',
      '.dio-label{font-size:14px;font-weight:600}',
      '.dio-help,.dio-summary{font-size:13px;line-height:1.6;color:var(--dsw-alias-fg-muted,#77736d)}',
      '.dio-field{display:flex;flex-direction:column;gap:8px;min-width:0}',
      '.dio-keywords{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
      '.dio-textarea,.dio-input{width:100%;box-sizing:border-box;padding:12px;border:1px solid var(--dsw-alias-border-subtle,#cacaca);border-radius:10px;background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;font:inherit;font-size:14px;line-height:1.55}',
      '.dio-textarea{min-height:145px;resize:vertical}',
      '.dio-textarea:focus,.dio-input:focus{outline:2px solid var(--dsw-alias-accent,#0071e3);outline-offset:1px}',
      '.dio-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.dio-button{padding:9px 15px;border:1px solid var(--dsw-alias-border-subtle,#cacaca);border-radius:9px;background:transparent;color:inherit;cursor:pointer;font:inherit}',
      '.dio-save{background:var(--dsw-alias-accent,#0071e3);border-color:transparent;color:white}',
      '.dio-button:disabled{opacity:.5;cursor:default}',
      '.dio-ok{font-size:13px;color:#278644}',
      '.dio-error{font-size:13px;color:#cd3b3b}',
      '@media(max-width:540px){.dio-keywords{grid-template-columns:minmax(0,1fr)}}',
    ].join('\n');

    function IdentityForm({ form }) {
      const state = form?.state;
      const savedIdentity = typeof state?.value?.identityText === 'string'
        ? state.value.identityText : DEFAULT_IDENTITY;
      const savedFind = typeof state?.value?.keywordFind === 'string'
        ? state.value.keywordFind : '';
      const savedReplace = typeof state?.value?.keywordReplace === 'string'
        ? state.value.keywordReplace : '';
      const [draftIdentity, setDraftIdentity] = React.useState(savedIdentity);
      const [draftFind, setDraftFind] = React.useState(savedFind);
      const [draftReplace, setDraftReplace] = React.useState(savedReplace);
      const [busy, setBusy] = React.useState(false);
      const [notice, setNotice] = React.useState('');
      const [error, setError] = React.useState('');

      React.useEffect(() => {
        setDraftIdentity(savedIdentity);
        setDraftFind(savedFind);
        setDraftReplace(savedReplace);
        setNotice('');
        setError('');
      }, [state?.revision, savedIdentity, savedFind, savedReplace]);

      const editable = Boolean(form) && state?.status === 'ready' && state.writable !== false;
      const valid = draftIdentity.trim().length > 0;
      const changed = draftIdentity !== savedIdentity || draftFind !== savedFind
        || draftReplace !== savedReplace;
      const edit = (setter) => (event) => {
        setter(event.target.value);
        setNotice('');
        setError('');
      };

      const save = async () => {
        if (!editable || !valid || !changed || busy) return;
        const updates = [];
        if (draftIdentity !== savedIdentity) {
          updates.push({ op: 'set', path: ['identityText'], value: draftIdentity });
        }
        if (draftFind !== savedFind) {
          updates.push({ op: 'set', path: ['keywordFind'], value: draftFind });
        }
        if (draftReplace !== savedReplace) {
          updates.push({ op: 'set', path: ['keywordReplace'], value: draftReplace });
        }
        setBusy(true);
        setNotice('');
        setError('');
        try {
          const ok = await form.mutate(updates, state?.revision);
          if (!ok) throw new Error('The profile rejected this settings update.');
          setNotice('Saved. Changes apply to subsequent system prompt assemblies.');
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
          h('h3', { className: 'dio-heading' }, 'HARNESS_IDENTITY'),
          h('label', { htmlFor: 'dio-identity', className: 'dio-label' }, 'Replace built-in identity with'),
          h('textarea', {
            id: 'dio-identity', className: 'dio-textarea', rows: 6,
            value: draftIdentity, disabled: busy || !editable, spellCheck: false,
            onChange: edit(setDraftIdentity),
          }),
          h('p', { className: 'dio-help' },
            'Replaces only the built-in harness:identity section. Other prompt sections, ',
            'tool schemas and ordering are unchanged. Literal {{variable}} text is preserved.'),
          h('div', { className: 'dio-actions' },
            h('button', {
              type: 'button', className: 'dio-button',
              disabled: busy || !editable || draftIdentity === DEFAULT_IDENTITY,
              onClick: () => { setDraftIdentity(DEFAULT_IDENTITY); setNotice(''); setError(''); },
            }, 'Use recommended default'),
          ),
        ),
        h('div', { className: 'dio-field' },
          h('h3', { className: 'dio-heading' }, 'Full system prompt: keyword replacement'),
          h('div', { className: 'dio-keywords' },
            h('div', { className: 'dio-field' },
              h('label', { htmlFor: 'dio-keyword-find', className: 'dio-label' }, 'Find (case-insensitive)'),
              h('input', {
                id: 'dio-keyword-find', className: 'dio-input', type: 'text',
                value: draftFind, placeholder: 'DeepSeek harness',
                disabled: busy || !editable, spellCheck: false,
                onChange: edit(setDraftFind),
              }),
            ),
            h('div', { className: 'dio-field' },
              h('label', { htmlFor: 'dio-keyword-replace', className: 'dio-label' }, 'Replace with'),
              h('input', {
                id: 'dio-keyword-replace', className: 'dio-input', type: 'text',
                value: draftReplace, placeholder: 'harness',
                disabled: busy || !editable, spellCheck: false,
                onChange: edit(setDraftReplace),
              }),
            ),
          ),
          h('p', { className: 'dio-help' },
            'Replaces every case-insensitive, literal occurrence across system prompt sections ',
            'after the identity override. An empty Find field disables this rule; ',
            'an empty Replace with field deletes matches. Tool definitions and runtime ',
            'user context are unaffected.'),
          h('div', { className: 'dio-actions' },
            h('button', {
              type: 'button', className: 'dio-button',
              disabled: busy || !editable || (draftFind === '' && draftReplace === ''),
              onClick: () => {
                setDraftFind(''); setDraftReplace(''); setNotice(''); setError('');
              },
            }, 'Clear keyword rule'),
          ),
        ),
        h('div', { className: 'dio-actions' },
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
          'Changes affect later model steps, not requests already sent. ',
          'A scope using a complete system prompt remains authoritative under DSH rules.'),
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
        ? h('span', { className: 'dio-summary' }, 'Customize HARNESS_IDENTITY and replace system prompt keywords')
        : h(IdentityForm, { form })));
    }

    return { inject: ['slots'], apply };
  },
});
