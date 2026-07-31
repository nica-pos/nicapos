import { getFriendlyErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardShell } from "@/components/app/DashboardShell";
import { useActiveTenant } from "@/hooks/use-tenant";
import { addTenantMemberByEmail, removeTenantMember } from "@/lib/tenant.functions";

export const Route = createFileRoute("/_authenticated/equipo")({
  component: TeamPage,
  head: () => ({ meta: [{ title: "Equipo — Nica-POS" }] }),
});

const roleLabels: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  cashier: "Cajero",
  accountant: "Contador",
};

function TeamPage() {
  const queryClient = useQueryClient();
  const { tenant, role } = useActiveTenant();
  const addMember = useServerFn(addTenantMemberByEmail);
  const removeMemberFn = useServerFn(removeTenantMember);
  const canManage = role === "owner" || role === "admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "cashier" | "accountant">("cashier");

  const members = useQuery({
    queryKey: ["tenant-members", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_members")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("created_at");
      if (error) throw error;
      const userIds = (data ?? []).map((m) => m.user_id);
      let profilesMap = new Map<string, { email: string | null; full_name: string | null }>();
      if (userIds.length) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);
        if (pErr) throw pErr;
        profilesMap = new Map((profs ?? []).map((p) => [p.id, { email: p.email, full_name: p.full_name }]));
      }
      return (data ?? []).map((m) => ({ ...m, profile: profilesMap.get(m.user_id) ?? null }));
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("Sin tienda activa");
      if (password && password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
      return await addMember({
        data: {
          tenantId: tenant.id,
          email: email.trim(),
          role: newRole,
          password: password.trim() || undefined,
          fullName: fullName.trim() || undefined,
        },
      });
    },
    onSuccess: (res: any) => {
      setEmail("");
      setPassword("");
      setFullName("");
      queryClient.invalidateQueries({ queryKey: ["tenant-members", tenant?.id] });
      if (res?.created) {
        toast.success("Cuenta creada. Ya puede iniciar sesión con ese correo y contraseña.");
      } else if (res?.invited) {
        toast.success("Invitación enviada. Se unirá automáticamente al registrarse con ese correo.");
      } else {
        toast.success("Miembro agregado");
      }
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role: r }: { id: string; role: string }) => {
      const { error } = await supabase
        .from("tenant_members")
        .update({ role: r as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-members", tenant?.id] });
      toast.success("Rol actualizado");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant) throw new Error("Sin tienda activa");
      return await removeMemberFn({
        data: { tenantId: tenant.id, memberId: id, deleteAuthIfOrphan: true },
      });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-members", tenant?.id] });
      if (res?.authDeleted) {
        toast.success("Miembro eliminado y su cuenta borrada por completo.");
      } else {
        toast.success("Miembro eliminado. Su cuenta sigue activa en otras tiendas.");
      }
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Equipo</h1>
        <p className="text-muted-foreground">Gestiona quién tiene acceso a tu tienda y sus roles.</p>
      </div>

      {canManage && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Agregar miembro
            </CardTitle>
            <CardDescription>
              Creá la cuenta del miembro con correo y contraseña. Podrá iniciar sesión inmediatamente con el rol asignado. Si dejás la contraseña vacía y el correo aún no existe, se guarda como invitación pendiente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="cajero@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre (opcional)</Label>
                <Input
                  id="fullName"
                  placeholder="Ej: Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="text"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Escribila y pasásela al miembro. Podrá cambiarla luego.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as typeof newRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="cashier">Cajero</SelectItem>
                    <SelectItem value="accountant">Contador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => invite.mutate()} disabled={!email.trim() || invite.isPending}>
                {invite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <UserPlus className="mr-2 h-4 w-4" /> Crear cuenta y agregar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
        </CardHeader>
        <CardContent>
          {members.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Sucursales</TableHead>

                  {canManage && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members.data ?? []).map((m: any) => {
                  const isOwner = m.role === "owner";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.profile?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.profile?.email ?? "—"}</TableCell>
                      <TableCell>
                        {canManage && !isOwner ? (
                          <Select value={m.role} onValueChange={(v) => updateRole.mutate({ id: m.id, role: v })}>
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="cashier">Cajero</SelectItem>
                              <SelectItem value="accountant">Contador</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={isOwner ? "default" : "secondary"}>{roleLabels[m.role]}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <MemberBranchesCell
                          tenantId={tenant!.id}
                          memberId={m.id}
                          userId={m.user_id}
                          role={m.role}
                          mainBranchId={m.branch_id ?? null}
                          canManage={canManage}
                        />
                      </TableCell>

                      {canManage && (
                        <TableCell className="text-right">
                          {!isOwner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMember.mutate(m.id)}
                              disabled={removeMember.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
