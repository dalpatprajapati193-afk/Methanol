import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/shared/components/Index';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ingenero360AI',
  description: 'Advanced Asset Framework Platform - Industrial Logic Operating System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} h-screen w-full flex text-primary`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
