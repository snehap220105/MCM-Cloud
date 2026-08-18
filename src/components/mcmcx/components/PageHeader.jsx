/** The standard page chrome: breadcrumb, title, actions and tab strip. */
export function PageHeader({ breadcrumb, title, actions, tabs, activeTab, onTabChange }) {
  return (
    <div className="phd">
      {breadcrumb ? <div className="bc">{breadcrumb}</div> : null}
      <div className="tt">
        <h1>{title}</h1>
        {actions ? <div className="rt">{actions}</div> : null}
      </div>
      {tabs && tabs.length > 0 ? (
        <div className="tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={'tb' + (tab.id === activeTab ? ' on' : '')}
              onClick={() => onTabChange?.(tab.id)}
            >
              {tab.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
