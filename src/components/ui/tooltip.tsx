"use client"

import { useState, cloneElement } from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  content: string
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
  side?: "top" | "bottom"
  className?: string
}

/**
 * Lightweight tooltip that works on hover AND keyboard focus (accessibility).
 * Does not use Radix — no extra dependency needed.
 * Touch devices: tap triggers focus which shows the tooltip briefly; this is
 * acceptable and doesn't break interaction.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  const wrapped = cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      setVisible(true)
      children.props.onMouseEnter?.(e)
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      setVisible(false)
      children.props.onMouseLeave?.(e)
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      setVisible(true)
      children.props.onFocus?.(e)
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      setVisible(false)
      children.props.onBlur?.(e)
    },
  })

  return (
    <span className="relative inline-flex">
      {wrapped}
      {visible && content && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-md",
            "bg-foreground text-background px-2 py-1 text-xs shadow-sm",
            "left-1/2 -translate-x-1/2",
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
