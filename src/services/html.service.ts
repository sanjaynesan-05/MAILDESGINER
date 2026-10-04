import type { EmailDraft, EmailSection, EmailTable, SectionBlock, TypographyStyle } from '../types/email';

const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[character] ?? character);
const safeUrl = (value: string) => /^https?:\/\//i.test(value.trim()) ? value.trim() : '#';
const css = (style: TypographyStyle) => `font-family:${style.fontFamily};font-size:${style.fontSize}px;font-weight:${style.fontWeight};line-height:${style.lineHeight};letter-spacing:${style.letterSpacing}px;text-align:${style.textAlign};color:${style.color};background-color:${style.backgroundColor};`;
const text = (value: string) => escapeHtml(value).replace(/\n/g, '<br>');
const richText = (value: string) => value.replace(/<!--.*?-->/gs, '').replace(/<([^>]+)>/g, (tag, inside: string) => { const match = inside.trim().match(/^\/?([a-z0-9]+)/i); if (!match) return ''; const rawName = match[1].toLowerCase(); const name = rawName === 'div' ? 'p' : rawName; if (!['strong', 'b', 'em', 'i', 'u', 'a', 'p', 'br', 'ul', 'ol', 'li', 'font'].includes(name) && rawName !== 'div') return ''; if (inside.trim().startsWith('/')) return name === 'font' ? '</span>' : `</${name}>`; if (name === 'a') { const href = inside.match(/href\s*=\s*["'](https?:\/\/[^"']+)["']/i)?.[1]; return href ? `<a href="${escapeHtml(href)}" style="color:#1c5148;text-decoration:underline;">` : ''; } if (name === 'font') { const color = inside.match(/color\s*=\s*["'](#[0-9a-f]{3,8})["']/i)?.[1]; const size = inside.match(/size\s*=\s*["']([1-7])["']/i)?.[1]; return `<span style="${color ? `color:${color};` : ''}${size ? `font-size:${size === '2' ? 12 : size === '4' ? 18 : size === '5' ? 22 : 15}px;` : ''}">`; } return `<${name}>`; });
const defaultStyle = (target: string): TypographyStyle => ({ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: target === 'title' ? 28 : 15, fontWeight: target === 'heading' || target === 'title' ? 700 : 400, lineHeight: 1.6, letterSpacing: 0, textAlign: 'left', color: '#17211e', backgroundColor: 'transparent' });
const styleFor = (draft: EmailDraft, target: keyof EmailDraft['typography']) => draft.typography?.[target] ?? defaultStyle(target);

const renderTable = (table: EmailTable, style: TypographyStyle) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${css(style)}"><tbody>${table.rows.map((row, rowIndex) => `<tr>${row.map((cell) => `<td style="padding:${table.cellPadding}px;border:${table.borderWidth}px solid ${escapeHtml(table.borderColor)};text-align:${table.align};font-size:${table.fontSize}px;font-weight:${rowIndex === 0 && table.header ? 700 : table.fontWeight};color:${escapeHtml(table.color)};background-color:${rowIndex === 0 && table.header ? escapeHtml(table.backgroundColor) : '#ffffff'};">${text(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

const renderBlock = (block: SectionBlock, draft: EmailDraft) => {
  const bodyStyle = styleFor(draft, 'body');
  if (block.type === 'paragraph') return `<div style="margin:0 0 18px;${css(bodyStyle)}">${richText(block.content)}</div>`;
  if (block.type === 'list') { const tag = block.ordered ? 'ol' : 'ul'; return `<${tag} style="margin:0 0 18px;padding-left:22px;${css(styleFor(draft, 'list'))}">${block.items.filter(Boolean).map((item) => `<li>${richText(item)}</li>`).join('')}</${tag}>`; }
  if (block.type === 'image' && block.imageUrl) return `<img src="${escapeHtml(safeUrl(block.imageUrl))}" alt="${escapeHtml(block.imageAlt)}" style="display:block;max-width:100%;height:auto;margin:0 0 20px;" />`;
  if (block.type === 'divider') return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 0 22px;border-bottom:1px solid #dfe5df;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>`;
  if (block.type === 'cta' && block.ctaLabel && block.ctaUrl) return `<p style="margin:4px 0 22px;text-align:${styleFor(draft, 'button').textAlign};"><a href="${escapeHtml(safeUrl(block.ctaUrl))}" style="display:inline-block;padding:13px 20px;border-radius:3px;text-decoration:none;${css(styleFor(draft, 'button'))}">${text(block.ctaLabel)}</a></p>`;
  if (block.type === 'table' && block.table) return `<div style="margin:0 0 22px;overflow-x:auto;">${renderTable(block.table, styleFor(draft, 'table'))}</div>`;
  return '';
};

const renderSection = (section: EmailSection, draft: EmailDraft) => {
  const blocks = section.blocks?.length ? section.blocks : [{ id: `${section.id}-legacy`, type: 'paragraph' as const, content: section.content, items: [], ordered: false, imageUrl: '', imageAlt: '', ctaLabel: '', ctaUrl: '' }];
  return `<tr><td style="padding:0 44px 22px;"><h2 style="margin:0 0 10px;${css(styleFor(draft, 'heading'))}">${text(section.heading)}</h2>${blocks.map((block) => renderBlock(block, draft)).join('')}</td></tr>`;
};

export function generateEmailHtml(draft: EmailDraft, logoSrc = ''): string {
  const accent = '#1c5148';
  const header = '#ffffff';
  const titleStyle = styleFor(draft, 'title');
  const bodyStyle = styleFor(draft, 'body');
  const signatureStyle = styleFor(draft, 'signature');
  const globalBody = `margin:0;padding:0;background:#f3f1ec;font-family:Arial,Helvetica,sans-serif;color:#17211e;`;
  const greeting = `<p style="margin:0 0 18px;${css(bodyStyle)}">${text(draft.greeting || 'Hello,')}</p>`;
  const body = draft.body ? `<div style="margin:0 0 18px;${css(bodyStyle)}">${richText(draft.body)}</div>` : '';
  const legacyCta = draft.ctaLabel && draft.ctaUrl ? `<tr><td style="padding:2px 44px 28px;"><a href="${escapeHtml(safeUrl(draft.ctaUrl))}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:3px;${css(styleFor(draft, 'button'))}">${text(draft.ctaLabel)}</a></td></tr>` : '';
  const logo = logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="JSN Designs" width="92" style="display:block;width:92px;height:auto;margin-bottom:24px;" />` : '<div style="font-size:12px;letter-spacing:3px;color:#ffffff;font-weight:bold;margin-bottom:24px;">JSN DESIGNS</div>';
  return `<!doctype html><html><body style="${globalBody}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f1ec;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;"><tr><td style="background:${header};padding:25px 44px 30px;border-bottom:1px solid #e7ece8;">${logo}<h1 style="margin:0;color:#17211e;${css({ ...titleStyle, color: '#17211e', backgroundColor: 'transparent' })}">${text(draft.title || 'A considered note')}</h1></td></tr><tr><td style="padding:34px 44px 12px;">${greeting}${body}</td></tr>${draft.sections.map((section) => renderSection(section, draft)).join('')}${legacyCta}<tr><td style="padding:4px 44px 34px;border-top:1px solid #e7ece8;"><p style="margin:24px 0 8px;${css(bodyStyle)}">${text(draft.closing)}</p><p style="margin:0;white-space:pre-line;${css(signatureStyle)}">${text(draft.signature)}</p></td></tr></table></td></tr></table></body></html>`;
}
