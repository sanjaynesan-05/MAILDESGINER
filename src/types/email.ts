export type TemplateId = 'professional' | 'minimal' | 'announcement';

export type TypographyTarget = 'title' | 'heading' | 'body' | 'list' | 'table' | 'button' | 'signature';
export type TypographyStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  color: string;
  backgroundColor: string;
};

export type EmailTable = {
  rows: string[][];
  header: boolean;
  align: 'left' | 'center' | 'right';
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
};

export type SectionBlock = {
  id: string;
  type: 'paragraph' | 'list' | 'image' | 'cta' | 'divider' | 'table';
  content: string;
  items: string[];
  ordered: boolean;
  imageUrl: string;
  imageAlt: string;
  ctaLabel: string;
  ctaUrl: string;
  table?: EmailTable;
};

export type EmailSection = {
  id: string;
  heading: string;
  content: string;
  bullets: string[];
  blocks?: SectionBlock[];
};

export type EmailDraft = {
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  greeting: string;
  title: string;
  body: string;
  sections: EmailSection[];
  closing: string;
  signature: string;
  ctaLabel: string;
  ctaUrl: string;
  template: TemplateId;
  typography: Record<TypographyTarget, TypographyStyle>;
};

export type AttachmentItem = { id: string; file: File };
