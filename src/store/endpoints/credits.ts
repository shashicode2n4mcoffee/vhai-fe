/**
 * Pricing & Credits API.
 */

import { api } from "../api";

export interface CreditBalance {
  technical: number;
  hr: number;
  behavioral: number;
  general: number;
  aptitude: number;
  coding: number;
  /** True if user has at least one ACTIVE pack with plan BUSINESS */
  hasBusinessPlan?: boolean;
}

export interface PlanInfo {
  id: string;
  name: string;
  description: string;
  currency: string;
  priceDisplay: number;
  amountSmallestUnit: number;
  packSize?: number;
  packSizes?: number[];
  minCredits?: number;
  maxCredits?: number;
  packPricePaise?: number;
  interviewAllocation: { technical: number; hr: number; behavioral: number; general: number };
  aptitudeTotal: number;
  codingTotal: number;
  reportSections: number;
  templates: number;
}

export interface PricingPlans {
  usd: PlanInfo[];
  inr: PlanInfo[];
}

const creditsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPricingPlans: builder.query<PricingPlans, void>({
      query: () => "/pricing/plans",
    }),
    getCreditsBalance: builder.query<CreditBalance, void>({
      query: () => "/credits/balance",
      providesTags: ["Credits"],
    }),
    getCreditsPacks: builder.query<any[], void>({
      query: () => "/credits/packs",
      providesTags: ["Credits"],
    }),
    getCreditsHistory: builder.query<any[], number | void>({
      query: (limit = 50) => ({ url: "/credits/history", params: { limit } }),
      providesTags: ["Credits"],
    }),
    purchasePack: builder.mutation<
      { success: boolean; packId: string; message?: string },
      { plan: string; quantity?: number; simulate?: boolean }
    >({
      query: (body) => ({
        url: "/credits/purchase",
        method: "POST",
        body: body.simulate !== false ? { ...body, simulate: true } : body,
      }),
      invalidatesTags: ["Credits"],
    }),
    createRazorpayOrder: builder.mutation<
      { orderId: string; amount: number; currency: string; keyId: string },
      { plan: "LITE" | "PRO" | "ELITE"; collegeRollNumber?: string | null }
    >({
      query: (body) => ({
        url: "/credits/razorpay/order",
        method: "POST",
        body,
      }),
    }),
    verifyRazorpayPayment: builder.mutation<
      { success: boolean; packId: string },
      { orderId: string; paymentId: string; signature: string }
    >({
      query: (body) => ({
        url: "/credits/razorpay/verify",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Credits"],
    }),
    grantCreditsPack: builder.mutation<
      { success: boolean; packId: string; message?: string },
      { userId: string; plan: string; quantity?: number }
    >({
      query: (body) => ({
        url: "/credits/grant",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Credits"],
    }),
  }),
});

export const {
  useGetPricingPlansQuery,
  useGetCreditsBalanceQuery,
  useGetCreditsPacksQuery,
  useGetCreditsHistoryQuery,
  usePurchasePackMutation,
  useCreateRazorpayOrderMutation,
  useVerifyRazorpayPaymentMutation,
  useGrantCreditsPackMutation,
} = creditsApi;
