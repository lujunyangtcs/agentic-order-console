import { useQuery } from '@tanstack/react-query'
import { api } from '@/services'
import type { AuditEntry } from '@/services'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { PageHeader } from '@/components/shell/PageHeader'
import { LoadingRows } from '@/components/state/States'
import { formatDateTime } from '@/fixtures/calendar'

/**
 * What was decided, by whom, and against what.
 *
 * Entries exist because something happened, not because the fixture seeded
 * them — write back the requisition set and three more rows appear with the
 * references the system of record returned. An audit log that is populated in
 * advance is a screenshot, and the one persona in the room whose job is to
 * doubt the integration will check exactly this.
 */

const columns: ColumnDef<AuditEntry>[] = [
  {
    key: 'at', header: 'When', width: '180px', pinned: 'left',
    sortValue: (r) => r.at,
    render: (r) => <span className="tabular text-xs">{formatDateTime(r.at)}</span>,
  },
  {
    key: 'actor', header: 'User or system', width: '170px',
    sortValue: (r) => r.actor,
    render: (r) => <span className="text-xs">{r.actor}</span>,
  },
  {
    key: 'entity', header: 'Entity', width: '190px',
    sortValue: (r) => r.entity,
    render: (r) => <span className="font-mono text-xs">{r.entity}</span>,
  },
  {
    key: 'action', header: 'Action', width: '280px',
    render: (r) => <span className="text-xs">{r.action}</span>,
  },
  {
    key: 'before', header: 'Before', width: '190px',
    render: (r) => <span className="text-muted-foreground text-2xs">{r.before ?? '—'}</span>,
  },
  {
    key: 'after', header: 'After', width: '210px',
    render: (r) => <span className="text-2xs">{r.after ?? '—'}</span>,
  },
  {
    key: 'evidence', header: 'Evidence', width: '220px',
    render: (r) => <span className="text-muted-foreground text-2xs">{r.evidence ?? '—'}</span>,
  },
  {
    key: 'ref', header: 'External reference', width: '160px', pinned: 'right',
    render: (r) => (
      <span className="text-verdict-pass font-mono text-xs">{r.externalReference ?? '—'}</span>
    ),
  },
]

export function AuditRoute() {
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => api.replenishment.audit() })

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-6">
      <PageHeader
        title="Audit Log"
        description="Every recommendation, edit, approval and write-back, with what it was based on."
        stats={[
          { label: 'Entries', value: String(audit.data?.length ?? '—') },
          {
            label: 'Written back',
            value: String(audit.data?.filter((a) => a.externalReference).length ?? '—'),
          },
        ]}
      />
      {audit.isLoading ? (
        <LoadingRows rows={5} />
      ) : (
        <DataTable
          name="audit"
          rows={audit.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          empty="Nothing has been decided yet."
        />
      )}
    </div>
  )
}
