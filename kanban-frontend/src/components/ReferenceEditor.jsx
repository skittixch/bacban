import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Paperclip, Bold, Italic, Link2, Type, Image } from 'lucide-react';

/**
 * ReferenceEditor — a mini CMS-style rich text editor for task references.
 * Supports paste/drop of images, inline formatting, and auto-saves to parent.
 *
 * Props:
 *   value       — HTML string (task.references)
 *   isDarkMode  — theme toggle
 *   onSave      — (html: string) => void — debounced save callback
 *   disabled    — if true, editor is read-only (non-top overlay)
 */
const ReferenceEditor = ({ value, isDarkMode, onSave, disabled }) => {
  const editorRef = useRef(null);
  const saveTimerRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [toolbar, setToolbar] = useState(null); // { top, left } or null
  const [isEmpty, setIsEmpty] = useState(!value);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastSavedRef = useRef(value || '');
  const isInitRef = useRef(false);

  // Initialize editor content once
  useEffect(() => {
    if (editorRef.current && !isInitRef.current) {
      editorRef.current.innerHTML = value || '';
      isInitRef.current = true;
      setIsEmpty(!value || value.replace(/<[^>]*>/g, '').trim() === '');
    }
  }, [value]);

  // Sync content when task changes (e.g. navigating between overlays)
  useEffect(() => {
    isInitRef.current = false;
  }, [value]);

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ---- Debounced save ----
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!editorRef.current) return;
      const html = editorRef.current.innerHTML;
      // Don't save if content hasn't actually changed
      if (html === lastSavedRef.current) return;
      lastSavedRef.current = html;
      // Treat effectively-empty content as empty string
      const stripped = html.replace(/<[^>]*>/g, '').trim();
      const hasImages = /<img\s/i.test(html);
      onSave(stripped || hasImages ? html : '');
    }, 800);
  }, [onSave]);

  // ---- Input handler ----
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    const hasImages = /<img\s/i.test(html);
    setIsEmpty(!stripped && !hasImages);
    scheduleSave();
  }, [scheduleSave]);

  // ---- Insert an image as base64 data URI ----
  const insertImageFromFile = useCallback((file) => {
    if (!file.type.startsWith('image/')) return;

    // Cap at ~10MB to avoid blowing up JSON
    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large (max 10 MB). Try a smaller image or screenshot.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUri = ev.target.result;
      // Insert at current cursor position
      const img = document.createElement('img');
      img.src = dataUri;
      img.className = 'ref-inline-img';
      img.setAttribute('draggable', 'false');

      // Wrap in a container for the delete button
      const wrapper = document.createElement('span');
      wrapper.className = 'ref-img-wrapper';
      wrapper.contentEditable = 'false';
      wrapper.appendChild(img);

      const delBtn = document.createElement('button');
      delBtn.className = 'ref-img-delete';
      delBtn.innerHTML = '×';
      delBtn.title = 'Remove image';
      delBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrapper.remove();
        handleInput();
      };
      wrapper.appendChild(delBtn);

      // Ensure focus is in editor
      editorRef.current.focus();
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(wrapper);
        // Move cursor after the image
        range.setStartAfter(wrapper);
        range.setEndAfter(wrapper);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editorRef.current.appendChild(wrapper);
      }

      // Add a line break after for continued typing
      const br = document.createElement('br');
      wrapper.after(br);

      handleInput();
    };
    reader.readAsDataURL(file);
  }, [handleInput]);

  // ---- Paste handler ----
  const handlePaste = useCallback((e) => {
    const clipData = e.clipboardData;
    if (!clipData) return;

    // Check for image files in clipboard
    const items = Array.from(clipData.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));

    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) insertImageFromFile(file);
      return;
    }

    // For text paste, strip formatting — keep it clean
    const text = clipData.getData('text/plain');
    if (text) {
      e.preventDefault();
      document.execCommand('insertText', false, text);
    }
  }, [insertImageFromFile]);

  // ---- Drag & Drop ----
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide if leaving the editor entirely
    if (!editorRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    imageFiles.forEach(insertImageFromFile);
  }, [insertImageFromFile]);

  // ---- Floating toolbar on text selection ----
  const handleSelectionChange = useCallback(() => {
    if (disabled) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current?.contains(sel.anchorNode)) {
      setToolbar(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    setToolbar({
      top: rect.top - editorRect.top - 44,
      left: Math.max(0, Math.min(
        rect.left - editorRect.left + rect.width / 2 - 80,
        editorRect.width - 170,
      )),
    });
  }, [disabled]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // ---- Formatting commands ----
  const execCmd = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    scheduleSave();
  };

  const handleLinkInsert = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCmd('createLink', url);
      // Make links open in new tab
      setTimeout(() => {
        if (!editorRef.current) return;
        editorRef.current.querySelectorAll('a:not([target])').forEach(a => {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'ref-inline-link';
        });
      }, 0);
    }
  };

  // ---- Image delete handlers (for images loaded from saved HTML) ----
  const handleEditorClick = useCallback((e) => {
    // Re-attach delete buttons to existing images that may have been loaded from saved HTML
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('img.ref-inline-img').forEach(img => {
      const parent = img.parentElement;
      if (parent && parent.classList.contains('ref-img-wrapper')) {
        // Already wrapped
        if (!parent.querySelector('.ref-img-delete')) {
          const delBtn = document.createElement('button');
          delBtn.className = 'ref-img-delete';
          delBtn.innerHTML = '×';
          delBtn.title = 'Remove image';
          delBtn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            parent.remove();
            handleInput();
          };
          parent.appendChild(delBtn);
        }
      }
    });
  }, [handleInput]);

  // On mount, wrap any bare images from saved HTML and attach delete handlers
  useEffect(() => {
    if (!editorRef.current) return;
    const timer = setTimeout(() => {
      if (!editorRef.current) return;
      editorRef.current.querySelectorAll('img.ref-inline-img').forEach(img => {
        const parent = img.parentElement;
        if (!parent || !parent.classList.contains('ref-img-wrapper')) {
          // Wrap the image
          const wrapper = document.createElement('span');
          wrapper.className = 'ref-img-wrapper';
          wrapper.contentEditable = 'false';
          img.parentNode.insertBefore(wrapper, img);
          wrapper.appendChild(img);

          const delBtn = document.createElement('button');
          delBtn.className = 'ref-img-delete';
          delBtn.innerHTML = '×';
          delBtn.title = 'Remove image';
          delBtn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            wrapper.remove();
            handleInput();
          };
          wrapper.appendChild(delBtn);
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [value, handleInput]);

  // ---- Key handler (Ctrl+B, Ctrl+I, etc.) ----
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); execCmd('bold'); break;
        case 'i': e.preventDefault(); execCmd('italic'); break;
        case 'k': e.preventDefault(); handleLinkInsert(); break;
        default: break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleSave]);

  return (
    <div className={`ref-section ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Section header */}
      <div
        className="ref-section-header"
        onClick={() => setIsCollapsed(c => !c)}
      >
        <div className="ref-section-title">
          <Paperclip size={13} />
          <h3>References</h3>
        </div>
        <span className={`ref-section-chevron ${isCollapsed ? '' : 'open'}`}>
          ‹
        </span>
      </div>

      {/* Editor body */}
      {!isCollapsed && (
        <div className={`ref-editor-container ${isDarkMode ? 'dark' : 'light'}`}>
          {/* Floating toolbar */}
          {toolbar && !disabled && (
            <div
              className={`ref-toolbar ${isDarkMode ? 'dark' : 'light'}`}
              style={{ top: toolbar.top, left: toolbar.left }}
            >
              <button
                className="ref-toolbar-btn"
                onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }}
                title="Bold (Ctrl+B)"
                aria-label="Bold"
              >
                <Bold size={14} />
              </button>
              <button
                className="ref-toolbar-btn"
                onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }}
                title="Italic (Ctrl+I)"
                aria-label="Italic"
              >
                <Italic size={14} />
              </button>
              <button
                className="ref-toolbar-btn"
                onMouseDown={(e) => { e.preventDefault(); handleLinkInsert(); }}
                title="Insert Link (Ctrl+K)"
                aria-label="Insert Link"
              >
                <Link2 size={14} />
              </button>
              <span className="ref-toolbar-divider" />
              <button
                className="ref-toolbar-btn"
                onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', '<h4>'); }}
                title="Heading"
                aria-label="Heading"
              >
                <Type size={14} />
              </button>
            </div>
          )}

          {/* Drop overlay */}
          {isDragOver && (
            <div className={`ref-drop-overlay ${isDarkMode ? 'dark' : 'light'}`}>
              <Image size={28} />
              <span>Drop to attach</span>
            </div>
          )}

          {/* The editable surface */}
          <div
            ref={editorRef}
            className={`ref-editor ${isDarkMode ? 'dark' : 'light'} ${isEmpty && !disabled ? 'empty' : ''}`}
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={handleInput}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onClick={handleEditorClick}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-placeholder="Drop images, paste screenshots, or type notes…"
            spellCheck
          />
        </div>
      )}
    </div>
  );
};

export default ReferenceEditor;
