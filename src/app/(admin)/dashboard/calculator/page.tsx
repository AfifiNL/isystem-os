import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { CalculatorApp } from "@/features/productivity/calculator/calculator-app";

export const metadata = {
    title: "Calculator",
};

export default async function CalculatorPage() {
    await requireAdminDashboardState();
    return <CalculatorApp />;
}
