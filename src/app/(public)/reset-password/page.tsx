import type { Metadata } from 'next'
import { PasswordResetForm } from '@/features/auth/ui/password-reset-form'
import { getActiveTemplate } from '@/features/templates/actions'
import { buildSecondaryPageMetadata } from '@/features/templates/metadata'

const RESET_COPY: Record<'en' | 'nl' | 'ar', { title: string; description: string }> = {
    en: { title: 'Reset password', description: 'Reset the password for your workspace account.' },
    nl: { title: 'Wachtwoord resetten', description: 'Reset het wachtwoord van je werkruimte-account.' },
    ar: { title: 'إعادة تعيين كلمة المرور', description: 'أعد تعيين كلمة مرور حسابك.' },
}

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate()
    const supported = locale === 'nl' || locale === 'ar' ? locale : 'en'
    const copy = RESET_COPY[supported]
    return buildSecondaryPageMetadata({
        path: '/reset-password',
        title: copy.title,
        description: copy.description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        noIndex: true,
    })
}

export default function ResetPasswordPage() {
    return (
        <div className="flex min-h-[calc(100vh-theme(spacing.16))] items-center justify-center bg-muted/40 px-4 py-10">
            <div className="w-full max-w-md">
                <PasswordResetForm />
            </div>
        </div>
    )
}
