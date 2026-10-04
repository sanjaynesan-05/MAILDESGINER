import type { TemplateId } from '../types/email';

export const templates: { id: TemplateId; name: string; description: string; accent: string }[] = [
  { id: 'professional', name: 'Professional', description: 'Client and project delivery', accent: '#1c4d45' },
  { id: 'minimal', name: 'Minimal', description: 'Simple communication', accent: '#263238' },
  { id: 'announcement', name: 'Announcement', description: 'Launches and events', accent: '#a5482e' },
];
