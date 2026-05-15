import { MongoClient, type Collection } from "mongodb";
import { log } from "./logger.js";
import type { StoredUser, ContactMessage, SupportTicket, OtpRecord, SubscriptionRecord } from "./types.js";

const mongoUri     = process.env.MONGODB_URI ?? "";
const databaseName = process.env.MONGODB_DB_NAME ?? "pdfsolution";

export let usersCollection:           Collection<StoredUser>;
export let contactMessagesCollection: Collection<ContactMessage>;
export let supportTicketsCollection:  Collection<SupportTicket>;
export let otpCollection:             Collection<OtpRecord>;
export let subscriptionsCollection:   Collection<SubscriptionRecord>;

export async function connectToDatabase() {
  if (!mongoUri) throw new Error("Missing MONGODB_URI — add it to your .env file.");
  const client = new MongoClient(mongoUri, {
    tls: true, tlsAllowInvalidCertificates: process.env.NODE_ENV !== "production",
    maxPoolSize: 10, minPoolSize: 0, maxIdleTimeMS: 15_000,
    serverSelectionTimeoutMS: 30_000, connectTimeoutMS: 30_000, socketTimeoutMS: 45_000,
  });
  await client.connect();
  const db = client.db(databaseName);
  usersCollection           = db.collection<StoredUser>("users");
  contactMessagesCollection = db.collection<ContactMessage>("contactMessages");
  supportTicketsCollection  = db.collection<SupportTicket>("supportTickets");
  otpCollection             = db.collection<OtpRecord>("otpCodes");
  subscriptionsCollection   = db.collection<SubscriptionRecord>("subscriptions");
  await Promise.all([
    usersCollection.createIndex({ email: 1 }, { unique: true }),
    contactMessagesCollection.createIndex({ createdAt: -1 }),
    supportTicketsCollection.createIndex({ createdAt: -1 }),
    otpCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    subscriptionsCollection.createIndex({ userId: 1, createdAt: -1 }),
  ]);
  log.info("Connected to MongoDB", { db: databaseName });
}
