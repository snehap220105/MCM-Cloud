import { avatarColour, initialsOf, presenceColour } from '@/data/presence';

/**
 * A round avatar with a presence ring.
 *
 * `size` picks the prototype's two avatar classes: `av2` is the 26px chip used
 * inside table rows, `av3` the 52px circle used on directory cards.
 */
export function Avatar({ name, presence, size = 'av3', colour, title }) {
  return (
    <div
      className={size}
      title={title ?? (presence ? `${name} — ${presence}` : name)}
      style={{
        background: colour ?? avatarColour(name),
        ...(presence ? { borderColor: presenceColour(presence) } : null),
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

/** The small coloured dot used next to a presence label. */
export function PresenceDot({ presence }) {
  return (
    <span
      className="pd"
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: presenceColour(presence),
      }}
    />
  );
}
