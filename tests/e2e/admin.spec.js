// An admin: the users and pre-approved lists, the manage-user and delete-user
// modals, the pre-approve modal with its validation, and the directory with
// the admin's Edit buttons and manage-link modal.
import { test, expect } from './support/test.js';

test.beforeEach(async ({ app }) => {
    await app.signInAs('admin');
    await app.open();
    await app.settleDashboard();
});

test.describe('admin panel', () => {
    test.beforeEach(async ({ app, page }) => {
        await app.navTo('Admin');
        await expect(page.locator('#page-admin')).toHaveClass(/\bactive\b/);
        await expect(page.locator('#admin-users-wrap tbody tr')).toHaveCount(5);
        await expect(page.locator('#admin-preapproved-wrap tbody tr')).toHaveCount(2);
    });

    test('users and pre-approved users', async ({ app, page }) => {
        await expect(page.locator('#admin-users-wrap .section-title')).toHaveText([
            /Pending Approval \(1\)/,
            /Approved Users \(4\)/,
        ]);
        await expect(page.locator('#admin-preapproved-wrap .section-title')).toContainText('Pre-approved Users (2)');
        expect(app.api.callsTo('GET /admin/users')).toHaveLength(1);
        expect(app.api.callsTo('GET /admin/preapproved')).toHaveLength(1);
        await app.expectView('admin', { fullPage: true });
    });

    test('manage user modal', async ({ app, page }) => {
        await page.locator('#admin-users-wrap tr', { hasText: '@quiet_deer' }).locator('button', { hasText: 'Edit' }).click();
        await expect(page.locator('#modal-admin-manage')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#admin-manage-subtitle')).toHaveText('@quiet_deer · deer@example.com');
        await expect(page.locator('#admin-manage-perm-btns button')).toHaveText(['Grant Editor', 'Revoke Viewer', 'Grant Admin']);
        await expect(page.locator('#admin-manage-username')).toHaveValue('quiet_deer');
        await app.expectView('admin-manage-user');
    });

    test('manage user modal for your own account', async ({ app, page }) => {
        await page.locator('#admin-users-wrap tr', { hasText: '@mod_lynx' }).locator('button', { hasText: 'Edit' }).click();
        await expect(page.locator('#modal-admin-manage')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#admin-manage-perm-btns button')).toHaveText(['Revoke Editor', 'Revoke Viewer']);
        await expect(page.locator('#admin-delete-user-row')).toHaveText('You cannot delete your own account from here.');
        await app.expectView('admin-manage-self');
    });

    test('manage user details validation', async ({ app, page }) => {
        await page.locator('#admin-users-wrap tr', { hasText: '@quiet_deer' }).locator('button', { hasText: 'Edit' }).click();
        await page.locator('#admin-manage-email').fill('deer @example.com');
        await page.locator('#admin-manage-details-btn').click();
        await expect(page.locator('#toast-container')).toContainText('No spaces are allowed in the email address');
        await expect(page.locator('#admin-manage-email')).toHaveClass(/\bis-invalid\b/);
        expect(app.api.callsTo('PUT /admin/users')).toHaveLength(0);
        await app.expectView('admin-manage-user-error-spaces');
    });

    test('delete user confirmation steps', async ({ app, page }) => {
        await page.locator('#admin-users-wrap tr', { hasText: '@quiet_deer' }).locator('button', { hasText: 'Edit' }).click();
        await page.locator('#admin-delete-user-row button', { hasText: 'Delete Account' }).click();
        await expect(page.locator('#modal-admin-delete-user')).toHaveClass(/\bopen\b/);
        const stepText = page.locator('#admin-delete-step-text');
        await expect(stepText).toHaveText("Are you sure you want to delete Quiet Deer's account? All their links will also be deleted.");
        await app.expectView('admin-delete-user-step-1');

        await page.locator('#modal-admin-delete-user button', { hasText: 'Continue →' }).click();
        await expect(stepText).toHaveText('This action is irreversible. Their account and all associated data will be permanently removed.');
        await page.locator('#modal-admin-delete-user button', { hasText: 'Continue →' }).click();
        await expect(stepText).toHaveText('Last chance! Once deleted, you cannot recover this account.');
        await expect(page.locator('#modal-admin-delete-user .admin-delete-step-dot.done')).toHaveCount(3);
        await app.expectView('admin-delete-user-step-3');
        expect(app.api.callsTo('DELETE /admin/users')).toHaveLength(0);
    });

    test('pre-approve user modal and its validation', async ({ app, page }) => {
        await page.locator('#page-admin .page-header button', { hasText: 'Pre-approve User' }).click();
        await expect(page.locator('#modal-add-preapproved')).toHaveClass(/\bopen\b/);
        await app.expectView('admin-add-preapproved');

        await page.locator('#preapproved-email').fill('new editor@example.com');
        await page.locator('#add-preapproved-btn').click();
        await expect(page.locator('#add-preapproved-error')).toHaveText('No spaces are allowed in an email address');
        expect(app.api.callsTo('POST /admin/preapproved')).toHaveLength(0);
        await app.expectView('admin-add-preapproved-error-spaces');

        await page.locator('#preapproved-email').fill('new.editor@example.com');
        await page.locator('#preapproved-role').selectOption('editor');
        await page.locator('#add-preapproved-btn').click();
        await expect(page.locator('#modal-add-preapproved')).not.toHaveClass(/\bopen\b/);
        await expect(page.locator('#toast-container')).toContainText('User pre-approved successfully');
        expect(app.api.callsTo('POST /admin/preapproved').map((call) => call.body)).toEqual([
            { email: 'new.editor@example.com', role: 'editor' },
        ]);
        await expect.poll(() => app.api.callsTo('GET /admin/users').length).toBe(2);
    });
});

test.describe('directory as an admin', () => {
    test.beforeEach(async ({ app, page }) => {
        await app.navTo('Directory');
        await expect(page.locator('#directory-table-wrap tbody tr')).toHaveCount(6);
    });

    test('every link has an Edit button', async ({ app, page }) => {
        await expect(page.locator('#directory-table-wrap button', { hasText: 'Edit' })).toHaveCount(6);
        await expect(page.locator('#directory-table-wrap tbody tr', { hasText: 'You own this' })).toHaveCount(1);
        await app.expectView('directory-admin');
    });

    test('manage short link modal', async ({ app, page }) => {
        await page.locator('#directory-table-wrap tr', { hasText: 'otter-zine' }).locator('button', { hasText: 'Edit' }).click();
        await expect(page.locator('#modal-admin-manage-link')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#admin-manage-link-subtitle')).toHaveText('gftv.asia/otter-zine');
        await expect(page.locator('#admin-link-slug')).toHaveValue('otter-zine');
        await expect(page.locator('#admin-link-status')).toHaveValue('true');
        await expect(page.locator('#admin-link-tags-container .tag-chip')).toHaveCount(2);
        await app.expectView('admin-manage-link');
    });
});
