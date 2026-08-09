const SPEAKER_TAG = /\[(HOST|GUEST)\]\s*:/gi;

/** A tagged source is ready for native two-speaker TTS only when both roles speak. */
export function isReadyMultiSpeakerPodcastScript(sourceText: string): boolean {
    const speakers = new Set<string>();
    for (const match of sourceText.matchAll(SPEAKER_TAG)) {
        speakers.add(match[1].toUpperCase());
    }
    return speakers.has("HOST") && speakers.has("GUEST");
}
