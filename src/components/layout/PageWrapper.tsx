import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';
import VisionClearLogo from "@/components/icons/VisionClearLogo"; // Import the logo

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
            {/* Use the Logo Component */}
            <div className="flex items-center gap-2">
                 <VisionClearLogo width={120} height={48} />
                 {/* Removed the text title "VisionClear" */}
            </div>

         </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground text-right flex-1 truncate">{title}</h2>
        <Link href="/options" passHref>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary ml-4">
                <Home className="h-5 w-5" />
                 <span className="sr-only">Home</span>
            </Button>
        </Link>
      </header>
      <main className="bg-card p-4 sm:p-6 rounded-lg shadow-md">
        {children}
      </main>
       <footer className="mt-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Vision Clear Opticals. All rights reserved.
      </footer>
    </div>
  );
};

export default PageWrapper;
