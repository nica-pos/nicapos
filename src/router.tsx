import { QueryClient, QueryCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { getFriendlyErrorMessage } from "./lib/errors";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          // No reintentar errores de permisos/autenticación.
          const code = (error as { code?: string; status?: number })?.code;
          const status = (error as { status?: number })?.status;
          if (code === "42501" || status === 401 || status === 403) return false;
          return failureCount < 2;
        },
      },
    },
    // Los errores de lectura de datos muestran un aviso amigable global.
    // Las mutaciones manejan sus propios errores en cada pantalla.
    queryCache: new QueryCache({
      onError: (error) => {
        toast.error(getFriendlyErrorMessage(error));
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
