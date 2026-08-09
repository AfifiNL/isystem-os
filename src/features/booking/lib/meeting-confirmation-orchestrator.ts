import type { BookingMeetingProvider } from "./meeting-policy";
import {
    canConfirmReservationWithMeeting,
    type MeetingConfirmationStatus,
} from "./meeting-confirmation-policy";

type ProvisionedMeeting = {
    status: Exclude<MeetingConfirmationStatus, null>;
    joinUrl: string | null;
    error?: string;
};

export async function provisionAndConfirmReservation(input: {
    provider: BookingMeetingProvider;
    provisionMeeting: () => Promise<ProvisionedMeeting>;
    commitConfirmation: () => Promise<boolean>;
}): Promise<{
    confirmed: boolean;
    meetingStatus: ProvisionedMeeting["status"];
    joinUrl: string | null;
    reason?: string;
}> {
    let meeting: ProvisionedMeeting;
    try {
        meeting = await input.provisionMeeting();
    } catch (error) {
        return {
            confirmed: false,
            meetingStatus: "failed",
            joinUrl: null,
            reason: error instanceof Error ? error.message : "Meeting provisioning failed.",
        };
    }

    const gate = canConfirmReservationWithMeeting({
        provider: input.provider,
        meetingStatus: meeting.status,
        joinUrl: meeting.joinUrl,
    });
    if (!gate.allowed) {
        return {
            confirmed: false,
            meetingStatus: meeting.status,
            joinUrl: meeting.joinUrl,
            reason: meeting.error ?? gate.reason,
        };
    }

    const committed = await input.commitConfirmation();
    if (!committed) {
        return {
            confirmed: false,
            meetingStatus: meeting.status,
            joinUrl: meeting.joinUrl,
            reason: "The reservation changed before confirmation could be committed.",
        };
    }

    return {
        confirmed: true,
        meetingStatus: meeting.status,
        joinUrl: meeting.joinUrl,
    };
}
