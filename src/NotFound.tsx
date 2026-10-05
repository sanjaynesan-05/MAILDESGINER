import { Mail } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 60% 0%, #fffdf8 0%, #f5f3ee 50%, #efeee8 100%)',
      fontFamily: "'Manrope', system-ui, sans-serif",
      padding: '32px 16px',
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#e8f4ee', color: '#1c5148',
          display: 'grid', placeItems: 'center', margin: '0 auto 20px',
        }}>
          <Mail size={24} />
        </div>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#7a9088', textTransform: 'uppercase', margin: '0 0 8px' }}>
          404 · Not found
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, margin: '0 0 10px', color: '#17211e' }}>
          Page not found
        </h1>
        <p style={{ color: '#73807a', fontSize: 14, margin: '0 0 28px' }}>
          This page doesn't exist. You're looking for JSN Mail Studio?
        </p>
        <a
          href="/"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#1c5148', color: '#fff', textDecoration: 'none',
            padding: '12px 22px', fontWeight: 700, fontSize: 12,
            letterSpacing: .4, textTransform: 'uppercase', borderRadius: 2,
            boxShadow: '0 4px 12px rgba(28,81,72,.25)',
          }}
        >
          Go to Mail Studio
        </a>
      </div>
    </div>
  );
}
