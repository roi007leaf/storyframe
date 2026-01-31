 

/**
 * StoryFrame Rich Text Editor
 * A contenteditable-based editor with toolbar for journal editing
 */
export class StoryFrameEditor {
  constructor(container, content, onDirtyChange) {
    this.container = container;
    this.initialContent = content;
    this.onDirtyChange = onDirtyChange;
    this.dirty = false;
    this.sourceViewMode = false;
    this.editorDiv = null;
    this.toolbar = null;
    this.sourceTextarea = null;
  }

  /**
   * Initialize and render the editor
   */
  async initialize() {
    this.container.innerHTML = '';

    // Create toolbar
    this.toolbar = this._createToolbar();
    this.container.appendChild(this.toolbar);

    // Create editor div
    this.editorDiv = document.createElement('div');
    this.editorDiv.className = 'storyframe-editor-content';
    this.editorDiv.contentEditable = 'true';
    this.editorDiv.innerHTML = this.initialContent;
    this.editorDiv.style.cssText = `
      min-height: 300px;
      padding: 10px;
      border: 1px solid #ccc;
      border-top: none;
      border-radius: 0 0 4px 4px;
      background: white;
      overflow-y: auto;
      max-height: 500px;
      font-family: inherit;
    `;

    this.container.appendChild(this.editorDiv);

    // Set up event listeners
    this._attachEventListeners();

    // Make images selectable
    this._makeImagesSelectable();

    return this;
  }

  /**
   * Create the editor toolbar
   */
  _createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'storyframe-editor-toolbar';
    toolbar.style.cssText = `
      display: flex;
      gap: 4px;
      padding: 8px;
      background: linear-gradient(to bottom, #fafafa 0%, #e8e8e8 100%);
      border: 1px solid #999;
      border-bottom: 1px solid #666;
      border-radius: 5px 5px 0 0;
      flex-wrap: wrap;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
      max-width: 100%;
      align-items: center;
    `;

    const buttons = this._getToolbarButtons();
    buttons.forEach(btn => this._createToolbarElement(btn, toolbar));

    // Set up category collapse/expand handlers
    this._setupCategoryHandlers(toolbar);

    return toolbar;
  }

  /**
   * Get toolbar button definitions
   */
  _getToolbarButtons() {
    return [
      { cmd: 'fontName', type: 'dropdown', title: 'Font Family', options: [
        { value: '', label: 'Font' },
        { value: 'Arial', label: 'Arial' },
        { value: 'Arial Black', label: 'Arial Black' },
        { value: 'Brush Script MT', label: 'Brush Script' },
        { value: 'Comic Sans MS', label: 'Comic Sans' },
        { value: 'Courier New', label: 'Courier' },
        { value: 'Garamond', label: 'Garamond' },
        { value: 'Georgia', label: 'Georgia' },
        { value: 'Helvetica', label: 'Helvetica' },
        { value: 'Impact', label: 'Impact' },
        { value: 'Lucida Console', label: 'Lucida Console' },
        { value: 'Palatino', label: 'Palatino' },
        { value: 'Tahoma', label: 'Tahoma' },
        { value: 'Times New Roman', label: 'Times' },
        { value: 'Trebuchet MS', label: 'Trebuchet' },
        { value: 'Verdana', label: 'Verdana' },
        { value: 'Modesto Condensed', label: 'Modesto' },
        { value: 'Signika', label: 'Signika' },
      ]},
      { cmd: 'fontSize', type: 'dropdown', title: 'Font Size', options: [
        { value: '', label: 'Size' },
        { value: '1', label: '8pt' },
        { value: '2', label: '10pt' },
        { value: '3', label: '12pt' },
        { value: '4', label: '14pt' },
        { value: '5', label: '18pt' },
        { value: '6', label: '24pt' },
        { value: '7', label: '36pt' },
      ]},
      { cmd: 'formatBlock', type: 'dropdown', title: 'Format', options: [
        { value: 'p', label: 'Paragraph' },
        { value: 'h1', label: 'Heading 1' },
        { value: 'h2', label: 'Heading 2' },
        { value: 'h3', label: 'Heading 3' },
        { value: 'h4', label: 'Heading 4' },
        { value: 'h5', label: 'Heading 5' },
        { value: 'h6', label: 'Heading 6' },
        { value: 'blockquote', label: 'Quote' },
        { value: 'pre', label: 'Preformatted' },
        { value: 'div', label: 'Div Block' },
      ]},
      { cmd: 'separator' },
      { type: 'label', label: 'Foundry', category: 'foundry' },
      { cmd: 'insertSecret', icon: 'fas fa-eye-slash', title: 'Secret Block', category: 'foundry' },
      { cmd: 'insertCodeBlock', icon: 'fas fa-code', title: 'Code Block', category: 'foundry' },
      { cmd: 'insertHR', icon: 'fas fa-minus', title: 'Horizontal Rule', category: 'foundry' },
      { cmd: 'separator' },
      { type: 'label', label: 'PF2e', category: 'pf2e' },
      { cmd: 'pf2e-inline-header', icon: 'fas fa-heading', title: 'PF2e Inline Header', category: 'pf2e' },
      { cmd: 'pf2e-info-block', icon: 'fas fa-info-circle', title: 'PF2e Info Block', category: 'pf2e' },
      { cmd: 'pf2e-stat-block', icon: 'fas fa-id-card', title: 'PF2e Stat Block', category: 'pf2e' },
      { cmd: 'pf2e-traits', icon: 'fas fa-tag', title: 'PF2e Trait', category: 'pf2e' },
      { cmd: 'pf2e-action-glyph', icon: 'fas fa-running', title: 'PF2e Action Icons', category: 'pf2e' },
      { cmd: 'pf2e-written-note', icon: 'fas fa-sticky-note', title: 'PF2e Written Note', category: 'pf2e' },
      { cmd: 'pf2e-gm-text-block', icon: 'fas fa-user-secret', title: 'PF2e GM Block', category: 'pf2e' },
      { cmd: 'pf2e-gm-text-inline', icon: 'fas fa-mask', title: 'PF2e GM Inline', category: 'pf2e' },
      { cmd: 'separator' },
      { cmd: 'bold', icon: 'fas fa-bold', title: 'Bold (Ctrl+B)' },
      { cmd: 'italic', icon: 'fas fa-italic', title: 'Italic (Ctrl+I)' },
      { cmd: 'underline', icon: 'fas fa-underline', title: 'Underline (Ctrl+U)' },
      { cmd: 'strikeThrough', icon: 'fas fa-strikethrough', title: 'Strikethrough' },
      { cmd: 'separator' },
      { cmd: 'insertUnorderedList', icon: 'fas fa-list-ul', title: 'Bullet List' },
      { cmd: 'insertOrderedList', icon: 'fas fa-list-ol', title: 'Numbered List' },
      { cmd: 'separator' },
      { cmd: 'indent', icon: 'fas fa-indent', title: 'Increase Indent' },
      { cmd: 'outdent', icon: 'fas fa-outdent', title: 'Decrease Indent' },
      { cmd: 'separator' },
      { cmd: 'justifyLeft', icon: 'fas fa-align-left', title: 'Align Left' },
      { cmd: 'justifyCenter', icon: 'fas fa-align-center', title: 'Align Center' },
      { cmd: 'justifyRight', icon: 'fas fa-align-right', title: 'Align Right' },
      { cmd: 'separator' },
      { cmd: 'createLink', icon: 'fas fa-link', title: 'Insert Link' },
      { cmd: 'unlink', icon: 'fas fa-unlink', title: 'Remove Link' },
      { cmd: 'insertImage', icon: 'fas fa-image', title: 'Insert Image' },
      { cmd: 'separator' },
      { cmd: 'removeFormat', icon: 'fas fa-eraser', title: 'Clear Formatting' },
      { cmd: 'toggleSource', icon: 'fas fa-code', title: 'Toggle HTML Source View' },
    ];
  }

  /**
   * Create a toolbar element (separator, label, dropdown, or button)
   */
  _createToolbarElement(btn, toolbar) {
    if (btn.cmd === 'separator') {
      const sep = document.createElement('div');
      sep.style.cssText = 'width: 1px; background: linear-gradient(to bottom, transparent 0%, #999 20%, #999 80%, transparent 100%); margin: 0 4px;';
      toolbar.appendChild(sep);
    } else if (btn.type === 'label') {
      const label = document.createElement('span');
      label.className = 'category-label';
      label.dataset.category = btn.category;
      label.innerHTML = `<i class="fas fa-chevron-right"></i> ${btn.label}`;
      label.style.cssText = `
        font-size: 11px;
        font-weight: 600;
        color: #666;
        padding: 4px 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        align-self: center;
        cursor: pointer;
        border-radius: 3px;
        transition: background 0.2s;
        user-select: none;
      `;
      label.addEventListener('mouseenter', () => {
        label.style.background = 'rgba(0,0,0,0.05)';
      });
      label.addEventListener('mouseleave', () => {
        label.style.background = '';
      });
      toolbar.appendChild(label);
    } else if (btn.type === 'dropdown') {
      this._createDropdown(btn, toolbar);
    } else {
      this._createButton(btn, toolbar);
    }
  }

  /**
   * Create a dropdown select element
   */
  _createDropdown(btn, toolbar) {
    const select = document.createElement('select');
    select.title = btn.title;
    select.style.cssText = `
      padding: 4px 6px;
      border: 1px solid #999;
      background: linear-gradient(to bottom, #fff 0%, #e8e8e8 100%);
      cursor: pointer;
      border-radius: 3px;
      font-size: 13px;
      color: #333;
      max-width: 120px;
      flex-shrink: 0;
    `;

    btn.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value) {
        this.editorDiv.focus();
        document.execCommand(btn.cmd, false, value);
        this._setDirty(true);
      }
      setTimeout(() => { select.selectedIndex = 0; }, 100);
    });

    toolbar.appendChild(select);
  }

  /**
   * Create a toolbar button
   */
  _createButton(btn, toolbar) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = btn.title;
    if (btn.category) {
      button.dataset.category = btn.category;
      button.style.display = 'none';
    }
    button.style.cssText = `
      padding: 5px 8px;
      border: 1px solid #999;
      background: linear-gradient(to bottom, #fff 0%, #e8e8e8 100%);
      cursor: pointer;
      border-radius: 3px;
      min-width: 28px;
      transition: all 0.15s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      color: #333;
      font-weight: ${btn.label ? '600' : 'normal'};
      font-size: 13px;
      line-height: 1;
      ${btn.category ? 'display: none;' : ''}
    `;

    if (btn.icon) {
      button.innerHTML = `<i class="${btn.icon}"></i>`;
    } else {
      button.textContent = btn.label;
    }

    // Add hover effects
    this._addButtonHoverEffects(button);

    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      this._handleButtonClick(btn.cmd, button);
    });

    toolbar.appendChild(button);
  }

  /**
   * Add hover effects to a button
   */
  _addButtonHoverEffects(button) {
    button.addEventListener('mouseenter', () => {
      if (!button.dataset.active) {
        button.style.background = 'linear-gradient(to bottom, #fff 0%, #f5f5f5 100%)';
        button.style.borderColor = '#666';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.dataset.active) {
        button.style.background = 'linear-gradient(to bottom, #fff 0%, #e8e8e8 100%)';
        button.style.borderColor = '#999';
      }
    });

    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      button.style.background = 'linear-gradient(to bottom, #ddd 0%, #ccc 100%)';
      button.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.2)';
    });

    button.addEventListener('mouseup', () => {
      if (!button.dataset.active) {
        button.style.background = 'linear-gradient(to bottom, #fff 0%, #e8e8e8 100%)';
      }
      button.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
    });
  }

  /**
   * Handle button click commands
   */
  _handleButtonClick(cmd, button) {
    const selection = window.getSelection();

    // Check if this format is currently active (button is highlighted)
    const isActive = button.dataset.active === 'true';

    switch (cmd) {
      case 'createLink': {
        const url = prompt('Enter URL:');
        if (url) document.execCommand('createLink', false, url);
        break;
      }

      case 'insertImage':
        this._handleInsertImage(selection);
        return; // Don't set dirty here, callback will do it

      case 'removeFormat':
        this._handleRemoveFormat(selection);
        break;

      case 'insertSecret':
        if (isActive) {
          this._unwrapFormat(selection, 'secret');
        } else {
          this._insertTemplate(selection, 'Secret content visible only to GM',
            (text) => `<section class="secret"><p>${text}</p></section>`);
        }
        break;

      case 'insertCodeBlock':
        if (isActive) {
          this._unwrapFormat(selection, 'code');
        } else {
          this._insertTemplate(selection, 'Code block content',
            (text) => `<pre><code>${text}</code></pre>`);
        }
        break;

      case 'pf2e-inline-header':
        if (isActive) {
          this._unwrapFormat(selection, 'inline-header');
        } else {
          this._insertTemplate(selection, 'Inline Header',
            (text) => `<h3 class="inline-header">${text}</h3>`);
        }
        break;

      case 'pf2e-info-block':
        if (isActive) {
          this._unwrapFormat(selection, 'info');
        } else {
          this._insertTemplate(selection, 'Info block content',
            (text) => `<aside class="info"><p>${text}</p></aside>`);
        }
        break;

      case 'pf2e-stat-block':
        if (isActive) {
          this._unwrapFormat(selection, 'statblock');
        } else {
          this._insertTemplate(selection, '<strong>Creature Name</strong><br>Stats go here',
            (text) => `<section class="statblock"><p>${text}</p></section>`);
        }
        break;

      case 'pf2e-traits':
        if (isActive) {
          this._unwrapFormat(selection, 'traits', 'tag');
        } else {
          this._insertTemplate(selection, 'Trait',
            (text) => `<span class="traits"><span class="tag">${text}</span></span> `);
        }
        break;

      case 'pf2e-action-glyph':
        if (isActive) {
          this._unwrapFormat(selection, 'action-glyph');
        } else {
          this._insertTemplate(selection, '1',
            (text) => `<span class="action-glyph">${text}</span> `);
        }
        break;

      case 'pf2e-written-note':
        if (isActive) {
          this._unwrapFormat(selection, 'message');
        } else {
          this._insertTemplate(selection, 'Written note content',
            (text) => `<aside class="message"><p>${text}</p></aside>`);
        }
        break;

      case 'pf2e-gm-text-block':
        if (isActive) {
          this._unwrapFormat(selection, 'visibility-gm');
        } else {
          this._insertTemplate(selection, 'GM-only block content',
            (text) => `<section class="visibility-gm"><p>${text}</p></section>`);
        }
        break;

      case 'pf2e-gm-text-inline':
        if (isActive) {
          this._unwrapFormat(selection, 'visibility-gm');
        } else {
          this._insertTemplate(selection, 'GM-only inline text',
            (text) => `<span class="visibility-gm">${text}</span> `);
        }
        break;

      case 'insertHR':
        this.editorDiv.focus();
        document.execCommand('insertHorizontalRule', false, null);
        break;

      case 'toggleSource':
        this._toggleSourceView(button);
        return; // Don't set dirty for view toggle

      default:
        // Standard execCommand (these toggle automatically for bold, italic, etc.)
        this.editorDiv.focus();
        document.execCommand(cmd, false, null);
    }

    this._setDirty(true);
  }

  /**
   * Insert a template with selected text or placeholder
   */
  _insertTemplate(selection, placeholder, templateFn) {
    this.editorDiv.focus();
    const selectedText = selection.toString() || placeholder;
    const html = templateFn(selectedText);
    document.execCommand('insertHTML', false, html);
  }

  /**
   * Unwrap/remove a format by finding and unwrapping the ancestor element with the given class
   */
  _unwrapFormat(selection, ...classNames) {
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;

    // Walk up the DOM tree to find the element with the target class
    let targetElement = null;
    let current = element;
    while (current && current !== this.editorDiv) {
      const classList = current.classList;
      if (classList) {
        for (const className of classNames) {
          if (classList.contains(className)) {
            targetElement = current;
            break;
          }
        }
      }
      if (targetElement) break;
      current = current.parentElement;
    }

    // If we found the target element, unwrap it
    if (targetElement) {
      const parent = targetElement.parentElement;
      if (parent) {
        // Extract the inner content
        while (targetElement.firstChild) {
          parent.insertBefore(targetElement.firstChild, targetElement);
        }
        // Remove the now-empty wrapper
        parent.removeChild(targetElement);
      }
    }
  }

  /**
   * Handle image insertion with FilePicker
   */
  _handleInsertImage(selection) {
    let savedRange = null;
    if (selection.rangeCount > 0) {
      savedRange = selection.getRangeAt(0);
    }

    const fp = new FilePicker({
      type: 'image',
      callback: (path) => {
        this.editorDiv.focus();
        if (savedRange) {
          selection.removeAllRanges();
          selection.addRange(savedRange);
        }
        document.execCommand('insertImage', false, path);
        this._setDirty(true);
        setTimeout(() => this._makeImagesSelectable(), 10);
      },
    });
    fp.browse();
  }

  /**
   * Handle remove formatting - strips all formatting and special blocks
   * Converts content to plain paragraphs
   */
  _handleRemoveFormat(selection) {
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // Get the selected content
    const fragment = range.cloneContents();

    // Extract just the text content
    let textContent = '';
    if (fragment.textContent) {
      textContent = fragment.textContent.trim();
    }

    // If we have text, replace with a clean paragraph
    if (textContent) {
      const cleanParagraph = `<p>${textContent}</p>`;
      range.deleteContents();
      document.execCommand('insertHTML', false, cleanParagraph);
    } else {
      // No text selected, just clear formatting on current element
      document.execCommand('removeFormat', false, null);
      document.execCommand('unlink', false, null);

      // Also remove special class wrappers
      const container = range.commonAncestorContainer;
      const element = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;

      if (element) {
        // Remove special classes
        const specialClasses = ['secret', 'info', 'statblock', 'traits', 'tag',
          'action-glyph', 'message', 'visibility-gm', 'inline-header'];
        specialClasses.forEach(cls => element.classList?.remove(cls));

        // Remove style attribute
        if (element.hasAttribute && element.hasAttribute('style')) {
          element.removeAttribute('style');
        }
      }
    }
  }

  /**
   * Toggle between WYSIWYG and HTML source view
   */
  _toggleSourceView(button) {
    if (this.sourceViewMode) {
      // Switch back to WYSIWYG
      if (this.sourceTextarea) {
        this.editorDiv.innerHTML = this.sourceTextarea.value;
        this.editorDiv.style.display = '';
        this.toolbar.style.display = 'flex';
        this.sourceTextarea.remove();
        this.sourceTextarea = null;
      }
      this.sourceViewMode = false;
      button.style.background = 'linear-gradient(to bottom, #fff 0%, #e8e8e8 100%)';
      button.style.color = '#333';
      this._makeImagesSelectable();
    } else {
      // Switch to source view
      this.sourceTextarea = document.createElement('textarea');
      this.sourceTextarea.className = 'source-view-textarea';
      this.sourceTextarea.value = this.editorDiv.innerHTML;
      this.sourceTextarea.style.cssText = `
        width: 100%;
        min-height: 400px;
        padding: 10px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        border: 1px solid #ccc;
        border-radius: 0 0 4px 4px;
        resize: vertical;
        background: #f8f8f8;
      `;
      this.sourceTextarea.addEventListener('input', () => this._setDirty(true));
      this.container.appendChild(this.sourceTextarea);
      this.editorDiv.style.display = 'none';
      this.toolbar.style.display = 'none';
      this.sourceViewMode = true;
      button.style.background = 'linear-gradient(to bottom, #4a90e2 0%, #357abd 100%)';
      button.style.color = 'white';
    }
  }

  /**
   * Set up category collapse/expand handlers
   */
  _setupCategoryHandlers(toolbar) {
    const expandedCategories = new Set();

    toolbar.querySelectorAll('.category-label').forEach(label => {
      label.addEventListener('click', () => {
        const category = label.dataset.category;
        const isExpanded = expandedCategories.has(category);
        const icon = label.querySelector('i');

        if (isExpanded) {
          expandedCategories.delete(category);
          icon.className = 'fas fa-chevron-right';
        } else {
          expandedCategories.add(category);
          icon.className = 'fas fa-chevron-down';
        }

        // Show/hide buttons in this category
        toolbar.querySelectorAll(`[data-category="${category}"]`).forEach(btn => {
          if (!btn.classList.contains('category-label')) {
            btn.style.display = isExpanded ? '' : 'none';
          }
        });
      });
    });
  }

  /**
   * Attach event listeners to the editor
   */
  _attachEventListeners() {
    // Update toolbar states on selection change
    this.editorDiv.addEventListener('mouseup', () => this._updateToolbarStates());
    this.editorDiv.addEventListener('keyup', () => this._updateToolbarStates());

    // Mark dirty on input
    this.editorDiv.addEventListener('input', () => {
      this._setDirty(true);
      this._makeImagesSelectable();
      this._updateToolbarStates();
    });

    // Mark dirty on keydown
    this.editorDiv.addEventListener('keydown', () => {
      this._setDirty(true);
    });
  }

  /**
   * Update toolbar button active states based on selection
   */
  _updateToolbarStates() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    // Get all ancestor elements of the selection
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;

    // Walk up the DOM tree to find all ancestor elements
    const ancestors = [];
    let current = element;
    while (current && current !== this.editorDiv) {
      ancestors.push(current);
      current = current.parentElement;
    }

    this.toolbar.querySelectorAll('button').forEach(btn => {
      const title = btn.title?.toLowerCase() || '';
      let isActive = false;

      // Check basic formatting states
      if (title.includes('bold')) {
        isActive = document.queryCommandState('bold');
      } else if (title.includes('italic')) {
        isActive = document.queryCommandState('italic');
      } else if (title.includes('underline')) {
        isActive = document.queryCommandState('underline');
      } else if (title.includes('strikethrough')) {
        isActive = document.queryCommandState('strikeThrough');
      }

      // Check for Foundry/PF2e special formats
      if (!isActive && ancestors.length > 0) {
        for (const ancestor of ancestors) {
          const classList = ancestor.classList;
          if (!classList) continue;

          // Map classes to button titles
          if (title.includes('secret block') && classList.contains('secret')) {
            isActive = true;
          } else if (title.includes('inline header') && classList.contains('inline-header')) {
            isActive = true;
          } else if (title.includes('info block') && classList.contains('info')) {
            isActive = true;
          } else if (title.includes('stat block') && classList.contains('statblock')) {
            isActive = true;
          } else if (title.includes('trait') && (classList.contains('traits') || classList.contains('tag'))) {
            isActive = true;
          } else if (title.includes('action') && classList.contains('action-glyph')) {
            isActive = true;
          } else if (title.includes('written note') && classList.contains('message')) {
            isActive = true;
          } else if (title.includes('gm block') && classList.contains('visibility-gm') && ancestor.tagName === 'SECTION') {
            isActive = true;
          } else if (title.includes('gm inline') && classList.contains('visibility-gm') && ancestor.tagName === 'SPAN') {
            isActive = true;
          }

          if (isActive) break;
        }
      }

      // Apply active state styling
      if (isActive) {
        btn.dataset.active = 'true';
        btn.style.background = 'linear-gradient(to bottom, #4a90e2 0%, #357abd 100%)';
        btn.style.color = 'white';
        btn.style.borderColor = '#2a5a8d';
      } else if (btn.title !== 'Toggle HTML Source View') {
        // Reset all buttons except the source view toggle
        delete btn.dataset.active;
        btn.style.background = 'linear-gradient(to bottom, #fff 0%, #e8e8e8 100%)';
        btn.style.color = '#333';
        btn.style.borderColor = '#999';
      }
    });
  }

  /**
   * Make images in editor selectable and deletable
   */
  _makeImagesSelectable() {
    const images = this.editorDiv.querySelectorAll('img');
    images.forEach(img => {
      img.style.cursor = 'pointer';
      img.onclick = function() {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNode(img);
        selection.removeAllRanges();
        selection.addRange(range);
      };
    });
  }

  /**
   * Set dirty state and notify parent
   */
  _setDirty(dirty) {
    this.dirty = dirty;
    if (this.onDirtyChange) {
      this.onDirtyChange(dirty);
    }
  }

  /**
   * Get the current editor content (HTML)
   */
  getContent() {
    if (this.sourceViewMode && this.sourceTextarea) {
      return this.sourceTextarea.value;
    }
    return this.editorDiv.innerHTML;
  }

  /**
   * Check if editor has unsaved changes
   */
  isDirty() {
    return this.dirty;
  }

  /**
   * Clean up the editor
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.editorDiv = null;
    this.toolbar = null;
    this.sourceTextarea = null;
  }
}
