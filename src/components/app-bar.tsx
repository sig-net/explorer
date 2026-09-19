import { BrandLogo } from '@/components/brand-logo'
import { ModeToggle } from '@/components/mode-toggle'
import { NetworkSwitcher } from '@/components/network-switcher'

export function AppBar() {
  return (
    <header className="border-b bg-secondary">
      <div className="flex h-14 items-center justify-between px-4">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <NetworkSwitcher />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
