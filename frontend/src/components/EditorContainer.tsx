import Editor from '@monaco-editor/react';
import type { EditorProps } from '@monaco-editor/react';
import { useTheme } from '../context/ThemeContext';

type OnMount = NonNullable<EditorProps['onMount']>;
export type MonacoEditorInstance = Parameters<OnMount>[0];

type EditorContainerProps = {
  onMount: OnMount;
  onChange: EditorProps['onChange'];
  value: string;
};

export default function EditorContainer({ onMount, onChange, value }: EditorContainerProps) {
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light';

  return (
    <section
      className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-outline bg-elevated p-4 shadow-soft md:p-6"
      aria-label="Code editor"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Editor</h2>
          <p className="text-xs text-muted">JavaScript · Live sync when connected</p>
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-hidden rounded-lg border border-outline bg-canvas shadow-inner">
        <Editor
          height="100%"
          width="100%"
          theme={monacoTheme}
          defaultLanguage="javascript"
          value={value}
          onMount={onMount}
          onChange={onChange}
          options={{
            readOnly: false,
            renderLineHighlight: 'all',
            colorDecorators: true,
            cursorBlinking: 'smooth',
            minimap: { enabled: true, scale: 0.75 },
            fontSize: 14,
            fontFamily: "ui-monospace, 'Cascadia Code', 'Segoe UI Mono', Consolas, monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            smoothScrolling: true,
            tabSize: 2,
          }}
        />
      </div>
    </section>
  );
}
