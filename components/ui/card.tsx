import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const cardVariants = cva(
  "rounded-2xl border bg-card text-card-foreground shadow-sm transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        default: "hover:shadow-lg",
        elevated: "shadow-lg hover:shadow-xl",
        interactive: "hover:shadow-lg hover:-translate-y-1 cursor-pointer",
        gradient: "bg-gradient-to-br from-white to-gray-50 hover:shadow-lg",
        success: "bg-green-50 border-green-200 text-green-900",
        warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
        error: "bg-red-50 border-red-200 text-red-900",
        info: "bg-blue-50 border-blue-200 text-blue-900",
      },
      size: {
        default: "p-6",
        sm: "p-4",
        lg: "p-8",
        xl: "p-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>(({ className, variant, size, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardVariants({ variant, size }), className)}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-xl font-bold leading-tight tracking-tight", className)}
    {...props}
  >
    {children}
  </h3>
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn("pt-0", className)} 
    {...props} 
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-6", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// 新しい拡張コンポーネント
const CardIcon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    icon: React.ReactNode
    color?: "primary" | "success" | "warning" | "error" | "info"
  }
>(({ className, icon, color = "primary", ...props }, ref) => {
  const colorClasses = {
    primary: "bg-gradient-to-br from-blue-500 to-sky-600 text-white",
    success: "bg-gradient-to-br from-green-500 to-emerald-600 text-white", 
    warning: "bg-gradient-to-br from-yellow-500 to-orange-600 text-white",
    error: "bg-gradient-to-br from-red-500 to-rose-600 text-white",
    info: "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
        colorClasses[color],
        className
      )}
      {...props}
    >
      {icon}
    </div>
  )
})
CardIcon.displayName = "CardIcon"

const CardBadge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    variant?: "default" | "success" | "warning" | "error" | "info"
  }
>(({ className, variant = "default", children, ...props }, ref) => {
  const badgeClasses = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800", 
    error: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
  }
  
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        badgeClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
})
CardBadge.displayName = "CardBadge"

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  CardIcon,
  CardBadge,
  cardVariants
}
