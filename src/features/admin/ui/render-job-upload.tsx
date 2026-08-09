"use client";

import { useState } from "react";
import { uploadRenderedVideo } from "@/features/admin/actions/video-fulfillment";
import { Button } from "@/shared/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { PremiumInlinePending } from "@/shared/ui/loading";

interface RenderJobUploadProps {
    jobId: string;
    workspaceId: string;
}

export function RenderJobUpload({ jobId, workspaceId }: RenderJobUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const result = await uploadRenderedVideo(jobId, workspaceId, formData);
            if (!result.success) {
                setError(result.error || "Upload failed");
            }
        } catch {
            setError("Network error during upload");
        } finally {
            setIsUploading(false);
            // reset file input
            e.target.value = "";
        }
    };

    return (
        <div className="flex flex-col gap-2">
            {isUploading ? <PremiumInlinePending label="Uploading render output" description="Validating and attaching fulfillment asset" /> : null}
            <div>
                <input
                    type="file"
                    accept="video/mp4"
                    className="hidden"
                    id={`upload-${jobId}`}
                    onChange={handleUpload}
                    disabled={isUploading}
                />
                <label htmlFor={`upload-${jobId}`}>
                    <Button variant="outline" size="sm" asChild disabled={isUploading} className="cursor-pointer">
                        <span>
                            {isUploading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            Upload Result
                        </span>
                    </Button>
                </label>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}
