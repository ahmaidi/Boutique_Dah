import type { Store } from "./types";
export function emptyStore(): Store {
  return {
    revision: 0,
    lists: [],
    commissions: [],
    settlements: [],
    audit: [],
    categories: [
      { id: "clothes", name: "ملابس", price: 20, active: true },
      { id: "shoes", name: "أحذية", price: 25, active: true },
      { id: "accessories", name: "إكسسوارات", price: 15, active: true },
      { id: "home", name: "مستلزمات منزلية", price: 35, active: true },
      { id: "other", name: "أخرى", price: 30, active: true },
    ],
    settings: {
      shopName: "بوتيك الداه",
      mapsUrl: "",
      logo: "",
      commissionRate: 10,
    },
  };
}
