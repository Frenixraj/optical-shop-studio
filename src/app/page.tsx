import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to the login page by default
  redirect('/login');
  return null; // Return null as redirect will handle navigation
}
