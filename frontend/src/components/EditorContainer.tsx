import Editor from '@monaco-editor/react';
import type { EditorProps } from '@monaco-editor/react';
import { useTheme } from '../context/ThemeContext';

type OnMount = NonNullable<EditorProps['onMount']>;
export type MonacoEditorInstance = Parameters<OnMount>[0];

type EditorContainerProps = {
  onMount: OnMount;
  onChange: EditorProps['onChange'];
};

export default function EditorContainer({ onMount, onChange }: EditorContainerProps) {
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light';

  return (
    <section
      className="flex min-h-0 flex-1 flex-col rounded-lg border border-outline bg-elevated p-4 shadow-soft md:p-6"
      aria-label="Code editor"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Editor</h2>
          <p className="text-xs text-muted">JavaScript · Live sync when connected</p>
        </div>
      </div>

      <div className="min-h-[320px] flex-1 overflow-hidden rounded-lg border border-outline bg-canvas shadow-inner md:min-h-[400px]">
        <Editor
          height="100%"
          theme={monacoTheme}
          defaultLanguage="javascript"
          defaultValue={
            '// Start typing to collaborate in real time.\n// Everyone in this room sees changes instantly.\n'
          }
          onMount={onMount}
          onChange={onChange}
          options={{
            minimap: { enabled: true, scale: 0.75 },
            fontSize: 14,
            fontFamily: "ui-monospace, 'Cascadia Code', 'Segoe UI Mono', Consolas, monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            smoothScrolling: true,
          }}
        />
      </div>
    </section>
  );
}
