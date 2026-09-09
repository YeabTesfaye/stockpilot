import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { getSessionUser } from '@/server/auth/session';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { can } from '@/server/rabc/can';
import { Action } from '@/server/rabc/permissions';
import { withTenant } from '@/server/tenancy/withTenant';
import Link from 'next/link';

interface MaxBuildableRow {
  materialId: string;
  materialName: string;
  materialSku: string;
  unit: string;
  quantityPerUnit: number;
  availableStock: number;
  buildableFromMaterial: number;
  isConstraint: boolean;
}

interface MaxBuildableResult {
  productId: string;
  productName: string;
  maxBuildable: number;
  rows: MaxBuildableRow[];
}

async function fetchMaxBuildable(productId: string, cookie: string): Promise<MaxBuildableResult> {
  const res = await fetch(
    `/api/products/${productId}/max-buildable`,
    {
      headers: { cookie },
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    throw new Error(`max-buildable fetch failed: ${res.status}`);
  }
  return res.json() as Promise<MaxBuildableResult>;
}

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return '∞';
  return n.toLocaleString();
}

export default async function MaxBuildablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');
  const user = await getSessionUser(token);
  if (!user || !can(user.roleBindings, Action.VIEW_PRODUCTS)) {
    notFound();
  }

  const tenantId = user.memberships[0]?.id;
  if (!tenantId) notFound();

  const cookie = store.get(SESSION_COOKIE)?.value ?? '';
  const data = await withTenant(tenantId, () =>
    fetchMaxBuildable(id, cookie),
  );
  if (!data) {
    notFound();
  }


  const { productName, maxBuildable, rows } = data;

  const columns: Column<MaxBuildableRow>[] = [
    {
      accessor: 'materialName',
      header: 'Material',
      className: 'font-medium',
      cell: (row: MaxBuildableRow) => (
        <span className="font-medium">{row.materialName}</span>
      ),
    },
    {
      accessor: 'materialSku',
      header: 'SKU',
      className: 'font-mono text-muted-foreground',
      cell: (row: MaxBuildableRow) => (
        <span className="font-mono text-muted-foreground">{row.materialSku}</span>
      ),
    },
    {
      accessor: 'quantityPerUnit',
      header: 'Qty / unit',
      className: 'text-right',
      cell: (row: MaxBuildableRow) => (
        <span className="tabular-nums">
          {row.quantityPerUnit}
          <span className="text-muted-foreground ml-1">{row.unit}</span>
        </span>
      ),
    },
    {
      accessor: 'availableStock',
      header: 'Available stock',
      className: 'text-right tabular-nums',
      cell: (row: MaxBuildableRow) => (
        <span className="text-right tabular-nums">{row.availableStock}</span>
      ),
    },
    {
      accessor: 'buildableFromMaterial',
      header: 'Buildable',
      className: 'text-right tabular-nums font-medium',
      cell: (row: MaxBuildableRow) => {
        const isConstraint = row.isConstraint;
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-semibold ${isConstraint ? 'bg-amber-500/10 text-amber-foreground' : 'text-foreground'}`}
          >
            {isConstraint && (
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
            {formatNumber(row.buildableFromMaterial)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Max buildable units"
        description={`How many ${productName} we can build right now given current stock`}
        actions={
          <Link
            href="/products"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground"
          >
            ← Back to products
          </Link>
        }
      />

      {!Number.isFinite(maxBuildable) ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-muted bg-muted/30 py-12">
          <p className="text-lg text-muted-foreground">No bill of materials set.</p>
          <p className="text-sm text-muted-foreground">
            Add BOM lines to see a max-buildable number.
          </p>
          <a
            href={`/products/${id}/bom`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Edit BOM
          </a>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-start gap-2 rounded-lg border border-muted bg-muted/40 px-6 py-5">
            <p className="text-sm text-muted-foreground">
              Max units of <strong>{productName}</strong> we can manufacture now
            </p>
            <p className="text-5xl font-bold tracking-tight tabular-nums">
              {formatNumber(maxBuildable)}
            </p>
            <p className="text-sm text-muted-foreground">
              {rows.length} material{rows.length !== 1 ? 's' : ''} holding us back
              {rows.some((r) => r.isConstraint)
                ? ` — constraint: ${rows.find((r) => r.isConstraint)!.materialName}`
                : ''}
            </p>
          </div>

          <DataTable
            key={`max-buildable-${id}`}
            data={rows}
            columns={columns}
            keyField="materialId"
            renderRowActions={(row: MaxBuildableRow) =>
              row.isConstraint ? (
                <StatusBadge variant="warning">Binding constraint</StatusBadge>
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}
