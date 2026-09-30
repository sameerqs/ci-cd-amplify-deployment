import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DASHBOARD_ROUTES } from "@/lib/routes";

export default function UnauthorizedPage() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
                You don&rsquo;t have access to this page
            </h1>
            <p className="text-muted-foreground max-w-md text-sm">
                This page is restricted to other roles. Head back to your
                dashboard to keep working.
            </p>
            <Button asChild>
                <Link href={DASHBOARD_ROUTES.HOME}>Back to dashboard</Link>
            </Button>
        </div>
    );
}
