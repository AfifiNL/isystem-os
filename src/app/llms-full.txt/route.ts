import { getAgentIndex, renderLlmsFullTxt } from "@/features/ai-discovery/agent-index";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
    const index = await getAgentIndex();

    return new Response(renderLlmsFullTxt(index), {
        headers: {
            "content-type": "text/markdown; charset=utf-8",
            "cache-control": "public, max-age=0, must-revalidate",
        },
    });
}
