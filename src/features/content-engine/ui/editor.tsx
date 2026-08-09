"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/shared/ui/button";
import {
    RICH_TEXT_COLOR_OPTIONS,
    RICH_TEXT_FONT_FAMILY_OPTIONS,
    RICH_TEXT_HIGHLIGHT_OPTIONS,
    normalizeRichTextInput,
} from "@/features/content-engine/lib/rich-text";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    Italic,
    Strikethrough,
    Code,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Link as LinkIcon,
    ImagePlus,
    Undo,
    Redo,
    Underline as UnderlineIcon,
} from "lucide-react";

interface EditorProps {
    content: string;
    onChange: (html: string) => void;
    editable?: boolean;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    onEditorReady?: (editor: any) => void;
}

import { Editor } from "@tiptap/react";

function ToolbarSelect({
    value,
    onChange,
    options,
    ariaLabel,
}: {
    value: string;
    onChange: (value: string) => void;
    options: ReadonlyArray<{ label: string; value: string }>;
    ariaLabel: string;
}) {
    return (
        <select
            aria-label={ariaLabel}
            className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            value={value}
            onChange={(event) => onChange(event.target.value)}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
    if (!editor) {
        return null;
    }

    const insertLink = () => {
        const previousUrl = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Enter URL", previousUrl || "https://");

        if (url === null) {
            return;
        }

        if (url.trim() === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    };

    const currentTextColor = (editor.getAttributes("textStyle").color as string | undefined) || "inherit";
    const currentHighlightColor = (editor.getAttributes("highlight").color as string | undefined) || "transparent";
    const currentFontFamily = (editor.getAttributes("textStyle").fontFamily as string | undefined) || "inherit";

    const applyTextColor = (value: string) => {
        if (value === "inherit") {
            editor.chain().focus().unsetColor().run();
            return;
        }

        editor.chain().focus().setColor(value).run();
    };

    const applyHighlightColor = (value: string) => {
        if (value === "transparent") {
            editor.chain().focus().unsetHighlight().run();
            return;
        }

        editor.chain().focus().toggleHighlight({ color: value }).run();
    };

    const applyFontFamily = (value: string) => {
        if (value === "inherit") {
            editor.chain().focus().unsetFontFamily().run();
            return;
        }

        editor.chain().focus().setFontFamily(value).run();
    };

    const insertImage = () => {
        const url = window.prompt("Enter image URL", "https://");

        if (!url || !url.trim()) {
            return;
        }

        const alt = window.prompt("Enter image alt text", "") || "";
        editor.chain().focus().setImage({ src: url.trim(), alt }).run();
    };

    return (
        <div className="flex max-w-full flex-nowrap gap-1 overflow-x-auto border-b border-border bg-muted/50 p-2 rounded-t-lg sm:flex-wrap sm:overflow-visible">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={editor.isActive("bold") ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <Bold className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={editor.isActive("italic") ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <Italic className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                disabled={!editor.can().chain().focus().toggleStrike().run()}
                className={editor.isActive("strike") ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                disabled={!editor.can().chain().focus().toggleUnderline().run()}
                className={editor.isActive("underline") ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleCode().run()}
                disabled={!editor.can().chain().focus().toggleCode().run()}
                className={editor.isActive("code") ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <Code className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 self-center" />

            <ToolbarSelect
                ariaLabel="Text color"
                value={currentTextColor}
                onChange={applyTextColor}
                options={RICH_TEXT_COLOR_OPTIONS}
            />
            <ToolbarSelect
                ariaLabel="Highlight color"
                value={currentHighlightColor}
                onChange={applyHighlightColor}
                options={RICH_TEXT_HIGHLIGHT_OPTIONS}
            />
            <ToolbarSelect
                ariaLabel="Font family"
                value={currentFontFamily}
                onChange={applyFontFamily}
                options={RICH_TEXT_FONT_FAMILY_OPTIONS}
            />

            <div className="w-px h-6 bg-border mx-1 self-center" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={editor.isActive("heading", { level: 1 }) ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <Heading1 className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor.isActive("heading", { level: 2 }) ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <Heading2 className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={editor.isActive("heading", { level: 3 }) ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <Heading3 className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 self-center" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive("bulletList") ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <List className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive("orderedList") ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive("blockquote") ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <Quote className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                className={editor.isActive({ textAlign: "left" }) ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                className={editor.isActive({ textAlign: "center" }) ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                className={editor.isActive({ textAlign: "right" }) ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <AlignRight className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 self-center" />

            <Button
                variant="ghost"
                size="sm"
                onClick={insertLink}
                className={editor.isActive("link") ? "bg-accent text-accent-foreground" : ""}
                type="button"
            >
                <LinkIcon className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={insertImage}
                type="button"
            >
                <ImagePlus className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 self-center" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                type="button"
            >
                <Undo className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                type="button"
            >
                <Redo className="h-4 w-4" />
            </Button>
        </div>
    );
};

export function RichTextEditor({ content, onChange, editable = true, onEditorReady }: EditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            TextStyle,
            Color,
            FontFamily,
            Highlight.configure({ multicolor: true }),
            Underline,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            LinkExtension.configure({
                openOnClick: false,
                autolink: true,
                defaultProtocol: "https",
            }),
            ImageExtension.configure({
                inline: true,
                allowBase64: true,
            }),
        ],
        content: normalizeRichTextInput(content),
        editable,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class:
                    "prose prose-sm sm:prose-base max-w-none text-foreground [&_p]:text-foreground [&_li]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_a]:text-primary focus:outline-none min-h-[300px] p-4",
            },
        },
    });

    useEffect(() => {
        if (editor && onEditorReady) {
            onEditorReady(editor);
        }
    }, [editor, onEditorReady]);

    useEffect(() => {
        if (!editor) {
            return;
        }

        const normalized = normalizeRichTextInput(content);

        if (normalized !== editor.getHTML()) {
            editor.commands.setContent(normalized, { emitUpdate: false });
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
            {editable && <MenuBar editor={editor} />}
            <div className="min-w-0 overflow-x-hidden">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
