
"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
// Removed Firebase Auth imports: import { onAuthStateChanged, User } from "firebase/auth";
// Removed Firebase Auth instance import: import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading state

// This hook now checks sessionStorage instead of Firebase Auth state

const useAuth = (allowUnauthenticated = false) => {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check sessionStorage for login status
    // Need to ensure this check only runs client-side
    if (typeof window !== 'undefined') {
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
        console.log("Auth check: sessionStorage isLoggedIn:", isLoggedIn);

        if (isLoggedIn) {
            // User is considered logged in
            // Redirect from login page if already logged in
            if (pathname === '/login') {
                router.replace('/options');
                // Keep loading until redirect is complete
            } else {
                setIsLoading(false); // Allow access to protected page
            }
        } else {
            // User is not logged in
            if (!allowUnauthenticated && pathname !== '/login') {
                // If auth is required and not on login page, redirect
                toast({
                  title: "Access Denied",
                  description: "Please log in to access this page.",
                  variant: "destructive",
                });
                router.replace('/login'); // Redirect to login
                // Keep loading until redirect is complete
            } else {
                // Allow access to unauthenticated page or login page
                setIsLoading(false);
            }
        }
    } else {
      // Still loading if window is not defined (SSR/initial load)
      // This prevents premature rendering or redirection attempts server-side
      setIsLoading(true);
    }

    // No cleanup needed for sessionStorage check
  }, [router, pathname, allowUnauthenticated, toast]); // Dependencies

  // Return loading state. The hook handles redirection.
  return isLoading;
};

// Optional: Loading component to show while checking auth state
export const AuthLoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-secondary">
      {/* You can customize this loading indicator */}
      <p className="text-muted-foreground">Loading...</p>
      {/* <Skeleton className="h-10 w-32" /> */}
  </div>
);

export default useAuth;
