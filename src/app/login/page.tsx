
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
// Removed Firebase Auth import: import { signInWithEmailAndPassword } from "firebase/auth";

// Removed Firebase Auth instance import: import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import VisionClearLogo from "@/components/icons/VisionClearLogo"; // Import the logo

// Define the Zod schema for validation using username
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"), // Changed from email
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Fixed login credentials
const FIXED_USERNAME = "visionclear";
const FIXED_PASSWORD = "visionclear@2025";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "", // Default to empty username
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setIsLoading(true);
    // Simple client-side check for username and password
    if (data.username === FIXED_USERNAME && data.password === FIXED_PASSWORD) {
      try {
        // Set a flag in sessionStorage to indicate login
        sessionStorage.setItem('isLoggedIn', 'true');
        console.log("Session storage set: isLoggedIn=true");

        toast({
          title: "Login Successful",
          description: "Redirecting to options...",
        });
        // Use replace to avoid login page being in history
        router.replace("/options");

      } catch (error) {
         console.error("Error setting session storage:", error);
         toast({
           title: "Login Failed",
           description: "Could not initiate session. Please try again.",
           variant: "destructive",
         });
         setIsLoading(false); // Stop loading on error
      }
      // No finally needed here as redirection happens on success
    } else {
      toast({
        title: "Login Failed",
        description: "Invalid username or password.",
        variant: "destructive",
      });
      setIsLoading(false); // Stop loading on failure
    }
    // setIsLoading(false); // Moved inside conditions
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
           {/* Use the Logo Component */}
           <div className="flex justify-center mb-4">
              <VisionClearLogo width={150} height={60} />
           </div>
          <CardTitle className="text-2xl font-bold text-primary">VisionClear Manager</CardTitle>
          <CardDescription>Enter your credentials to access the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username" // Changed from email
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel> {/* Changed label */}
                    <FormControl>
                      <Input placeholder={FIXED_USERNAME} {...field} className="text-foreground" type="text" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="********"
                          {...field}
                          className="text-foreground pr-10" // Add padding for the icon
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={togglePasswordVisibility}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff /> : <Eye />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full mt-6 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                 {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground">
           <p>Login with username: {FIXED_USERNAME}</p>
          &copy; {new Date().getFullYear()} Vision Clear Opticals. All rights reserved.
        </CardFooter>
      </Card>
    </div>
  );
}
