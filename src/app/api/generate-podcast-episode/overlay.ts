import { Buffer } from "buffer";
import { INTER_BOLD_BASE64, NOTO_SANS_ARABIC_BOLD_BASE64 } from "../generate-assets/font-data";

export function escapeSvgText(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

export function wrapTitleForCover(title: string, maxCharsPerLine = 24, maxLines = 3): string[] {
    const words = title.trim().split(/\s+/);
    const lines: string[] = [];
    let buffer = "";
    for (const word of words) {
        const candidate = buffer ? `${buffer} ${word}` : word;
        if (candidate.length <= maxCharsPerLine) {
            buffer = candidate;
        } else {
            if (buffer) lines.push(buffer);
            buffer = word;
            if (lines.length === maxLines - 1) break;
        }
    }
    if (buffer && lines.length < maxLines) lines.push(buffer);

    // If we stopped early because the title is huge, append an ellipsis to the
    // last line — better than silently dropping words.
    if (lines.length === maxLines) {
        const joined = lines.join(" ");
        const titleNormalized = title.trim().replace(/\s+/g, " ");
        if (joined.length < titleNormalized.length) {
            const last = lines[lines.length - 1];
            lines[lines.length - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : "…";
        }
    }
    return lines;
}

export function generatePodcastCoverOverlay(title: string, logoDataUri?: string | null): Buffer {
    const isRtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(title);
    const lines = wrapTitleForCover(title, 24, 3);

    const textAnchor = isRtl ? "end" : "start";
    const textX = isRtl ? 1320 : 80;
    const direction = isRtl ? "rtl" : "ltr";

    const barX = isRtl ? 1200 : 80;
    const logoX = isRtl ? 1140 : 80;

    const longestLine = Math.max(...lines.map(line => line.length));
    let fontSize = 72;
    if (longestLine > 18) {
        fontSize = Math.max(48, Math.round(72 * (18 / longestLine)));
    }
    const lineHeight = fontSize + 16;

    const tspans = lines.map((line, idx) => {
        const y = 1070 + idx * lineHeight;
        return `<tspan x="${textX}" y="${y}">${escapeSvgText(line)}</tspan>`;
    }).join("");

    const inter = INTER_BOLD_BASE64;
    const arabic = NOTO_SANS_ARABIC_BOLD_BASE64;

    let fontFaceStyles = "";
    if (inter) {
        fontFaceStyles += `
        @font-face {
            font-family: 'Inter';
            src: url('data:font/woff2;charset=utf-8;base64,${inter}') format('woff2');
            font-weight: 700;
            font-style: normal;
        }
        @font-face {
            font-family: 'Inter';
            src: url('data:font/woff2;charset=utf-8;base64,${inter}') format('woff2');
            font-weight: 800;
            font-style: normal;
        }
        `;
    }
    if (arabic) {
        fontFaceStyles += `
        @font-face {
            font-family: 'Noto Sans Arabic';
            src: url('data:font/woff2;charset=utf-8;base64,${arabic}') format('woff2');
            font-weight: 700;
            font-style: normal;
        }
        @font-face {
            font-family: 'Noto Sans Arabic';
            src: url('data:font/woff2;charset=utf-8;base64,${arabic}') format('woff2');
            font-weight: 800;
            font-style: normal;
        }
        `;
    }

    let logoImageElement = "";
    if (logoDataUri) {
        logoImageElement = `<image href="${escapeSvgText(logoDataUri)}" x="${logoX}" y="80" width="180" height="90" />`;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
    <svg width="1400" height="1400" viewBox="0 0 1400 1400" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <style>
                ${fontFaceStyles}
            </style>
            <linearGradient id="scrim" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#020617" stop-opacity="0" />
                <stop offset="40%" stop-color="#020617" stop-opacity="0.85" />
                <stop offset="100%" stop-color="#020617" stop-opacity="0.98" />
            </linearGradient>
            <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="100%" stop-color="#6366f1" />
            </linearGradient>
        </defs>

        <rect x="0" y="750" width="1400" height="650" fill="url(#scrim)" />
        ${logoImageElement}
        <text font-family="'Noto Sans Arabic', Inter, DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif"
              font-size="24"
              font-weight="700"
              fill="#94a3b8"
              letter-spacing="5"
              text-anchor="${textAnchor}"
              direction="${direction}"
              x="${textX}"
              y="950">
            ${isRtl ? "حلقة البودكاست" : "PODCAST EPISODE"}
        </text>
        <rect x="${barX}" y="980" width="120" height="8" rx="4" fill="url(#accent)" />
        <text font-family="'Noto Sans Arabic', Inter, DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif"
              font-size="${fontSize}"
              font-weight="800"
              fill="#ffffff"
              ${isRtl ? "" : 'letter-spacing="-1.2"'}
              text-anchor="${textAnchor}"
              direction="${direction}">
            ${tspans}
        </text>
    </svg>`;

    return Buffer.from(svg);
}
