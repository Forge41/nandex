"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { Decoration, EditorView, lineNumbers, ViewPlugin, type DecorationSet } from "@codemirror/view";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { go } from "@codemirror/lang-go";
import { javascript } from "@codemirror/lang-javascript";
import { cn } from "@/lib/utils";
import type { CodeLanguage } from "@/lib/interview/types";

const LANGUAGE = {
  python: () => python(),
  sql: () => sql(),
  go: () => go(),
  typescript: () => javascript({ typescript: true }),
} as const;

/** Token colours reference CSS variables, so a theme switch repaints the editor
 * without rebuilding the extension. */
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.moduleKeyword, tags.controlKeyword], color: "hsl(var(--ui-violet-fg))" },
  { tag: [tags.string, tags.special(tags.string), tags.bool, tags.number], color: "hsl(var(--ui-jade-fg))" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "hsl(var(--ui-blue-fg))" },
  { tag: [tags.className, tags.typeName, tags.definition(tags.className)], color: "hsl(var(--ui-gold-fg))" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "hsl(var(--foreground-fg-muted))", fontStyle: "italic" },
  { tag: [tags.operator, tags.punctuation], color: "hsl(var(--foreground-fg-subtle))" },
  { tag: tags.variableName, color: "hsl(var(--foreground-fg-base))" },
]);

const theme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "hsl(var(--foreground-fg-base))",
    fontSize: "var(--text-xs)",
    height: "100%",
  },
  ".cm-content": { fontFamily: "var(--font-mono)", lineHeight: "1.75", padding: "12px 0" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "hsl(var(--foreground-fg-disabled))",
    fontFamily: "var(--font-mono)",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 14px" },
  ".cm-activeLine": { backgroundColor: "hsl(var(--background-bg-subtle))" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-cursor": { borderLeftColor: "hsl(var(--foreground-fg-base))" },
  "&.cm-focused": { outline: "none" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "hsl(var(--background-bg-component)) !important" },
  ".cm-scroller": { overflow: "auto" },
  /* Set by the fault-line decoration in the debug round. */
  ".cm-line.cm-faultLine": { backgroundColor: "hsl(var(--ui-danger-bg))" },
});

const faultDecoration = Decoration.line({ class: "cm-faultLine" });

/** Marks one line as the fault, for the debug round. A view plugin rather than
 * a static decoration so it survives edits and viewport changes. */
function faultLineHighlight(line: number) {
  const build = (view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>();
    if (line >= 1 && line <= view.state.doc.lines) {
      builder.add(view.state.doc.line(line).from, view.state.doc.line(line).from, faultDecoration);
    }
    return builder.finish();
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
        if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );
}

export function CodeSurface({
  value,
  language,
  onChange,
  readOnly,
  startLine = 1,
  highlightLine,
  className,
}: {
  value: string;
  language: CodeLanguage;
  onChange?: (next: string) => void;
  readOnly?: boolean;
  /** First line's displayed number, for an excerpt from a larger file. */
  startLine?: number;
  /** 1-based line to mark as the fault. */
  highlightLine?: number;
  className?: string;
}) {
  const extensions = useMemo(
    () => [
      LANGUAGE[language](),
      syntaxHighlighting(highlight),
      theme,
      lineNumbers({ formatNumber: (n) => String(n + startLine - 1) }),
      EditorView.lineWrapping,
      ...(readOnly ? [EditorState.readOnly.of(true)] : []),
      ...(highlightLine ? [faultLineHighlight(highlightLine)] : []),
    ],
    [language, startLine, readOnly, highlightLine]
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: !readOnly, autocompletion: false }}
      className={cn("min-h-0 flex-1 overflow-hidden text-xs", className)}
      editable={!readOnly}
    />
  );
}
