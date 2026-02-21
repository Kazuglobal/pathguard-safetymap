"use client"
import { Slider } from '@/components/ui/slider'
import { Sun, Sunrise, Sunset, Moon } from 'lucide-react'

interface Props {
  value: number
  onChange: (v: number) => void
}

export function extractSliderValue(values: number[]): number | null {
  if (!values || values.length === 0) {
    return null
  }
  return values[0]
}

function formatHour(h: number) {
  const hh = Math.floor(h)
  const mm = Math.round((h % 1) * 60)
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}

function getIcon(h: number) {
  if (h >= 5 && h < 7)   return <Sunrise className="h-4 w-4 text-orange-300" />
  if (h >= 7 && h < 18)  return <Sun className="h-4 w-4 text-yellow-300" />
  if (h >= 18 && h < 20) return <Sunset className="h-4 w-4 text-orange-500" />
  return <Moon className="h-4 w-4 text-blue-300" />
}

export default function TimeOfDaySlider({ value, onChange }: Props) {
  return (
    <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-5 py-4 border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        {getIcon(value)}
        <span className="text-white text-sm font-semibold">{formatHour(value)}</span>
      </div>
      <Slider
        min={0}
        max={23}
        step={0.25}
        value={[value]}
        onValueChange={(values) => {
          const nextValue = extractSliderValue(values)
          if (nextValue === null) return
          onChange(nextValue)
        }}
      />
      <div className="flex justify-between mt-1.5 text-slate-500 text-xs">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:45</span>
      </div>
    </div>
  )
}
