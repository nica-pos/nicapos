import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/app/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Loader2, Star } from "lucide-react";
import {
  useBranches,
  useSaveBranch,
  useDeleteBranch,
  useCanCreateBranch,
  type Branch,
} from "@/hooks/use-branch";
import { useActiveTenant, useIsSuperadmin } from "@/hooks/use-tenant";
import { getFriendlyErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/sucursales")({
  component: SucursalesPage,
});

function SucursalesPage() {
  const { role } = useActiveTenant();
  const { data: isSuper } = useIsSuperadmin();
  const branches = useBranches();
  const canCreate = useCanCreateBranch();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const canManage = isSuper || role === "owner" || role === "admin";
  const canAddMore = isSuper || canCreate.data !== false;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" /> Sucursales
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tus puntos de venta. Inventario y caja se manejan de forma
              independiente por sucursal.
            </p>
          </div>
          {canManage && (
            <Button
              onClick={() => setOpenNew(true)}
              disabled={!canAddMore}
              title={!canAddMore ? "Alcanzaste el límite de tu plan" : ""}
            >
              <Plus className="mr-2 h-4 w-4" /> Nueva sucursal
            </Button>
          )}
        </div>

        {!canAddMore && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            Alcanzaste el máximo de sucursales de tu plan. Actualiza tu plan para agregar más.
          </div>
        )}

        <div className="rounded-lg border border-border/60 bg-card/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(branches.data ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {b.name}
                    {b.is_default && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3" /> Principal
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{b.address ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{b.phone ?? "—"}</TableCell>
                  <TableCell>
                    {b.is_active ? (
                      <Badge variant="outline" className="text-success">Activa</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Inactiva</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(b)}>
                        Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {branches.data && branches.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aún no tienes sucursales.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <BranchDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        branch={null}
      />
      <BranchDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        branch={editing}
      />
    </DashboardShell>
  );
}

function BranchDialog({
  open,
  onClose,
  branch,
}: {
  open: boolean;
  onClose: () => void;
  branch: Branch | null;
}) {
  const save = useSaveBranch();
  const del = useDeleteBranch();
  const [name, setName] = useState(branch?.name ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [isActive, setIsActive] = useState(branch?.is_active ?? true);

  useEffect(() => {
    setName(branch?.name ?? "");
    setAddress(branch?.address ?? "");
    setPhone(branch?.phone ?? "");
    setIsActive(branch?.is_active ?? true);
  }, [branch]);

  function handleSave() {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    save.mutate(
      {
        id: branch?.id,
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        is_active: isActive,
      },
      {
        onSuccess: () => {
          toast.success(branch ? "Sucursal actualizada" : "Sucursal creada");
          onClose();
        },
        onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
      },
    );
  }

  function handleDelete() {
    if (!branch) return;
    if (branch.is_default) {
      toast.error("No puedes eliminar la sucursal principal");
      return;
    }
    if (!confirm(`Eliminar sucursal "${branch.name}"?`)) return;
    del.mutate(branch.id, {
      onSuccess: () => {
        toast.success("Sucursal eliminada");
        onClose();
      },
      onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{branch ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
          <DialogDescription>
            El inventario y las cajas se registran por sucursal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sucursal Centro" />
          </div>
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input value={address ?? ""} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {branch && !branch.is_default && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <div className="text-sm font-medium">Sucursal activa</div>
                <div className="text-xs text-muted-foreground">
                  Las sucursales inactivas no aparecen en el POS.
                </div>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {branch && !branch.is_default && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={del.isPending}
              className="mr-auto"
            >
              Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
