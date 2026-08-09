import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Data-driven prose section. Keeps long-form per-tool copy as plain data
 * structures so the same trilingual registry holds EN/NL/AR without 3× JSX.
 */
export type ProseSection =
    | { type: "h2"; text: string }
    | { type: "p"; text: string }
    | { type: "p-link"; text: string; linkHref: string; linkLabel: string; suffix?: string }
    | { type: "ul" | "ol"; items: string[] }
    | { type: "ul-strong"; items: Array<{ strong: string; text: string }> };

export function renderProse(sections: ProseSection[], keyPrefix = "p"): ReactNode {
    return sections.map((s, idx) => {
        const key = `${keyPrefix}-${idx}`;
        switch (s.type) {
            case "h2":
                return <h2 key={key}>{s.text}</h2>;
            case "p":
                return <p key={key}>{s.text}</p>;
            case "p-link":
                return (
                    <p key={key}>
                        {s.text}
                        <Link href={s.linkHref}>{s.linkLabel}</Link>
                        {s.suffix ?? ""}
                    </p>
                );
            case "ul":
                return (
                    <ul key={key}>
                        {s.items.map((item, i) => (
                            <li key={`${key}-${i}`}>{item}</li>
                        ))}
                    </ul>
                );
            case "ol":
                return (
                    <ol key={key}>
                        {s.items.map((item, i) => (
                            <li key={`${key}-${i}`}>{item}</li>
                        ))}
                    </ol>
                );
            case "ul-strong":
                return (
                    <ul key={key}>
                        {s.items.map((item, i) => (
                            <li key={`${key}-${i}`}>
                                <strong>{item.strong}</strong> — {item.text}
                            </li>
                        ))}
                    </ul>
                );
        }
    });
}
