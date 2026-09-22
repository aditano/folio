import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div>
        <Link to="/" className="text-sm text-muted hover:text-fg">
          Folio
        </Link>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Sign in</h1>
      </div>
      {authEnabled ? (
        <div className="space-y-2">
          {GROK_PROVIDERS.map((provider) => (
            <Button
              key={provider.providerId}
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
            >
              Continue with {provider.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Sign-in is off. Folio works without an account.</p>
      )}
    </main>
  );
}
