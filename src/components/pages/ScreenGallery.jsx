import React, { useMemo, useState } from 'react'
import navigationData from '../navigationData.js'
import { buildThumbSvg } from '../../utils/thumb.js'
import help from '../../data/galleryHelp.json'
import pages from '../../data/galleryPages.json'
import legacyHelp from '../../data/help.json'

const WORKSPACE_EXTRA = [
  ['performance', 'Performance / Supervisor', 'performance'],
  ['activity', 'Activity / Agent Workspace', 'activity'],
  ['directory', 'Directory', 'directory'],
  ['apps', 'Apps', 'apps']
]

function searchBlobFor(label, group, h) {
  return (label + ' ' + group + ' ' + (h.kws || []).join(' ') + ' ' + (h.topics || []).join(' '))
    .toLowerCase()
    .replace(/"/g, '')
}

function GalleryThumb({ id }) {
  const svg = useMemo(() => buildThumbSvg(id, pages), [id])
  return <div dangerouslySetInnerHTML={{ __html: svg }} />
}

function GalleryCard({ id, label, group, help: h, onOpen }) {
  const kws = (h.kws || []).slice(0, 3)
  return (
    <div className="galc" onClick={onOpen}>
      <GalleryThumb id={id} />
      <div className="gm">
        <div className="gt">{label}</div>
        <div className="gg">{group}</div>
        <div className="gk">
          {kws.map((k) => <span className="kw" key={k}>{k}</span>)}
        </div>
      </div>
    </div>
  )
}

function ScreenGallery({ onNavigate, onOpenView }) {
  const [query, setQuery] = useState('')
  const q = query.toLowerCase()

  const sections = useMemo(() => {
    const built = navigationData.map((section) => ({
      group: section.heading,
      cards: section.items.map((item) => {
        const h = help[item.id] || { kws: [] }
        const label = item.starred ? `★ ${item.label}` : item.label
        return { id: item.id, label, help: h, searchBlob: searchBlobFor(label, section.heading, h) }
      })
    }))
    built.push({
      group: 'Agent & Supervisor Workspaces',
      cards: WORKSPACE_EXTRA.map(([id, label, view]) => {
        const h = legacyHelp[id] || { kws: [] }
        return {
          id,
          label,
          help: h,
          searchBlob: (label + ' workspace ' + (h.kws || []).join(' ')).toLowerCase().replace(/"/g, ''),
          view
        }
      })
    })
    return built
  }, [])

  function handleOpen(card) {
    if (card.view) onOpenView(card.view)
    else onNavigate(card.id)
  }

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Admin</span>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span>UI Map</span>
      </nav>

      <h1 className="page-title">Screen Gallery — every MCM Cloud CX screen</h1>
      <p className="gallery-subtitle">
        A visual index of every page in the product. Each thumbnail is a wireframe of that screen — click to open the live page.
      </p>

      <input
        type="text"
        className="toolbar-search gallery-search"
        placeholder="Search screens, keywords, functionality..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search screens"
      />

      {sections.map((sec) => {
        const visible = sec.cards.filter((c) => c.searchBlob.indexOf(q) > -1)
        if (!visible.length) return null
        return (
          <div key={sec.group}>
            <div className="galsec">{sec.group}</div>
            <div className="galgrid">
              {visible.map((c) => (
                <GalleryCard
                  key={c.id}
                  id={c.id}
                  label={c.label}
                  group={sec.group}
                  help={c.help}
                  onOpen={() => handleOpen(c)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ScreenGallery
