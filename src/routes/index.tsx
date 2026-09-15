import { createFileRoute } from '@tanstack/react-router'

import { Counter } from '../components/Counter'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome</h1>
      <p className="text-slate-400">
        A React single-page application built with Vite, TanStack Router and Tailwind CSS.
      </p>
      <Counter />
    </section>
  )
}
