import React, { createContext, useContext } from 'react';
import useKanban from '../hooks/useKanban';

const KanbanContext = createContext(null);

export function KanbanProvider({ children }) {
  const kanban = useKanban();

  return (
    <KanbanContext.Provider value={kanban}>
      {children}
    </KanbanContext.Provider>
  );
}

export function useKanbanContext() {
  const context = useContext(KanbanContext);
  if (!context) {
    throw new Error('useKanbanContext must be used within a KanbanProvider');
  }
  return context;
}
