"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";

const useAuth = () => {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
      toast({
        title: "Access Denied",
        description: "Please log in to access this page.",
        variant: "destructive",
      });
      router.push('/login');
    }
  }, [router, toast]);
};

export default useAuth;
