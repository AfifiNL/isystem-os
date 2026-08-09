"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Filter,
    RefreshCw,
    ShieldAlert,
    ShieldCheck
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { getBookingPaymentsOverview, markBookingPaymentVerified, expireBookingHoldManual } from "@/features/booking/actions";
import { isLegacyBookingPricingVersion } from "@/features/booking/lib/pricing";
import type { Tables } from "@/shared/lib/supabase/database.types";

type BookingReservationRow = Tables<"booking_reservations">;

interface BookingPaymentHoldsProps {
    reservations: BookingReservationRow[];
}

interface PaymentHoldItem {
    id: string;
    reservation_id: string;
    provider: string;
    status: "requested" | "verified" | "failed" | "expired" | "refunded";
    amount_cents: number;
    currency: string;
    net_amount_cents: number | null;
    vat_rate_basis_points: number | null;
    vat_amount_cents: number | null;
    gross_amount_cents: number | null;
    pricing_version: string | null;
    payment_url: string | null;
    payment_reference: string;
    deadline_at: string | null;
    verified_at: string | null;
    verified_by: string | null;
    verified_note: string | null;
    created_at: string;
    updated_at: string;
    paypal_order_id?: string | null;
    paypal_status?: string | null;
    // Joined local fields
    customerName?: string;
    reservationStatus?: string;
    isStuck?: boolean;
    stuckReason?: string;
}

export function BookingPaymentHolds({ reservations }: BookingPaymentHoldsProps) {
    const [rawPayments, setRawPayments] = useState<Exclude<Awaited<ReturnType<typeof getBookingPaymentsOverview>>["data"], null>>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [actionStatus, setActionStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [providerFilter, setProviderFilter] = useState<string>("all");
    const [stuckFilter, setStuckFilter] = useState<string>("all");

    // Timer state for countdowns
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const loadHolds = useCallback(async () => {
        setLoading(true);
        setActionStatus(null);
        try {
            const res = await getBookingPaymentsOverview({ limit: 200 });
            if (res.error) {
                setActionStatus({ tone: "error", message: res.error });
                return;
            }

            setRawPayments(res.data ?? []);
        } catch (err) {
            setActionStatus({ tone: "error", message: err instanceof Error ? err.message : "Failed to load payment holds." });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHolds();
    }, [loadHolds]);

    const holds = useMemo<PaymentHoldItem[]>(() => {
        return rawPayments.map((payment) => {
            const resRow = reservations.find((r) => r.id === payment.reservation_id);

            // Detection logic
            let isStuck = false;
            let stuckReason = "";

            if (resRow) {
                const isReservationTerminal = ["cancelled_by_customer", "cancelled_by_workspace", "expired", "no_show"].includes(resRow.status);
                const isPayPalCancelled = payment.paypal_status === "CUSTOMER_CANCELLED";
                const isMismatch1 = payment.status === 'verified' && resRow.status === 'pending_confirmation';
                const isMismatch2 = payment.status !== 'verified' && resRow.status === 'confirmed';
                const isStuckPaypal = payment.provider === 'paypal_checkout' &&
                                      payment.status === 'requested' &&
                                      !isPayPalCancelled &&
                                      payment.paypal_order_id &&
                                      new Date(payment.created_at).getTime() < now - 30 * 60 * 1000;
                const isDeadlinePassed = payment.status === 'requested' &&
                                         !isPayPalCancelled &&
                                         payment.deadline_at &&
                                         new Date(payment.deadline_at).getTime() < now;
                const isFailed = payment.status === 'failed';

                isStuck = !isReservationTerminal && (isMismatch1 || isMismatch2 || isStuckPaypal || isDeadlinePassed || isFailed);

                if (isMismatch1) stuckReason = "Payment verified but hold not confirmed";
                else if (isMismatch2) stuckReason = "Reservation confirmed without verified payment";
                else if (isStuckPaypal) stuckReason = "PayPal order created but not captured (>30m)";
                else if (isDeadlinePassed) stuckReason = "Payment deadline passed without verification";
                else if (isFailed) stuckReason = "Payment failed";
            }

            return {
                ...payment,
                customerName: resRow?.customer_full_name ?? "Unknown customer",
                reservationStatus: resRow?.status ?? "Unknown",
                isStuck,
                stuckReason,
            };
        });
    }, [rawPayments, reservations, now]);

    const filteredHolds = useMemo<PaymentHoldItem[]>(() => {
        let result = [...holds];

        if (statusFilter !== "all") {
            result = result.filter((h) => h.status === statusFilter);
        }

        if (providerFilter !== "all") {
            result = result.filter((h) => h.provider === providerFilter);
        }

        if (stuckFilter === "stuck") {
            result = result.filter((h) => h.isStuck);
        } else if (stuckFilter === "clean") {
            result = result.filter((h) => !h.isStuck);
        }

        return result;
    }, [holds, statusFilter, providerFilter, stuckFilter]);

    function handleVerify(reservationId: string) {
        setActionStatus(null);
        const note = window.prompt("Enter verification note (optional):");
        if (note === null) return; // cancelled

        startTransition(async () => {
            const res = await markBookingPaymentVerified({
                reservationId,
                note: note.trim() || "Manually verified by operator",
                autoConfirm: true,
            });

            if (res.error) {
                setActionStatus({ tone: "error", message: res.error });
            } else {
                setActionStatus({ tone: "success", message: "Payment verified and reservation confirmed." });
                loadHolds();
            }
        });
    }

    function handleExpire(reservationId: string) {
        setActionStatus(null);
        if (!window.confirm("Are you sure you want to manually expire this booking hold? This will free up the availability slot.")) {
            return;
        }

        startTransition(async () => {
            const res = await expireBookingHoldManual(reservationId);

            if (res.error) {
                setActionStatus({ tone: "error", message: res.error });
            } else {
                setActionStatus({ tone: "success", message: "Booking hold expired successfully." });
                loadHolds();
            }
        });
    }

    function renderCountdown(deadlineAt: string | null, status: string) {
        if (!deadlineAt || status !== "requested") return <span className="text-muted-foreground">—</span>;

        const diff = new Date(deadlineAt).getTime() - now;
        if (diff <= 0) {
            return <span className="text-red-500 font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Expired</span>;
        }

        const totalSecs = Math.floor(diff / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;

        const timeString = `${mins}:${secs.toString().padStart(2, "0")}`;
        const colorClass = mins < 15 ? "text-red-500 font-medium animate-pulse" : "text-amber-500 font-medium";

        return <span className={colorClass}>{timeString}</span>;
    }

    return (
        <Card className="premium-panel premium-glow rounded-3xl border-border/60 bg-background/75 min-h-[500px]">
            <CardHeader className="flex flex-row items-center justify-between pb-6">
                <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                        Booking payment holds
                    </CardTitle>
                    <CardDescription>
                        Monitor active holds, check for stuck PayPal checkout sequences, and resolve hold exceptions.
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadHolds} disabled={loading || isPending}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </CardHeader>
            <CardContent className="space-y-6">
                {actionStatus && (
                    <div className={`p-4 rounded-2xl flex items-center gap-2 text-sm font-medium border ${
                        actionStatus.tone === "success"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "bg-destructive/10 border-destructive/20 text-destructive"
                    }`}>
                        {actionStatus.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {actionStatus.message}
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-accent/30 p-4 rounded-2xl border border-border/40">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-2">
                        <Filter className="h-3.5 w-3.5" /> Filters:
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">Payment Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
                        >
                            <option value="all">All statuses</option>
                            <option value="requested">Requested (Hold)</option>
                            <option value="verified">Verified</option>
                            <option value="failed">Failed</option>
                            <option value="expired">Expired</option>
                            <option value="refunded">Refunded</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">Provider</label>
                        <select
                            value={providerFilter}
                            onChange={(e) => setProviderFilter(e.target.value)}
                            className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
                        >
                            <option value="all">All providers</option>
                            <option value="paypal_checkout">PayPal Checkout</option>
                            <option value="manual_revolut_pro">Manual Revolut Pro</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">Anomaly Check</label>
                        <select
                            value={stuckFilter}
                            onChange={(e) => setStuckFilter(e.target.value)}
                            className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
                        >
                            <option value="all">All holds</option>
                            <option value="stuck">Stuck / Anomalies only</option>
                            <option value="clean">Normal only</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                        <p className="text-sm">Loading holds list...</p>
                    </div>
                ) : filteredHolds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-3xl text-muted-foreground">
                        <Clock className="h-10 w-10 mb-4 text-muted-foreground/60" />
                        <p className="text-sm font-medium">No payment holds match current filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-border/60">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b bg-accent/40 text-xs font-semibold uppercase text-muted-foreground">
                                    <th className="p-4">Hold Reference</th>
                                    <th className="p-4">Customer</th>
                                    <th className="p-4">Provider</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Countdown</th>
                                    <th className="p-4">Anomaly State</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredHolds.map((hold) => (
                                    <tr key={hold.id} className={`hover:bg-accent/20 transition-colors ${hold.isStuck ? "bg-red-500/5" : ""}`}>
                                        <td className="p-4 font-mono font-medium text-foreground">
                                            {hold.payment_reference}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium">{hold.customerName}</div>
                                            <div className="text-xs text-muted-foreground">Res: {hold.reservationStatus}</div>
                                        </td>
                                        <td className="p-4 text-xs">
                                            {hold.provider === "paypal_checkout" ? "PayPal" : "Revolut Pro"}
                                        </td>
                                        <td className="p-4 font-medium">
                                            <div>
                                                €{((hold.gross_amount_cents ?? hold.amount_cents) / 100).toFixed(2)}
                                            </div>
                                            {hold.gross_amount_cents !== null && hold.net_amount_cents !== null && hold.vat_amount_cents !== null ? (
                                                <div className="mt-1 text-xs font-normal text-muted-foreground">
                                                    €{(hold.net_amount_cents / 100).toFixed(2)} net + €{(hold.vat_amount_cents / 100).toFixed(2)} VAT
                                                    {hold.vat_rate_basis_points !== null ? ` (${(hold.vat_rate_basis_points / 100).toFixed(2)}%)` : ""}
                                                </div>
                                            ) : isLegacyBookingPricingVersion(hold.pricing_version) ? (
                                                <div className="mt-1 text-xs font-normal text-amber-600 dark:text-amber-400">Legacy pricing</div>
                                            ) : null}
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                                                hold.status === "verified" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                                                hold.status === "requested" ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300" :
                                                "bg-muted border-muted-foreground/20 text-muted-foreground"
                                            }`}>
                                                {hold.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {renderCountdown(hold.deadline_at, hold.status)}
                                        </td>
                                        <td className="p-4">
                                            {hold.isStuck ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
                                                    <ShieldAlert className="h-3.5 w-3.5" />
                                                    {hold.stuckReason}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                    Normal
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            {hold.status === "requested" && hold.provider === "manual_revolut_pro" && (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="xs"
                                                        onClick={() => handleVerify(hold.reservation_id)}
                                                        disabled={isPending}
                                                        className="text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10"
                                                    >
                                                        Verify
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="xs"
                                                        onClick={() => handleExpire(hold.reservation_id)}
                                                        disabled={isPending}
                                                        className="text-red-500 border-red-500/20 hover:bg-red-500/10"
                                                    >
                                                        Expire
                                                    </Button>
                                                </>
                                            )}
                                            {hold.status === "requested" && hold.provider === "paypal_checkout" && (
                                                <span className="text-xs text-amber-700 dark:text-amber-300">Awaiting PayPal capture</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
