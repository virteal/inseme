// Revised CopCoreLandingPage.jsx — clearer, more assertive positioning
import React from "react";

const GITHUB_ROOT = "https://github.com/JeanHuguesRobert/survey/tree/main/packages/cop-core";
const GITHUB_BLOB_BASE = "https://github.com/JeanHuguesRobert/survey/blob/main/packages/cop-core";

const link = (path) => `${GITHUB_BLOB_BASE}/${path}`;

export default function CopCoreLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-14 lg:py-18">
        {/* Hero */}
        <header className="space-y-10 border-b border-slate-800 pb-14">
          <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Cognitive Orchestration Protocol · <span className="ml-1">cop-core</span>
          </div>

          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              COP — Cognitive Orchestration Protocol
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-slate-300">
              COP is a <strong>foundational protocol</strong> for durable, auditable and
              interoperable multi‑agent systems. It standardizes how cognition is
              <em> recorded, replayed and shared</em> — independently of models, vendors or
              runtimes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <PrimaryButton href={GITHUB_ROOT}>View on GitHub</PrimaryButton>
            <SecondaryButton href={link("README.md")}>Read the Overview</SecondaryButton>
            <TertiaryButton href={link("COMPARISON.md")}>Why COP exists</TertiaryButton>
          </div>
        </header>

        {/* Main layout */}
        <main className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)]">
          {/* Left column */}
          <div className="space-y-10">
            {/* What COP is */}
            <Section title="What COP actually is">
              <p>
                COP is <strong>not</strong> a framework, SDK or platform. It is a
                <strong> protocol and canonical data model</strong> defining how cognitive work is
                represented over time.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>
                  Immutable, ordered <code>Events</code> as the source of truth
                </li>
                <li>
                  Durable <code>Artifacts</code> as explicit cognitive outputs
                </li>
                <li>
                  Explicit structure via <code>Topics</code>, <code>Tasks</code> and{" "}
                  <code>Steps</code>
                </li>
                <li>Stateless agents with replayable behavior</li>
                <li>Continuations for long‑running, resumable reasoning</li>
              </ul>
              <p className="mt-4">
                COP sits <em>below</em> agent frameworks and orchestration engines. It is the stable
                layer they can all share.
              </p>
            </Section>

            {/* Why COP */}
            <Section title="Why COP exists">
              <p>
                Today’s agent frameworks solve execution, not durability. They embed cognition
                inside runtime‑specific abstractions:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>State is implicit or transient</li>
                <li>Reasoning cannot be replayed years later</li>
                <li>Interoperability is accidental, not guaranteed</li>
                <li>Auditability is an afterthought</li>
              </ul>
              <p className="mt-4">
                COP inverts the model: cognition is durable first. Execution becomes replaceable.
              </p>
            </Section>

            {/* Who it is for */}
            <Section title="Who COP is for">
              <div className="grid gap-5 sm:grid-cols-2">
                <Audience
                  title="System architects"
                  text="Designing long‑lived AI systems that must survive model, vendor and infrastructure churn."
                />
                <Audience
                  title="Framework authors"
                  text="Who want their tools to interoperate instead of locking users into a closed stack."
                />
                <Audience
                  title="Institutions & regulators"
                  text="Needing traceable, auditable cognitive processes for compliance or governance."
                />
                <Audience
                  title="Researchers"
                  text="Who care about reproducibility, inspection and long‑term analysis of AI behavior."
                />
              </div>
            </Section>
          </div>

          {/* Right column */}
          <aside className="space-y-6">
            <Card title="Documentation">
              <DocLink label="Overview" href={link("README.md")} />
              <DocLink label="Architecture" href={link("Architecture.md")} />
              <DocLink label="Invariants" href={link("invariants.md")} />
              <DocLink label="Comparison" href={link("COMPARISON.md")} />
              <DocLink label="Roadmap" href={link("ROADMAP.md")} />
              <DocLink label="FAQ" href={link("FAQ.md")} />
            </Card>

            <Card title="Mental model">
              <pre className="rounded-xl bg-slate-950/70 p-3 text-xs font-mono text-slate-300">
                {`Topic
 ├─ Events (immutable, ordered)
 └─ Artifacts (durable outputs)

Tasks
 └─ Steps

Agents
 ├─ consume Events
 └─ emit Events

Store = replayable projection
Bus   = transport + history`}
              </pre>
            </Card>

            <Card title="Build on COP">
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                <li>Implement a COPStore or COPBus</li>
                <li>Make your agents COP‑native</li>
                <li>Define domain‑specific profiles</li>
                <li>Use COP as your audit and governance layer</li>
              </ul>
              <a
                href={GITHUB_ROOT}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                Open repository →
              </a>
            </Card>
          </aside>
        </main>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-800 pt-6 text-xs text-slate-500">
          COP is a protocol, not a product. It is designed to outlive models, vendors and
          frameworks.
        </footer>
      </div>
    </div>
  );
}

/* ---------- small components ---------- */

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-7">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      <div className="mt-4 space-y-3 text-sm text-slate-300">{children}</div>
    </section>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Audience({ title, text }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <p className="mt-1 text-sm text-slate-300">{text}</p>
    </div>
  );
}

function DocLink({ label, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
    >
      {label} ↗
    </a>
  );
}

function PrimaryButton({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
    >
      {children}
    </a>
  );
}

function SecondaryButton({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-400"
    >
      {children}
    </a>
  );
}

function TertiaryButton({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-400"
    >
      {children}
    </a>
  );
}
