"use client"

import { useState, useRef, useEffect } from "react"
import { useSupabase } from "@/components/providers/supabase-provider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, User, Camera } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface ProfileEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProfileUpdated?: () => void
}

interface ProfileData {
  display_name: string
  full_name: string
  avatar_url: string | null
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function ProfileEditDialog({
  open,
  onOpenChange,
  onProfileUpdated,
}: ProfileEditDialogProps) {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    display_name: "",
    full_name: "",
    avatar_url: null,
  })
  const [originalProfile, setOriginalProfile] = useState<ProfileData>({
    display_name: "",
    full_name: "",
    avatar_url: null,
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (open) {
      loadProfile()
    }
  }, [open])

  const loadProfile = async () => {
    if (!supabase) return

    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()

      if (error) throw error

      const profileData = {
        display_name: data?.display_name || "",
        full_name: data?.full_name || "",
        avatar_url: data?.avatar_url || null,
      }

      setProfile(profileData)
      setOriginalProfile(profileData)
      setPreviewUrl(data?.avatar_url || null)
    } catch (error) {
      console.error("Failed to load profile:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const hasChanges = () => {
    return (
      profile.display_name !== originalProfile.display_name ||
      profile.full_name !== originalProfile.full_name ||
      selectedFile !== null
    )
  }

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!profile.display_name.trim()) {
      newErrors.display_name = "表示名は必須です"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) {
      setErrors({ ...errors, avatar: "画像ファイル（JPEG, PNG, GIF, WebP）を選択してください" })
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setErrors({ ...errors, avatar: "ファイルサイズは5MB以下にしてください" })
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setErrors({ ...errors, avatar: "" })
  }

  const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
    if (!supabase) return null

    const fileExt = file.name.split(".").pop()
    const fileName = `${userId}-${Date.now()}.${fileExt}`
    const filePath = fileName  // バケット名が "avatars" なのでプレフィックス不要

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file)

    if (uploadError) {
      throw uploadError
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath)

    return publicUrl
  }

  const handleSave = async () => {
    if (!validateForm()) return
    if (!supabase) return

    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      let avatarUrl = profile.avatar_url

      // Upload new avatar if selected
      if (selectedFile) {
        avatarUrl = await uploadAvatar(selectedFile, user.id)
      }

      // Upsert profile (create if not exists, update if exists)
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email: user.email ?? "",
          display_name: profile.display_name.trim(),
          full_name: profile.full_name.trim(),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      toast({
        title: "プロフィールを更新しました",
        description: "変更が保存されました。",
      })

      setOriginalProfile({
        ...profile,
        avatar_url: avatarUrl,
      })
      setSelectedFile(null)
      onProfileUpdated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save profile:", error)
      setErrors({ ...errors, submit: "保存に失敗しました。もう一度お試しください。" })
      toast({
        title: "エラー",
        description: "プロフィールの保存に失敗しました。",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setProfile(originalProfile)
    setPreviewUrl(originalProfile.avatar_url)
    setSelectedFile(null)
    setErrors({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="profile-edit-dialog"
        aria-describedby="profile-edit-description"
      >
        <DialogHeader>
          <DialogTitle>プロフィール編集</DialogTitle>
          <DialogDescription id="profile-edit-description">
            表示名やアバター画像を変更できます
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form
            data-testid="profile-edit-form"
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
            }}
          >
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4" data-testid="avatar-upload">
              <div className="relative">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="アバター"
                    className="h-24 w-24 rounded-full object-cover border-4 border-slate-200 avatar-preview"
                    data-testid="avatar-preview"
                  />
                ) : (
                  <div
                    className="h-24 w-24 rounded-full bg-slate-200 flex items-center justify-center"
                    data-testid="user-avatar"
                  >
                    <User className="h-12 w-12 text-slate-400" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 rounded-full bg-primary p-2 text-white shadow-lg hover:bg-primary/90 transition-colors"
                  aria-label="アバター画像を変更"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="avatar-file-input"
              />
              {errors.avatar && (
                <p
                  className="text-sm text-destructive"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.avatar}
                </p>
              )}
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="display_name">表示名 *</Label>
              <Input
                id="display_name"
                name="display_name"
                data-testid="display-name-input"
                value={profile.display_name}
                onChange={(e) =>
                  setProfile({ ...profile, display_name: e.target.value })
                }
                placeholder="表示名を入力"
                aria-invalid={!!errors.display_name}
                aria-describedby={errors.display_name ? "display-name-error" : undefined}
              />
              {errors.display_name && (
                <p
                  id="display-name-error"
                  className="text-sm text-destructive"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.display_name}
                </p>
              )}
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">氏名</Label>
              <Input
                id="full_name"
                name="full_name"
                data-testid="full-name-input"
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
                placeholder="氏名を入力（任意）"
              />
            </div>

            {errors.submit && (
              <p
                className="text-sm text-destructive text-center"
                role="alert"
                aria-live="polite"
              >
                {errors.submit}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                data-testid="profile-cancel-button"
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !hasChanges()}
                data-testid="profile-save-button"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
