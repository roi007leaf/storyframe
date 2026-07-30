import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applySecretRollMode,
  enforceSecretRollMessage,
} from '../scripts/utils/secret-roll-utils.mjs';

test('PF2e v14 secret roll opens dialog with blind visibility', () => {
  const options = {};

  applySecretRollMode(options, 14, {
    BLIND: 'blindroll',
  });

  assert.deepEqual(options, { messageMode: 'blind' });
});

test('Foundry v13 secret roll retains legacy blind roll mode', () => {
  const options = {};

  applySecretRollMode(options, 13, {
    BLIND: 'blindroll',
  });

  assert.deepEqual(options, { rollMode: 'blindroll' });
});

test('secret player roll is forced blind for GM recipients', () => {
  let applied = null;
  const message = {
    speaker: { actor: 'actor-1' },
    updateSource: (changes) => {
      applied = changes;
    },
  };

  const enforced = enforceSecretRollMessage(
    message,
    { actorId: 'actor-1' },
    [{ id: 'gm-1' }, { id: 'gm-2' }],
  );

  assert.equal(enforced, true);
  assert.deepEqual(applied, {
    blind: true,
    whisper: ['gm-1', 'gm-2'],
  });
});

test('unrelated chat messages stay unchanged', () => {
  let applied = false;
  const message = {
    speaker: { actor: 'actor-2' },
    updateSource: () => {
      applied = true;
    },
  };

  const enforced = enforceSecretRollMessage(
    message,
    { actorId: 'actor-1' },
    [{ id: 'gm-1' }],
  );

  assert.equal(enforced, false);
  assert.equal(applied, false);
});
