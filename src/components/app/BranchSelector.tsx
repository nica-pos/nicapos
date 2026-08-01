import { Building2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveBranch, setActiveBranchId, ALL_BRANCHES } from "@/hooks/use-branch";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function BranchSelector() {
  const { tenant } = useActiveTenant();
  const { activeBranches, branch, isAll, canSeeAll } = useActiveBranch();
  const qc = useQueryClient();

  if (!tenant || activeBranches.length === 0) return null;

  function pick(id: string) {
    if (!tenant) return;
    setActiveBranchId(tenant.id, id);
    qc.invalidateQueries();
  }

  const hasMenu = activeBranches.length > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[160px] truncate">
            {isAll ? "Todas las sucursales" : (branch?.name ?? "Sucursal")}
          </span>
          {hasMenu && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </Button>
      </DropdownMenuTrigger>
      {hasMenu && (
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Sucursal activa</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {activeBranches.map((b) => (
            <DropdownMenuItem key={b.id} onClick={() => pick(b.id)} className="gap-2">
              <Check className={cn("h-4 w-4", !isAll && b.id === branch?.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{b.name}</span>
              {b.is_default && (
                <span className="ml-auto text-[10px] text-muted-foreground">Principal</span>
              )}
            </DropdownMenuItem>
          ))}
          {canSeeAll && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => pick(ALL_BRANCHES)} className="gap-2">
                <Check className={cn("h-4 w-4", isAll ? "opacity-100" : "opacity-0")} />
                <span className="truncate">Todas las sucursales</span>
                <span className="ml-auto text-[10px] text-muted-foreground">Consolidado</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}

