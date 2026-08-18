import React, { useEffect, useRef } from 'react'

function ColumnsMenu({ columns, hidden, onToggle, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.columns-menu-trigger')) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [onClose])

  return (
    <div className="columns-menu" role="menu" aria-label="Toggle columns" ref={ref}>
      {columns.map((col) => (
        <label key={col.key} className="columns-menu-item">
          <input type="checkbox" checked={!hidden.has(col.key)} onChange={() => onToggle(col.key)} />
          <span>{col.label}</span>
        </label>
      ))}
    </div>
  )
}

export default ColumnsMenu
