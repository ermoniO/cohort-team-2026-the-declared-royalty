export interface CategoryItem {
  categoryCode: string;
  name: string;
  description?: string;
  status?: string;
}

export interface PaymentMethodItem {
  methodCode: string;
  name: string;
  description?: string;
  status?: string;
}

export type PropertyCategoryResponse = CategoryItem;
export type VendorCategoryResponse = CategoryItem;
export type PaymentMethodResponse = PaymentMethodItem;
