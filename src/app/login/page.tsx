"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Eye, EyeOff, Sun } from "lucide-react"; // Added Sun icon for logo placeholder

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

// Define the Zod schema for validation
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    if (data.username === "visionclear" && data.password === "visionclear@2025") {
      // In a real app, you'd set session/token here
      localStorage.setItem('isLoggedIn', 'true'); // Simple flag for demo
      toast({
        title: "Login Successful",
        description: "Redirecting to options...",
      });
      router.push("/options");
    } else {
      toast({
        title: "Login Failed",
        description: "Invalid username or password.",
        variant: "destructive",
      });
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
           {/* Placeholder for Logo */}
           <div className="flex justify-center mb-4">
              {/* Replace Sun with actual SVG Logo */}
              <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-glasses"><path d="M6 15h.01"/><path d="M18 15h.01"/><path d="M3 15a2 2 0 0 1-2-2V9a4 4 0 0 1 4-4h1"/><path d="M21 15a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4h-1"/><path d="M7.5 11a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 5 12.5v0A1.5 1.5 0 0 1 6.5 11h1Z"/><path d="M16.5 11a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v0a1.5 1.5 0 0 1 1.5-1.5h1Z"/><path d="M10 15h4"/></svg>
           </div>
          <CardTitle className="text-2xl font-bold text-primary">VisionClear Manager</CardTitle>
          <CardDescription>Enter your credentials to access the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="visionclear" {...field} className="text-foreground" />
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
              <Button type="submit" className="w-full mt-6 bg-accent hover:bg-accent/90 text-accent-foreground">Login</Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} VisionClear Optical Shop. All rights reserved.
        </CardFooter>
      </Card>
    </div>
  );
}
