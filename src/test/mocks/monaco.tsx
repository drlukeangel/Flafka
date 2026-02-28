import React from 'react'

interface EditorProps {
  value?: string
  onChange?: (value: string) => void
  language?: string
  theme?: string
  options?: Record<string, unknown>
  height?: string | number
  width?: string | number
}

/**
 * Mock Monaco Editor for testing.
 * Renders a textarea instead of the actual Monaco Editor
 * since Monaco cannot render in jsdom environment.
 */
const MockEditor: React.FC<EditorProps> = ({ value = '', onChange, ...props }) => {
  return (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        width: typeof props.width === 'number' ? `${props.width}px` : props.width || '100%',
        height: typeof props.height === 'number' ? `${props.height}px` : props.height || '200px',
        fontFamily: 'monospace',
      }}
    />
  )
}

export const loader = {
  init: () => Promise.resolve(),
}

export const DiffEditor = MockEditor

export default MockEditor
