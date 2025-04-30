"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Search, UserPlus, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import useAuth from '@/hooks/useAuth'; // Assuming useAuth hook handles redirection if not logged in

export default function OptionsPage() {
  useAuth(); // Protect the route
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    router.push('/login');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
       {/* Placeholder for Logo */}
       <div className="mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-glasses"><path d="M6 15h.01"/><path d="M18 15h.01"/><path d="M3 15a2 2 0 0 1-2-2V9a4 4 0 0 1 4-4h1"/><path d="M21 15a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4h-1"/><path d="M7.5 11a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 5 12.5v0A1.5 1.5 0 0 1 6.5 11h1Z"/><path d="M16.5 11a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v0a1.5 1.5 0 0 1 1.5-1.5h1Z"/><path d="M10 15h4"/></svg>
       </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Main Menu</CardTitle>
          <CardDescription>Select an option to continue.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-4 p-6">
          <Button
            variant="outline"
            className="justify-start py-6 text-lg border-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => router.push("/new-bill")}
          >
            <FilePlus2 className="mr-3 h-6 w-6" />
            New Bill
          </Button>
          <Button
            variant="outline"
             className="justify-start py-6 text-lg border-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => router.push("/search-customers")}
          >
            <Search className="mr-3 h-6 w-6" />
            Search Customers
          </Button>
          <Button
            variant="outline"
            className="justify-start py-6 text-lg border-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => router.push("/add-customer")}
          >
            <UserPlus className="mr-3 h-6 w-6" />
            Add Customer
          </Button>
        </CardContent>
      </Card>
       <Button
        variant="ghost"
        className="mt-8 text-muted-foreground hover:text-destructive"
        onClick={handleLogout}
       >
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </div>
  );
}
