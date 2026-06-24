const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'index.css');
let css = fs.readFileSync(cssPath, 'utf8');

css = css.replace(/\.subtask-column\.dark \{[\s\S]*?\}\n\n\.subtask-column\.light \{[\s\S]*?\}/g, '');
css = css.replace(/\.subtask-column \{/g, '.subtask-column {\n  background: var(--surface-sunken);');

css = css.replace(/\.subtask-pill\.dark \{[\s\S]*?\.subtask-pill\.light:hover \{[\s\S]*?\}/g, `
.subtask-pill {
  background: var(--surface-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}
.subtask-pill:hover {
  background: var(--surface-primary);
  border-color: var(--border-strong);
}
.dark-mode .subtask-pill {
  background: var(--surface-tertiary);
  border-color: var(--border-default);
}
.dark-mode .subtask-pill:hover {
  background: var(--surface-sunken);
  border-color: var(--border-strong);
}
`);

css = css.replace(/\.subtask-empty\.dark \{[\s\S]*?\}\n\n\.subtask-empty\.light \{[\s\S]*?\}/g, '');
// Same for subtask-add-input
css = css.replace(/\.subtask-add-input\.dark \{[\s\S]*?\}\n\n\.subtask-add-input\.light \{[\s\S]*?\}/g, '');
// Same for subtask-edit-input
css = css.replace(/\.subtask-edit-input\.dark \{[\s\S]*?\}\n\n\.subtask-edit-input\.light \{[\s\S]*?\}/g, '');

fs.writeFileSync(cssPath, css);
console.log('Cleaned up index.css for subtasks');
