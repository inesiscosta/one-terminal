import { Layout, Navbar } from 'nextra-theme-docs'
import { getPageMap } from 'nextra/page-map'
import type { PageMapItem } from 'nextra'
import 'nextra-theme-docs/style.css'
import { ReactNode } from 'react'

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const pageMap = await getPageMap()

  return (
    <Layout
      navbar={<Navbar logo={<b>One-Terminal</b>} />}
      pageMap={pageMap as PageMapItem[]}
      docsRepositoryBase="https://github.com/inesiscosta/one-terminal/tree/main/website/src/content"
      feedback={{ content: null }}
      editLink={null}
      sidebar={{ defaultMenuCollapseLevel: 1, toggleButton: false }}
    >
      {children}
    </Layout>
  )
}