export type UserPreferences = {
  marketingEmails: boolean; productUpdates: boolean; darkMode: boolean;
};
export type StoredUser = {
  _id?: string; id: string; name: string; email: string; passwordHash?: string;
  phone?: string; company?: string; avatarUrl?: string; plan: 'free' | 'pro' | 'team';
  authProviders: { password: boolean; google: boolean; };
  preferences: UserPreferences; createdAt: Date; updatedAt: Date;
};
export type ContactMessage = { _id?: string; id: string; name: string; email: string; message: string; createdAt: Date; };
export type SupportTicket = {
  _id?: string; id: string; userId?: string; name: string; email: string;
  subject: string; message: string; status: 'open' | 'in_progress' | 'resolved'; createdAt: Date;
};
export type OtpRecord = {
  _id?: string; id: string; email: string; codeHash: string;
  purpose: 'login' | 'reset'; expiresAt: Date; createdAt: Date;
};
export type SubscriptionRecord = {
  _id?: string; id: string; userId: string; email: string; plan: 'pro' | 'team';
  status: 'pending' | 'active' | 'cancelled'; provider: 'razorpay';
  razorpayOrderId?: string; razorpayPaymentId?: string; createdAt: Date; updatedAt: Date;
};
export type SessionUser = {
  id: string; name: string; email: string; phone?: string; company?: string;
  avatarUrl?: string; plan: 'free' | 'pro' | 'team'; preferences: UserPreferences;
};
export type PublicPlan = {
  id: 'free' | 'pro' | 'team'; title: string; priceLabel: string; interval: string;
  description: string; features: string[]; cta: string;
};
export type SessionEntry = { user: SessionUser; expiresAt: number; };
export type UsageRecord = {
  _id?: string;
  userId: string;    // user ID for logged-in, IP hash for guests
  dateKey: string;   // "YYYY-MM-DD"
  count: number;
  updatedAt: Date;
};
