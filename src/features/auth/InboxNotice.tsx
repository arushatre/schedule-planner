import { motion } from 'framer-motion'
import { MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AuthFailure } from '@/auth/errors'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Callout, fade } from './AuthParts'

const RESEND_SECONDS = 30

function useCountdown(initial: number): [number, () => void] {
  const [seconds, setSeconds] = useState(initial)
  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])
  return [seconds, () => setSeconds(RESEND_SECONDS)]
}

export function InboxNotice({ email, onResend, onBack }: { email: string; onResend: () => Promise<AuthFailure | null>; onBack: () => void }) {
  // The first link was just sent, so the cooldown starts immediately.
  const [cooldown, restart] = useCountdown(RESEND_SECONDS)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<AuthFailure | null>(null)

  const resend = async () => {
    setPending(true)
    setError(await onResend())
    setPending(false)
    restart()
  }

  return (
    <motion.div {...fade} className="flex flex-col items-center text-center" role="status">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent/20 bg-accent-soft text-accent">
        <Icon icon={MailCheck} size={22} />
      </span>
      <h2 className="font-display text-lg text-fg">Check your inbox</h2>
      <p className="mt-1.5 text-pretty text-base text-fg-muted">
        We sent a link to <span className="font-medium text-fg">{email}</span>. Open it on this device to continue.
      </p>
      {error && (
        <div className="mt-4 w-full text-left">
          <Callout tone="error">{error.message}</Callout>
        </div>
      )}
      <div className="mt-6 flex w-full flex-col gap-2">
        <Button onClick={() => void resend()} disabled={pending || cooldown > 0} className="w-full">
          {cooldown > 0 ? `Resend in ${cooldown}s` : pending ? 'Sending…' : 'Resend link'}
        </Button>
        <Button variant="ghost" onClick={onBack} className="w-full">
          Use a different email
        </Button>
      </div>
    </motion.div>
  )
}
