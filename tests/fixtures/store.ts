import type { Store } from "../../src/lib/types";
export function seedStore(): Store {
  const categories = [
    { id: "clothes", name: "ملابس", price: 20, active: true },
    { id: "shoes", name: "أحذية", price: 25, active: true },
    { id: "accessories", name: "إكسسوارات", price: 15, active: true },
    { id: "home", name: "مستلزمات منزلية", price: 35, active: true },
    { id: "other", name: "أخرى", price: 30, active: true },
  ];
  const drivers = [
    "محمد الأمين",
    "أحمد السالك",
    "عبد الله محمد",
    "الحسن علي",
    "محمد الأمين",
    "أحمد السالك",
    "عبد الله محمد",
    "الحسن علي",
  ];
  const lists = drivers.map((driver, i) => {
    const id = `BD-2026-${String(1084 - i).padStart(4, "0")}`;
    const parcels = Array.from(
      { length: [8, 6, 5, 7, 4, 6, 3, 5][i] },
      (_, j) => {
        const category = categories[(i + j) % categories.length];
        const quantity = j % 3 === 0 ? 2 : 1;
        return {
          id: `demo-${i}-${j}`,
          reference: `${id}-${String(j + 1).padStart(3, "0")}`,
          phone: "+212600000000",
          items: [
            {
              categoryId: category.id,
              name: category.name,
              quantity,
              unitPrice: category.price,
            },
          ],
          total: category.price * quantity,
          paid: i > 3 || j % 3 !== 0,
          collected: i > 3 || j % 2 !== 0,
        };
      },
    );
    return {
      id,
      driver,
      createdAt: new Date(Date.UTC(2026, 9, 30 - i, 9 + i, 20)).toISOString(),
      parcels,
      total: parcels.reduce((s, p) => s + p.total, 0),
      commissionRate: 10,
      transactionId: `seed-${i}`,
    };
  });
  return {
    revision: 0,
    lists,
    categories,
    commissions: lists
      .filter((_, i) => i > 3)
      .map((l) => ({
        id: `commission-${l.id}`,
        listId: l.id,
        amount: l.total / 10,
        earnedAt: l.createdAt,
      })),
    settlements: [
      {
        id: "settlement-demo",
        amount: 30,
        createdAt: "2026-10-26T12:00:00.000Z",
        transactionId: "settlement-seed",
      },
    ],
    settings: {
      shopName: "بوتيك الداه",
      mapsUrl: "",
      logo: "",
      commissionRate: 10,
    },
    audit: [],
  };
}
