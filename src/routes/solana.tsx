import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/solana')({
  component: SolanaPage,
})

function SolanaPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
      <div className="flex flex-1 items-center justify-center">
        <h1 className="text-2xl font-semibold">Solana</h1>
      </div>
    </main>
  )
}
