import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE env vars. Check .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CHECK_IDS = [
    "fcc66726-062a-4570-85c7-97a2656e5651", // legal-digital-systems
    "16c9158f-97d5-4675-9964-b61d72409836", // real-estate-digital-systems
];

async function run() {
    for (const id of CHECK_IDS) {
        const { data: item } = await supabase
            .from("content_items")
            .select("title, slug, content_markdown, visual_layout")
            .eq("id", id)
            .single();

        if (!item) {
            console.log(`Not found: ${id}`);
            continue;
        }

        console.log(`\nChecking "${item.title}"`);
        const markdownStr = item.content_markdown || "";
        const layoutStr = JSON.stringify(item.visual_layout || {});

        const markdownMatches = [...markdownStr.matchAll(/home/gi)];
        const layoutMatches = [...layoutStr.matchAll(/home/gi)];

        console.log(`Markdown matches for 'home': ${markdownMatches.length}`);
        console.log(`Layout matches for 'home': ${layoutMatches.length}`);

        if (markdownMatches.length > 0) {
            // print context around match
            console.log("Markdown matches context:");
            const idx = markdownStr.toLowerCase().indexOf("home");
            console.log(markdownStr.substring(Math.max(0, idx - 40), Math.min(markdownStr.length, idx + 40)));
        }
        if (layoutMatches.length > 0) {
            // print context around match
            console.log("Layout matches context:");
            const idx = layoutStr.toLowerCase().indexOf("home");
            console.log(layoutStr.substring(Math.max(0, idx - 40), Math.min(layoutStr.length, idx + 40)));
        }
    }
}

run();
