import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MapPin,
  Globe,
  Clock,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useIsSuperadmin, usePlans } from "@/hooks/use-tenant";
import {
  listTrialRequests,
  approveTrialRequest,
  rejectTrialRequest,
} from "@/lib/trial-requests.functions";
import { getFriendlyErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin_/solicitudes-prueba")({
  component: SolicitudesPruebaPage,
  head: () => ({ meta: [{ title: "Solicitudes de prueba — Nica-POS" }] }),
});

type Row = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  business_name: string;
  city: string | null;
  country: string | null;
  ip_address: string | null;
  user_agent: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  owner_user_id: string | null;
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function SolicitudesPruebaPage() {
  const { data: isSuper, isLoading: loadingRole } = useIsSuperadmin();
  const qc = useQueryClient();
  const { data: plans = [] } = usePlans();
  const fetchList = useServerFn(listTrialRequests);
  const approve = useServerFn(approveTrialRequest);
  const reject = useServerFn(rejectTrialRequest);

  const [viewing, setViewing] = useState<Row | null>(null);
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [planId, setPlanId] = useState<string>("");
  const [days, setDays] = useState("7");
  const [password, setPassword] = useState(randomPassword());
  const [reason, setReason] = useState("");
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  const list = useQuery({
    queryKey: ["admin-trial-requests"],
    enabled: !!isSuper,
    queryFn: () => fetchList() as Promise<Row[]>,
  });

  const approveMut = useMutation({
    mutationFn: (v: {
      requestId: string;
      planId: string;
      trialDays: number;
      password?: string;
    }) => approve({ data: v }),
    onSuccess: (result: any) => {
      toast.success("Prueba aprobada");
      if (result?.password) {
        setCreds({ email: result.email, password: result.password });
      }

      setMode(null);
      qc.invalidateQueries({ queryKey: ["admin-trial-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err)),
  });

  const rejectMut = useMutation({
    mutationFn: (v: { requestId: string; reason: string }) => reject({ data: v }),
    onSuccess: () => {
      toast.success("Solicitud rechazada");
      setMode(null);
      setViewing(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-trial-requests"] });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err)),
  });

  if (loadingRole) {
    return (
      <DashboardShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }

  if (!isSuper) {
    return (
      <DashboardShell>
        <Card className="mx-auto max-w-md p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold">Acceso restringido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Necesitas rol de superadmin.
          </p>
        </Card>
      </DashboardShell>
    );
  }

  const rows = list.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const others = rows.filter((r) => r.status !== "pending");

  // Duplicate detection: same email or same IP among pending+approved
  function duplicateFlag(row: Row) {
    const flags: string[] = [];
    if (row.email) {
      const same = rows.filter(
        (r) => r.id !== row.id && r.email.toLowerCase() === row.email.toLowerCase(),
      );
      if (same.length) flags.push(`${same.length} con mismo correo`);
    }
    if (row.ip_address) {
      const same = rows.filter((r) => r.id !== row.id && r.ip_address === row.ip_address);
      if (same.length) flags.push(`${same.length} con misma IP`);
    }
    return flags.length ? flags.join(" · ") : null;
  }

  return (
    <DashboardShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/admin"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al panel
          </Link>
          <h1 className="text-2xl font-bold">Solicitudes de prueba</h1>
          <p className="text-sm text-muted-foreground">
            Aprueba manualmente las pruebas de 7 días. Verifica ubicación e IP para evitar
            cuentas duplicadas.
          </p>
        </div>
      </div>

      {list.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Section
            title="Pendientes"
            emptyMsg="No hay solicitudes pendientes."
            rows={pending}
            duplicateFlag={duplicateFlag}
            onReview={(r) => {
              setViewing(r);
              setMode(null);
              setPassword(randomPassword());
              setPlanId(plans[0]?.id ?? "");
              setDays("7");
              setReason("");
            }}
          />
          <Section
            title="Historial"
            emptyMsg="Sin historial."
            rows={others}
            duplicateFlag={duplicateFlag}
            onReview={(r) => setViewing(r)}
          />
        </>
      )}

      {/* Review dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(o) => {
          if (!o) {
            setViewing(null);
            setMode(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Solicitud de prueba</DialogTitle>
            <DialogDescription>
              Revisa los datos, confirma que no sea una cuenta duplicada y aprueba o
              rechaza.
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <Grid label="Nombre" value={viewing.full_name} />
              <Grid label="Correo" value={viewing.email} />
              <Grid label="Teléfono" value={viewing.phone ?? "—"} />
              <Grid label="Negocio" value={viewing.business_name} />
              <Grid
                label="Ubicación reportada"
                value={
                  [viewing.city, viewing.country].filter(Boolean).join(", ") || "—"
                }
              />
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" /> Trazabilidad
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">IP: </span>
                    <span className="font-mono">{viewing.ip_address ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Navegador: </span>
                    <span className="break-all">{viewing.user_agent ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {viewing.latitude != null && viewing.longitude != null ? (
                      <a
                        className="text-primary underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://www.google.com/maps?q=${viewing.latitude},${viewing.longitude}`}
                      >
                        Ver en mapa ({viewing.latitude.toFixed(4)},{" "}
                        {viewing.longitude.toFixed(4)}
                        {viewing.location_accuracy
                          ? ` ±${Math.round(viewing.location_accuracy)}m`
                          : ""}
                        )
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        Ubicación no compartida
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />{" "}
                    {new Date(viewing.created_at).toLocaleString()}
                  </div>
                  {duplicateFlag(viewing) && (
                    <div className="mt-1 rounded bg-warning/10 px-2 py-1 text-warning">
                      ⚠ Posible duplicada: {duplicateFlag(viewing)}
                    </div>
                  )}
                </div>
              </div>
              {viewing.notes && (
                <div>
                  <Label>Notas</Label>
                  <p className="text-muted-foreground">{viewing.notes}</p>
                </div>
              )}
              {viewing.status !== "pending" && (
                <div className="rounded bg-muted/30 p-2 text-xs">
                  Estado: <span className="font-medium">{viewing.status}</span>
                  {viewing.rejection_reason && (
                    <> — {viewing.rejection_reason}</>
                  )}
                </div>
              )}

              {viewing.status === "pending" && mode === "approve" && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <Label>Plan a asignar</Label>
                    <Select value={planId} onValueChange={setPlanId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Días de prueba</Label>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                      />
                    </div>
                    {!viewing.owner_user_id && (
                      <div>
                        <Label>Contraseña inicial</Label>
                        <div className="flex gap-1">
                          <Input
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setPassword(randomPassword())}
                          >
                            ↻
                          </Button>
                        </div>
                      </div>
                    )}
                    {viewing.owner_user_id && (
                      <div className="col-span-1 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                        El usuario ya se registró. Solo se activará su tienda.
                      </div>
                    )}

                  </div>
                </div>
              )}

              {viewing.status === "pending" && mode === "reject" && (
                <div className="border-t pt-3">
                  <Label>Motivo del rechazo</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explica brevemente"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {viewing?.status === "pending" ? (
              mode === null ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => setMode("reject")}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Rechazar
                  </Button>
                  <Button onClick={() => setMode("approve")}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar
                  </Button>
                </>
              ) : mode === "approve" ? (
                <>
                  <Button variant="outline" onClick={() => setMode(null)}>
                    Volver
                  </Button>
                  <Button
                    disabled={
                      !planId ||
                      approveMut.isPending ||
                      (!viewing?.owner_user_id && (!password || password.length < 6))
                    }
                    onClick={() =>
                      approveMut.mutate({
                        requestId: viewing!.id,
                        planId,
                        trialDays: Number(days) || 7,
                        password: viewing?.owner_user_id ? undefined : password,
                      })
                    }
                  >

                    {approveMut.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Confirmar aprobación
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setMode(null)}>
                    Volver
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!reason || rejectMut.isPending}
                    onClick={() =>
                      rejectMut.mutate({ requestId: viewing!.id, reason })
                    }
                  >
                    {rejectMut.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Confirmar rechazo
                  </Button>
                </>
              )
            ) : (
              <Button variant="outline" onClick={() => setViewing(null)}>
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials dialog */}
      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciales generadas</DialogTitle>
            <DialogDescription>
              Envía estos datos al cliente. No las volveremos a mostrar.
            </DialogDescription>
          </DialogHeader>
          {creds && (
            <div className="space-y-2 text-sm">
              <CredRow label="Correo" value={creds.email} />
              <CredRow label="Contraseña" value={creds.password} />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreds(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function Grid({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2 font-medium">{value}</div>
    </div>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border p-2">
      <div className="w-24 text-xs text-muted-foreground">{label}</div>
      <div className="flex-1 font-mono text-sm">{value}</div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success("Copiado");
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Section({
  title,
  rows,
  emptyMsg,
  onReview,
  duplicateFlag,
}: {
  title: string;
  rows: Row[];
  emptyMsg: string;
  onReview: (r: Row) => void;
  duplicateFlag: (r: Row) => string | null;
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
        {title} · {rows.length}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded border border-dashed p-4 text-sm text-muted-foreground">
          {emptyMsg}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const dup = duplicateFlag(r);
            return (
              <Card
                key={r.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.business_name}</span>
                    <span className="text-xs text-muted-foreground">
                      · {r.full_name}
                    </span>
                    <StatusPill status={r.status} />
                    {dup && (
                      <span className="rounded bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                        Posible duplicado
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.email} · {r.city ?? "—"} · IP {r.ip_address ?? "—"} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onReview(r)}>
                  Revisar
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/10 text-warning",
    approved: "bg-success/10 text-success",
    rejected: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-medium ${map[status] ?? "bg-muted"}`}
    >
      {status}
    </span>
  );
}
