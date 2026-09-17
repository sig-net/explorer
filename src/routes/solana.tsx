import { createFileRoute } from '@tanstack/react-router'
import { Construction } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const Route = createFileRoute('/solana')({
  component: SolanaPage,
})

function SolanaPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
      <Alert>
        <Construction />
        <AlertTitle>Coming soon</AlertTitle>
        <AlertDescription>The Solana explorer is not available yet.</AlertDescription>
      </Alert>
    </main>
  )
}
