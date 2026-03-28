import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        /**
         * Attach Supabase JWT when available. Cap wait so a stuck getSession() never blocks
         * public catalog tRPC calls (category pages would stay "Loading" forever).
         */
        try {
          type GetSession = Awaited<ReturnType<typeof supabase.auth.getSession>>;
          const timeoutFallback = new Promise<GetSession>(resolve =>
            setTimeout(
              () => resolve({ data: { session: null }, error: null } as GetSession),
              2_000
            )
          );
          const { data } = await Promise.race([supabase.auth.getSession(), timeoutFallback]);
          const session = data?.session;
          if (session?.access_token) {
            return { Authorization: `Bearer ${session.access_token}` };
          }
        } catch {
          /* storefront queries remain public without Authorization */
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
