import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/midnight/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/midnight/explorer', search, replace: true })
  },
})
