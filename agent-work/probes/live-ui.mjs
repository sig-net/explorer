// Loads the built UI against a running backend and reports what the browser did. Needs UI_URL
// (the preview's origin and base path) and SHOT (where the screenshot is written). Prints one
// JSON object. Run from the repository root so that playwright resolves.
import { chromium } from 'playwright'

const midnight = /blockfrost|midnight\.network|:9944|:8088|graphql/i
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const requests = []
page.on('request', (request) => requests.push(request.url()))
const result = { uiRows: 0, uiExpandedRowVerified: false, uiRequestsToMidnight: 0, uiError: null }
try {
  await page.goto(`${process.env.UI_URL}midnight/explorer`)
  const rows = page.locator('button[aria-label="Expand event details"]')
  await rows.nth(49).waitFor({ timeout: 60_000 })
  result.uiRows = await rows.count()
  // The oldest loaded rows are the likeliest to be complete: expand the last one.
  await rows.nth(result.uiRows - 1).click()
  await page.getByText('valid for key', { exact: false }).first().waitFor({ timeout: 60_000 })
  result.uiExpandedRowVerified = (await page.getByText('not valid for key', { exact: false }).count()) === 0
} catch (error) {
  result.uiError = error instanceof Error ? error.message.split('\n')[0] : 'unknown'
}
await page.screenshot({ path: process.env.SHOT })
result.uiRequestsToMidnight = requests.filter((url) => midnight.test(url.split('?')[0])).length
result.uiRequestHosts = [...new Set(requests.map((url) => new URL(url).host))]
await browser.close()
console.log(JSON.stringify(result))
