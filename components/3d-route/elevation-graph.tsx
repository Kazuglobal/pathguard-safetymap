"use client"

import { useMemo } from 'react'
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

export interface RouteCoordinate {
    lon: number;
    lat: number;
}

interface ElevationGraphProps {
    routeCoordinates: RouteCoordinate[];
}

// 簡易的な高低差データの生成（デモ用）
// 実際の利用では、routeCoordinates の各点に対する標高APIの返り値などを想定
function generateMockElevationData(coords: RouteCoordinate[]) {
    if (!coords || coords.length === 0) return []

    const data = []
    let currentElevation = 38 // 渋谷周辺の初期標高（仮）
    let totalDistance = 0

    for (let i = 0; i < coords.length; i++) {
        // 距離の擬似計算 (1度あたり約111kmとして超ざっくり計算)
        if (i > 0) {
            const prev = coords[i - 1]
            const curr = coords[i]
            const dx = (curr.lon - prev.lon) * 111000 * Math.cos(curr.lat * Math.PI / 180)
            const dy = (curr.lat - prev.lat) * 111000
            const dist = Math.sqrt(dx * dx + dy * dy)
            totalDistance += dist
        }

        // 標高の変動を適当に作成 (±1m〜2mの変動)
        if (i > 0) {
            currentElevation += (Math.random() - 0.3) * 3; // 少し登り傾向
        }

        data.push({
            distance: Math.round(totalDistance), // m
            elevation: Number(currentElevation.toFixed(1)),
            pointIndex: i,
        })
    }

    return data
}

export default function ElevationGraph({ routeCoordinates }: ElevationGraphProps) {
    const data = useMemo(() => generateMockElevationData(routeCoordinates), [routeCoordinates])

    if (data.length === 0) {
        return null;
    }

    // Y軸の表示範囲を調整
    const minElevation = Math.floor(Math.min(...data.map(d => d.elevation)) - 2)
    const maxElevation = Math.ceil(Math.max(...data.map(d => d.elevation)) + 2)

    return (
        <div className="w-full h-32 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-3 pt-4 custom-scrollbar">
            <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-white font-bold flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    標高・勾配プロファイル
                </span>
                <span className="text-[10px] text-slate-400">総距離: {data[data.length - 1]?.distance}m</span>
            </div>
            <div className="w-full h-20 text-[10px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                        <XAxis
                            dataKey="distance"
                            tick={{ fill: '#94a3b8', fontSize: 9 }}
                            tickFormatter={(val) => `${val}m`}
                            axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                            tickLine={false}
                            minTickGap={20}
                        />
                        <YAxis
                            domain={[minElevation, maxElevation]}
                            tick={{ fill: '#94a3b8', fontSize: 9 }}
                            tickFormatter={(val) => `${val}m`}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                            formatter={(value, name) => {
                                const displayValue = Array.isArray(value) ? value[0] : value
                                return [`${displayValue ?? 0}m`, name ?? '標高']
                            }}
                            labelFormatter={(label) => `距離: ${label}m`}
                        />
                        <Area
                            type="monotone"
                            dataKey="elevation"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorElevation)"
                            isAnimationActive={true}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
