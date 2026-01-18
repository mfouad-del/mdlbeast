const fs = require('fs');
const path = require('path');

const files = [
    'components/BarcodePrinter.tsx',
    'components/OfficialReceipt.tsx',
    'components/ChangePassword.tsx',
    'components/InstallPWA.tsx',
    'components/SessionExpiredModal.tsx',
    'components/SignedPdfPreview.tsx',
    'components/StatementModal.tsx',
    'components/ui/loading-context.tsx',
    'components/UserProfile.tsx'
];

files.forEach(relPath => {
    const file = path.join(__dirname, '../', relPath);
    if (!fs.existsSync(file)) {
        console.log(`Skipping missing file: ${relPath}`);
        return;
    }

    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. Add Import if missing
    if (!content.includes('import { useI18n }')) {
        // Try to insert after last import or at top
        const lastImportRegex = /import .*[\r\n]+/;
        const match = content.match(lastImportRegex); // finds first match? No we want simple append
        
        // Find the last line starting with import
        const lines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ')) {
                lastImportIndex = i;
            }
        }

        if (lastImportIndex !== -1) {
            lines.splice(lastImportIndex + 1, 0, "import { useI18n } from '@/lib/i18n-context'");
            content = lines.join('\n');
        } else {
            content = "import { useI18n } from '@/lib/i18n-context'\n" + content;
        }
    }

    // 2. Add Hook if missing
    // Need to find where to insert: inside the main exported function or component
    // We look for "export default function Name(...) {" or "export const Name = (...) => {"
    
    // Simplistic approach: look for the first function definition that IS exported or default
    // and checks if it already has useI18n
    
    // Warning: some files might have multiple components. We primarily target the one causing errors.
    
    if (!content.includes('const { t } = useI18n()')) {
         // Regex for function start
         // Matches: export default function X(...) {
         // Matches: export function X(...) {
         // Matches: function X(...) {
         // We'll insert immediately after the opening brace {
         
         const funcRegex = /(export\s+default\s+function\s+\w+\s*\(.*?\)\s*\{|export\s+function\s+\w+\s*\(.*?\)\s*\{|function\s+\w+\s*\(.*?\)\s*\{)/;
         const match = content.match(funcRegex);
         
         if (match) {
             const insertionPoint = match.index + match[0].length;
             content = content.slice(0, insertionPoint) + "\n  const { t } = useI18n()" + content.slice(insertionPoint);
         } else {
             console.log(`Could not find component function in ${relPath}`);
         }
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Fixed imports in ${relPath}`);
    } else {
        console.log(`No changes made to ${relPath}`);
    }
});
