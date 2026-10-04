export type TemplateId = 'professional' | 'minimal' | 'announcement';

export type EmailSection = {
  id: string;
  heading: string;
  content: string;
  bullets: string[];
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
};

export type AttachmentItem = { id: string; file: File };
