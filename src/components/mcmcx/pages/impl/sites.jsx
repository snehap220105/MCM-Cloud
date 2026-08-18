/**
 * Telephony › Sites.
 *
 * A site is the media anchor for a location: it owns a time zone, a media model
 * (Cloud or Premises), an edge group, and — nested inside it — the number plans
 * and outbound routes that decide how dialed digits leave the platform.
 *
 * Ported from the prototype's `renderSites` / `editSite` / `saveSite` /
 * `delSite`. The Number Plans and Outbound Routes shortcuts set the shared
 * TELSITE selection before navigating, exactly as the original did.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { getTelSite, groupName, plansOf, routesOf, setTelSite, siteById } from './_telephony';
import { ErrorBox } from './_telephonyUi';
const TIME_ZONES = [
  'Europe/London',
  'Europe/Dublin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'America/New_York',
  'UTC',
];
const MEDIA_MODELS = ['Cloud', 'Premises'];

/** The standard number plans every new site is created with. */
function defaultPlans() {
  return [
    {
      id: uid(),
      name: 'Emergency',
      match: 'Number List',
      spec: {
        list: '999,112',
      },
      cls: 'Emergency',
      norm: '',
    },
    {
      id: uid(),
      name: 'Extension',
      match: 'Digit Length',
      spec: {
        min: 4,
        max: 4,
      },
      cls: 'Extension',
      norm: '',
    },
    {
      id: uid(),
      name: 'National',
      match: 'Regex',
      spec: {
        pattern: '^0(\\d{9,10})$',
      },
      cls: 'National',
      norm: '+44$1',
    },
    {
      id: uid(),
      name: 'International 00',
      match: 'Regex',
      spec: {
        pattern: '^00(\\d{8,14})$',
      },
      cls: 'International',
      norm: '+$1',
    },
    {
      id: uid(),
      name: 'E.164 Passthrough',
      match: 'Regex',
      spec: {
        pattern: '^\\+(\\d{8,14})$',
      },
      cls: 'International',
      norm: '+$1',
    },
  ];
}

/* -------------------------------------------------------------- site drawer */

function SiteDrawer({ siteId, onClose }) {
  const db = useDb();
  const navigate = useNavigate();
  const { toast, confirmBox } = useUi();
  const existing = siteId ? siteById(db, siteId) : undefined;
  const isNew = !existing;
  const base = existing ?? {
    id: '',
    name: '',
    location: '',
    tz: 'Europe/London',
    media: 'Cloud',
    def: false,
    group: db.edgeGroups[0]?.id ?? '',
    plans: [],
    routes: [],
  };
  const [name, setName] = useState(base.name);
  const [location, setLocation] = useState(base.location);
  const [tz, setTz] = useState(base.tz);
  const [media, setMedia] = useState(base.media);
  const [group, setGroup] = useState(base.group);
  const [def, setDef] = useState(base.def);
  const [errors, setErrors] = useState([]);
  function save() {
    const trimmed = name.trim();
    const errs = [];
    if (trimmed.length < 2) errs.push('Site name is required.');
    if (db.sites.some((x) => x.name.toLowerCase() === trimmed.toLowerCase() && x.id !== siteId))
      errs.push('A site with this name already exists.');
    if (errs.length) {
      setErrors(errs);
      return;
    }
    let savedMedia = base.media;
    mutate((database) => {
      let site = siteId ? database.sites.find((x) => x.id === siteId) : undefined;
      if (!site) {
        site = {
          id: uid(),
          name: '',
          location: '',
          tz: 'Europe/London',
          media: 'Cloud',
          def: false,
          group: '',
          plans: defaultPlans(),
          routes: [
            {
              id: uid(),
              name: 'Default Route',
              cls: ['Emergency', 'National', 'International'],
              trunks: [],
              dist: 'Sequential',
              on: true,
            },
          ],
        };
        database.sites.push(site);
      }
      site.name = trimmed;
      site.location = location.trim();
      site.tz = tz;
      if (isNew) site.media = media;
      site.group = group;
      if (def) {
        database.sites.forEach((x) => {
          x.def = false;
        });
        site.def = true;
      }
      savedMedia = site.media;
    });
    audit(isNew ? 'Create site' : 'Edit site', `${trimmed} (${savedMedia})`);
    onClose();
    toast((isNew ? 'Site created — ' : 'Site saved — ') + trimmed);
  }
  function remove() {
    if (!existing) return;
    if (existing.def) {
      toast('The default site cannot be deleted — make another site default first');
      return;
    }
    confirmBox(
      `Delete site ${existing.name}? Its number plans and outbound routes are removed with it.`,
      () => {
        mutate((database) => {
          database.sites = database.sites.filter((x) => x.id !== existing.id);
        });
        if (getTelSite() === existing.id && db.sites[0]) setTelSite(db.sites[0].id);
        audit('Delete site', existing.name);
        toast('Site deleted');
      }
    );
    onClose();
  }

  /** Jump to a sub-page for this site, carrying the TELSITE selection with us. */
  function openFor(pageId) {
    if (existing) setTelSite(existing.id);
    onClose();
    navigate(`/admin/${pageId}`);
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{isNew ? 'Create Site' : `Edit — ${base.name}`}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <ErrorBox messages={errors} />

          <div className="sect">Site</div>

          <div className="fld">
            <label>Site name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="fld">
            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="fld">
            <label>Time zone</label>
            <select value={tz} onChange={(e) => setTz(e.target.value)}>
              {TIME_ZONES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Media model {isNew ? '' : '(cannot be changed after creation)'}</label>
            <select value={media} disabled={!isNew} onChange={(e) => setMedia(e.target.value)}>
              {MEDIA_MODELS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Edge group</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {db.edgeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="tgl">
            <input
              type="checkbox"
              checked={def}
              onChange={(e) => setDef(e.target.checked)}
              style={{
                width: 'auto',
                marginRight: 4,
              }}
            />
            Default site for the organisation
          </div>

          {isNew ? (
            <div
              style={{
                fontSize: 11.5,
                color: '#8794a8',
                marginTop: 8,
              }}
            >
              New sites are created with the standard default number plans; customise them under
              Telephony › Number Plans.
            </div>
          ) : (
            <>
              <div className="sect">Shortcuts</div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                }}
              >
                <button className="btn sec" onClick={() => openFor('numplan')}>
                  Number plans ({plansOf(base).length})
                </button>
                <button className="btn sec" onClick={() => openFor('outroute')}>
                  Outbound routes ({routesOf(base).length})
                </button>
              </div>
              <div
                style={{
                  marginTop: 12,
                }}
              >
                <button className="btn gh" onClick={remove}>
                  Delete site
                </button>
              </div>
            </>
          )}
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            {isNew ? 'Create site' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- the page */

export default function SitesPage() {
  const db = useDb();
  const navigate = useNavigate();
  /** `null` = closed, `''` = create, otherwise the site id being edited. */
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Telephony
          </>
        }
        title="Sites"
        actions={
          <>
            <button className="btn" onClick={() => setEditing('')}>
              + Create Site
            </button>
            <button className="btn sec" onClick={() => navigate('/admin/numplan')}>
              Number Plans
            </button>
            <button className="btn sec" onClick={() => navigate('/admin/outroute')}>
              Outbound Routes
            </button>
          </>
        }
        tabs={[
          {
            id: 'all',
            label: `All Sites (${db.sites.length})`,
          },
        ]}
        activeTab="all"
      />

      <div className="pbody">
        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th>Site</th>
                <th>Time zone</th>
                <th>Media model</th>
                <th>Edge group</th>
                <th>Number plans</th>
                <th>Outbound routes</th>
                <th
                  style={{
                    width: 40,
                  }}
                ></th>
              </tr>
            </thead>
            <tbody>
              {db.sites.map((site) => (
                <tr key={site.id} onClick={() => setEditing(site.id)}>
                  <td>
                    <b className="lnk">{site.name}</b>
                    {site.def ? (
                      <>
                        {' '}
                        <span className="tag">Default</span>
                      </>
                    ) : null}
                    <br />
                    <span
                      style={{
                        color: '#8794a8',
                        fontSize: 11,
                      }}
                    >
                      {site.location}
                    </span>
                  </td>
                  <td>{site.tz}</td>
                  <td>{site.media}</td>
                  <td>{groupName(db, site.group)}</td>
                  <td>{plansOf(site).length}</td>
                  <td>{routesOf(site).length}</td>
                  <td
                    style={{
                      color: '#a9b3c2',
                    }}
                  >
                    ⋮
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null ? (
        <SiteDrawer siteId={editing || null} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
