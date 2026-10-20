import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_IDENTITY } from '../lib/identity.js';

function createUI() {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  const hooks = [];
  let cursor = 0;
  const React = {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children };
    },
    useState(initial) {
      const position = cursor++;
      if (!(position in hooks)) hooks[position] = initial;
      return [hooks[position], value => {
        hooks[position] = typeof value === 'function' ? value(hooks[position]) : value;
      }];
    },
    useEffect() { /* server revision changes are not needed in this test */ },
  };
  let captured;
  const window = { __ModuleLoader__: { load(bundle) { captured = bundle; } } };
  vm.runInNewContext(source, { window }, { filename: 'lib/client.js' });
  assert.equal(captured.id, 'dsh-identity-override');
  const client = captured.factory(specifier => {
    assert.equal(specifier, 'react');
    return React;
  });
  const registrations = [];
  client.apply({
    effect() { /* stylesheet is not relevant to the form contract */ },
    slots: {
      inject(key, callback) { assert.equal(key, 'plugins.row.config'); callback(); },
      register(options, render) { registrations.push({ options, render }); },
    },
  });
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].options.key, 'dsh-identity-override#identity-override');
  const row = registrations[0];
  return {
    row,
    render(form) {
      cursor = 0;
      const vnode = row.render({ view: 'page', form });
      return vnode.type(vnode.props);
    },
  };
}

function findNode(tree, match) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (match(tree)) return tree;
  for (const child of tree.children ?? []) {
    const found = findNode(child, match);
    if (found) return found;
  }
  return undefined;
}

function control(tree, type, text) {
  return findNode(tree, node => node.type === type &&
    (text === undefined || node.children.includes(text)));
}

test('client default equals the Host default and row renders an editable textarea', () => {
  const ui = createUI();
  const form = { state: { status: 'ready', revision: 1, writable: true, value: {} } };
  const tree = ui.render(form);
  const input = control(tree, 'textarea');
  assert.equal(input.props.value, DEFAULT_IDENTITY);
  assert.equal(control(tree, 'button', 'Save').props.disabled, true);
  assert.equal(input.props.disabled, false);
});

test('Save writes only identityText, including line breaks and literal template braces', async () => {
  const ui = createUI();
  const updates = [];
  const form = {
    state: { status: 'ready', revision: 8, writable: true, value: {} },
    async mutate(operations, revision) {
      updates.push({ operations, revision });
      return true;
    },
  };
  const replacement = 'Agent identity\nKeep {{literal}} as text';
  control(ui.render(form), 'textarea').props.onChange({ target: { value: replacement } });
  const save = control(ui.render(form), 'button', 'Save');
  assert.equal(save.props.disabled, false);
  await save.props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(updates)), [{
    revision: 8,
    operations: [{ op: 'set', path: ['identityText'], value: replacement }],
  }]);
});

test('empty text cannot be saved; reset changes draft but requires Save', () => {
  const ui = createUI();
  const form = { state: { status: 'ready', revision: 4, writable: true, value: { identityText: 'Saved value' } } };
  control(ui.render(form), 'textarea').props.onChange({ target: { value: ' \n  ' } });
  let tree = ui.render(form);
  assert.equal(control(tree, 'button', 'Save').props.disabled, true);
  const reset = control(tree, 'button', 'Use recommended default');
  reset.props.onClick();
  tree = ui.render(form);
  assert.equal(control(tree, 'textarea').props.value, DEFAULT_IDENTITY);
  assert.equal(control(tree, 'button', 'Save').props.disabled, false);
});

test('read-only settings never enable saving', () => {
  const ui = createUI();
  const form = { state: { status: 'ready', revision: 1, writable: false, value: {} } };
  const tree = ui.render(form);
  assert.equal(control(tree, 'textarea').props.disabled, true);
  assert.equal(control(tree, 'button', 'Save').props.disabled, true);
});
