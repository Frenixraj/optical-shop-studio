import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';

interface PageWrapperProps {
  title: string;
  children: React.ReactNode;
}

const PageWrapper: React.FC<PageWrapperProps> = ({ title, children }) => {
  return (
    <div className="min-h-screen bg-secondary p-4 sm:p-8">
      <header className="mb-8 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <Link href="/options" passHref>
                <Button variant="outline" size="icon" className="bg-card hover:bg-muted">
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back to Options</span>
                </Button>
            </Link>
            {/* Placeholder for Logo */}
            <div className="flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-glasses"><path d="M6 15h.01"/><path d="M18 15h.01"/><path d="M3 15a2 2 0 0 1-2-2V9a4 4 0 0 1 4-4h1"/><path d="M21 15a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4h-1"/><path d="M7.5 11a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 5 12.5v0A1.5 1.5 0 0 1 6.5 11h1Z"/><path d="M16.5 11a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v0a1.5 1.5 0 0 1 1.5-1.5h1Z"/><path d="M10 15h4"/></svg>
                <h1 className="text-2xl sm:text-3xl font-bold text-primary">VisionClear</h1>
            </div>

         </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground">{title}</h2>
        <Link href="/options" passHref>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <Home className="h-5 w-5" />
                 <span className="sr-only">Home</span>
            </Button>
        </Link>
      </header>
      <main className="bg-card p-4 sm:p-6 rounded-lg shadow-md">
        {children}
      </main>
       <footer className="mt-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} VisionClear Optical Shop. All rights reserved.
      </footer>
    </div>
  );
};

export default PageWrapper;
