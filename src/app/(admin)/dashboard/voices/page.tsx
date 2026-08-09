import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listVoices } from "@/features/voices/actions";
import { VoiceLibraryApp } from "@/features/voices/ui/voice-library-app";
import { isElevenLabsConfigured } from "@/shared/lib/ai/tts-providers/elevenlabs";
import {
    DashboardAppWorkbench,
} from "@/features/admin/ui/app-workbench";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Voice Library",
};

export default async function VoicesPage() {
    const state = await requireDashboardModuleAccess("voices");
    const { data, error } = await listVoices(false);

    return (
        <DashboardAppWorkbench>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <VoiceLibraryApp
                    initialVoices={data}
                    initialError={error}
                    canManage={state.role === "admin" || state.role === "manager"}
                    elevenlabsConfigured={isElevenLabsConfigured()}
                />
            </div>
        </DashboardAppWorkbench>
    );
}
