"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { buildSiteUrl, getSiteUrl } from "@/shared/lib/auth/redirect-url";
import { assertWorkspaceOwnerAdmin, getCurrentUserRole } from "@/shared/lib/workspace/context";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/shared/lib/resend/send-email";

function getManagerInviteRedirectTo() {
    return buildSiteUrl(`/api/auth/confirm?next=${encodeURIComponent("/dashboard")}`);
}

function getInviteBrandName(workspaceName: string) {
    return process.env.PLATFORM_NAME?.trim() || workspaceName;
}

function getInviteLogoMarkup() {
    const logoUrl = process.env.MANAGER_INVITE_LOGO_URL?.trim();
    return logoUrl
        ? `<img src="${logoUrl}" alt="" style="height:36px;display:block;margin-bottom:18px;" />`
        : "";
}

function buildManagerInviteEmail(params: {
    fullName: string;
    email: string;
    workspaceName: string;
    workspaceTier: string;
    inviteUrl?: string;
    initialPassword?: string;
}) {
    const workspaceTierLabel = params.workspaceTier === "pro" ? "Pro Workspace" : "Basic Workspace";
    const siteUrl = getSiteUrl().replace(/\/$/, "");
    const loginUrl = `${siteUrl}/login`;
    const ctaUrl = params.inviteUrl || loginUrl;
    const ctaLabel = params.inviteUrl ? "Accept invite" : "Open login";
    const brandName = getInviteBrandName(params.workspaceName);

    return `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f4f7fb;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #dbe4f0;box-shadow:0 24px 70px rgba(15,23,42,0.12);">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#071226 0%,#0d4f8c 100%);color:#ffffff;">
                ${getInviteLogoMarkup()}
                <div style="font-size:12px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;opacity:0.72;">Workspace Invitation</div>
                <h1 style="margin:14px 0 10px;font-size:32px;line-height:1.1;font-weight:800;">You’ve been invited to ${params.workspaceName}</h1>
                <p style="margin:0;font-size:15px;line-height:1.75;color:rgba(255,255,255,0.84);">An administrator added you as a workspace manager in ${brandName}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:#334155;">Hi ${params.fullName || params.email},</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#475569;">You now have manager access to the workspace below. Use the action button to activate your access and continue to the dashboard.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:12px; margin:-12px 0 0;">
                  <tr>
                    <td style="background:#f8fafc;border:1px solid #dbe4f0;border-radius:18px;padding:18px;vertical-align:top;">
                      <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Workspace</div>
                      <div style="font-size:20px;font-weight:800;color:#0f172a;">${params.workspaceName}</div>
                    </td>
                    <td style="background:#f8fafc;border:1px solid #dbe4f0;border-radius:18px;padding:18px;vertical-align:top;">
                      <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Tier</div>
                      <div style="font-size:20px;font-weight:800;color:#0f172a;">${workspaceTierLabel}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="background:#f8fafc;border:1px solid #dbe4f0;border-radius:18px;padding:18px;vertical-align:top;">
                      <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Account Email</div>
                      <div style="font-size:16px;font-weight:700;color:#0f172a;">${params.email}</div>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:28px;">
                  <a href="${ctaUrl}" style="display:inline-block;background:#0d4f8c;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-size:14px;font-weight:800;letter-spacing:0.02em;">${ctaLabel}</a>
                </div>

                ${params.initialPassword ? `
                <div style="margin-top:24px;background:#f8fafc;border:1px solid #dbe4f0;border-radius:20px;padding:20px;">
                  <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Initial Password</div>
                  <div style="font-size:18px;font-weight:800;color:#0f172a;word-break:break-word;">${params.initialPassword}</div>
                  <p style="margin:10px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Use this temporary password when you sign in, then change your password immediately from your account settings to keep your access secure.</p>
                </div>` : ""}

                <p style="margin:24px 0 0;font-size:13px;line-height:1.8;color:#64748b;">If you already have credentials, you can also log in directly at <a href="${loginUrl}" style="color:#0d4f8c;text-decoration:none;font-weight:700;">${loginUrl}</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendManagerInviteEmail(params: {
    fullName: string;
    email: string;
    workspaceName: string;
    workspaceTier: string;
    inviteUrl?: string;
    initialPassword?: string;
}) {
    const fromEmail = process.env.MANAGER_INVITES_FROM_EMAIL?.trim()
        || process.env.NEWSLETTER_FROM_EMAIL?.trim();
    if (!fromEmail) {
        throw new Error("MANAGER_INVITES_FROM_EMAIL or NEWSLETTER_FROM_EMAIL must be configured");
    }

    await sendEmail({
        from: fromEmail,
        to: params.email,
        subject: `You’ve been invited to manage ${params.workspaceName}`,
        html: buildManagerInviteEmail(params),
    });
}

interface AssignManagerInput {
    workspaceId: string;
    managerProfileId: string;
    startsAt?: string;
}

interface ReassignManagerInput {
    managerProfileId: string;
    toWorkspaceId: string;
    startsAt?: string;
}

interface RevokeManagerInput {
    assignmentId: string;
    workspaceId: string;
    endsAt?: string;
}

async function assertManagerRole(profileId: string) {
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, role")
        .eq("id", profileId)
        .maybeSingle();

    if (error || !data) {
        throw new Error("Manager profile not found");
    }

    if (data.role !== "manager") {
        throw new Error("Selected profile is not a manager");
    }
}

export async function assignManagerToWorkspace(input: AssignManagerInput) {
    try {
        await assertWorkspaceOwnerAdmin(input.workspaceId);
        await assertManagerRole(input.managerProfileId);

        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return { data: null, error: "Unauthorized" };
        }

        const { data: existingAssignment, error: existingAssignmentError } = await supabase
            .from("manager_assignments")
            .select("id")
            .eq("manager_profile_id", input.managerProfileId)
            .eq("workspace_id", input.workspaceId)
            .eq("manager_profile_id", input.managerProfileId)
            .eq("is_active", true)
            .is("ends_at", null)
            .maybeSingle();

        if (existingAssignmentError) {
            return { data: null, error: existingAssignmentError.message };
        }

        if (existingAssignment) {
            return { data: null, error: "Manager is already assigned to this workspace." };
        }

        const { data, error } = await supabase
            .from("manager_assignments")
            .insert({
                manager_profile_id: input.managerProfileId,
                workspace_id: input.workspaceId,
                assigned_by_profile_id: user.id,
                is_active: true,
                starts_at: input.startsAt ?? new Date().toISOString(),
                ends_at: null,
            })
            .select("id, manager_profile_id, workspace_id, is_active, starts_at, ends_at, created_at")
            .single();

        if (error) {
            return { data: null, error: error.message };
        }

        return { data, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to assign manager",
        };
    }
}

export async function reassignManagerToWorkspace(input: ReassignManagerInput) {
    return assignManagerToWorkspace({
        workspaceId: input.toWorkspaceId,
        managerProfileId: input.managerProfileId,
        startsAt: input.startsAt,
    });
}

export async function revokeManagerAssignment(input: RevokeManagerInput) {
    try {
        await assertWorkspaceOwnerAdmin(input.workspaceId);

        const supabase = await createClient();

        const { data, error } = await supabase
            .from("manager_assignments")
            .update({
                is_active: false,
                ends_at: input.endsAt ?? new Date().toISOString(),
            })
            .eq("id", input.assignmentId)
            .eq("workspace_id", input.workspaceId)
            .select("id, manager_profile_id, workspace_id, is_active, starts_at, ends_at, updated_at")
            .single();

        if (error) {
            return { data: null, error: error.message };
        }

        return { data, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to revoke manager assignment",
        };
    }
}

export async function getWorkspaceManagerAssignments(workspaceId: string) {
    try {
        await assertWorkspaceOwnerAdmin(workspaceId);

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data, error } = await supabaseAdmin
            .from("manager_assignments")
            .select(
                "id, manager_profile_id, workspace_id, is_active, starts_at, ends_at, created_at, updated_at, manager:profiles!manager_assignments_manager_profile_id_fkey(id, email, role)",
            )
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false });

        if (error) {
            return { data: null, error: error.message };
        }

        return { data, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to fetch manager assignments",
        };
    }
}

export async function getManagerProfilesForWorkspace(workspaceId: string) {
    try {
        await assertWorkspaceOwnerAdmin(workspaceId);

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data, error } = await supabaseAdmin
            .from("profiles")
            .select("id, email, role")
            .eq("role", "manager")
            .order("email", { ascending: true });

        if (error) {
            return { data: null, error: error.message };
        }

        return { data, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to fetch manager profiles",
        };
    }
}

export async function inviteManager(input: { email: string; fullName: string; password?: string; workspaceId: string }) {
    try {
        const userRole = await getCurrentUserRole();
        if (userRole?.role !== "admin") {
            throw new Error("Forbidden: admin role required");
        }

        const normalizedEmail = input.email.trim().toLowerCase();
        const normalizedFullName = input.fullName.trim();

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: workspace, error: workspaceError } = await supabaseAdmin
            .from("workspaces")
            .select("id, name, workspace_tier")
            .eq("id", input.workspaceId)
            .single();

        if (workspaceError || !workspace) {
            return { data: null, error: workspaceError?.message || "Workspace not found" };
        }

        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
            .from("profiles")
            .select("id, email, role")
            .eq("email", normalizedEmail)
            .maybeSingle();

        if (existingProfileError) {
            return { data: null, error: existingProfileError.message };
        }

        if (existingProfile) {
            const { error: roleUpdateError } = await supabaseAdmin
                .from("profiles")
                .update({ role: "manager" })
                .eq("id", existingProfile.id);

            if (roleUpdateError) {
                return { data: null, error: roleUpdateError.message };
            }

            // If admin supplied a password, reset the auth user's password so the email's
            // stated initial password is actually usable.
            if (input.password) {
                const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
                    existingProfile.id,
                    { password: input.password, email_confirm: true }
                );
                if (pwError) {
                    return { data: null, error: pwError.message };
                }
            }

            const assignmentResult = await assignManagerToWorkspace({
                workspaceId: input.workspaceId,
                managerProfileId: existingProfile.id,
            });

            if (
                assignmentResult.error &&
                assignmentResult.error !== "Manager is already assigned to this workspace."
            ) {
                return { data: null, error: assignmentResult.error };
            }

            try {
                await sendManagerInviteEmail({
                    fullName: normalizedFullName,
                    email: normalizedEmail,
                    workspaceName: workspace.name,
                    workspaceTier: workspace.workspace_tier,
                    initialPassword: input.password,
                });
            } catch (emailError) {
                return {
                    data: { id: existingProfile.id, email: existingProfile.email },
                    error: `Manager assigned but invitation email failed: ${
                        emailError instanceof Error ? emailError.message : "unknown error"
                    }`,
                };
            }

            return { data: { id: existingProfile.id, email: existingProfile.email }, error: null };
        }

        let authUser;
        let inviteUrl: string | undefined;

        if (input.password) {
            // Admin provided an initial password; create the user directly so they can log in immediately.
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email: normalizedEmail,
                password: input.password,
                email_confirm: true,
                user_metadata: { full_name: normalizedFullName || null }
            });

            if (error) {
                const alreadyRegistered = /already|exists|registered/i.test(error.message);
                if (!alreadyRegistered) {
                    return { data: null, error: error.message };
                }

                // Fallback: fetch existing user, then apply the new initial password
                // so the email's stated password is actually usable.
                const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
                    page: 1,
                    perPage: 1000,
                });
                if (usersError) return { data: null, error: usersError.message };

                const existingAuthUser = usersData.users.find(
                    (candidate) => candidate.email?.toLowerCase() === normalizedEmail
                );
                if (!existingAuthUser) return { data: null, error: error.message };

                const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
                    existingAuthUser.id,
                    { password: input.password, email_confirm: true }
                );
                if (pwError) {
                    return { data: null, error: pwError.message };
                }

                authUser = existingAuthUser;
            } else {
                authUser = data.user;
            }
        } else {
            const { data, error } = await supabaseAdmin.auth.admin.generateLink({
                type: "invite",
                email: normalizedEmail,
                options: {
                    redirectTo: getManagerInviteRedirectTo(),
                    data: { full_name: normalizedFullName || null },
                },
            });

            if (error) {
                const alreadyRegistered = /already|exists|registered/i.test(error.message);
                if (!alreadyRegistered) {
                    return { data: null, error: error.message };
                }

                const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
                    page: 1,
                    perPage: 1000,
                });

                if (usersError) {
                    return { data: null, error: usersError.message };
                }

                const existingAuthUser = usersData.users.find(
                    (candidate) => candidate.email?.toLowerCase() === normalizedEmail
                );

                if (!existingAuthUser) {
                    return { data: null, error: error.message };
                }

                authUser = existingAuthUser;
            } else {
                authUser = data.user;
                inviteUrl = data.properties?.action_link ?? undefined;
            }
        }

        if (!authUser) {
            return { data: null, error: "Failed to provision user authentication" };
        }

        // Upsert into profiles as a manager (idempotent with auth trigger profile creation).
        const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
            id: authUser.id,
            email: normalizedEmail,
            role: "manager",
        });

        if (profileError) {
            return { data: null, error: profileError.message };
        }

        const assignmentResult = await assignManagerToWorkspace({
            workspaceId: input.workspaceId,
            managerProfileId: authUser.id,
        });

        if (assignmentResult.error && assignmentResult.error !== "Manager is already assigned to this workspace.") {
            return { data: null, error: assignmentResult.error };
        }

        try {
            await sendManagerInviteEmail({
                fullName: normalizedFullName,
                email: normalizedEmail,
                workspaceName: workspace.name,
                workspaceTier: workspace.workspace_tier,
                inviteUrl,
                initialPassword: input.password,
            });
        } catch (emailError) {
            return {
                data: authUser,
                error: `Manager provisioned but invitation email failed: ${
                    emailError instanceof Error ? emailError.message : "unknown error"
                }`,
            };
        }

        return { data: authUser, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to invite manager",
        };
    }
}
