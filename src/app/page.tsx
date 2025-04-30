
// Redirect logic is now handled by the useAuth hook globally or on specific page layouts.
// This page can be used for a landing page or kept minimal.
export default function Home() {
  // You can optionally add a loading indicator or basic message here,
  // but the primary redirection logic lives in useAuth.
  return null; // Render nothing, as redirection will occur via useAuth
}
