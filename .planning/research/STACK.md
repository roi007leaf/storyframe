# Stack Research

**Domain:** FoundryVTT v13 Module Development
**Researched:** 2025-01-29
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| FoundryVTT API | v13.350+ | Platform runtime and APIs | Target platform. V13 is stable as of 2025 with complete ApplicationV2 conversion. All core UIs now use ApplicationV2 framework. |
| TypeScript | ^5.x | Type-safe JavaScript development | Standard for modern Foundry modules. Provides compile-time safety for Foundry's complex API surface. Use `target: "esnext"` because Foundry targets bleeding-edge JS features. |
| Vite | ^6.x | Build tool and dev server | Recommended by Foundry community. Fast dev server with HMR, Rollup-based production builds. Known cyclic dependency issue with esbuild in dev server is rare. |
| fvtt-types | `github:League-of-Foundry-Developers/foundry-vtt-types#main` | TypeScript definitions for Foundry API | Unofficial but community-standard types. V13 support in beta but actively developed. Install from main branch, not npm, for latest v13 types. |

### ApplicationV2 Framework (Core UI)

| Component | Purpose | Why Required |
|-----------|---------|--------------|
| ApplicationV2 | Base application class | V13's modern UI framework. Replaces legacy Application class (deprecated in v16). Better lifecycle, form handling, rendering queue. |
| HandlebarsApplicationMixin | Template rendering | Standard rendering engine for ApplicationV2. Use unless building with external framework like Vue/Svelte. Provides built-in formInput/formGroup helpers. |
| Handlebars | Templating | Core templating language. V13 provides built-in helpers (selectOptions, editor, formatNumber). Clean separation of templates and logic. |

### Socket Communication

| Technology | Purpose | When to Use |
|------------|---------|-------------|
| `game.socket` (native) | Real-time client-to-client messaging | For simple broadcast patterns. Direct access to socket.io. Must namespace as `module.storyframe`. |
| V13 Query System (`CONFIG.queries`) | Request-response socket pattern | NEW in v13. For request-response patterns between clients. Register handlers in `CONFIG.queries['module-id.event']`. More structured than raw sockets. |
| socketlib (optional) | Socket abstraction library | For complex socket patterns or executing functions on remote clients. Adds abstraction layer. Only if native sockets too verbose. |

**Recommendation for StoryFrame:** Use native `game.socket` for GM→player broadcasts. V13 query system if players need to request state. Skip socketlib unless complexity grows.

### Document Persistence

| API | Purpose | Pattern |
|-----|---------|---------|
| Document Flags | Key-value storage on documents | Use `Document.setFlag('storyframe', key, value)` for module data. Auto-namespaced. Survives document lifecycle. Supports any JSON-serializable data. Merges objects rather than replacing. |
| JournalEntry flags | Store StoryFrame configuration | Attach speaker gallery config to journal entries. Persists with world data. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| libWrapper | Latest | Safe function wrapping/patching | If you need to modify core Foundry behavior. V13 compatible. Prevents conflicts with other modules. Use instead of monkey-patching. |
| foundry.utils | Built-in | Utility functions | Use `foundry.utils.mergeObject()` etc. Replaces deprecated global utils (pre-v12). Available since v12, standard in v13. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint | JavaScript/TypeScript linting | Use ESLint 9+ flat config. Configure for FoundryVTT globals. Community templates include configs. |
| Prettier | Code formatting | Integrate with ESLint via `eslint-plugin-prettier`. Use `eslint-config-prettier` to disable conflicting rules. |
| CSS Preprocessor (Sass/Less) | Stylesheet organization | Optional but recommended. Allows partials, nesting, variables. Compiles to CSS during build. |
| Vite Plugin: rollup-plugin-copy | Asset copying | Copy static assets (module.json, templates, lang files) to dist during build. |

### CSS Architecture (V13)

| Feature | Purpose | Why Important |
|---------|---------|---------------|
| CSS Cascade Layers | Style priority management | V13+ automatically imports module CSS into `module` layer (highest priority). No more specificity wars. System styles beat Foundry built-in, module beats system. |
| Built-in CSS Framework | Base styles and utilities | Use Foundry's `.flexcol`, `.flexrow`, `.flex0-3` classes. Includes Font Awesome. Don't fight the framework. |

## Installation

```bash
# Initialize npm project
npm init -y

# Core dependencies (none - Foundry provides runtime)

# Dev dependencies - TypeScript
npm install -D typescript
npm install -D fvtt-types@github:League-of-Foundry-Developers/foundry-vtt-types#main

# Dev dependencies - Build tools
npm install -D vite
npm install -D vite-plugin-static-copy  # or rollup-plugin-copy

# Dev dependencies - Linting/formatting
npm install -D eslint
npm install -D prettier
npm install -D eslint-plugin-prettier
npm install -D eslint-config-prettier
npm install -D @typescript-eslint/parser
npm install -D @typescript-eslint/eslint-plugin

# Optional - CSS preprocessing
npm install -D sass  # if using Sass
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "types": ["fvtt-types"],
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2022", "dom"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

**Key settings:**
- `target: "esnext"` — Foundry uses bleeding-edge JS features
- `lib: ["es2022"]` — Minimum for WeakRef and other v13 APIs
- `strict: true` — Highly recommended for safety
- `moduleResolution: "bundler"` — Required for certain fvtt-types imports

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vite | Rollup (raw) | If you need more build control or already have Rollup expertise. Vite uses Rollup under the hood for production. |
| Vite | esbuild (raw) | If build speed is critical and you don't need Rollup's plugin ecosystem. No HMR though. |
| Vite | Webpack | Never for new Foundry modules. Webpack is slower and more complex. Legacy choice. |
| Handlebars | Vue/Svelte | If building complex reactive UIs. Requires custom ApplicationV2 rendering. More setup, better DX for complex state. |
| Native sockets | socketlib | If you have complex multi-client RPC patterns. socketlib simplifies remote function execution. |
| Sass | Less | Personal preference. Both work. Sass has larger ecosystem. Less is simpler. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Application (v1) | Deprecated in v16. All core UIs converted to v2 in v13. | ApplicationV2 with HandlebarsApplicationMixin |
| Global utils functions | Deprecated since v12. Will break in future versions. | `foundry.utils.*` namespace |
| Monkey-patching core functions | Breaks when other modules patch same code. Hard to debug conflicts. | libWrapper for safe wrapping |
| jQuery | Not needed. Foundry v13 uses modern JS/DOM APIs. Adds unnecessary weight. | Native DOM APIs, `document.querySelector`, etc. |
| Old socket patterns without namespacing | Conflicts with other modules. Foundry requires namespacing. | Always use `module.{module-id}` event names |
| `target: "es2020"` or lower in tsconfig | Missing types like WeakRef. Foundry assumes es2022+. | `target: "esnext"` and `lib: ["es2022"]` |

## Stack Patterns by Variant

**For simple modules (minimal UI):**
- Skip build tools entirely
- Write vanilla ES6 modules
- Use Handlebars templates directly
- No TypeScript needed (but helpful)

**For standard modules (like StoryFrame):**
- TypeScript + Vite + Sass
- ApplicationV2 + HandlebarsApplicationMixin
- Native sockets for simple broadcast
- Document flags for persistence

**For complex modules (heavy state/reactivity):**
- TypeScript + Vite
- Consider Vue/Svelte with custom ApplicationV2 integration
- socketlib for complex RPC
- May need state management library

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| fvtt-types (main branch) | FoundryVTT v13.350+ | V13 support in beta. Update regularly with `npm install` re-run. Known bugs and unfinished work. |
| Vite 6.x | TypeScript 5.x, Rollup 4.x | Rare cyclic dependency bug in dev server. Doesn't affect most modules. |
| ApplicationV2 | v12+ | Introduced in v12, mandatory in v13 (all core UIs converted). Application v1 deprecated in v16. |
| CSS Cascade Layers | v13+ | Automatic module layer assignment only in v13+. Pre-v13 requires manual layer assignment. |
| socketlib | v13+ | Community-maintained. Check compatibility before using. |

## Configuration Notes

### Vite Build Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/storyframe.ts',
      formats: ['es'],
      fileName: 'storyframe'
    },
    rollupOptions: {
      output: {
        assetFileNames: '[name].[ext]'
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'module.json', dest: '.' },
        { src: 'templates/**/*', dest: 'templates' },
        { src: 'lang/**/*', dest: 'lang' },
        { src: 'styles/**/*', dest: 'styles' }
      ]
    })
  ]
});
```

### ESLint Configuration (Flat Config)

```javascript
// eslint.config.js
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      globals: {
        game: 'readonly',
        canvas: 'readonly',
        ui: 'readonly',
        CONFIG: 'readonly',
        foundry: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
];
```

## Sources

**HIGH Confidence (Official Documentation):**
- [FoundryVTT API v13.350](https://foundryvtt.com/api/) — Official API documentation
- [ApplicationV2 API Documentation](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) — Official ApplicationV2 reference
- [HandlebarsApplicationMixin API](https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html) — Official mixin documentation
- [Release 13.341](https://foundryvtt.com/releases/13.341) — V13 release notes and changes

**HIGH Confidence (Community Wiki - Curated):**
- [ApplicationV2 Community Wiki](https://foundryvtt.wiki/en/development/api/applicationv2) — Comprehensive ApplicationV2 guide
- [ApplicationV2 Conversion Guide](https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide) — Migration from v1 to v2
- [Package Best Practices](https://foundryvtt.wiki/en/development/guides/package-best-practices) — Official best practices checklist
- [Sockets API](https://foundryvtt.wiki/en/development/api/sockets) — Socket communication patterns
- [Document Flags API](https://foundryvtt.wiki/en/development/api/flags) — Flag usage patterns
- [CSS Cascade Layers](https://foundryvtt.wiki/en/development/guides/css-cascade-layers) — V13 CSS architecture
- [Built-in CSS Framework](https://foundryvtt.wiki/en/development/guides/builtin-css) — Foundry CSS utilities
- [Helpers and Utils](https://foundryvtt.wiki/en/development/api/helpers) — Handlebars helpers and utilities
- [Using Vite to build for Foundry](https://foundryvtt.wiki/en/development/guides/vite) — Official Vite guide

**MEDIUM Confidence (Community Resources):**
- [League of Foundry Developers - foundry-vtt-types](https://github.com/League-of-Foundry-Developers/foundry-vtt-types) — TypeScript types repository
- [libWrapper](https://foundryvtt.com/packages/lib-wrapper) — Safe function wrapping library
- [socketlib](https://foundryvtt.com/packages/socketlib) — Socket helper library

**MEDIUM Confidence (Verified via multiple sources):**
- TypeScript configuration recommendations verified across multiple module templates
- Vite as standard build tool confirmed via community wiki and multiple 2025 templates
- V13 stability and ApplicationV2 completion confirmed via official release notes

---
*Stack research for: StoryFrame - FoundryVTT v13 Module*
*Researched: 2025-01-29*
