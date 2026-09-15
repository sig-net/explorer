import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">About</h1>
      <p className="text-slate-400">Routes live in src/routes and are matched by file name.</p>
    </section>
  )
}
