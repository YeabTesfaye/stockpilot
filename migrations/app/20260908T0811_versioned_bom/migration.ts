#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/566dc65dd578b24f21a25662e2b47eaae43aa8f452ed99dec6ed1cced39684eb/contract';
import endContract from '../../snapshots/566dc65dd578b24f21a25662e2b47eaae43aa8f452ed99dec6ed1cced39684eb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9b8e68a8c8cac6afe80e2f55712bda37c59c14d57e95807ae5ff598a4e5f9bbd/contract';
import startContract from '../../snapshots/9b8e68a8c8cac6afe80e2f55712bda37c59c14d57e95807ae5ff598a4e5f9bbd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      // Drop RLS policy first (depends on product_id column)
      this.dropRlsPolicy({
        schema: 'public',
        table: 'bom_items',
        policy: 'bom_items_tenant_isolation',
      }),
      // Drop old bom_items constraints/indexes/FKs
      this.dropConstraint({
        schema: 'public',
        table: 'bom_items',
        constraint: 'bom_items_product_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'bom_items',
        index: 'bom_items_product_id_idx_22a2b7d2',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'bom_items',
        constraint: 'bom_items_product_id_material_id_key',
      }),
      // Drop old columns
      this.dropColumn({ schema: 'public', table: 'bom_items', column: 'product_id' }),
      this.dropColumn({ schema: 'public', table: 'bom_items', column: 'quantity' }),
      // Create boms table
      this.createTable({
        schema: 'public',
        table: 'boms',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('effective_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('product_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      // Add current_bom_id to products
      this.addColumn({
        schema: 'public',
        table: 'products',
        column: col('current_bom_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      // Add new columns to bom_items (nullable initially)
      this.addColumn({
        schema: 'public',
        table: 'bom_items',
        column: col('bom_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bom_items',
        column: col('quantity_per_unit', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      // New indexes
      this.createIndex({
        schema: 'public',
        table: 'bom_items',
        index: 'bom_items_bom_id_idx_96a0a405',
        columns: ['bom_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'boms',
        index: 'boms_product_id_idx_22a2b7d2',
        columns: ['product_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'products',
        index: 'products_current_bom_id_idx_15995837',
        columns: ['current_bom_id'],
      }),
      // FKs
      this.addForeignKey({
        schema: 'public',
        table: 'boms',
        foreignKey: {
          name: 'boms_product_id_fkey',
          columns: ['product_id'],
          references: { schema: 'public', table: 'products', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bom_items',
        foreignKey: {
          name: 'bom_items_bom_id_fkey',
          columns: ['bom_id'],
          references: { schema: 'public', table: 'boms', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'products',
        foreignKey: {
          name: 'products_current_bom_id_fkey',
          columns: ['current_bom_id'],
          references: { schema: 'public', table: 'boms', columns: ['id'] },
        },
      }),
      // Unique constraint on boms(product_id, version)
      this.addUnique({
        schema: 'public',
        table: 'boms',
        constraint: 'boms_product_id_version_key',
        columns: ['product_id', 'version'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
