import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DASHBOARD_ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <h2 className="mt-2 text-2xl font-semibold text-foreground">
        Page not found
      </h2>
      <p className="mt-2 text-muted-foreground">
        Sorry, we couldn’t find the page you’re looking for.
      </p>
      <div className="mt-6">
        <Button asChild size="lg" className="px-6 py-2 text-base">
          <Link href={DASHBOARD_ROUTES?.HOME}>Back to home</Link>
        </Button>
      </div>
    </div>
  );
}