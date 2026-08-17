import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh bg-bg text-fg lg:grid-cols-2">
      <section className="relative hidden overflow-hidden lg:block">
        <img
          src={`${import.meta.env.BASE_URL}empty-desk.jpg`}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-bg/35" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="font-display text-3xl font-medium tracking-tight text-fg">Keep the paper. Take the words.</p>
          <p className="mt-2 max-w-sm text-sm text-primary/80">
            Folio reads documents in place. Sign in if you want your session to follow you.
          </p>
        </div>
      </section>
      <section className="flex flex-col justify-center px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <Link to="/" className="inline-flex items-center gap-2 text-fg">
            <span className="grid size-8 place-items-center rounded-sm bg-primary text-primary-fg">
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                <path d="M3.2 1.6h6.4L13 5v9.4H3.2V1.6Z" fill="currentColor" />
              </svg>
            </span>
            <span className="font-display text-xl font-medium">Folio</span>
          </Link>
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm text-muted">Use a Grok-connected account. You can still read files as a guest.</p>
          </div>
          {authEnabled ? (
            <div className="space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
          <Link to="/" className="inline-block text-sm text-subtle underline-offset-4 hover:text-fg hover:underline">
            Back to the reader
          </Link>
        </div>
      </section>
    </main>
  );
}
