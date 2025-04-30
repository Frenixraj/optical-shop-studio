
"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, User } from "firebase/auth"; // Import Firebase Auth functions
import { auth } from "@/lib/firebase"; // Import Firebase Auth instance
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading state

// The specific email allowed to access protected routes
const ALLOWED_EMAIL = "visionclear@example.com";

const useAuth = (allowUnauthenticated = false) => {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        // User is signed in
        if (user.email === ALLOWED_EMAIL) {
            // User is the allowed 'visionclear' user
            setIsAuthenticated(true);
            console.log("Auth check: User authenticated and allowed:", user.email);
             // Redirect from login page if already logged in and allowed
             if (pathname === '/login') {
                 router.replace('/options');
             } else {
                 setIsLoading(false);
             }
        } else {
            // User is signed in but not the allowed user
             setIsAuthenticated(false);
             console.log("Auth check: User authenticated but NOT allowed:", user.email);
             if (!allowUnauthenticated && pathname !== '/login') {
                 toast({
                    title: "Access Denied",
                    description: "You do not have permission to access this page.",
                    variant: "destructive",
                 });
                 auth.signOut(); // Sign out the unauthorized user
                 router.replace('/login');
             } else {
                 setIsLoading(false); // Still finish loading if on allowed unauth page or login page
             }
        }
      } else {
        // User is signed out
        setIsAuthenticated(false);
        console.log("Auth check: User not authenticated.");
        if (!allowUnauthenticated && pathname !== '/login') {
          toast({
            title: "Access Denied",
            description: "Please log in to access this page.",
            variant: "destructive",
          });
          router.replace('/login'); // Redirect to login if not on login page and auth required
        } else {
            setIsLoading(false); // Finish loading if on allowed unauth page or login page
        }
      }
       // setIsLoading(false); // Handled within conditions now
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router, toast, pathname, allowUnauthenticated]); // Add pathname and allowUnauthenticated to dependency array

    // Return loading state and authentication status
   // Render Skeleton or null while loading
   // We don't return isAuthenticated directly, the hook handles redirection
   return isLoading;
};

// Optional: Loading component to show while checking auth state
export const AuthLoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-secondary">
      <Skeleton className="h-10 w-32" />
  </div>
);

export default useAuth;
