"use client"

import React, { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, ExternalLink } from "lucide-react"
import { validateMapboxTokenAsync } from "@/lib/mapbox-config"

interface MapboxErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface TokenValidationResult {
  isValid: boolean
  error?: string
  isLoading: boolean
}

export default function MapboxErrorBoundary({ children, fallback }: MapboxErrorBoundaryProps) {
  const [tokenStatus, setTokenStatus] = useState<TokenValidationResult>({
    isValid: true,
    isLoading: false
  })
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const validateToken = async () => {
    setTokenStatus(prev => ({ ...prev, isLoading: true }))
    
    try {
      const result = await validateMapboxTokenAsync()
      setTokenStatus({
        isValid: result.isValid,
        error: result.error,
        isLoading: false
      })
    } catch (error) {
      setTokenStatus({
        isValid: false,
        error: `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isLoading: false
      })
    }
  }

  const fetchDebugInfo = async () => {
    try {
      const response = await fetch('/api/debug/mapbox')
      const data = await response.json()
      setDebugInfo(data)
    } catch (error) {
      setDebugInfo({ error: 'Failed to fetch debug info' })
    }
  }

  useEffect(() => {
    validateToken()
  }, [])

  // If token is valid, render children normally
  if (tokenStatus.isValid && !tokenStatus.isLoading) {
    return <>{children}</>
  }

  // If loading, show loading state
  if (tokenStatus.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Mapboxトークンを検証中...</span>
      </div>
    )
  }

  // If token is invalid, show error UI
  return (
    <div className="p-4 space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Mapboxエラー</AlertTitle>
        <AlertDescription>
          {tokenStatus.error || 'Mapboxアクセストークンの問題が発生しました。'}
        </AlertDescription>
      </Alert>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button 
          onClick={validateToken}
          disabled={tokenStatus.isLoading}
          variant="outline"
          className="flex-1"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          再試行
        </Button>
        
        <Button 
          onClick={() => {
            setShowDebugInfo(!showDebugInfo)
            if (!showDebugInfo && !debugInfo) {
              fetchDebugInfo()
            }
          }}
          variant="outline"
          className="flex-1"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          デバッグ情報
        </Button>
        
        <Button 
          onClick={() => window.open('https://docs.mapbox.com/help/troubleshooting/access-token-troubleshooting/', '_blank')}
          variant="outline"
          className="flex-1"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          ヘルプ
        </Button>
      </div>

      {showDebugInfo && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>デバッグ情報</AlertTitle>
          <AlertDescription>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
              {debugInfo ? JSON.stringify(debugInfo, null, 2) : 'Loading...'}
            </pre>
          </AlertDescription>
        </Alert>
      )}

      {fallback && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          {fallback}
        </div>
      )}
    </div>
  )
}