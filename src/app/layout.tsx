
'use client'; // Required because we use hooks like useState and useEffect in AuthWrapper

import type { Metadata } from 'next'; // Keep type import if metadata object is static
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import useAuth, { AuthLoadingScreen } from '@/hooks/useAuth'; // Import useAuth and loading component
import { usePathname } from 'next/navigation';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Removed metadata export as it's not allowed in 'use client' components.
// Metadata can be defined in individual page.tsx files or a separate server component if needed globally.
/*
export const metadata: Metadata = {
  title: 'VisionClear Manager',
  description: 'Optical Shop Management Application',
};
*/

// Create a wrapper component to handle auth loading
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Allow unauthenticated access only to the login page
  const allowUnauthenticated = pathname === '/login';
  const isLoadingAuth = useAuth(allowUnauthenticated);

  if (isLoadingAuth) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>; // Render children once auth check is complete
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
         {/* Wrap children with AuthWrapper */}
        <AuthWrapper>
            {children}
        </AuthWrapper>
        <Toaster /> {/* Add Toaster here */}
      </body>
    </html>
  );
}
