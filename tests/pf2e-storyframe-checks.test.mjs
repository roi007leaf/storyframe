import assert from 'node:assert/strict';

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (Base) => Base,
    },
    ux: {
      TextEditor: {
        implementation: {
          getDragEventData: (event) => {
            const raw = event.dataTransfer?.getData('text/plain');
            return raw ? JSON.parse(raw) : {};
          },
        },
      },
    },
  },
  utils: {
    mergeObject: (target, source) => ({ ...target, ...source }),
    randomID: () => 'test-id',
  },
};

globalThis.game = {
  system: { id: 'pf2e' },
  modules: new Map(),
  settings: { get: () => false },
  i18n: {
    localize: (key) => key,
    format: (key) => key,
  },
};

globalThis.ui = {
  notifications: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
};

globalThis.fromUuid = async () => null;

const [{ GMSidebarAppPF2e }, { GMSidebarAppBase }] = await Promise.all([
  import('../scripts/applications/gm-sidebar/gm-sidebar-pf2e.mjs'),
  import('../scripts/applications/gm-sidebar/gm-sidebar-base.mjs'),
]);

function storyFrameCheckElement(data, text = data.label) {
  return {
    dataset: { check: JSON.stringify(data) },
    textContent: text,
    closest: () => null,
  };
}

function contentWithStoryFrameChecks(elements) {
  return {
    querySelectorAll(selector) {
      if (selector === '.sf-check[data-check]') return elements;
      return [];
    },
  };
}

const survivalCheck = {
  type: 'StoryFrameCheck',
  skillSlug: 'sur',
  actionSlug: null,
  dc: 24,
  label: 'Survival DC 24',
};

{
  const content = contentWithStoryFrameChecks([storyFrameCheckElement(survivalCheck)]);
  const checks = GMSidebarAppPF2e.prototype._parseChecksFromContent(content);

  assert.equal(checks.length, 1);
  assert.equal(checks[0].skillName, 'sur');
  assert.equal(checks[0].dc, 24);
  assert.equal(checks[0].label, 'Survival DC 24');
  assert.equal(checks[0].checkType, 'skill');
}

{
  const sidebar = Object.create(GMSidebarAppBase.prototype);
  const batchButton = {
    style: { display: 'none' },
    querySelector: () => ({ textContent: '' }),
  };
  sidebar.batchedChecks = [];
  sidebar.element = {
    querySelectorAll: () => [],
    querySelector: (selector) => (selector === '.send-batch-btn' ? batchButton : null),
  };

  await sidebar._handleDrop({
    altKey: false,
    preventDefault: () => {},
    dataTransfer: {
      getData: (type) => (type === 'text/plain' ? JSON.stringify(survivalCheck) : ''),
    },
  });

  assert.equal(sidebar.batchedChecks.length, 1);
  assert.deepEqual(sidebar.batchedChecks[0], {
    skill: 'sur',
    dc: 24,
    isSecret: false,
    actionSlug: null,
    actionVariant: null,
    checkType: 'skill',
    checkId: 'journal:sur:24',
  });
}
