import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: { default: 'Aster & Co', template: '%s · Aster & Co' }, description: 'Salon booking and checkout' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" /><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet" /></head><body>{children}</body></html>);
}
