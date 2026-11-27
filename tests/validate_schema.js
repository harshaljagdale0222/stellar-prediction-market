// SPDX-License-Identifier: MIT
// Schema validation test script for WP5-B.3: wtf-prediction-market/event_schema.json

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'event_schema.json');
console.log(`Loading schema from: ${schemaPath}`);

if (!fs.existsSync(schemaPath)) {
    console.error(`FAIL: Schema file not found at ${schemaPath}`);
    process.exit(1);
}

const raw = fs.readFileSync(schemaPath, 'utf8');
let schema;
try {
    schema = JSON.parse(raw);
} catch (e) {
    console.error(`FAIL: Invalid JSON in event_schema.json: ${e.message}`);
    process.exit(1);
}

const requiredEvents = [
    'MarketCreated',
    'TradePlaced',
    'LiquidityAdded',
    'MarketResolved',
    'DisputeWindowOpen',
    'DisputeWindowClosed'
];

let errors = [];

// 1. Verify schema top-level metadata
if (!schema.title || !schema.events) {
    errors.push('Schema missing title or events object');
}

// 2. Verify all required events exist
for (const ev of requiredEvents) {
    if (!schema.events[ev]) {
        errors.push(`Missing event definition: ${ev}`);
        continue;
    }

    const def = schema.events[ev];
    if (def.name !== ev) {
        errors.push(`Event ${ev} name mismatch: found ${def.name}`);
    }
    if (!Array.isArray(def.topics) || def.topics.length < 2) {
        errors.push(`Event ${ev} must define an array of topics (>= 2)`);
    }
    if (!def.data || !Array.isArray(def.data.fields) || def.data.fields.length === 0) {
        errors.push(`Event ${ev} missing data.fields definition`);
    }
    if (!def.example || !Array.isArray(def.example.topics) || !def.example.data) {
        errors.push(`Event ${ev} missing valid example with topics and data`);
    }

    // Verify example data fields match defined fields
    if (def.data && def.data.fields && def.example && def.example.data) {
        for (const f of def.data.fields) {
            if (def.example.data[f.name] === undefined) {
                errors.push(`Event ${ev} example missing field: ${f.name}`);
            }
        }
    }
}

if (errors.length > 0) {
    console.error('FAIL: Schema validation failed with errors:');
    errors.forEach(e => console.error(` - ${e}`));
    process.exit(1);
}

console.log('SUCCESS: All 6 required Soroban events are strictly valid and comply with schema:');
for (const ev of requiredEvents) {
    const d = schema.events[ev];
    console.log(` [PASS] ${ev} (${d.topics.length} topics, ${d.data.fields.length} data fields)`);
}
