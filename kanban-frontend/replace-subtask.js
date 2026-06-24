const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'SubtaskBoard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  { match: /\s*\$\{isDarkMode \? 'dark' : 'light'\}/g, replace: '' },
  { match: /\s*\$\{isDarkMode \? 'dark' : 'light'\}\s*/g, replace: ' ' },
];

for (const {match, replace} of replacements) {
  content = content.replace(match, replace);
}

fs.writeFileSync(filePath, content);
console.log('SubtaskBoard.jsx updated');
