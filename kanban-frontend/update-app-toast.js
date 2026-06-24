const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add to context destructing
content = content.replace(
  /undoDelete, deletedTask,/,
  "undoDelete, deletedTask, undoDeleteSubtask, deletedSubtask,"
);

// Add toast
content = content.replace(
  /\{\/\* Toasts \*\/\}/,
  `{/* Toasts */}
      {deletedSubtask && !deletedTask && (
        <div className="undo-toast">
          <span>Subtask deleted</span>
          <button onClick={undoDeleteSubtask}>Undo</button>
          <span className="text-gray-500 text-xs">or Ctrl+Z</span>
        </div>
      )}`
);

fs.writeFileSync(filePath, content);
console.log('App.jsx updated with subtask toast');
