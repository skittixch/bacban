const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'hooks', 'useKanban.js');
let content = fs.readFileSync(filePath, 'utf8');

// Add deletedSubtask state
content = content.replace(
  /const \[deletedTask, setDeletedTask\] = useState\(null\);/,
  "const [deletedTask, setDeletedTask] = useState(null);\n  const [deletedSubtask, setDeletedSubtask] = useState(null);"
);

// Update deleteSubtask to set deletedSubtask
content = content.replace(
  /const deleteSubtask = useCallback\(\(boardId, columnId, taskId, subtaskColId, subtaskId, subtaskPath\) => \{\n    setBoards\(prev => updateTaskInState\(prev, boardId, columnId, taskId, subtaskPath, \(target\) => \{\n      if \(target\.subtasks && target\.subtasks\.items && target\.subtasks\.items\[subtaskColId\]\) \{\n        target\.subtasks\.items\[subtaskColId\] = target\.subtasks\.items\[subtaskColId\]\.filter\(s => s\.id !== subtaskId\);\n      \}\n    \}\)\);\n  \}, \[\]\);/,
  `const deleteSubtask = useCallback((boardId, columnId, taskId, subtaskColId, subtaskId, subtaskPath) => {
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (target) => {
      if (target.subtasks && target.subtasks.items && target.subtasks.items[subtaskColId]) {
        const subtask = target.subtasks.items[subtaskColId].find(s => s.id === subtaskId);
        if (subtask) {
          setDeletedSubtask({ subtask, boardId, columnId, taskId, subtaskColId, subtaskPath });
          if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
          undoTimeoutRef.current = setTimeout(() => setDeletedSubtask(null), 5000);
        }
        target.subtasks.items[subtaskColId] = target.subtasks.items[subtaskColId].filter(s => s.id !== subtaskId);
      }
    }));
  }, []);`
);

// Add undoDeleteSubtask
content = content.replace(
  /const updateSubtask = useCallback\(\(/,
  `const undoDeleteSubtask = useCallback(() => {
    if (!deletedSubtask) return;
    const { subtask, boardId, columnId, taskId, subtaskColId, subtaskPath } = deletedSubtask;
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (target) => {
      if (target.subtasks && target.subtasks.items) {
        target.subtasks.items[subtaskColId] = [...(target.subtasks.items[subtaskColId] || []), subtask];
      }
    }));
    setDeletedSubtask(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  }, [deletedSubtask]);

  const updateSubtask = useCallback((`
);

// Add to returned object
content = content.replace(
  /undoDelete, deletedTask,/,
  "undoDelete, deletedTask, undoDeleteSubtask, deletedSubtask,"
);

fs.writeFileSync(filePath, content);
console.log('useKanban.js updated');
