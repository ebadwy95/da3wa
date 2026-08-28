import { PRIVATE_ROUTE_METADATA } from "@/lib/seo";

// Partner pricing. Out of every index, like the guest and dashboard routes —
// see src/lib/seo.js.
export const metadata = PRIVATE_ROUTE_METADATA;

export default function Layout({ children }) {
  return children;
}
