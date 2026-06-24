import React, { useRef, useEffect } from 'react';
import { useContextMenu } from '../contexts/ContextMenuContext';
import { useKanbanContext } from '../contexts/KanbanContext';

const ContextMenu = () => {
  const { contextMenuState, hideContextMenu, setContextMenuState } = useContextMenu();
  const { isDarkMode } = useKanbanContext();
  const menuRef = useRef(null);

  useEffect(() => {
    if (contextMenuState.isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = contextMenuState.x;
      let adjustedY = contextMenuState.y;

      if (adjustedX + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }
      if (adjustedY + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      if (adjustedX !== contextMenuState.x || adjustedY !== contextMenuState.y) {
        setContextMenuState(prev => ({ ...prev, x: adjustedX, y: adjustedY }));
      }
    }
  }, [contextMenuState.isOpen, contextMenuState.x, contextMenuState.y, setContextMenuState]);

  if (!contextMenuState.isOpen) return null;

  return (
    <div
      ref={menuRef}
      className={`fixed z-[9999] min-w-[200px] py-1.5 rounded-lg shadow-xl border ${
        isDarkMode 
          ? 'bg-gray-800/95 border-gray-700/80 text-gray-300' 
          : 'bg-white/95 border-gray-200/80 text-gray-700'
      }`}
      style={{
        left: contextMenuState.x,
        top: contextMenuState.y,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {contextMenuState.options.map((option, idx) => {
        if (option.type === 'divider') {
          return (
            <div 
              key={idx} 
              className={`my-1.5 h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} 
            />
          );
        }

        const isDanger = option.type === 'danger';
        
        return (
          <button
            key={idx}
            className={`w-full text-left px-4 py-2 text-sm flex items-center transition-colors ${
              isDanger 
                ? 'text-red-500 hover:bg-red-500/10' 
                : isDarkMode 
                  ? 'hover:bg-gray-700 hover:text-white' 
                  : 'hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              option.onClick();
              hideContextMenu();
            }}
          >
            {option.icon && (
              <span className={`mr-2.5 flex-shrink-0 ${isDanger ? '' : 'text-gray-400'}`}>
                {option.icon}
              </span>
            )}
            <span className="flex-1 font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;
