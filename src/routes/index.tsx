import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-muted-foreground">Choose a network to begin exploring</p>
    </div>
  )
}
