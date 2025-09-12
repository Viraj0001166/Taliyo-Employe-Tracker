import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
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
      <body className="font-body antialiased h-full bg-background text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var ls=localStorage.getItem('theme');var t=(ls==='dark'||ls==='light')?ls:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`}
        </Script>
        {children}      
        <ToasterLazy />
      </body>
    </html>
  );
}
