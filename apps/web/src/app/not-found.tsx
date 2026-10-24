import { Corgi } from "@/components/corgi";
export default function NotFound() {
  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <Corgi size={64} />
      <h1 className="text-3xl font-bold mt-6 mb-4">
        This page isn’t available.
      </h1>
      <p>The link may be out of date, or your account may not have access.</p>
      <a
        className="inline-flex min-h-11 items-center text-primary underline mt-5"
        href="/lists"
      >
        Back to lists
      </a>
    </main>
  );
}
