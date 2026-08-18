/**
 * Local demo data for the Directory.
 *
 * The prototype's Directory screen was frozen markup, so the captured seed has
 * no external contacts, no per-person presence and no desk/location assignment.
 * `ensureDirectory()` fills those gaps in the same idempotent style the original
 * used for its lazily-built collections (`ensureCC`, `ensureTel`, `ensureArch`):
 * it only ever writes a field that is missing, so edits are never clobbered.
 */
import { db, mutate, uid } from '@/store/db';
import { PRESENCES } from '@/data/presence';

/** External contacts — suppliers and partners, as the Directory tab expects. */
const EXTERNAL_CONTACTS = [
  {
    name: 'Helena Vos',
    org: 'Northwind Insurance',
    title: 'Claims Partner Manager',
    email: 'h.vos@northwind-ins.co.uk',
    phone: '+442078880141',
    type: 'Partner',
  },
  {
    name: 'Daniel Okonkwo',
    org: 'Brightpay Ltd',
    title: 'Head of Collections',
    email: 'd.okonkwo@brightpay.co.uk',
    phone: '+442078880172',
    type: 'Supplier',
  },
  {
    name: 'Yuki Tanaka',
    org: 'Meridian Telecom',
    title: 'Carrier Account Lead',
    email: 'y.tanaka@meridiantel.com',
    phone: '+442078880233',
    type: 'Carrier',
  },
  {
    name: 'Claire Dubois',
    org: 'Atlas BPO Manila',
    title: 'Service Delivery Manager',
    email: 'c.dubois@atlasbpo.ph',
    phone: '+6328765412',
    type: 'Partner',
  },
  {
    name: 'Ibrahim Al-Fulani',
    org: 'Sentinel Compliance',
    title: 'Regulatory Adviser',
    email: 'i.alfulani@sentinelcomp.co.uk',
    phone: '+442078880390',
    type: 'Supplier',
  },
  {
    name: 'Rebecca Lyle',
    org: 'Northwind Insurance',
    title: 'Escalations Lead',
    email: 'r.lyle@northwind-ins.co.uk',
    phone: '+442078880155',
    type: 'Partner',
  },
];

/** A stable pseudo-random index derived from a string, so demo data never flickers. */
function hashIndex(text, modulo) {
  let hash = 0;
  const value = String(text || '');
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % modulo;
}

let seeded = false;

/**
 * Top up the database with the collections the Directory needs.
 *
 * Safe to call from every render — the work happens once per session.
 */
export function ensureDirectory() {
  if (seeded) return;
  seeded = true;
  mutate((database) => {
    // `locationsList` already ships with the MCM offices in the captured seed,
    // so the Directory reads it rather than inventing its own.
    if (!Array.isArray(database.locationsList)) database.locationsList = [];
    if (!Array.isArray(database.extContacts) || database.extContacts.length === 0) {
      database.extContacts = EXTERNAL_CONTACTS.map((contact) => ({ id: uid(), ...contact }));
    }
    if (!Array.isArray(database.favourites)) database.favourites = [];

    const locationNames = database.locationsList.map((location) => location.name);
    database.users.forEach((user, index) => {
      if (!user.presence) {
        // Inactive and not-yet-invited people read as Offline, as they would in
        // a real org; everyone else gets a stable spread across the states.
        user.presence =
          user.state === 'Active' ? PRESENCES[hashIndex(user.id, PRESENCES.length)].label : 'Offline';
      }
      if (!user.ext) user.ext = String(7301 + index);
      if (!user.mobile) user.mobile = `+4477009${String(10000 + index * 137).slice(-5)}`;
      if (!user.location && locationNames.length) {
        user.location = locationNames[hashIndex(user.id + 'loc', locationNames.length)];
      }
    });

    // A couple of favourites so the tab is not empty on first load.
    if (database.favourites.length === 0) {
      database.favourites = database.users.slice(2, 5).map((user) => user.id);
    }
  });
}

/** Toggle a person in or out of the signed-in user's favourites. */
export function toggleFavourite(userId) {
  mutate((database) => {
    if (!Array.isArray(database.favourites)) database.favourites = [];
    const at = database.favourites.indexOf(userId);
    if (at > -1) database.favourites.splice(at, 1);
    else database.favourites.push(userId);
  });
}

/** Is this person currently a favourite? */
export function isFavourite(userId) {
  return Array.isArray(db.favourites) && db.favourites.includes(userId);
}
