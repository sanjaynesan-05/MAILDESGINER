import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import NotFound from './NotFound';
import './styles.css';
import './styles-extensions.css';

// Simple client-side routing without react-router dependency
function Root() {
  const path = window.location.pathname;
  if (path !== '/' && path !== '') {
    return <NotFound />;
  }
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
    <Toaster position="top-right" richColors closeButton />
  </StrictMode>,
);
