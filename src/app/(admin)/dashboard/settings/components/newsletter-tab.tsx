import type { Dispatch, SetStateAction } from "react";
import type { NewsletterSettingsInput } from "@/features/newsletter/schema";

interface NewsletterTabProps {
    newsletterSettings: NewsletterSettingsInput;
    setNewsletterSettings: Dispatch<SetStateAction<NewsletterSettingsInput>>;
}

export function NewsletterTab({ newsletterSettings, setNewsletterSettings }: NewsletterTabProps) {
    return (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4 rounded-md border border-border/50 bg-card p-6 shadow-sm">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Newsletter sender settings</h2>
                    <p className="mt-1 text-[17px] text-muted-foreground">
                        Configure the sender identity, welcome message, audience defaults, and footer used by newsletter campaigns and automation.
                    </p>
                </div>

                <div className="grid gap-4">
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">From name</span>
                        <input value={newsletterSettings.fromName} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, fromName: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">From email</span>
                        <input value={newsletterSettings.fromEmail} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, fromEmail: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">Reply-to email</span>
                        <input value={newsletterSettings.replyToEmail} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, replyToEmail: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">Company name</span>
                        <input value={newsletterSettings.companyName} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, companyName: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">Company address</span>
                        <textarea value={newsletterSettings.companyAddress} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, companyAddress: event.target.value }))} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">Default audience name</span>
                        <input value={newsletterSettings.defaultAudienceName} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, defaultAudienceName: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">Brand accent</span>
                        <input value={newsletterSettings.brandAccent} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, brandAccent: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono" />
                    </label>
                </div>
            </div>

            <div className="space-y-4 rounded-md border border-border/50 bg-card p-6 shadow-sm">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Welcome experience</h2>
                    <p className="mt-1 text-[17px] text-muted-foreground">
                        These values power the welcome email and become the baseline voice for template-driven newsletter automation.
                    </p>
                </div>

                <div className="grid gap-4">
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">Welcome subject</span>
                        <input value={newsletterSettings.welcomeSubject} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, welcomeSubject: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">Welcome heading</span>
                        <input value={newsletterSettings.welcomeHeading} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, welcomeHeading: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">Welcome body</span>
                        <textarea value={newsletterSettings.welcomeBody} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, welcomeBody: event.target.value }))} className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="space-y-2 text-[17px]">
                        <span className="font-medium text-foreground">Footer text</span>
                        <textarea value={newsletterSettings.footerText} onChange={(event) => setNewsletterSettings((prev) => ({ ...prev, footerText: event.target.value }))} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                </div>
            </div>
        </div>
    );
}
