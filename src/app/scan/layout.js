import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";

// This route is private — see src/lib/seo.js for why the opt-out lives here
// rather than on the root layout.
export const metadata = PRIVATE_ROUTE_METADATA;

export default function Layout({ children }) {
  return children;
}
