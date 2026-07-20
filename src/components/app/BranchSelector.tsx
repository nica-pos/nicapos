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
import { useActiveBranch, setActiveBranchId } from "@/hooks/use-branch";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function BranchSelector() {
  const { tenant } = useActiveTenant();
  const { activeBranches, branch } = useActiveBranch();
  const qc = useQueryClient();

  if (!tenant || activeBranches.length === 0) return null;

  function pick(id: string) {
    if (!tenant) return;
    setActiveBranchId(tenant.id, id);
    qc.invalidateQueries();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[140px] truncate">{branch?.name ?? "Sucursal"}</span>
          {activeBranches.length > 1 && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </Button>
      </DropdownMenuTrigger>
      {activeBranches.length > 1 && (
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Sucursal activa</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {activeBranches.map((b) => (
            <DropdownMenuItem key={b.id} onClick={() => pick(b.id)} className="gap-2">
              <Check className={cn("h-4 w-4", b.id === branch?.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{b.name}</span>
              {b.is_default && (
                <span className="ml-auto text-[10px] text-muted-foreground">Principal</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
