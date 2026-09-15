import { Link, useLocation, useSearch } from '@tanstack/react-router'

import { MidnightConfiguration } from '@/components/midnight/midnight-configuration'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = [
  { value: 'explorer', label: 'Explorer', to: '/midnight/explorer' },
  { value: 'contract-analyser', label: 'Contract Analyser', to: '/midnight/contract-analyser' },
] as const

type TabValue = (typeof TABS)[number]['value']

function tabFromPathname(pathname: string): TabValue | null {
  const match = TABS.find((tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`))
  return match === undefined ? null : match.value
}

export function MidnightAppBar() {
  const { pathname } = useLocation()
  const { networkId } = useSearch({ from: '/midnight' })

  return (
    <div className="border-b bg-card">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
        <Tabs value={tabFromPathname(pathname)}>
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                nativeButton={false}
                render={<Link to={tab.to} search={{ networkId }} />}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <MidnightConfiguration />
      </div>
    </div>
  )
}
