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

// Fase 4: job di espansione autonoma della KB. Possibile solo perché l'app
// gira come processo Node persistente (Render), non come function serverless
// a vita breve (Vercel) — il loop in background sopravvive oltre la singola
// richiesta HTTP che l'ha avviato.
export const kbExpansionJobs = pgTable("kb_expansion_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  mode: text("mode").notNull(), // "domain" | "general"
  domain: text("domain"),
  status: text("status").notNull().default("running"), // "running" | "done" | "error"
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at").notNull(),
  log: jsonb("log").notNull().default([]).$type<{ at: string; message: string }[]>(),
  domainsProcessed: jsonb("domains_processed").notNull().default([]).$type<string[]>(),
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
