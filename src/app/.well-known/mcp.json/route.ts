import { getAgentIndex, renderAgentManifest } from "@/features/ai-discovery/agent-index";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
    const index = await getAgentIndex();

    return Response.json(renderAgentManifest(index), {
        headers: {
            "cache-control": "public, max-age=0, must-revalidate",
        },
    });
}
