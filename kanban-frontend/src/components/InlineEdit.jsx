import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

const InlineEdit = forwardRef(({
  value,
  onSave,
  type = 'input',
  as: Component = 'span',
  trigger = 'click',
  isEditable = true,
  placeholder = 'Enter text...',
  className = '',
  textClassName = '',
  inputProps = {},
  renderText,
  labelId,
  onEditingChange,
}, ref) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  const setEditingState = (state) => {
    setIsEditing(state);
    if (onEditingChange) {
      onEditingChange(state);
    }
  };

  useImperativeHandle(ref, () => ({
    startEditing: () => {
      if (isEditable) setEditingState(true);
    },
    stopEditing: () => {
      setEditingState(false);
    }
  }));

  // Sync state if prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.select) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setEditValue(value); // revert
    }
    setEditingState(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (type === 'textarea' && e.shiftKey) {
        // Allow newline in textarea with Shift+Enter
        return;
      }
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditValue(value);
      setEditingState(false);
    }
  };

  if (isEditing && isEditable) {
    if (type === 'textarea') {
      return (
        <textarea
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          className={className}
          {...inputProps}
        />
      );
    }

    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        placeholder={placeholder}
        className={className}
        {...inputProps}
      />
    );
  }

  const handleTrigger = (e) => {
    if (!isEditable) return;
    if (e) {
      e.stopPropagation();
    }
    setEditingState(true);
  };

  const triggerProps = {};
  if (trigger === 'click') {
    triggerProps.onClick = handleTrigger;
  } else if (trigger === 'doubleClick') {
    triggerProps.onDoubleClick = handleTrigger;
  }

  return (
    <Component
      id={labelId}
      className={`${textClassName} ${isEditable ? 'cursor-pointer' : ''}`}
      {...triggerProps}
    >
      {renderText ? renderText(value) : value}
    </Component>
  );
});

export default InlineEdit;
