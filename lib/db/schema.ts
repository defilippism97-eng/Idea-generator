import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Archivio (Fase 2): una riga per sessione (chat manuale o Esplorazione
// Random). Associata al browser tramite un clientId anonimo in cookie —
// niente login, ma persiste tra sessioni sullo stesso dispositivo/browser.
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: text("client_id").notNull(),
  kind: text("kind").notNull(), // "manual" | "explore"
  title: text("title"), // derivato dal primo messaggio utente, o dal nome del progetto
  messages: jsonb("messages").notNull().$type<{ role: string; content: string; variant?: string }[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Knowledge Base (Fase 3): un dominio tematico (es. "fisioterapia
// freelance", "growth marketing SaaS B2B") con i suoi tre ruoli riutilizzabili.
export const kbDomains = pgTable("kb_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  sources: jsonb("sources").$type<{ title: string; url: string }[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kbPersonas = pgTable("kb_personas", {
  id: uuid("id").defaultRandom().primaryKey(),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => kbDomains.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "domain_expert" | "mvp_designer" | "stakeholder"
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
