export type Category = {
  id: string;
  name: string;
  price: number;
  active: boolean;
};
export type ParcelItem = {
  categoryId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};
export type Parcel = {
  id: string;
  reference: string;
  phone: string;
  items: ParcelItem[];
  total: number;
  paid: boolean;
  collected: boolean;
};
export type ParcelList = {
  id: string;
  closedAt?: string;
  driver: string;
  createdAt: string;
  parcels: Parcel[];
  total: number;
  commissionRate: number;
  transactionId: string;
};
export type Commission = {
  id: string;
  listId: string;
  amount: number;
  earnedAt: string;
};
export type Settlement = {
  id: string;
  amount: number;
  createdAt: string;
  transactionId: string;
};
export type Settings = {
  backupEmail?: string;
  shopName: string;
  mapsUrl: string;
  logo: string;
  commissionRate: number;
};
export type Audit = {
  id: string;
  action: string;
  entityId: string;
  createdAt: string;
};
export type Store = {
  revision: number;
  lists: ParcelList[];
  categories: Category[];
  commissions: Commission[];
  settlements: Settlement[];
  settings: Settings;
  audit: Audit[];
};
