// Reply shapes and DB calls for api/auth/totp-setup.js, totp-enable.js, totp-disable.js,
// totp-verify.js and backup-codes-regenerate.js. Uses the real otplib, qrcode and bcryptjs.
// Run with `npm test` (tests/api/index.js installs the fake Supabase first).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticator } from 'otplib';
import { fake } from './helpers/fake-supabase.js';
import { callHandler } from './helpers/http.js';
import { expectReply, MESSAGE_SHAPE } from './helpers/shape.js';
import {
    BACKUP_CODE, CHALLENGE_TOKEN, editor, editorWith2fa, FAR_FUTURE, IDS, PASSWORD, PASSWORD_HASH,
    PUBLIC_USER_SHAPE, sessionAs, SESSION_HEADERS, SESSION_LOOKUP, hashBackupCode, TOTP_SECRET,
} from './helpers/fixtures.js';

import totpSetup from '../../api/auth/totp-setup.js';
import totpEnable from '../../api/auth/totp-enable.js';
import totpDisable from '../../api/auth/totp-disable.js';
import totpVerify from '../../api/auth/totp-verify.js';
import backupCodesRegenerate from '../../api/auth/backup-codes-regenerate.js';

const SESSION_INSERT = 'from(gftvhello_sessions).insert({expires_at,token,user_id})';

function assertBackupCodes(reply) {
    const codes = reply.json.backup_codes;
    assert.equal(codes.length, 10);
    for (const code of codes) assert.match(code, /^[0-9A-F]{5}-[0-9A-F]{5}$/);
    const rows = fake.find('gftvhello_backup_codes', 'insert').payload;
    assert.deepStrictEqual(rows.map(row => row.code_hash), codes.map(hashBackupCode), 'stored hashes match the codes');
}

describe('api/auth/totp-setup.js', () => {
    test('GET: new secret and QR code', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(totpSetup, { method: 'GET', url: '/api/auth/totp-setup', headers: SESSION_HEADERS });
        expectReply(reply, 200, { success: 'boolean', secret: 'string', qr_data_url: 'string' });
        assert.match(reply.json.qr_data_url, /^data:image\/png;base64,/);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP]);
    });
});

describe('api/auth/totp-enable.js', () => {
    test('POST: valid code enables 2FA and returns backup codes', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(totpEnable, {
            method: 'POST', url: '/api/auth/totp-enable', headers: SESSION_HEADERS,
            body: { secret: TOTP_SECRET, code: authenticator.generate(TOTP_SECRET) },
        });
        expectReply(reply, 200, { success: 'boolean', message: 'string', backup_codes: ['string'] });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users).update({totp_secret}).eq(id)',
            'from(gftvhello_backup_codes).delete().eq(user_id)',
            'from(gftvhello_backup_codes).insert([{code_hash,user_id}])',
        ]);
        assertBackupCodes(reply);
    });
});

describe('api/auth/totp-disable.js', () => {
    test('POST: correct password disables 2FA', async () => {
        fake.reset([
            sessionAs(editorWith2fa()),
            { table: 'gftvhello_users', operation: 'select', reply: { data: { password_hash: PASSWORD_HASH } } },
        ]);
        const reply = await callHandler(totpDisable, {
            method: 'POST', url: '/api/auth/totp-disable', headers: SESSION_HEADERS, body: { password: PASSWORD },
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users).select("password_hash").eq(id).single()',
            'from(gftvhello_users).update({totp_secret}).eq(id)',
            'from(gftvhello_trusted_devices).delete().eq(user_id)',
            'from(gftvhello_backup_codes).delete().eq(user_id)',
        ]);
    });
});

// The second login step: a TOTP code or a single-use backup code turns the challenge into a session.
describe('api/auth/totp-verify.js', () => {
    const challengeRule = {
        table: 'gftvhello_totp_challenges', operation: 'select', eq: { token: CHALLENGE_TOKEN },
        reply: {
            data: {
                token: CHALLENGE_TOKEN, user_id: IDS.editor, expires_at: FAR_FUTURE,
                gftvhello_users: editorWith2fa(),
            },
        },
    };
    const CHALLENGE_LOG = [
        'from(gftvhello_totp_challenges).select("*, gftvhello_users(*)").eq(token).gt(expires_at).single()',
        'from(gftvhello_totp_challenges).delete().eq(token)',
    ];

    test('POST: TOTP code, trust this device, remember me', async () => {
        fake.reset([challengeRule]);
        const reply = await callHandler(totpVerify, {
            method: 'POST', url: '/api/auth/totp-verify',
            body: {
                challenge_token: CHALLENGE_TOKEN, code: authenticator.generate(TOTP_SECRET),
                trust_device: true, remember: true,
            },
        });
        expectReply(reply, 200, {
            success: 'boolean', token: 'string', user: PUBLIC_USER_SHAPE, device_token: 'string', remember: 'boolean',
        });
        assert.equal(reply.json.user.totp_enabled, true);
        assert.deepStrictEqual(fake.log(), [
            ...CHALLENGE_LOG,
            SESSION_INSERT,
            'from(gftvhello_trusted_devices).insert({device_token,expires_at,user_id})',
        ]);
        assert.equal(fake.find('gftvhello_trusted_devices', 'insert').payload.device_token, reply.json.device_token);
    });

    test('POST: backup code, device not trusted', async () => {
        fake.reset([
            challengeRule,
            {
                table: 'gftvhello_backup_codes', operation: 'select', eq: { code_hash: hashBackupCode(BACKUP_CODE) },
                reply: { data: { id: IDS.backupCode } },
            },
        ]);
        const reply = await callHandler(totpVerify, {
            method: 'POST', url: '/api/auth/totp-verify',
            body: { challenge_token: CHALLENGE_TOKEN, backup_code: ` ${BACKUP_CODE.toLowerCase()} ` },
        });
        expectReply(reply, 200, {
            success: 'boolean', token: 'string', user: PUBLIC_USER_SHAPE, device_token: 'null', remember: 'boolean',
        });
        assert.deepStrictEqual(fake.log(), [
            ...CHALLENGE_LOG,
            'from(gftvhello_backup_codes).select("id").eq(user_id).eq(code_hash).single()',
            'from(gftvhello_backup_codes).delete().eq(id)',
            SESSION_INSERT,
        ]);
    });
});

describe('api/auth/backup-codes-regenerate.js', () => {
    test('POST: correct password, fresh backup codes', async () => {
        fake.reset([
            sessionAs(editorWith2fa()),
            {
                table: 'gftvhello_users', operation: 'select',
                reply: { data: { password_hash: PASSWORD_HASH, totp_secret: TOTP_SECRET } },
            },
        ]);
        const reply = await callHandler(backupCodesRegenerate, {
            method: 'POST', url: '/api/auth/backup-codes-regenerate', headers: SESSION_HEADERS, body: { password: PASSWORD },
        });
        expectReply(reply, 200, { success: 'boolean', backup_codes: ['string'] });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users).select("password_hash, totp_secret").eq(id).single()',
            'from(gftvhello_backup_codes).delete().eq(user_id)',
            'from(gftvhello_backup_codes).insert([{code_hash,user_id}])',
        ]);
        assertBackupCodes(reply);
    });
});
