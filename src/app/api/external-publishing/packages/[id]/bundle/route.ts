import { NextResponse } from "next/server";
import { assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import { exportExternalPublicationBundle } from "@/features/external-publishing/service";

export const dynamic = "force-dynamic";

export function GET() {
    return NextResponse.json({ error: "Bundle export is state-changing. Use POST." }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const [{ id }, context] = await Promise.all([params, assertWorkspaceAiEnabled()]);
        const bundle = await exportExternalPublicationBundle({
            workspaceId: context.activeWorkspace.id,
            templateId: context.activeWorkspace.legacy_template_id,
            userId: context.userId,
            locale: (context.activeWorkspace.default_locale ?? "en") as "en" | "nl" | "ar",
        }, id);

        return new NextResponse(bundle.markdown, {
            status: 200,
            headers: {
                "Content-Type": bundle.contentType,
                "Content-Disposition": `attachment; filename="${bundle.filename}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Bundle export failed." }, { status: 400 });
    }
}
