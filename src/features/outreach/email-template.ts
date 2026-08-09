type OutreachEmailTemplateInput = {
    bodyHtml: string;
    previewText?: string | null;
    unsubscribeUrl: string;
    brandName: string;
    siteUrl: string;
    logoUrl?: string | null;
    footerText?: string | null;
};

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function renderOutreachEmailHtml(input: OutreachEmailTemplateInput) {
    const baseUrl = input.siteUrl.replace(/\/$/, "");
    const brandName = escapeHtml(input.brandName);
    const preview = escapeHtml(
        input.previewText?.replace(/\s+/g, " ").slice(0, 180)
        ?? `A short note from ${input.brandName}.`,
    );
    const logo = input.logoUrl
        ? `<img src="${escapeHtml(input.logoUrl)}" width="132" alt="${brandName}" style="display:block;border:0;outline:none;text-decoration:none;height:auto;">`
        : `<strong style="font-size:20px;line-height:1.2;color:#0f172a;">${brandName}</strong>`;
    const footerText = escapeHtml(
        input.footerText
        ?? `${input.brandName} sends reviewed business outreach with a clear unsubscribe path.`,
    );
    const siteLabel = escapeHtml(new URL(baseUrl).hostname);

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${brandName} outreach</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f8;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f8;margin:0;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe4e7;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 30px 20px;border-bottom:1px solid #e7eef0;background:#ffffff;">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="padding:30px;color:#172033;font-size:16px;line-height:1.65;">
              <div style="max-width:560px;">
                ${input.bodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 30px 28px;background:#0f172a;color:#cbd5e1;font-size:12px;line-height:1.55;">
              <p style="margin:0 0 10px;">${footerText}</p>
              <p style="margin:0;">
                <a href="${baseUrl}" style="color:#a7f3d0;text-decoration:none;">${siteLabel}</a>
                <span style="color:#64748b;">&nbsp;|&nbsp;</span>
                <a href="${input.unsubscribeUrl}" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe</a>
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
