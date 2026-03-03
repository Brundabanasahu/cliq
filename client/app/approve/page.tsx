"use client"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Smartphone } from "lucide-react"
import { toast } from "sonner"

const DeviceApprovalpage = () => {
  const { data, isPending } = authClient.useSession()

  const router = useRouter()
  const searchParams = useSearchParams()
  const userCode = searchParams.get("user_code")

  const [isProcessing, setIsProcessing] = useState({
    approve: false,
    deny: false
  })

  // ✅ Redirect inside useEffect
  useEffect(() => {
    if (!isPending && (!data?.session || !data?.user)) {
      router.push("/sign-in")
    }
  }, [data, isPending, router])

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  if (!data?.session || !data?.user) return null

  const handleApprove = async () => {
    setIsProcessing({ approve: true, deny: false })

    try {
      toast.loading("Approving device...", { id: "loading" })

      await authClient.device.approve({
        userCode: userCode!
      })

      toast.dismiss("loading")
      toast.success("Device approved successfully")
      router.push("/")
    } catch (error) {
      toast.dismiss("loading")
      toast.error("Failed to approve device")
    } finally {
      setIsProcessing({ approve: false, deny: false })
    }
  }

  const handleDeny = async () => {
    setIsProcessing({ approve: false, deny: true })

    try {
      toast.loading("Denying device...", { id: "deny" })

      await authClient.device.deny({
        userCode: userCode!
      })

      toast.dismiss("deny")
      toast.success("Device denied successfully")
      router.push("/")
    } catch (error) {
      toast.dismiss("deny")
      toast.error("Failed to deny device")
    } finally {
      setIsProcessing({ approve: false, deny: false })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <div className="w-full max-w-md px-4">
        <div className="space-y-8">
          {/* UI unchanged below */}
          ...
        </div>
      </div>
    </div>
  )
}

export default DeviceApprovalpage