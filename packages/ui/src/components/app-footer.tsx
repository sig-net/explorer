import { ExternalLinkButton } from '@/components/external-link-button'
import { GithubIcon } from '@/components/github-icon'

const REPOSITORY_URL = 'https://github.com/sig-net/explorer'

export function AppFooter() {
  return (
    // Half of the AppBar's h-14.
    <footer className="flex h-7 shrink-0 items-center justify-between border-t bg-secondary px-4">
      <ExternalLinkButton href={REPOSITORY_URL} label="Open on GitHub" icon={<GithubIcon />} />
      <span className="font-mono text-xs text-muted-foreground">
        {import.meta.env.VITE_EXPLORER_VERSION}
      </span>
    </footer>
  )
}
