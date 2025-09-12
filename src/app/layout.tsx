import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import ToasterLazy from '@/components/common/toaster-lazy';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Taliyo Lead Track',
  description: 'Track employee performance and streamline your workflow with Taliyo Lead Track.',
  icons: {
    icon: '/logo-circle.svg',
    shortcut: '/logo-circle.svg',
    apple: '/logo-circle.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", inter.variable)} suppressHydrationWarning>
      <body className="font-body antialiased h-full">
        {children}      
        <ToasterLazy />
      </body>
    </html>
  );
}
