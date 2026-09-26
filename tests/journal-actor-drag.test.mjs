import assert from 'node:assert/strict';
import test from 'node:test';

const appendedStyles = [];

globalThis.document = {
  createElement: () => ({}),
  head: {
    appendChild: (element) => appendedStyles.push(element),
  },
};

const { _setupActorDragTransparency } = await import('../scripts/hooks/journal-hooks.mjs');

test('journal actor drag loads preview styles without opening GM sidebar', () => {
  const registeredEvents = [];
  const actorLink = {
    addEventListener: (eventName) => registeredEvents.push(eventName),
    classList: { add: () => {} },
  };
  const contentArea = {
    querySelectorAll: () => [actorLink],
  };

  _setupActorDragTransparency({}, {}, contentArea);

  assert.deepEqual(registeredEvents, ['mousedown']);
  assert.equal(
    appendedStyles.some(
      (style) =>
        style.rel === 'stylesheet' &&
        style.href === 'modules/storyframe/styles/gm-sidebar-journal.css',
    ),
    true,
    'actor drag preview CSS should load independently of GM sidebar',
  );
});
