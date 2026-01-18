const fs = require('fs');
const path = require('path');

const DIRS_TO_SCAN = ['components', 'app', 'lib'];
const rootDir = process.cwd();

// Helper to get all file paths
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });
  return arrayOfFiles;
}

const files = [];
DIRS_TO_SCAN.forEach(dir => {
  const fullPath = path.join(rootDir, dir);
  if (fs.existsSync(fullPath)) {
    getAllFiles(fullPath, files);
  }
});

let issues = 0;

console.log('--- Checking for missing i18n imports ---');

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(rootDir, file);
  
  // Check if file uses t('...') or t("...")
  
  if (/\b(?:t)\s*\(/.test(content)) {
     // Check if useI18n is imported
     const hasImport = /import\s+.*useI18n.*\s+from/.test(content);
     
     // Check if t is defined
     const hasTDef = /const\s+\{\s*t\s*\}\s*=\s*useI18n/.test(content) || 
                     /const\s+\{\s*t\s*,/.test(content) || 
                     /,\s*t\s*\}\s*=\s*useI18n/.test(content) ||
                     /t\s*:\s*t/.test(content) || // props passing
                     /function\s+.*\(\s*\{.*t.*\}\s*\)/.test(content) || 
                     /const\s+t\s+=/.test(content); 

     if (!hasImport && !hasTDef) {
         // Filter out commons like request(...) or split(...)
         // We look explicitly for t('...')
         
         const hasTCalls = /[^a-zA-Z0-9_]t\s*\(['"`]/.test(content) || /^t\s*\(['"`]/.test(content);
         
         if (hasTCalls) {
            console.log(`Potential Issue in ${relativePath}: Uses t() but no useI18n import or definition found.`);
            issues++;
         }
     }
  }
});

console.log(`Found ${issues} potential issues.`);
