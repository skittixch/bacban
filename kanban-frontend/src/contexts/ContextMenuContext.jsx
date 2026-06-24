import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ContextMenuContext = createContext(null);

export function ContextMenuProvider({ children }) {
  const [contextMenuState, setContextMenuState] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    options: [], // { label, icon, onClick, type: 'action' | 'divider' | 'danger' }
  });

  const showContextMenu = useCallback((e, options) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate position to prevent overflowing off-screen
    let x = e.clientX;
    let y = e.clientY;
    
    setContextMenuState({
      isOpen: true,
      x,
      y,
      options,
    });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenuState(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
  }, []);

  // Close context menu on any external click or scroll
  useEffect(() => {
    if (contextMenuState.isOpen) {
      window.addEventListener('click', hideContextMenu);
      window.addEventListener('scroll', hideContextMenu, true);
      window.addEventListener('resize', hideContextMenu);
      
      return () => {
        window.removeEventListener('click', hideContextMenu);
        window.removeEventListener('scroll', hideContextMenu, true);
        window.removeEventListener('resize', hideContextMenu);
      };
    }
  }, [contextMenuState.isOpen, hideContextMenu]);

  return (
    <ContextMenuContext.Provider value={{ contextMenuState, showContextMenu, hideContextMenu, setContextMenuState }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenu must be used within a ContextMenuProvider');
  }
  return context;
}
