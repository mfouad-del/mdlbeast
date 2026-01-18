const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../components/Dashboard.tsx'),
  path.join(__dirname, '../components/DocumentList.tsx'),
  path.join(__dirname, '../components/ReportGenerator.tsx'),
];

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Pattern: === {t('key')} or === {t("key")}
  // We want to replace it with === t('key')
  // Also handle closing bracket correctly.
  
  // Regex to match: ===\s*\{t\((['"].*?['"])\)\}
  const regex = /===\s*\{t\((['"].*?['"])\)\}/g;
  
  content = content.replace(regex, "=== t($1)");

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed curly braces in ${path.basename(file)}`);
  } else {
    console.log(`No curly braces issues found in ${path.basename(file)}`);
  }
});
