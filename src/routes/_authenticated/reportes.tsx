import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Download, Trophy, BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardShell } from "@/components/app/DashboardShell";
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
import { useBranches } from "@/hooks/use-branch";
import { useBranchComparison, useSalesExport, downloadCsv } from "@/hooks/use-reports";
import { formatUSD } from "@/hooks/use-fiscal";
import { getFriendlyErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: ReportesPage,
  head: () => ({
    meta: [
      { title: "Reportes por sucursal — Nica-POS" },
      {
        name: "description",
        content:
          "Compará el desempeño de tus sucursales y exportá reportes de ventas en CSV.",
      },
      { property: "og:title", content: "Reportes por sucursal — Nica-POS" },
      {
        property: "og:description",
        content: "Ranking de ventas, utilidad y ticket promedio por sede, con exportación a CSV.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/reportes" }],
  }),
});

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function ReportesPage() {
  const [from, setFrom] = useState(todayStr(-29));
  const [to, setTo] = useState(todayStr(0));
  const [exportBranch, setExportBranch] = useState<string>("__all__");

  const { data: branches } = useBranches();
  const report = useBranchComparison(from, to);
  const salesExport = useSalesExport(
    from,
    to,
    exportBranch === "__all__" ? null : exportBranch,
  );

  const rows = report.data?.rows ?? [];
  const totals = report.data?.totals;

  const chartData = useMemo(
    () =>
      rows
        .filter((r) => r.salesCount > 0)
        .slice(0, 8)
        .map((r) => ({
          name: r.branchName.length > 14 ? r.branchName.slice(0, 13) + "…" : r.branchName,
          ventas: Number(r.totalUsd.toFixed(2)),
          utilidad: Number(r.profitUsd.toFixed(2)),
        })),
    [rows],
  );

  const branchNameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of branches ?? []) m.set(b.id, b.name);
    return m;
  }, [branches]);

  function exportComparison() {
    if (rows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    downloadCsv(
      `comparativa-sucursales_${from}_${to}.csv`,
      ["Sucursal", "Ventas (#)", "Total USD", "Costo USD", "Utilidad USD", "Ticket prom. USD", "Margen %"],
      rows.map((r) => [
        r.branchName,
        r.salesCount,
        r.totalUsd.toFixed(2),
        r.cogsUsd.toFixed(2),
        r.profitUsd.toFixed(2),
        r.avgTicketUsd.toFixed(2),
        r.marginPct.toFixed(1),
      ]),
    );
    toast.success("Comparativa exportada");
  }

  async function exportDetail() {
    try {
      const res = await salesExport.refetch();
      const data = res.data ?? [];
      if (data.length === 0) {
        toast.error("No hay ventas en ese rango");
        return;
      }
      const label = exportBranch === "__all__" ? "todas" : (branchNameOf.get(exportBranch) ?? "sucursal");
      downloadCsv(
        `ventas_${label}_${from}_${to}.csv`.replace(/\s+/g, "-"),
        ["Factura", "Fecha", "Sucursal", "Subtotal USD", "Impuesto USD", "Total USD"],
        data.map((s) => [
          s.sale_number,
          new Date(s.created_at).toLocaleString("es-NI"),
          s.branch_id ? (branchNameOf.get(s.branch_id) ?? "—") : "—",
          Number(s.subtotal_usd ?? 0).toFixed(2),
          Number(s.tax_usd ?? 0).toFixed(2),
          Number(s.total_usd ?? 0).toFixed(2),
        ]),
      );
      toast.success(`${data.length} ventas exportadas`);
    } catch (e) {
      toast.error("No se pudo exportar", { description: getFriendlyErrorMessage(e) });
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes por sucursal</h1>
          <p className="text-sm text-muted-foreground">
            Compará el desempeño de tus sedes y descargá los datos en CSV.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rango de fechas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="from">Desde</Label>
              <Input
                id="from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="w-[170px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">Hasta</Label>
              <Input
                id="to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="w-[170px]"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setFrom(todayStr(0)); setTo(todayStr(0)); }}>
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setFrom(todayStr(-6)); setTo(todayStr(0)); }}>
                7 días
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setFrom(todayStr(-29)); setTo(todayStr(0)); }}>
                30 días
              </Button>
            </div>
            <Button className="ml-auto" variant="outline" onClick={exportComparison}>
              <Download className="mr-2 h-4 w-4" />
              Exportar comparativa
            </Button>
          </CardContent>
        </Card>

        {report.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Ventas" value={String(totals?.salesCount ?? 0)} />
              <MetricCard label="Total facturado" value={formatUSD(totals?.totalUsd ?? 0)} />
              <MetricCard label="Utilidad bruta" value={formatUSD(totals?.profitUsd ?? 0)} />
              <MetricCard label="Ticket promedio" value={formatUSD(totals?.avgTicketUsd ?? 0)} />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Ventas y utilidad por sede
                </CardTitle>
                <CardDescription>Top 8 sucursales con ventas en el período.</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sin ventas en el período seleccionado.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} width={50} />
                      <Tooltip
                        formatter={(v: number) => formatUSD(Number(v))}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="utilidad" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4" />
                  Ranking de sucursales
                </CardTitle>
                <CardDescription>Ordenado por total facturado en el período.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Utilidad</TableHead>
                      <TableHead className="text-right">Ticket prom.</TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          Sin datos en el período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r, i) => (
                        <TableRow key={r.branchId ?? "none"}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            {r.branchName}
                            {i === 0 && r.totalUsd > 0 && (
                              <Badge variant="secondary" className="ml-2">Líder</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{r.salesCount}</TableCell>
                          <TableCell className="text-right font-medium">{formatUSD(r.totalUsd)}</TableCell>
                          <TableCell className="text-right">{formatUSD(r.profitUsd)}</TableCell>
                          <TableCell className="text-right">{formatUSD(r.avgTicketUsd)}</TableCell>
                          <TableCell className="text-right">{r.marginPct.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Exportar detalle de ventas</CardTitle>
                <CardDescription>
                  Descargá el listado de facturas del período, filtrado por sucursal.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label>Sucursal</Label>
                  <Select value={exportBranch} onValueChange={setExportBranch}>
                    <SelectTrigger className="w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas las sucursales</SelectItem>
                      {(branches ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={exportDetail} disabled={salesExport.isFetching}>
                  {salesExport.isFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Descargar CSV
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
