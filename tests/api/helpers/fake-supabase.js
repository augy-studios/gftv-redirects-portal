// Fake @supabase/supabase-js for the API handler tests. Run the tests with `npm test`.
//
// tests/api/index.js maps the '@supabase/supabase-js' specifier to this file, so lib/supabase.js
// gets this createClient instead of the real one. No network calls are made.
//
// Tests drive it through the exported `fake` controller:
//   fake.reset(rules)  clear the call log and set the replies for the next handler call
//   fake.log()         one signature string per query the handler awaited, in order, e.g.
//                      'from(gftvhello_users).update({is_editor,updated_at}).eq(id)'
//   fake.calls         the raw call records (payloads, filter values, rpc parameters)
//
// A rule is { table?, operation?, rpc?, bucket?, columns?, eq?, reply }. The `rpc` and `eq` keys
// keep the names of the supabase-js methods they match. The first rule whose given fields all
// match the call wins; `reply` is { data, error, count } or a function of the call. A call that
// matches no rule gets { data: null, error: null, count: null }.
//
// Only the query builder methods the handlers actually use are implemented, so a call to any
// other method fails loudly with a TypeError.

const state = {
    rules: [],
    calls: [],
    clientArguments: [],
};

const EMPTY_REPLY = { data: null, error: null, count: null };

function normaliseColumns(columns) {
    let normalised;
    if (columns === undefined) {
        normalised = '';
    } else {
        normalised = String(columns).replace(/\s+/g, ' ').trim();
    }
    return normalised;
}

function sortObjectKeys(object) {
    const sorted = {};
    for (const key of Object.keys(object).sort()) sorted[key] = object[key];
    return sorted;
}

// {a:1,b:'x'} -> '{a:1,b:x}' (keys sorted, values shown, no quotes)
function formatOptions(options) {
    return JSON.stringify(sortObjectKeys(options)).replace(/"/g, '');
}

// The options argument to append after the other arguments: separator + '{…}', or '' when there is none.
function formatOptionalOptions(options, separator) {
    let formatted;
    if (options) {
        formatted = separator + formatOptions(options);
    } else {
        formatted = '';
    }
    return formatted;
}

// {b:1,a:2} -> '{a,b}'; [{x,y},{x,y}] -> '[{x,y}]' (one entry per distinct key set)
function formatKeys(payload) {
    if (Array.isArray(payload)) {
        const keySets = [...new Set(payload.map(item => formatKeys(item)))];
        return `[${keySets.join(',')}]`;
    }
    if (payload && typeof payload === 'object') return `{${Object.keys(payload).sort().join(',')}}`;
    return String(payload);
}

// Formats one method chained after the first operation, such as '.eq(token)' or
// '.order(created_at,{ascending:false})'. Filters show the column only, because their values
// change from call to call; literal arguments (limit, range, is, or) are shown in full.
function formatStep({ name, argumentsList }) {
    switch (name) {
        case 'eq':
        case 'neq':
        case 'gt':
        case 'ilike':
        case 'contains':
            return `.${name}(${argumentsList[0]})`;
        case 'is':
            return `.is(${argumentsList[0]},${String(argumentsList[1])})`;
        case 'or':
            return `.or(${JSON.stringify(argumentsList[0])})`;
        case 'order': {
            const orderOptions = formatOptionalOptions(argumentsList[1], ',');
            return `.order(${argumentsList[0]}${orderOptions})`;
        }
        case 'limit':
            return `.limit(${argumentsList[0]})`;
        case 'range':
            return `.range(${argumentsList[0]},${argumentsList[1]})`;
        case 'select':
            return `.select(${JSON.stringify(normaliseColumns(argumentsList[0]))})`;
        case 'single':
        case 'maybeSingle':
            return `.${name}()`;
        default:
            throw new Error(`fake-supabase: no format for step ${name}`);
    }
}

// The one-line signature of a recorded call, as the tests compare it.
export function signature(call) {
    if (call.kind === 'rpc') return `rpc(${call.functionName},${formatKeys(call.parameters ?? {})})`;
    if (call.kind === 'storage') {
        const storageOptions = formatOptionalOptions(call.options, ',');
        return `storage.from(${call.bucket}).${call.operation}(${call.path}${storageOptions})`;
    }
    let text = `from(${call.table})`;
    if (call.operation === 'select') {
        const selectOptions = formatOptionalOptions(call.selectOptions, ', ');
        text += `.select(${JSON.stringify(call.columns)}${selectOptions})`;
    } else if (call.operation === 'delete') {
        text += '.delete()';
    } else {
        const mutateOptions = formatOptionalOptions(call.mutateOptions, ',');
        text += `.${call.operation}(${formatKeys(call.payload)}${mutateOptions})`;
    }
    for (const step of call.steps) text += formatStep(step);
    return text;
}

// The value a call filtered `column` on with .eq(), if it did.
function findEqualsValue(call, column) {
    const equalsStep = call.steps.find(step => step.name === 'eq' && step.argumentsList[0] === column);
    let result;
    if (equalsStep) {
        result = { found: true, value: equalsStep.argumentsList[1] };
    } else {
        result = { found: false };
    }
    return result;
}

function ruleMatches(rule, call) {
    if (rule.table !== undefined && rule.table !== call.table) return false;
    if (rule.operation !== undefined && rule.operation !== call.operation) return false;
    if (rule.rpc !== undefined && rule.rpc !== call.functionName) return false;
    if (rule.bucket !== undefined && rule.bucket !== call.bucket) return false;
    if (rule.columns !== undefined && normaliseColumns(rule.columns) !== call.columns) return false;
    if (rule.eq) {
        for (const [column, value] of Object.entries(rule.eq)) {
            const match = findEqualsValue(call, column);
            if (!match.found || match.value !== value) return false;
        }
    }
    return true;
}

function resolveReply(call, fallbackReply = EMPTY_REPLY) {
    state.calls.push(call);
    const rule = state.rules.find(candidate => ruleMatches(candidate, call));
    if (!rule) return { ...fallbackReply };
    let reply;
    if (typeof rule.reply === 'function') {
        reply = rule.reply(call);
    } else {
        reply = rule.reply;
    }
    return { ...EMPTY_REPLY, ...(reply || {}) };
}

// Awaiting a chain runs it: record the call and settle with the matching rule's reply.
function settle(call, onFulfilled, onRejected) {
    let result;
    try {
        result = Promise.resolve(resolveReply(call));
    } catch (error) {
        result = Promise.reject(error);
    }
    return result.then(onFulfilled, onRejected);
}

// A chainable stand-in for the supabase-js query builder: the first method picks the operation
// (select, insert, update, upsert or delete), every later method is recorded as a step, and
// awaiting the chain records the whole call.
class FakeQuery {
    constructor(table) {
        this.call = { kind: 'query', table, operation: null, columns: undefined, steps: [] };
    }

    #start(operation, fields) {
        if (this.call.operation) {
            throw new Error(`fake-supabase: ${operation}() after ${this.call.operation}() on ${this.call.table}`);
        }
        this.call.operation = operation;
        Object.assign(this.call, fields);
        return this;
    }

    #step(name, argumentsList) {
        if (!this.call.operation) {
            throw new Error(`fake-supabase: ${name}() before select/insert/update/upsert/delete`);
        }
        this.call.steps.push({ name, argumentsList });
        return this;
    }

    select(columns, options) {
        if (this.call.operation) return this.#step('select', [columns]); // returning columns after a mutation
        return this.#start('select', { columns: normaliseColumns(columns ?? '*'), selectOptions: options });
    }

    insert(payload, options) { return this.#start('insert', { payload, mutateOptions: options }); }
    update(payload, options) { return this.#start('update', { payload, mutateOptions: options }); }
    upsert(payload, options) { return this.#start('upsert', { payload, mutateOptions: options }); }
    delete(options) { return this.#start('delete', { mutateOptions: options }); }

    eq(...argumentsList) { return this.#step('eq', argumentsList); }
    neq(...argumentsList) { return this.#step('neq', argumentsList); }
    gt(...argumentsList) { return this.#step('gt', argumentsList); }
    is(...argumentsList) { return this.#step('is', argumentsList); }
    or(...argumentsList) { return this.#step('or', argumentsList); }
    ilike(...argumentsList) { return this.#step('ilike', argumentsList); }
    contains(...argumentsList) { return this.#step('contains', argumentsList); }
    order(...argumentsList) { return this.#step('order', argumentsList); }
    limit(...argumentsList) { return this.#step('limit', argumentsList); }
    range(...argumentsList) { return this.#step('range', argumentsList); }
    single() { return this.#step('single', []); }
    maybeSingle() { return this.#step('maybeSingle', []); }

    then(onFulfilled, onRejected) {
        return settle(this.call, onFulfilled, onRejected);
    }
}

class FakeRpc {
    constructor(functionName, parameters) {
        this.call = { kind: 'rpc', operation: 'rpc', functionName, parameters };
    }

    then(onFulfilled, onRejected) {
        return settle(this.call, onFulfilled, onRejected);
    }
}

// The fake client: from() and rpc() as above, plus the two storage methods api/profile/avatar.js
// uses. Storage calls are recorded too; by default upload succeeds and getPublicUrl builds the
// public URL from the client's project URL.
function makeClient(projectUrl) {
    return {
        from(table) {
            return new FakeQuery(table);
        },
        rpc(functionName, parameters) {
            return new FakeRpc(functionName, parameters);
        },
        storage: {
            from(bucket) {
                return {
                    async upload(path, body, options) {
                        const call = {
                            kind: 'storage', operation: 'upload', bucket, path, options,
                            bodyLength: body?.length,
                        };
                        return resolveReply(call, { data: { path }, error: null });
                    },
                    getPublicUrl(path) {
                        const call = { kind: 'storage', operation: 'getPublicUrl', bucket, path };
                        const publicUrl = `${projectUrl}/storage/v1/object/public/${bucket}/${path}`;
                        return resolveReply(call, { data: { publicUrl } });
                    },
                };
            },
        },
    };
}

export function createClient(projectUrl, key) {
    state.clientArguments.push({ url: projectUrl, key });
    return makeClient(projectUrl);
}

export const fake = {
    reset(rules = []) {
        state.rules = rules;
        state.calls = [];
    },
    get calls() {
        return state.calls;
    },
    get clientArguments() {
        return state.clientArguments;
    },
    log() {
        return state.calls.map(signature);
    },
    // The first recorded query on `table` with this operation (handy for payload value checks).
    find(table, operation) {
        return state.calls.find(call => call.table === table && call.operation === operation);
    },
};
