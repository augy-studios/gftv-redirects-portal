import { ok, err, optionsResponse } from '../../lib/response.js';
import { getSessionUser } from '../../lib/auth.js';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

    try {
        const user = await getSessionUser(req);
        if (!user) return err(res, 'Unauthorized', 401);

        const secret = authenticator.generateSecret();
        const account = user.email || user.username;
        const otpauthUrl = authenticator.keyuri(account, 'GFTV Portal', secret);

        const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 200, margin: 2 });

        return ok(res, { secret, qr_data_url: qrDataUrl });
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}
