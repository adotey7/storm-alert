import "server-only";

import { getPrisma } from "@/lib/prisma";

export type AlertStats = {
  activeSubscribers: number;
  alertsSent: number;
  lastAlertAt: string | null;
};

export type RecentAlert = {
  id: string;
  regionCode: string;
  triggerReason: string;
  triggeredAt: string;
  recipientsCount: number;
};

export async function getAlertStats(): Promise<AlertStats> {
  const prisma = getPrisma();

  const [activeSubscribers, alertsSent, lastAlert] = await Promise.all([
    prisma.subscriber.count({ where: { active: true } }),
    prisma.alertLog.count(),
    prisma.alertLog.findFirst({ orderBy: { triggeredAt: "desc" } }),
  ]);

  return {
    activeSubscribers,
    alertsSent,
    lastAlertAt: lastAlert ? lastAlert.triggeredAt.toISOString() : null,
  };
}

export async function getRecentAlerts(limit: number): Promise<RecentAlert[]> {
  const prisma = getPrisma();

  const rows = await prisma.alertLog.findMany({
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    regionCode: row.regionCode,
    triggerReason: row.triggerReason,
    triggeredAt: row.triggeredAt.toISOString(),
    recipientsCount: row.recipientsCount,
  }));
}
