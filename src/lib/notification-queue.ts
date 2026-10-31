import { z } from "zod";
import type { ParcelList } from "./types";

export const QUEUE_STORAGE_KEY = "boutique.whatsapp-queue.v1";
const queueSchema = z.object({
  listId: z.string().max(100),
  parcelIds: z.array(z.string().max(100)).max(100),
  index: z.number().int().min(0).max(100),
  openedParcelId: z.string().max(100).nullable(),
});
export type NotificationQueue = z.infer<typeof queueSchema>;

// Only parcel IDs and navigation progress are stored locally, never phone numbers or messages.
export function notificationQueue(
  list: ParcelList,
  saved: string | null = null,
): NotificationQueue {
  const eligible = list.parcels.filter((parcel) => !parcel.collected);
  if (saved) {
    try {
      const prior = queueSchema.parse(JSON.parse(saved));
      if (
        prior.listId === list.id &&
        prior.index < prior.parcelIds.length &&
        new Set(prior.parcelIds).size === prior.parcelIds.length
      ) {
        const valid = (id: string) =>
          eligible.some((parcel) => parcel.id === id);
        const parcelIds = prior.parcelIds.filter(valid);
        const index = prior.parcelIds
          .slice(0, prior.index)
          .filter(valid).length;
        if (index < parcelIds.length)
          return {
            ...prior,
            parcelIds,
            index,
            openedParcelId:
              prior.openedParcelId === parcelIds[index]
                ? prior.openedParcelId
                : null,
          };
      }
    } catch {
      /* A stale or malformed cache must never prevent starting a fresh queue. */
    }
  }
  return {
    listId: list.id,
    parcelIds: eligible.map((parcel) => parcel.id),
    index: 0,
    openedParcelId: null,
  };
}

export function nextNotification(queue: NotificationQueue): NotificationQueue {
  return {
    ...queue,
    index: Math.min(queue.index + 1, queue.parcelIds.length),
    openedParcelId: null,
  };
}
