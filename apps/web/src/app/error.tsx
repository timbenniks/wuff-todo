"use client";
import { Button } from "@/components/ui/button";
import { Corgi } from "@/components/corgi";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <Corgi size={64} />
      <h1 className="text-3xl font-bold mt-6 mb-4">
        We couldn’t open this page.
      </h1>
      <p>
        Try again, or return to your lists. Check your connection if this keeps
        happening.
      </p>
      <div className="flex flex-wrap gap-4 mt-5">
        <Button onClick={reset}>Try again</Button>
        <a
          className="inline-flex min-h-11 items-center text-primary underline"
          href="/lists"
        >
          Back to lists
        </a>
      </div>
    </main>
  );
}
