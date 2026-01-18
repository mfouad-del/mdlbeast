const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

const filesToFix = [
  'components/ApprovalSigner.tsx',
  'components/AppVersionWatcher.tsx',
  'components/ArchitectureView.tsx',
  'components/BarcodePrinter.tsx',
  'components/ChangePassword.tsx',
  'components/ErrorBoundary.tsx',
  'components/InstallPWA.tsx',
  'components/LanguageSettings.tsx',
  'components/MobileHeader.tsx',
  'components/OfficialReceipt.tsx',
  'components/SessionExpiredModal.tsx',
  'components/UserProfile.tsx'
];

filesToFix.forEach(fp => {
  const file = path.join(rootDir, fp);
  if (!fs.existsSync(file)) {
      console.log(`Skipping ${fp} (not found)`);
      return;
  }
  let content = fs.readFileSync(file, 'utf8');

  // 1. Add import if missing
  if (!content.includes("useI18n")) {
      // Find last import
      // Use existing imports to determine path depth? They are all in components/, so ../lib is correct.
      let importStatement = `import { useI18n } from '../lib/i18n-context'`;
      
      const lastImport = content.lastIndexOf("import ");
      if (lastImport !== -1) {
          const endOfImportLine = content.indexOf('\n', lastImport);
          content = content.slice(0, endOfImportLine + 1) + 
                    importStatement + '\n' + 
                    content.slice(endOfImportLine + 1);
      } else {
        content = importStatement + '\n' + content;
      }
  }

  // 2. Add useI18n hook at start of component
  
  // Regex to find start of component body
  // Matches:
  // export default function Name(...) {
  // export const Name = (...) => {
  // function Name(...) {
  
  const componentPattern = /(?:export\s+(?:default\s+)?)?(?:function\s+\w+\s*\(|const\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>)\s*(?:<[^>]+>\s*)?(\s*){/;
  const match = content.match(componentPattern);
  
  if (match) {
      // Create insertion point after the opening brace
      const insertionIndex = match.index + match[0].length;
      
      // Check if t is already defined or useI18n used
      // We look ahead a bit
      const lookAhead = content.slice(insertionIndex, insertionIndex + 500); 
      
      if (!lookAhead.includes("useI18n()") && !lookAhead.includes("const { t }")) {
         content = content.slice(0, insertionIndex) + `\n  const { t } = useI18n()` + content.slice(insertionIndex);
         console.log(`Fixed ${fp}`);
         fs.writeFileSync(file, content, 'utf8');
      } else {
         console.log(`Skipping hook insertion for ${fp} (hook/t seems present)`);
      }
  } else {
      console.log(`Could not find component start in ${fp}`);
  }
});
