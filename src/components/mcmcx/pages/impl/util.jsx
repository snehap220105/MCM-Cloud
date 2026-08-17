/**
 * Contact Center › Utilization — the organization-wide capacity defaults.
 *
 * For every media type: how many interactions an agent may handle at once, and
 * which other media types are allowed to interrupt it. This is what makes
 * omnichannel blending work (a voice call interrupting two open chats, etc.).
 *
 * Ported from the prototype's `renderUtil` / `saveUtil`. As in the original the
 * edits are held locally and only written to the database on "Save changes".
 */
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
import { MEDIA_TYPES } from '@/types';
/** Copies the stored defaults into an editable draft, filling any gaps. */
function toDraft(stored) {
  const draft = {};
  MEDIA_TYPES.forEach((channel) => {
    const entry = stored[channel];
    draft[channel] = {
      cap: entry?.cap ?? 0,
      intBy: [...(entry?.intBy ?? [])],
    };
  });
  return draft;
}
export default function UtilizationPage() {
  const db = useDb();
  const { toast } = useUi();
  const [draft, setDraft] = useState(() => toDraft(db.util));
  function setCap(channel, value) {
    setDraft((current) => ({
      ...current,
      [channel]: {
        ...current[channel],
        cap: parseInt(value, 10) || 0,
      },
    }));
  }
  function toggleInterrupt(channel, by, on) {
    setDraft((current) => {
      const entry = current[channel];
      const intBy = on
        ? entry.intBy.indexOf(by) > -1
          ? entry.intBy
          : [...entry.intBy, by]
        : entry.intBy.filter((x) => x !== by);
      return {
        ...current,
        [channel]: {
          ...entry,
          intBy,
        },
      };
    });
  }
  function save() {
    mutate((database) => {
      MEDIA_TYPES.forEach((channel) => {
        const entry = draft[channel];
        database.util[channel] = {
          cap: Math.max(0, Math.min(10, entry.cap)),
          intBy: [...entry.intBy],
        };
      });
    });
    setDraft((current) => {
      const clamped = {};
      MEDIA_TYPES.forEach((channel) => {
        const entry = current[channel];
        clamped[channel] = {
          cap: Math.max(0, Math.min(10, entry.cap)),
          intBy: [...entry.intBy],
        };
      });
      return clamped;
    });
    audit('Edit utilization', 'Org defaults updated');
    toast('Utilization saved');
  }
  return (
    <>
      <PageHeader
        breadcrumb="Admin › Contact Center"
        title="Utilization"
        actions={
          <button className="btn" onClick={save}>
            Save changes
          </button>
        }
        tabs={[
          {
            id: 'org',
            label: 'Organization defaults',
          },
        ]}
        activeTab="org"
      />

      <div className="pbody">
        <div
          style={{
            fontSize: 12.5,
            color: '#5b6b82',
            marginBottom: 12,
            lineHeight: 1.6,
          }}
        >
          Maximum simultaneous interactions per media type for every agent, and which media types
          may <b>interrupt</b> this one. Agent-level overrides are set on the person record.
        </div>

        <div className="tblw">
          <table className="dt">
            <thead>
              <tr>
                <th
                  style={{
                    width: 120,
                  }}
                >
                  Media type
                </th>
                <th
                  style={{
                    width: 140,
                  }}
                >
                  Max capacity
                </th>
                <th>Can be interrupted by</th>
              </tr>
            </thead>
            <tbody>
              {MEDIA_TYPES.map((channel) => {
                const entry = draft[channel];
                return (
                  <tr key={channel}>
                    <td>
                      <b>{channel}</b>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={entry.cap}
                        onChange={(e) => setCap(channel, e.target.value)}
                        style={{
                          width: 70,
                          height: 30,
                          border: '1px solid #ccd4e0',
                          borderRadius: 4,
                          padding: '0 8px',
                        }}
                      />
                    </td>
                    <td>
                      {MEDIA_TYPES.filter((c) => c !== channel).map((other) => (
                        <label
                          key={other}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginRight: 10,
                            fontSize: 12,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={entry.intBy.indexOf(other) > -1}
                            onChange={(e) => toggleInterrupt(channel, other, e.target.checked)}
                            style={{
                              width: 'auto',
                            }}
                          />
                          {other}
                        </label>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
