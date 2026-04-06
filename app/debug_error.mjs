import fs from 'fs';
const raw = fs.readFileSync('test_results.json', 'utf16le');
const jsonStr = raw.substring(raw.indexOf('{'));
const data = JSON.parse(jsonStr);
if (data.error) {
    console.log('ERROR:', JSON.stringify(data.error, null, 2));
} else {
    console.log('SUCCESS (NO ERROR)');
}
