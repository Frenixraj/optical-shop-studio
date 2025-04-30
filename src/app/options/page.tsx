
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Search, UserPlus, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import useAuth from '@/hooks/useAuth'; // Assuming useAuth hook handles redirection if not logged in
import VisionClearLogo from "@/components/icons/VisionClearLogo"; // Import the logo

export default function OptionsPage() {
  useAuth(); // Protect the route
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    router.push('/login');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
       {/* Use the Logo Component */}
       <div className="mb-8">
           <VisionClearLogo width={200} height={80} />
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
