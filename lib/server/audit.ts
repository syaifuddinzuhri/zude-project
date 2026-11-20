import { toJson, type Tx } from "@/lib/db";

export interface AuditInput {
  userId: number | null;
  entity: string;
  entityId?: string | number | null;
  action: "create" | "update" | "delete" | "restore" | "lock" | "unlock" | "login" | "close" | string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

export async function audit(tx: Tx, a: AuditInput) {
  await tx.auditLog.create({
    data: {
      userId: a.userId,
      entity: a.entity,
      entityId: a.entityId != null ? String(a.entityId) : null,
      action: a.action,
      beforeJson: a.before === undefined ? undefined : toJson(a.before),
      afterJson: a.after === undefined ? undefined : toJson(a.after),
      reason: a.reason ?? null,
    },
  });
}
