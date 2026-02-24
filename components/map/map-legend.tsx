"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp, Car, Shield, AlertTriangle, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface MapLegendProps {
  className?: string
}

export default function MapLegend({ className }: MapLegendProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const cardClassName = cn(
    "absolute bottom-2 left-2 z-10 bg-white/95 backdrop-blur-sm shadow-lg border-0",
    "transition-all duration-300 ease-in-out",
    "max-w-[calc(100vw-1rem)] sm:max-w-none",
    isExpanded ? "w-64" : "w-32",
    className
  )

  return (
    <Card className={cardClassName}>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold text-gray-800">Map Legend</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(!isVisible)}
              className="h-5 w-5 p-0"
              aria-label={isVisible ? "Hide legend" : "Show legend"}
            >
              {isVisible ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </Button>
            {isVisible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-5 w-5 p-0"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse details" : "Expand details"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isVisible && isExpanded && (
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-1">Traffic Density</h4>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow-sm"></div>
                  <span>Light</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white shadow-sm"></div>
                  <span>Moderate</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-orange-500 border border-white shadow-sm"></div>
                  <span>Heavy</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm"></div>
                  <span>Severe</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-1">Incident Type</h4>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1 text-xs">
                  <Car className="h-3 w-3 text-blue-600" />
                  <span>Vehicle</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Shield className="h-3 w-3 text-red-600" />
                  <span>Emergency</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                  <span>Warning</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <HelpCircle className="h-3 w-3 text-gray-600" />
                  <span>Information</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
