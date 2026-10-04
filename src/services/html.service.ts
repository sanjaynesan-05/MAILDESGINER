import type { EmailDraft } from '../types/email';

const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[character] ?? character);
const safeUrl = (value: string) => /^https?:\/\//i.test(value.trim()) ? value.trim() : '#';
const paragraphs = (value: string) => value.split(/\n\s*\n/).filter(Boolean).map((part) => `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#4b5752;">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('');

export function generateEmailHtml(draft: EmailDraft): string {
  const isAnnouncement = draft.template === 'announcement';
  const isMinimal = draft.template === 'minimal';
  const accent = isAnnouncement ? '#a5482e' : isMinimal ? '#263238' : '#1c4d45';
  const header = isAnnouncement ? '#2a2522' : '#17211e';
  const sections = draft.sections.map((section) => `<tr><td style="padding:0 44px 22px;"><h2 style="margin:0 0 9px;color:#17211e;font-size:18px;line-height:1.3;">${escapeHtml(section.heading)}</h2>${paragraphs(section.content)}${section.bullets.length ? `<ul style="margin:0;padding-left:20px;color:#4b5752;font-size:15px;line-height:1.8;">${section.bullets.filter(Boolean).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}</td></tr>`).join('');
  const cta = draft.ctaLabel && draft.ctaUrl ? `<tr><td style="padding:2px 44px 28px;"><a href="${escapeHtml(safeUrl(draft.ctaUrl))}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:5px;font-size:14px;font-weight:bold;">${escapeHtml(draft.ctaLabel)}</a></td></tr>` : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f5f2;font-family:Arial,Helvetica,sans-serif;color:#17211e;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f5f2;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;"><tr><td style="background:${header};padding:34px 44px;"><div style="font-size:11px;letter-spacing:2px;color:#9ad4c5;font-weight:bold;text-transform:uppercase;">JSN DESIGNS</div><h1 style="margin:13px 0 0;color:#ffffff;font-size:28px;line-height:1.2;">${escapeHtml(draft.title || 'A note from JSN Designs')}</h1></td></tr><tr><td style="padding:34px 44px 12px;"><p style="margin:0 0 18px;font-size:16px;line-height:1.7;">${escapeHtml(draft.greeting || 'Hello,')}</p>${paragraphs(draft.body)}</td></tr>${sections}${cta}<tr><td style="padding:4px 44px 34px;border-top:1px solid #e7ece8;"><p style="margin:24px 0 8px;font-size:15px;line-height:1.6;color:#4b5752;">${escapeHtml(draft.closing)}</p><p style="margin:0;font-size:15px;line-height:1.6;font-weight:bold;white-space:pre-line;">${escapeHtml(draft.signature)}</p></td></tr></table></td></tr></table></body></html>`;
}
