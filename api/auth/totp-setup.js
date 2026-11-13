// GET /api/auth/totp-setup: starts 2FA setup. Makes a new TOTP secret and a QR code of it for an
// authenticator app. Nothing is saved: /api/auth/totp-enable saves the secret once a code checks out.
// Who can call it: any signed-in user (session token).
import { sendSuccess, sendError, sendOptionsResponse } from '../../lib/response.js';
import { getSessionUser } from '../../lib/auth.js';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'GET') return sendError(response, 'Method not allowed', 405);

    try {
        const user = await getSessionUser(request);
        if (!user) return sendError(response, 'Unauthorized', 401);

        const secret = authenticator.generateSecret();
        const account = user.email || user.username;
        const otpauthUrl = authenticator.keyuri(account, 'GFTV Hello Apps', secret);

        const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 200, margin: 2 });

        return sendSuccess(response, { secret, qr_data_url: qrDataUrl });
    } catch (error) {
        console.error(error);
        return sendError(response, 'Server error', 500);
    }
}
