
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth"; // Import Firebase Auth function

import { auth } from "@/lib/firebase"; // Import Firebase Auth instance
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

// Define the Zod schema for validation
const loginSchema = z.object({
  // Use email field as Firebase Auth uses email for login
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Fixed login credentials (replace username with email)
const FIXED_EMAIL = "visionclear@example.com";
const FIXED_PASSWORD = "visionclear@2025";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "", // Default to empty email
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    // Use fixed credentials for comparison before attempting Firebase Auth
    if (data.email !== FIXED_EMAIL || data.password !== FIXED_PASSWORD) {
       toast({
        title: "Login Failed",
        description: "Invalid email or password.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Attempt to sign in with Firebase Authentication
      await signInWithEmailAndPassword(auth, data.email, data.password);

      // Firebase Auth handles session state automatically (via onAuthStateChanged in useAuth hook)
      toast({
        title: "Login Successful",
        description: "Redirecting to options...",
      });
      router.push("/options"); // Redirect on successful Firebase login

    } catch (error: any) {
      console.error("Firebase Login Error:", error);
      let errorMessage = "An unknown error occurred during login.";
      // Provide more specific feedback based on Firebase error codes
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = "Invalid email format.";
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': // Catch invalid credentials
           errorMessage = "Invalid email or password.";
           break;
        case 'auth/too-many-requests':
          errorMessage = "Too many login attempts. Please try again later.";
          break;
        default:
          errorMessage = `Login failed: ${error.message}`;
      }
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
                name="email" // Changed from username to email
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel> {/* Changed label */}
                    <FormControl>
                      {/* Placeholder reflects the required email format */}
                      <Input placeholder={FIXED_EMAIL} {...field} className="text-foreground" type="email" />
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
           <p>Login with email: {FIXED_EMAIL}</p>
          &copy; {new Date().getFullYear()} Vision Clear Opticals. All rights reserved.
        </CardFooter>
      </Card>
    </div>
  );
}
