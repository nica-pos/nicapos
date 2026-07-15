import { getFriendlyErrorMessage } from "@/lib/errors";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Palette, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant, usePlans } from "@/hooks/use-tenant";

export const Route = createFileRoute("/_authenticated/configuracion")({
  component: ConfigPage,
  head: () => ({ meta: [{ title: "Configuración — Nica-POS" }] }),
});

const PRESET_COLORS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#0ea5e9", "#14b8a6"];

function ConfigPage() {
  const queryClient = useQueryClient();
  const { tenant, role, isLoading } = useActiveTenant();
  const { data: plans } = usePlans(true);

  const [name, setName] = useState("");
  const [ruc, setRuc] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#f59e0b");

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setRuc(tenant.ruc ?? "");
      setLogoUrl(tenant.logo_url ?? "");
      setFaviconUrl(tenant.favicon_url ?? "");
      setPrimaryColor(tenant.primary_color ?? "#f59e0b");
    }
  }, [tenant]);

  const canEdit = role === "owner" || role === "admin";
  const currentPlan = plans?.find((p) => p.id === tenant?.plan_id);

  const save = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("Sin tienda activa");
      const { error } = await supabase
        .from("tenants")
        .update({
          name: name.trim(),
          ruc: ruc.trim() || null,
          logo_url: logoUrl.trim() || null,
          favicon_url: faviconUrl.trim() || null,
          primary_color: primaryColor,
        })
        .eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Configuración guardada");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  if (isLoading) {
    return (
      <DashboardShell>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </DashboardShell>
    );
  }

  if (!tenant) {
    return (
      <DashboardShell>
        <Card className="max-w-xl border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle>Sin negocio propio configurado</CardTitle>
            <CardDescription>
              Configuración solo muestra tiendas donde tu cuenta es miembro real.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/onboarding">Crear mi tienda</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configuración</h1>
        <p className="text-muted-foreground">Datos del negocio e identidad de marca.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Datos del negocio</CardTitle>
              <CardDescription>Información general de tu tienda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ruc">RUC</Label>
                <Input id="ruc" value={ruc} disabled={!canEdit} onChange={(e) => setRuc(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" /> Identidad de marca
              </CardTitle>
              <CardDescription>Personaliza el logo, favicon y color de tu tienda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo">Logo</Label>
                <LogoUploader
                  tenantId={tenant.id}
                  disabled={!canEdit}
                  value={logoUrl}
                  onChange={setLogoUrl}
                  field="logo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="favicon">Favicon</Label>
                <LogoUploader
                  tenantId={tenant.id}
                  disabled={!canEdit}
                  value={faviconUrl}
                  onChange={setFaviconUrl}
                  field="favicon"
                />
              </div>
              <div className="space-y-2">
                <Label>Color principal</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setPrimaryColor(c)}
                      className="h-9 w-9 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: primaryColor === c ? "hsl(var(--foreground))" : "transparent",
                      }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                  <Input
                    type="color"
                    value={primaryColor}
                    disabled={!canEdit}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-16 cursor-pointer p-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {canEdit && (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vista previa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded font-bold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {name.charAt(0).toUpperCase() || "N"}
                    </div>
                  )}
                  <span className="font-semibold text-foreground">{name || "Tu tienda"}</span>
                </div>
                <button
                  type="button"
                  className="mt-4 w-full rounded-md px-3 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Botón de ejemplo
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan actual</CardTitle>
            </CardHeader>
            <CardContent>
              {currentPlan ? (
                <div className="space-y-1">
                  <div className="text-lg font-bold text-foreground">{currentPlan.name}</div>
                  <div className="text-sm text-muted-foreground">${currentPlan.price_usd}/mes</div>
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <li>{currentPlan.max_products.toLocaleString()} productos</li>
                    <li>{currentPlan.max_cashiers} cajeros</li>
                    <li>{currentPlan.max_branches} sucursales</li>
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin plan asignado.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

function LogoUploader({
  tenantId,
  value,
  onChange,
  disabled,
  field,
}: {
  tenantId: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  field: "logo" | "favicon";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("El archivo excede 3 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${tenantId}/${field}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // Bucket privado: firmamos una URL con expiración larga (~10 años)
      const { data: signed, error: signErr } = await supabase.storage
        .from("branding")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;
      onChange(signed.signedUrl);
      toast.success("Archivo subido. Recuerda pulsar “Guardar cambios”.");
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e as Error));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {value ? (
          <img
            src={value}
            alt={field}
            className="h-16 w-16 rounded border object-contain bg-muted"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
            Sin {field}
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Subir archivo
            </Button>
            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange("")}
              >
                <X className="mr-1 h-4 w-4" /> Quitar
              </Button>
            )}
          </div>
          <Input
            placeholder="…o pega una URL"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
