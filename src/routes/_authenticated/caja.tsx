import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Loader2,
  Wallet,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  useOpenCashSession,
  useOpenSessionMutation,
  useCloseSessionMutation,
  useCashMovements,
  useAddMovement,
} from "@/hooks/use-pos";
import { formatNIO, formatUSD } from "@/hooks/use-fiscal";

export const Route = createFileRoute("/_authenticated/caja")({
  component: CajaPage,
  head: () => ({ meta: [{ title: "Control de caja — Nica-POS" }] }),
});

function CajaPage() {
  const { data: session, isLoading } = useOpenCashSession();
  const openSession = useOpenSessionMutation();
  const closeSession = useCloseSessionMutation();
  const addMovement = useAddMovement();
  const { data: movements } = useCashMovements(session?.id);

  const [openNio, setOpenNio] = useState("");
  const [openUsd, setOpenUsd] = useState("");

  const [movType, setMovType] = useState<"income" | "expense">("expense");
  const [movAmount, setMovAmount] = useState("");
  const [movCurrency, setMovCurrency] = useState<"NIO" | "USD">("NIO");
  const [movReason, setMovReason] = useState("");

  const [countedNio, setCountedNio] = useState("");
  const [countedUsd, setCountedUsd] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  async function handleOpen() {
    try {
      await openSession.mutateAsync({
        opening_nio: Number(openNio) || 0,
        opening_usd: Number(openUsd) || 0,
      });
      toast.success("Caja abierta");
      setOpenNio("");
      setOpenUsd("");
    } catch (e) {
      toast.error("No se pudo abrir", { description: String((e as Error).message) });
    }
  }

  async function handleAddMovement() {
    if (!session) return;
    if (!movReason.trim() || !Number(movAmount)) {
      toast.error("Ingresa monto y motivo");
      return;
    }
    try {
      await addMovement.mutateAsync({
        session_id: session.id,
        type: movType,
        amount: Number(movAmount),
        currency: movCurrency,
        reason: movReason.trim(),
      });
      toast.success("Movimiento registrado");
      setMovAmount("");
      setMovReason("");
    } catch (e) {
      toast.error("Error", { description: String((e as Error).message) });
    }
  }

  async function handleClose() {
    if (!session) return;
    try {
      await closeSession.mutateAsync({
        id: session.id,
        counted_nio: Number(countedNio) || 0,
        counted_usd: Number(countedUsd) || 0,
        notes: closeNotes.trim() || undefined,
      });
      toast.success("Caja cerrada (arqueo registrado)");
      setCountedNio("");
      setCountedUsd("");
      setCloseNotes("");
    } catch (e) {
      toast.error("No se pudo cerrar", { description: String((e as Error).message) });
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Wallet className="h-6 w-6 text-primary" /> Control de caja
          </h1>
          <p className="text-muted-foreground">
            Apertura, arqueo ciego, ingresos y egresos.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !session ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-primary" /> Abrir caja
              </CardTitle>
              <CardDescription>
                Registra el fondo inicial del cajón monedero.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Fondo inicial (C$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={openNio}
                    onChange={(e) => setOpenNio(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Fondo inicial ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={openUsd}
                    onChange={(e) => setOpenUsd(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleOpen} disabled={openSession.isPending}>
                {openSession.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Abrir caja
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" /> Caja abierta
                  </CardTitle>
                  <Badge variant="secondary">Activa</Badge>
                </div>
                <CardDescription>
                  Abierta el{" "}
                  {new Date(session.opened_at).toLocaleString("es-NI")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Fondo C$</p>
                  <p className="text-xl font-bold">
                    {formatNIO(Number(session.opening_nio))}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Fondo $</p>
                  <p className="text-xl font-bold">
                    {formatUSD(Number(session.opening_usd))}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ingresos / Egresos</CardTitle>
                <CardDescription>
                  Registra entradas o salidas de dinero de la caja.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select
                      value={movType}
                      onValueChange={(v) =>
                        setMovType(v as "income" | "expense")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Ingreso</SelectItem>
                        <SelectItem value="expense">Egreso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Monto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={movAmount}
                      onChange={(e) => setMovAmount(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Moneda</Label>
                    <Select
                      value={movCurrency}
                      onValueChange={(v) =>
                        setMovCurrency(v as "NIO" | "USD")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NIO">Córdobas (C$)</SelectItem>
                        <SelectItem value="USD">Dólares ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Motivo</Label>
                    <Input
                      value={movReason}
                      onChange={(e) => setMovReason(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddMovement}
                  disabled={addMovement.isPending}
                  variant="secondary"
                >
                  Registrar movimiento
                </Button>

                {movements && movements.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Hora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            {m.type === "income" ? (
                              <span className="flex items-center gap-1 text-primary">
                                <ArrowDownCircle className="h-4 w-4" /> Ingreso
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-destructive">
                                <ArrowUpCircle className="h-4 w-4" /> Egreso
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{m.reason}</TableCell>
                          <TableCell className="text-right">
                            {m.currency === "NIO"
                              ? formatNIO(Number(m.amount))
                              : formatUSD(Number(m.amount))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(m.created_at).toLocaleTimeString("es-NI")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-destructive" /> Cerrar caja
                  (arqueo ciego)
                </CardTitle>
                <CardDescription>
                  Cuenta el efectivo físico sin ver el esperado y registra el
                  cierre.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Efectivo contado (C$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={countedNio}
                      onChange={(e) => setCountedNio(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Efectivo contado ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={countedUsd}
                      onChange={(e) => setCountedUsd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="Observaciones del cierre..."
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={handleClose}
                  disabled={closeSession.isPending}
                >
                  {closeSession.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Cerrar caja
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
