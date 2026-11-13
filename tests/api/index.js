// Entry point for the API handler tests. Run them with `npm test` (`node --test tests/api`
// resolves the directory to this file). All the *.test.js files run in this one process.
//
// 1. Stub the env values lib/supabase.js reads (this process only; never a real .env).
// 2. Map '@supabase/supabase-js' to helpers/fake-supabase.js with a synchronous resolve hook,
//    before anything under api/ or lib/ is imported.
// 3. Turn off fetch so nothing can reach the network.
// 4. Import every tests/api/*.test.js in sorted order.

import { registerHooks } from 'node:module';
import { readdirSync } from 'node:fs';

process.env.SUPABASE_URL = 'https://fake-project.supabase.example.com';
process.env.SUPABASE_SERVICE_KEY = 'fake-service-key-for-tests';

const fakeSupabaseUrl = new URL('./helpers/fake-supabase.js', import.meta.url).href;

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === '@supabase/supabase-js') {
            return { url: fakeSupabaseUrl, format: 'module', shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});

globalThis.fetch = async (input) => {
    throw new Error(`fetch is disabled in the API tests (tried ${String(input)})`);
};

const testDir = new URL('./', import.meta.url);
const testFiles = readdirSync(testDir).filter(fileName => fileName.endsWith('.test.js')).sort();

for (const fileName of testFiles) {
    await import(new URL(fileName, testDir).href);
}
