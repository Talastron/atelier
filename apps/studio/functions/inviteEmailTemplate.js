/**
 * The one-off "you've been invited" email, sent when an owner adds a new
 * email to the allowlist. Kept in its own file since the HTML is long and
 * has nothing to do with the Cloud Function's own logic — index.js just
 * imports buildInviteEmailHtml/buildInviteEmailText and sends them.
 *
 * Email clients don't support external stylesheets reliably, so styling is
 * inline throughout. Font stacks fall back to system serif/sans-serif —
 * the app's actual display font isn't available in email clients. The logo
 * is loaded from the live marketing site rather than attached, since most
 * clients block inline attachments by default anyway.
 */

// The signed-in app lives on its own subdomain, separate from the marketing
// site at myatelier.style — matches EDIT_URL in apps/marketing/src/config.ts,
// which every "Sign In" / "Open Studio" button on the marketing site uses.
const APP_URL = 'https://edit.myatelier.style';
const MARKETING_URL = 'https://myatelier.style';
const LOGO_URL = 'https://myatelier.style/brand/atelier-logo.png';
const PRIVACY_URL = 'https://myatelier.style/legal/privacy';

function buildInviteEmailHtml() {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#F7F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F5F2;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background-color:#FFFFFF;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:36px 40px 0 40px;text-align:center;">
                <a href="${MARKETING_URL}">
                  <img src="${LOGO_URL}" width="120" height="37" alt="Atelier" style="display:block;width:120px;height:37px;margin:0 auto;border:0;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 32px 40px;">
                <h1 style="margin:0 0 20px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.3;color:#1C1917;font-weight:500;">You're in.</h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#57534E;">
                  You've been given your own private wardrobe inside Atelier, a space that's entirely yours. No one else sees what's in it, and you won't see anyone else's.
                </p>
                <p style="margin:0 0 32px 0;font-size:15px;line-height:1.6;color:#57534E;">
                  Add what you own, save the looks that catch your eye, and let the Concierge help you get dressed from what's already there.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:999px;background-color:#1C1917;">
                      <a href="${APP_URL}" style="display:inline-block;padding:14px 32px;font-size:13px;letter-spacing:0.05em;color:#FFFFFF;text-decoration:none;font-weight:500;">Open Atelier</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:32px 0 0 0;font-size:13px;line-height:1.6;color:#A8A29E;">
                  Sign in with this email address and your wardrobe will be ready.
                </p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" style="max-width:480px;">
            <tr>
              <td style="padding:24px 20px 0 20px;text-align:center;">
                <p style="margin:0;font-size:11px;line-height:1.7;color:#A8A29E;">
                  You're receiving this because an Atelier member invited you.<br />
                  Talastron Ltd, registered in England and Wales, Company No. 15464691.<br />
                  Registered office: The Long Barn, Cobham Park Road, Cobham, Surrey, KT11 3NE.<br />
                  <a href="${PRIVACY_URL}" style="color:#A8A29E;text-decoration:underline;">Privacy policy</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildInviteEmailText() {
  return `You're in.

You've been given your own private wardrobe inside Atelier, a space that's entirely yours. No one else sees what's in it, and you won't see anyone else's.

Add what you own, save the looks that catch your eye, and let the Concierge help you get dressed from what's already there.

Open Atelier: ${APP_URL}

Sign in with this email address and your wardrobe will be ready.

---
You're receiving this because an Atelier member invited you.
Talastron Ltd, registered in England and Wales, Company No. 15464691.
Registered office: The Long Barn, Cobham Park Road, Cobham, Surrey, KT11 3NE.
Privacy policy: ${PRIVACY_URL}`;
}

module.exports = { buildInviteEmailHtml, buildInviteEmailText };
