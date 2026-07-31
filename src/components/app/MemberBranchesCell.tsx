import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches } from "@/hooks/use-branch";
import { getFriendlyErrorMessage } from "@/lib/errors";

type Props = {
  tenantId: string;
  memberId: string;
  userId: string;
  role: string;
  mainBranchId: string | null;
  canManage: boolean;
};

export function MemberBranchesCell({
  tenantId,
  memberId,
  userId,
  role,
  mainBranchId,
  canManage,
}: Props) {
  const qc = useQueryClient();
  const branches = useBranches();
  const list = (branches.data ?? []).filter((b) => b.is_active);

  const assignments = useQuery({
    queryKey: ["user-branches", tenantId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_branches")
        .select("branch_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.branch_id);
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ branchId, on }: { branchId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase
          .from("user_branches")
          .insert({ tenant_id: tenantId, user_id: userId, branch_id: branchId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_branches")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .eq("branch_id", branchId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-branches", tenantId, userId] });
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const setMain = useMutation({
    mutationFn: async (branchId: string | null) => {
      const { error } = await supabase
        .from("tenant_members")
        .update({ branch_id: branchId })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-members", tenantId] });
      toast.success("Sucursal principal actualizada");
    },
    onError: (e: Error) => toast.error(getFriendlyErrorMessage(e)),
  });

  const globalRole = role === "owner" || role === "admin" || role === "accountant";
  if (globalRole) {
    return (
      <Badge variant="outline" className="gap-1">
        <Building2 className="h-3 w-3" /> Todas
      </Badge>
    );
  }

  const selected = assignments.data ?? [];
  const names = list.filter((b) => selected.includes(b.id)).map((b) => b.name);
  const mainName = list.find((b) => b.id === mainBranchId)?.name ?? null;
  const summary =
    names.length > 0 ? names.join(", ") : mainName ? `${mainName} (principal)` : "Todas";

  if (!canManage) {
    return <span className="text-sm text-muted-foreground">{summary}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[220px] justify-start gap-2">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Sucursal principal</Label>
          <Select
            value={mainBranchId ?? "none"}
            onValueChange={(v) => setMain.mutate(v === "none" ? null : v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin definir</SelectItem>
              {list.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Sucursales permitidas</Label>
          {assignments.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <div className="space-y-2">
              {list.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.includes(b.id)}
                    onCheckedChange={(c) => toggle.mutate({ branchId: b.id, on: !!c })}
                  />
                  <span className="truncate">{b.name}</span>
                </label>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Si no marcás ninguna, se usa solo la sucursal principal. Si tampoco hay principal,
            puede operar en todas.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
