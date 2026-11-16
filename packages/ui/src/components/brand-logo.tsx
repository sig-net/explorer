import { publicAssetUrl } from '@/lib/public-asset-url'

export function BrandLogo() {
  return (
    <a href="https://sig.network" className="flex items-center">
      <img
        src={publicAssetUrl('icons/signetwork-logo-black.svg')}
        alt="sig.network"
        className="h-5 dark:hidden"
      />
      <img
        src={publicAssetUrl('icons/signetwork-logo-white.svg')}
        alt="sig.network"
        className="hidden h-5 dark:block"
      />
    </a>
  )
}
