
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');

console.log('--- INSEME DIAGNOSTIC ---');

const checkFile = (filePath) => {
    const fullPath = path.join(rootDir, filePath);
    const exists = fs.existsSync(fullPath);
    console.log(`${exists ? '✅' : '❌'} ${filePath}`);
    return exists;
};

console.log('\nVerifying Core Files:');
checkFile('src/package/inseme/hooks/useInseme.js');
checkFile('src/package/inseme/InsemeContext.jsx');
checkFile('src/netlify/edge-functions/ophelia.js');
checkFile('netlify.toml');
checkFile('.env');

console.log('\nChecking package.json:');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
console.log(`Version: ${pkg.version}`);
console.log(`React: ${pkg.dependencies.react}`);

console.log('\nChecking netlify.toml for Edge Functions:');
if (fs.existsSync(path.join(rootDir, 'netlify.toml'))) {
    const netlifyToml = fs.readFileSync(path.join(rootDir, 'netlify.toml'), 'utf8');
    if (netlifyToml.includes('[[edge_functions]]')) {
        console.log('✅ Edge Functions are configured in netlify.toml');
    } else {
        console.log('⚠️ No [[edge_functions]] found in netlify.toml');
    }
}

console.log('\nChecking for possible circular dependencies in useInseme.js:');
const useInsemeContent = fs.readFileSync(path.join(rootDir, 'src/package/inseme/hooks/useInseme.js'), 'utf8');
const sendMessageMatches = useInsemeContent.match(/const sendMessage =/g) || [];
if (sendMessageMatches.length > 1) {
    console.log(`❌ Multiple definitions of sendMessage found (${sendMessageMatches.length})`);
} else {
    console.log('✅ sendMessage is defined once');
}

console.log('\nDiagnostic complete.');
