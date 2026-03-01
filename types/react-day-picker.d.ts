// Type shim for react-day-picker@9 — dist/esm/index.d.ts is absent in the published build.
// Provides minimal ambient declarations to unblock TypeScript type checking.
declare module 'react-day-picker' {
  import type * as React from 'react'

  export interface DayPickerProps extends React.HTMLAttributes<HTMLElement> {
    showOutsideDays?: boolean
    classNames?: Record<string, string>
    components?: Record<string, React.ComponentType<Record<string, unknown>>>
    [key: string]: unknown
  }

  export const DayPicker: React.ComponentType<DayPickerProps>
}
