import { createFileRoute } from '@tanstack/react-router'
import { Construction } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const Route = createFileRoute('/solana')({
  component: SolanaPage,
})

function SolanaPage() {
  return (
    <main className="flex w-full flex-1 flex-col p-4">
      <Alert>
        <Construction />
        <AlertTitle>Coming soon</AlertTitle>
        <AlertDescription>The Solana explorer is not available yet.</AlertDescription>
      </Alert>
    </main>
  )
}
