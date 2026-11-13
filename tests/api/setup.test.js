// Sanity checks for the test harness itself. Run with `npm test` (tests/api/index.js is the entry).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fake } from './helpers/fake-supabase.js';
import supabase from '../../lib/supabase.js';

test('lib/supabase.js gets the fake client, built from SUPABASE_URL and SUPABASE_SERVICE_KEY', () => {
    assert.equal(typeof supabase.from, 'function');
    assert.deepStrictEqual(fake.clientArguments, [
        { url: 'https://fake-project.supabase.example.com', key: 'fake-service-key-for-tests' },
    ]);
});

test('the fake records chains and answers from the first matching rule', async () => {
    fake.reset([{ table: 't', operation: 'select', eq: { id: 1 }, reply: { data: { id: 1 } } }]);
    const hit = await supabase.from('t').select('id, name').eq('id', 1).single();
    const miss = await supabase.from('t').select('id').eq('id', 2).maybeSingle();
    assert.deepStrictEqual(hit, { data: { id: 1 }, error: null, count: null });
    assert.deepStrictEqual(miss, { data: null, error: null, count: null });
    assert.deepStrictEqual(fake.log(), [
        'from(t).select("id, name").eq(id).single()',
        'from(t).select("id").eq(id).maybeSingle()',
    ]);
});
