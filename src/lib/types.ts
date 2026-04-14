export type ToolId = "merge" | "split" | "extract" | "edit" | "word" | "imageToPdf" | "compress";

export type PreferenceSettings = {
  marketingEmails: boolean;
  productUpdates: boolean;
  darkMode: boolean;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  avatarUrl?: string;
  plan: "free" | "pro" | "team";
  preferences: PreferenceSettings;
};

export type AppConfig = {
  googleLoginEnabled: boolean;
  googleClientId: string;
  otpEnabled: boolean;
  billingEnabled: boolean;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (notification?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void) => void;
          cancel: () => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export type SubscriptionPlan = {
  id: "free" | "pro" | "team";
  title: string;
  priceLabel: string;
  interval: string;
  description: string;
  features: string[];
  cta: string;
};

export type DashboardSummary = {
  user: SessionUser;
  stats: {
    supportTickets: number;
    contactMessages: number;
    currentPlan: string;
    billingStatus: string;
  };
};

export type AuthMode = "login" | "signup" | "forgot" | "otpLogin" | "otpReset";

export type RazorpayCheckoutPayload = {
  provider: "razorpay";
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
};

export type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature?: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      prefill?: { name?: string; email?: string; contact?: string };
      notes?: Record<string, string>;
      theme?: { color?: string };
      handler?: (response: RazorpayResponse) => void;
      modal?: { ondismiss?: () => void };
    }) => { open: () => void };
  }
}
