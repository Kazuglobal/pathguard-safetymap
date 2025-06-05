import * as TabsPrimitive from "@radix-ui/react-tabs"

const Debug = ({children}: {children: React.ReactNode}) => {
  return (
    <div style={{ border: "1px solid #ccc", padding: "8px" }}>{children}</div>
  )
}

export const Tabs = ({children}:{children:React.ReactNode}) => (
  <div style={{ border: "1px solid #ccc", padding: "8px" }}>{children}</div>
)
