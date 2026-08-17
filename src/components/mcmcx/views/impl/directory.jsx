/**
 * Directory — the Collaborate surface from the prototype.
 *
 * The original shipped this screen as frozen markup, so the structure here is
 * taken from that snapshot: the "Collaborate" breadcrumb, the New group / New
 * chat actions, the five tabs (People, Groups, Locations, External contacts,
 * Favourites), the department / location / presence filter chips and the
 * `.dgrid` of `.pcard` person cards with their ✆ ✉ 💬 ✎ action row.
 *
 * What was static in the prototype is live here: the filters and search really
 * narrow the list, the star really toggles a favourite, and clicking a card
 * opens the profile drawer where presence can be changed.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, PresenceDot } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { ensureDirectory, isFavourite, toggleFavourite } from '@/data/directory';
import { PRESENCES } from '@/data/presence';
import { audit, divisionName, mutate, roleName, useDb } from '@/store/db';
import { useUi } from '@/store/ui';

const TABS = [
  { id: 'people', label: 'People' },
  { id: 'groups', label: 'Groups' },
  { id: 'locations', label: 'Locations' },
  { id: 'external', label: 'External contacts' },
  { id: 'favourites', label: 'Favourites' },
];

/* ------------------------------------------------------------ person card */

function PersonCard({ user, onOpen, onAction }) {
  const favourite = isFavourite(user.id);
  return (
    <div className="pcard" onClick={() => onOpen(user)}>
      <div
        title={favourite ? 'Remove from favourites' : 'Add to favourites'}
        onClick={(event) => {
          event.stopPropagation();
          toggleFavourite(user.id);
        }}
        style={{
          float: 'right',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          color: favourite ? '#e8a33d' : '#ccd4e0',
        }}
      >
        {favourite ? '★' : '☆'}
      </div>
      <Avatar name={user.name} presence={user.presence} />
      <b>{user.name}</b>
      <span>{user.title || '—'}</span>
      <span style={{ marginTop: 4 }}>
        <PresenceDot presence={user.presence} />{' '}
        <span style={{ color: '#5b6a7d' }}>{user.presence}</span>
      </span>
      <div className="acts">
        {[
          ['✆', `Calling ${user.name} on ${user.ext}`],
          ['✉', `New email to ${user.email}`],
          ['💬', `Chat started with ${user.name}`],
          ['✎', 'profile'],
        ].map(([icon, message]) => (
          <div
            key={icon}
            onClick={(event) => {
              event.stopPropagation();
              if (message === 'profile') onOpen(user);
              else onAction(message);
            }}
          >
            {icon}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- profile drawer */

function ProfileDrawer({ user, onClose }) {
  const db = useDb();
  const { toast } = useUi();
  const favourite = isFavourite(user.id);
  const groups = db.groupsList.filter((group) => group.members.includes(user.id));
  const skills = Object.keys(user.skills || {});

  function setPresence(next) {
    mutate((database) => {
      const target = database.users.find((u) => u.id === user.id);
      if (target) target.presence = next;
    });
    audit('Set presence', `${user.name} → ${next}`);
    toast(`${user.name} is now ${next}`);
  }

  function Row({ label, children }) {
    return (
      <div className="kv">
        <span>{label}</span>
        <b>{children || '—'}</b>
      </div>
    );
  }

  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div id="drw">
        <div className="dh">
          <h2>{user.name}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
            <Avatar name={user.name} presence={user.presence} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#152550' }}>{user.title}</div>
              <div style={{ fontSize: 12.5, color: '#8a94a6' }}>
                {user.dept} · {divisionName(user.division)}
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                <button
                  className="btn sec"
                  style={{ height: 28 }}
                  onClick={() => toast(`Calling ${user.name} on ${user.ext}`)}
                >
                  ✆ Call
                </button>
                <button
                  className="btn sec"
                  style={{ height: 28 }}
                  onClick={() => toast(`Chat started with ${user.name}`)}
                >
                  💬 Chat
                </button>
                <button
                  className="btn sec"
                  style={{ height: 28 }}
                  onClick={() => toggleFavourite(user.id)}
                >
                  {favourite ? '★ Favourited' : '☆ Favourite'}
                </button>
              </div>
            </div>
          </div>

          <div className="sect">Presence</div>
          <div className="fld">
            <label>Current presence</label>
            <select value={user.presence} onChange={(event) => setPresence(event.target.value)}>
              {PRESENCES.map((option) => (
                <option key={option.label}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="sect">Contact</div>
          <Row label="Email">{user.email}</Row>
          <Row label="Extension">{user.ext}</Row>
          <Row label="Mobile">{user.mobile}</Row>
          <Row label="Location">{user.location}</Row>
          <Row label="Station">{user.station}</Row>

          <div className="sect">Organisation</div>
          <Row label="Department">{user.dept}</Row>
          <Row label="Division">{divisionName(user.division)}</Row>
          <Row label="Roles">{user.roles.map(roleName).join(', ')}</Row>
          <Row label="Licence">
            <span className="tag o">{user.license}</span>
          </Row>
          <Row label="Status">{user.state}</Row>
          <Row label="Created">{user.created}</Row>

          <div className="sect">ACD skills &amp; languages</div>
          {skills.length ? (
            skills.map((skill) => (
              <div className="kv" key={skill}>
                <span>{skill}</span>
                <b>
                  <span className="tag g">Proficiency {user.skills[skill]}</span>
                </b>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12.5, color: '#8794a8', padding: '4px 0' }}>
              No ACD skills assigned
            </div>
          )}
          <Row label="Languages">{(user.langs || []).join(', ')}</Row>

          <div className="sect">Groups</div>
          {groups.length ? (
            groups.map((group) => (
              <div className="kv" key={group.id}>
                <span>{group.type}</span>
                <b>{group.name}</b>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12.5, color: '#8794a8', padding: '4px 0' }}>
              Not a member of any group
            </div>
          )}
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Close
          </button>
          <button
            className="btn"
            onClick={() => {
              onClose();
              toast(`New email to ${user.email}`);
            }}
          >
            ✉ Send email
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- the screen */

// Top up the demo data at import time rather than during render: seeding writes
// to the store, and a write while React is rendering warns about setState in
// render. The view registry imports this module eagerly at startup, so the data
// is in place well before anything asks for it.
ensureDirectory();

export default function DirectoryView() {
  const db = useDb();
  const { toast } = useUi();
  const [params, setParams] = useSearchParams();

  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'people';
  const query = params.get('q') ?? '';
  const dept = params.get('dept') ?? '';
  const location = params.get('loc') ?? '';
  const presence = params.get('presence') ?? '';
  const selectedId = params.get('person');
  const selected = selectedId ? db.users.find((u) => u.id === selectedId) : undefined;

  /** Patch one search param, dropping it when cleared. */
  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const departments = useMemo(
    () => [...new Set(db.users.map((u) => u.dept).filter(Boolean))].sort(),
    [db.users]
  );
  const locations = useMemo(
    () => [...new Set(db.users.map((u) => u.location).filter(Boolean))].sort(),
    [db.users]
  );

  const term = query.trim().toLowerCase();

  const people = db.users.filter((user) => {
    if (dept && user.dept !== dept) return false;
    if (location && user.location !== location) return false;
    if (presence && user.presence !== presence) return false;
    if (!term) return true;
    const haystack = [
      user.name,
      user.email,
      user.title,
      user.dept,
      user.location,
      ...(user.langs || []),
      ...Object.keys(user.skills || {}),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });

  const favourites = people.filter((user) => isFavourite(user.id));

  const groups = db.groupsList.filter((group) =>
    term ? group.name.toLowerCase().includes(term) : true
  );
  const locationRows = db.locationsList.filter((row) =>
    term ? (row.name + ' ' + row.addr).toLowerCase().includes(term) : true
  );
  const externals = (db.extContacts || []).filter((contact) =>
    term
      ? (contact.name + ' ' + contact.org + ' ' + contact.title + ' ' + contact.email)
          .toLowerCase()
          .includes(term)
      : true
  );

  const showPeopleFilters = tab === 'people' || tab === 'favourites';
  const cards = tab === 'favourites' ? favourites : people;

  function openPerson(user) {
    setParam('person', user.id);
  }

  return (
    <>
      <PageHeader
        breadcrumb="Collaborate"
        title="Directory"
        actions={
          <>
            <button className="btn sec" onClick={() => toast('New group — opens in Admin › Groups')}>
              New group
            </button>
            <button className="btn" onClick={() => toast('New chat started')}>
              New chat
            </button>
          </>
        }
        tabs={TABS.map((t) => ({
          id: t.id,
          label:
            t.id === 'favourites' ? `${t.label} (${(db.favourites || []).length})` : t.label,
        }))}
        activeTab={tab}
        onTabChange={(next) => setParam('tab', next === 'people' ? '' : next)}
      />

      <div className="pbody">
        <div className="tbar">
          <input
            className="s"
            placeholder="Search people, skills, departments"
            value={query}
            onChange={(event) => setParam('q', event.target.value)}
          />
          {showPeopleFilters ? (
            <>
              <select
                className="chip"
                style={{ cursor: 'pointer' }}
                value={dept}
                onChange={(event) => setParam('dept', event.target.value)}
              >
                <option value="">Department: All</option>
                {departments.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <select
                className="chip"
                style={{ cursor: 'pointer' }}
                value={location}
                onChange={(event) => setParam('loc', event.target.value)}
              >
                <option value="">Location: All</option>
                {locations.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <select
                className="chip"
                style={{ cursor: 'pointer' }}
                value={presence}
                onChange={(event) => setParam('presence', event.target.value)}
              >
                <option value="">Presence: Any</option>
                {PRESENCES.map((option) => (
                  <option key={option.label}>{option.label}</option>
                ))}
              </select>
            </>
          ) : null}
          <div className="sp" />
          <div
            className="chip"
            onClick={() => setParams(new URLSearchParams(tab === 'people' ? {} : { tab }))}
          >
            ✕ Clear filters
          </div>
        </div>

        {showPeopleFilters ? (
          cards.length ? (
            <div className="dgrid">
              {cards.map((user) => (
                <PersonCard key={user.id} user={user} onOpen={openPerson} onAction={toast} />
              ))}
            </div>
          ) : (
            <div className="tblw" style={{ padding: 26, textAlign: 'center', color: '#8794a8' }}>
              {tab === 'favourites'
                ? 'No favourites yet — star someone on the People tab.'
                : 'No people match the current filters'}
            </div>
          )
        ) : null}

        {tab === 'groups' ? (
          <div className="tblw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Type</th>
                  <th>Members</th>
                  <th>Group number</th>
                  <th>Ring style</th>
                  <th>Voicemail</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} onClick={() => toast(`${group.name} — ${group.members.length} members`)}>
                    <td>
                      <b className="lnk">{group.name}</b>
                    </td>
                    <td>
                      <span className={'tag' + (group.type === 'Social' ? ' o' : '')}>
                        {group.type}
                      </span>
                    </td>
                    <td>
                      {group.members.slice(0, 4).map((memberId) => {
                        const member = db.users.find((u) => u.id === memberId);
                        return member ? (
                          <Avatar
                            key={memberId}
                            name={member.name}
                            presence={member.presence}
                            size="av2"
                          />
                        ) : null;
                      })}
                      {group.members.length > 4 ? `+${group.members.length - 4}` : null}
                      {group.members.length === 0 ? '—' : null}
                    </td>
                    <td>{group.ext || '—'}</td>
                    <td>{group.ring || '—'}</td>
                    <td>{group.vm ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'locations' ? (
          <div className="tblw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Address</th>
                  <th>Emergency number</th>
                  <th>People</th>
                  <th>Address status</th>
                </tr>
              </thead>
              <tbody>
                {locationRows.map((row) => {
                  const headcount = db.users.filter((u) => u.location === row.name).length;
                  return (
                    <tr key={row.id} onClick={() => setParam('loc', row.name)}>
                      <td>
                        <b className="lnk">{row.name}</b>
                      </td>
                      <td>{row.addr}</td>
                      <td>{row.emerg || '—'}</td>
                      <td>{headcount}</td>
                      <td>
                        {row.verified ? (
                          <span className="st ok">
                            <span className="d" />
                            Verified
                          </span>
                        ) : (
                          <span className="st wn">
                            <span className="d" />
                            Not verified
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'external' ? (
          <div className="tblw">
            <table className="dt">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Organisation</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {externals.map((contact) => (
                  <tr key={contact.id} onClick={() => toast(`Calling ${contact.name}`)}>
                    <td>
                      <Avatar name={contact.name} size="av2" />
                      <b className="lnk">{contact.name}</b>
                      <br />
                      <span style={{ color: '#8794a8', fontSize: 11 }}>{contact.title}</span>
                    </td>
                    <td>{contact.org}</td>
                    <td>
                      <span className="tag">{contact.type}</span>
                    </td>
                    <td>{contact.email}</td>
                    <td>{contact.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selected ? (
        <ProfileDrawer user={selected} onClose={() => setParam('person', '')} />
      ) : null}
    </>
  );
}
