import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Genera una URL firmada de larga duración para una imagen del bucket product-images.
// Acepta rutas del bucket (ej: "<tenant>/products/xxx.jpg") o URLs http(s) ya resueltas.
export function useProductImage(path: string | null | undefined) {
  return useQuery({
    queryKey: ["product-image", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 60 * 6, // 6h
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      if (/^https?:\/\//i.test(path)) return path;
      const { data, error } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 días
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
}

export async function uploadProductImage(
  tenantId: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${tenantId}/products/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw error;
  return path;
}

export async function deleteProductImage(path: string | null | undefined) {
  if (!path || /^https?:\/\//i.test(path)) return;
  await supabase.storage.from("product-images").remove([path]);
}
