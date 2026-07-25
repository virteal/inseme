import React, { useState, useMemo } from "react";
import {
  validateAccountingEvent,
  projectAccountBalances,
  projectBudgetStatus,
  projectPublicKudos,
  fromDecimal,
  toDecimal,
  toBigInt,
  fromBigInt,
} from "@inseme/cop-kernel";

// Initial demonstration event sequence for JHN Personal Instance Node
const SAMPLE_JHN_EVENTS = [
  {
    event_id: "evt_jhn_grant_001",
    event_type: "BUDGET_GRANTED",
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    domain: "compute",
    actor_subject_id: "subject:jhn",
    principal_subject_id: "subject:jhn",
    resource_type: "EUR_MICRO",
    postings: [
      {
        account_id: "account:jhn:treasury",
        amount: fromDecimal(100.0, 6, "EUR"),
        direction: "debit",
      },
      {
        account_id: "account:jhn:compute_budget",
        amount: fromDecimal(100.0, 6, "EUR"),
        direction: "credit",
      },
    ],
    budget_limit: fromDecimal(100.0, 6, "EUR"),
    kudos_trace: { kudos_score: 50, reputation_action: "TREASURY_INIT" },
  },
  {
    event_id: "evt_jhn_res_001",
    event_type: "RESERVATION_HOLD",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    domain: "compute",
    actor_subject_id: "subject:jhn",
    principal_subject_id: "subject:jhn",
    resource_type: "EUR_MICRO",
    postings: [
      {
        account_id: "account:jhn:compute_budget",
        amount: fromDecimal(30.0, 6, "EUR"),
        direction: "debit",
      },
      {
        account_id: "account:jhn:reserved_futures",
        amount: fromDecimal(30.0, 6, "EUR"),
        direction: "credit",
      },
    ],
    holding_fee: fromDecimal(5.0, 6, "EUR"),
    kudos_trace: { kudos_score: 25, reputation_action: "COMPUTE_FUTURES_RESERVED" },
  },
  {
    event_id: "evt_jhn_consume_001",
    event_type: "RESOURCE_CONSUMED",
    timestamp: new Date().toISOString(),
    domain: "compute",
    actor_subject_id: "subject:jhn",
    principal_subject_id: "subject:jhn",
    resource_type: "EUR_MICRO",
    postings: [
      {
        account_id: "account:jhn:reserved_futures",
        amount: fromDecimal(30.0, 6, "EUR"),
        direction: "debit",
      },
      {
        account_id: "account:jhn:spent_compute",
        amount: fromDecimal(25.0, 6, "EUR"),
        direction: "credit",
      },
      {
        account_id: "account:jhn:holding_fee_retained",
        amount: fromDecimal(5.0, 6, "EUR"),
        direction: "credit",
      },
    ],
    kudos_trace: { kudos_score: 30, reputation_action: "COMPUTE_EXECUTED_ON_TIME" },
  },
];

export default function CopAccountingDashboard() {
  const [eventSequence, setEventSequence] = useState(SAMPLE_JHN_EVENTS);
  const [activeTab, setActiveTab] = useState("projections");
  const [selectedEventId, setSelectedEventId] = useState(null);

  // New Event Form State
  const [newEventAmount, setNewEventAmount] = useState("10.0");
  const [newEventHoldingFee, setNewEventHoldingFee] = useState("1.0");
  const [newEventType, setNewEventType] = useState("RESERVATION_HOLD");
  const [kudosPoints, setKudosPoints] = useState("15");

  // Validate all events
  const validationResults = useMemo(() => {
    return eventSequence.map((evt) => ({
      evt,
      validation: validateAccountingEvent(evt),
    }));
  }, [eventSequence]);

  // Project deterministic balances
  const balances = useMemo(() => projectAccountBalances(eventSequence), [eventSequence]);
  const budgetStatus = useMemo(() => projectBudgetStatus(eventSequence), [eventSequence]);
  const kudosState = useMemo(() => projectPublicKudos(eventSequence), [eventSequence]);

  // Informational Gravity Attractor Calculation:
  // Gravity Attractor Strength (Γ) = Kudos Reputation Mass * (1 + Resource Volume / 100)
  const totalKudos = kudosState["subject:jhn"]?.accumulated_kudos || 0;
  const spentAmount = toDecimal(
    balances["account:jhn:spent_compute"] || { coefficient: "0", scale: 6 }
  );
  const totalBudget = toDecimal(budgetStatus.total_budget || { coefficient: "0", scale: 6 });
  const remainingBudget = toDecimal(
    budgetStatus.remaining_budget || { coefficient: "0", scale: 6 }
  );
  const budgetPercent = totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0;

  const attractorGravityScore = (totalKudos * (1 + spentAmount / 50)).toFixed(1);

  // Handle adding a new event
  const handleAddEvent = (e) => {
    e.preventDefault();
    const amountVal = parseFloat(newEventAmount) || 0;
    const feeVal = parseFloat(newEventHoldingFee) || 0;

    const newEvt = {
      event_id: `evt_jhn_${Date.now().toString(36)}`,
      event_type: newEventType,
      timestamp: new Date().toISOString(),
      domain: "compute",
      actor_subject_id: "subject:jhn",
      principal_subject_id: "subject:jhn",
      resource_type: "EUR_MICRO",
      postings:
        newEventType === "RESERVATION_HOLD"
          ? [
              {
                account_id: "account:jhn:compute_budget",
                amount: fromDecimal(amountVal, 6, "EUR"),
                direction: "debit",
              },
              {
                account_id: "account:jhn:reserved_futures",
                amount: fromDecimal(amountVal, 6, "EUR"),
                direction: "credit",
              },
            ]
          : [
              {
                account_id: "account:jhn:compute_budget",
                amount: fromDecimal(amountVal, 6, "EUR"),
                direction: "debit",
              },
              {
                account_id: "account:jhn:spent_compute",
                amount: fromDecimal(amountVal, 6, "EUR"),
                direction: "credit",
              },
            ],
      holding_fee: newEventType === "RESERVATION_HOLD" ? fromDecimal(feeVal, 6, "EUR") : undefined,
      kudos_trace: {
        kudos_score: parseInt(kudosPoints, 10) || 10,
        reputation_action: "CUSTOM_USER_ACTION",
      },
    };

    setEventSequence((prev) => [...prev, newEvt]);
  };

  // Quick Simulation Preset Event Handlers
  const handleSimulateReservation = () => {
    const newEvt = {
      event_id: `evt_sim_res_${Date.now().toString(36)}`,
      event_type: "RESERVATION_HOLD",
      timestamp: new Date().toISOString(),
      domain: "compute",
      actor_subject_id: "subject:jhn",
      principal_subject_id: "subject:jhn",
      resource_type: "EUR_MICRO",
      postings: [
        {
          account_id: "account:jhn:compute_budget",
          amount: fromDecimal(15.0, 6, "EUR"),
          direction: "debit",
        },
        {
          account_id: "account:jhn:reserved_futures",
          amount: fromDecimal(15.0, 6, "EUR"),
          direction: "credit",
        },
      ],
      holding_fee: fromDecimal(2.0, 6, "EUR"),
      kudos_trace: { kudos_score: 20, reputation_action: "SIMULATED_RESERVATION_HOLD" },
    };
    setEventSequence((prev) => [...prev, newEvt]);
  };

  const handleSimulateExecution = () => {
    const newEvt = {
      event_id: `evt_sim_exec_${Date.now().toString(36)}`,
      event_type: "RESOURCE_CONSUMED",
      timestamp: new Date().toISOString(),
      domain: "compute",
      actor_subject_id: "subject:jhn",
      principal_subject_id: "subject:jhn",
      resource_type: "EUR_MICRO",
      postings: [
        {
          account_id: "account:jhn:reserved_futures",
          amount: fromDecimal(15.0, 6, "EUR"),
          direction: "debit",
        },
        {
          account_id: "account:jhn:spent_compute",
          amount: fromDecimal(13.0, 6, "EUR"),
          direction: "credit",
        },
        {
          account_id: "account:jhn:holding_fee_retained",
          amount: fromDecimal(2.0, 6, "EUR"),
          direction: "credit",
        },
      ],
      kudos_trace: { kudos_score: 35, reputation_action: "SIMULATED_EXECUTION_ON_TIME" },
    };
    setEventSequence((prev) => [...prev, newEvt]);
  };

  const handleSimulateKudosGrant = () => {
    const newEvt = {
      event_id: `evt_sim_kudos_${Date.now().toString(36)}`,
      event_type: "BUDGET_GRANTED",
      timestamp: new Date().toISOString(),
      domain: "compute",
      actor_subject_id: "subject:jhn",
      principal_subject_id: "subject:jhn",
      resource_type: "EUR_MICRO",
      postings: [
        {
          account_id: "account:jhn:treasury",
          amount: fromDecimal(50.0, 6, "EUR"),
          direction: "debit",
        },
        {
          account_id: "account:jhn:compute_budget",
          amount: fromDecimal(50.0, 6, "EUR"),
          direction: "credit",
        },
      ],
      budget_limit: fromDecimal(50.0, 6, "EUR"),
      kudos_trace: { kudos_score: 50, reputation_action: "COMMUNITY_KUDOS_BOOST" },
    };
    setEventSequence((prev) => [...prev, newEvt]);
  };

  const handleResetLedger = () => {
    setEventSequence(SAMPLE_JHN_EVENTS);
  };

  return (
    <div style={theme.container}>
      {/* Header Banner */}
      <div style={theme.header}>
        <div>
          <h2 style={theme.title}>COP Conformance & Accounting Engine</h2>
          <p style={theme.subtitle}>
            Node Identity: <code>https://jhn.baronsmariani.org/</code> (Living Person Personal Twin)
          </p>
        </div>
        <div style={theme.badgeContainer}>
          <span style={theme.badgeSuccess}>ExactQuantity Micro-Units</span>
          <span style={theme.badgePurple}>Kudos Gravity Active</span>
        </div>
      </div>

      {/* Soft Budget Warning Banner */}
      {budgetStatus.warnings && budgetStatus.warnings.length > 0 && (
        <div style={theme.warningBanner}>
          ⚠️ <strong>BUDGET ALERT:</strong>{" "}
          {budgetStatus.warnings.map((w) => w.message || w.code).join(", ")}
          (Remaining: {budgetPercent.toFixed(1)}%)
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={theme.kpiGrid}>
        <div style={theme.kpiCard}>
          <div style={theme.kpiLabel}>Total Allocated Budget</div>
          <div style={theme.kpiValue}>€{totalBudget.toFixed(2)}</div>
          <div style={theme.kpiSubtext}>Deterministic credit postings</div>
        </div>

        <div style={theme.kpiCard}>
          <div style={theme.kpiLabel}>Remaining Available</div>
          <div style={{ ...theme.kpiValue, color: budgetPercent <= 10 ? "#ef4444" : "#10b981" }}>
            €{remainingBudget.toFixed(2)}
          </div>
          <div style={theme.kpiSubtext}>{budgetPercent.toFixed(1)}% of total budget</div>
        </div>

        <div style={theme.kpiCard}>
          <div style={theme.kpiLabel}>Option Premium / Holding Fees</div>
          <div style={{ ...theme.kpiValue, color: "#f59e0b" }}>
            €
            {toDecimal(
              balances["account:jhn:holding_fee_retained"] || { coefficient: "0", scale: 6 }
            ).toFixed(2)}
          </div>
          <div style={theme.kpiSubtext}>Non-refundable futures fee</div>
        </div>

        <div style={theme.kpiCard}>
          <div style={theme.kpiLabel}>Informational Gravity Attractor (Γ)</div>
          <div style={{ ...theme.kpiValue, color: "#8b5cf6" }}>
            {attractorGravityScore} <span style={{ fontSize: "14px", color: "#9ca3af" }}>Mass</span>
          </div>
          <div style={theme.kpiSubtext}>{totalKudos} Kudos accumulated</div>
        </div>
      </div>

      {/* Quick Simulation Action Bar */}
      <div style={{
        background: "rgba(30, 41, 59, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>⚡</span>
          <strong style={{ color: "#f8fafc", fontSize: "14px" }}>Quick COP Event Simulator:</strong>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={handleSimulateReservation}
            style={{
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            + Reserve Option (€15)
          </button>
          <button
            onClick={handleSimulateExecution}
            style={{
              background: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            + Execute Futures (€15)
          </button>
          <button
            onClick={handleSimulateKudosGrant}
            style={{
              background: "#8b5cf6",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            + Award Kudos (+50)
          </button>
          <button
            onClick={handleResetLedger}
            style={{
              background: "transparent",
              color: "#94a3b8",
              border: "1px solid #475569",
              borderRadius: "6px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            🔄 Reset Sequence
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={theme.tabs}>
        <button
          style={activeTab === "projections" ? theme.tabActive : theme.tab}
          onClick={() => setActiveTab("projections")}
        >
          Projections & Balances
        </button>
        <button
          style={activeTab === "events" ? theme.tabActive : theme.tab}
          onClick={() => setActiveTab("events")}
        >
          Event Ledger ({eventSequence.length})
        </button>

        <button
          style={activeTab === "gravity" ? theme.tabActive : theme.tab}
          onClick={() => setActiveTab("gravity")}
        >
          Kudos Gravity & Routing
        </button>
      </div>

      {/* Tab 1: Projections & Balances */}
      {activeTab === "projections" && (
        <div style={theme.tabContent}>
          <h3 style={theme.sectionHeader}>Deterministic Account Balances</h3>
          <div style={theme.tableWrapper}>
            <table style={theme.table}>
              <thead>
                <tr>
                  <th style={theme.th}>Account ID</th>
                  <th style={theme.th}>Resource</th>
                  <th style={theme.th}>Raw Micro-Units (BigInt)</th>
                  <th style={theme.th}>Exact Decimal Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(balances).map(([accId, qty]) => {
                  const microInt = toBigInt(qty);
                  const decVal = toDecimal(qty);
                  return (
                    <tr key={accId} style={theme.tr}>
                      <td style={theme.td}>
                        <code>{accId}</code>
                      </td>
                      <td style={theme.td}>{qty.unit || "EUR"}</td>
                      <td style={theme.td}>
                        <code>{microInt.toString()}</code>
                      </td>
                      <td style={{ ...theme.td, fontWeight: "bold" }}>€{decVal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "24px" }}>
            <h3 style={theme.sectionHeader}>Futures Holding Fee / Option Premium Rules</h3>
            <div style={theme.infoBox}>
              <p>
                <strong>Futures Reservation Rule:</strong> When compute capacity is reserved, an
                option premium / <code>holding_fee</code> can be charged.
              </p>
              <p>
                Upon unconsumed release or expiry, the <code>holding_fee</code> is{" "}
                <strong>non-refundable</strong> and retained in <code>spent</code> balance, while
                only unconsumed capacity returns to <code>available</code> budget.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Event Ledger & Dispatch Simulator */}
      {activeTab === "events" && (
        <div style={theme.tabContent}>
          <h3 style={theme.sectionHeader}>Simulate New Accounting Event</h3>
          <form onSubmit={handleAddEvent} style={theme.formGrid}>
            <div>
              <label style={theme.formLabel}>Event Type</label>
              <select
                style={theme.formSelect}
                value={newEventType}
                onChange={(e) => setNewEventType(e.target.value)}
              >
                <option value="RESERVATION_HOLD">RESERVATION_HOLD (Futures Contract)</option>
                <option value="BUDGET_GRANTED">BUDGET_GRANTED (Top-Up)</option>
                <option value="RESOURCE_CONSUMED">RESOURCE_CONSUMED (Direct Execution)</option>
              </select>
            </div>

            <div>
              <label style={theme.formLabel}>Amount (EUR)</label>
              <input
                type="number"
                step="0.1"
                style={theme.formInput}
                value={newEventAmount}
                onChange={(e) => setNewEventAmount(e.target.value)}
              />
            </div>

            {newEventType === "RESERVATION_HOLD" && (
              <div>
                <label style={theme.formLabel}>Holding Fee / Option Premium (EUR)</label>
                <input
                  type="number"
                  step="0.1"
                  style={theme.formInput}
                  value={newEventHoldingFee}
                  onChange={(e) => setNewEventHoldingFee(e.target.value)}
                />
              </div>
            )}

            <div>
              <label style={theme.formLabel}>Kudos Trace Score</label>
              <input
                type="number"
                style={theme.formInput}
                value={kudosPoints}
                onChange={(e) => setKudosPoints(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
              <button type="submit" style={theme.primaryBtn}>
                + Emit Balanced Accounting Event
              </button>
            </div>
          </form>

          <h3 style={{ ...theme.sectionHeader, marginTop: "32px" }}>Immutable Event Sequence</h3>
          <div style={theme.tableWrapper}>
            <table style={theme.table}>
              <thead>
                <tr>
                  <th style={theme.th}>Event ID</th>
                  <th style={theme.th}>Type</th>
                  <th style={theme.th}>Timestamp</th>
                  <th style={theme.th}>Validation</th>
                  <th style={theme.th}>Holding Fee</th>
                  <th style={theme.th}>Kudos</th>
                </tr>
              </thead>
              <tbody>
                {validationResults.map(({ evt, validation }) => (
                  <tr
                    key={evt.event_id}
                    style={{
                      ...theme.tr,
                      backgroundColor: selectedEventId === evt.event_id ? "#1f2937" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      setSelectedEventId(evt.event_id === selectedEventId ? null : evt.event_id)
                    }
                  >
                    <td style={theme.td}>
                      <code>{evt.event_id}</code>
                    </td>
                    <td style={theme.td}>
                      <span style={theme.badgeBlue}>{evt.event_type}</span>
                    </td>
                    <td style={theme.td}>{new Date(evt.timestamp).toLocaleTimeString()}</td>
                    <td style={theme.td}>
                      {validation.valid ? (
                        <span style={theme.badgeSuccess}>
                          ✓ Balanced ({validation.balanced ? "Double-Entry" : "Single"})
                        </span>
                      ) : (
                        <span style={theme.badgeError}>✗ Invalid</span>
                      )}
                    </td>
                    <td style={theme.td}>
                      {evt.holding_fee ? `€${toDecimal(evt.holding_fee).toFixed(2)}` : "—"}
                    </td>
                    <td style={theme.td}>+{evt.kudos_trace?.kudos_score || 0} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Kudos Gravity & Attractor Routing */}
      {activeTab === "gravity" && (
        <div style={theme.tabContent}>
          <h3 style={theme.sectionHeader}>Kudos Complementary Currency & Informational Gravity</h3>

          <div style={theme.infoBox}>
            <p>
              <strong>Informational Gravity Doctrine (WCBT §5):</strong> Kudos acts as a
              complementary currency accompanying resource transactions regardless of primary unit
              (CPU, EUR, tokens).
            </p>
            <p>
              In Fractanet routing, packet attractors broadcast their gravitational mass ($\Gamma$).
              Incoming cognitive packets are pulled toward attractors based on reputation mass.
            </p>
          </div>

          <div style={theme.kpiGrid}>
            <div style={theme.kpiCard}>
              <div style={theme.kpiLabel}>Subject ID</div>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: "#60a5fa" }}>
                subject:jhn
              </div>
              <div style={theme.kpiSubtext}>Jean-Hugues Robert (Node Principal)</div>
            </div>

            <div style={theme.kpiCard}>
              <div style={theme.kpiLabel}>Accumulated Reputation Mass</div>
              <div style={theme.kpiValue}>{totalKudos} Kudos</div>
              <div style={theme.kpiSubtext}>Derived from valid event sequence</div>
            </div>

            <div style={theme.kpiCard}>
              <div style={theme.kpiLabel}>Attractor Pull Strength (Γ)</div>
              <div style={{ ...theme.kpiValue, color: "#a855f7" }}>{attractorGravityScore}</div>
              <div style={theme.kpiSubtext}>Packet Attractor Gravity Index</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Design System Styles (Vanilla Dark Theme)
const theme = {
  container: {
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    padding: "24px",
    borderRadius: "12px",
    border: "1px solid #1e293b",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    borderBottom: "1px solid #1e293b",
    paddingBottom: "16px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 4px 0",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: "13px",
    color: "#94a3b8",
    margin: 0,
  },
  badgeContainer: {
    display: "flex",
    gap: "8px",
  },
  badgeSuccess: {
    backgroundColor: "#064e3b",
    color: "#34d399",
    padding: "4px 10px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgePurple: {
    backgroundColor: "#4c1d95",
    color: "#c084fc",
    padding: "4px 10px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeBlue: {
    backgroundColor: "#1e3a8a",
    color: "#60a5fa",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "600",
  },
  badgeError: {
    backgroundColor: "#7f1d1d",
    color: "#fca5a5",
    padding: "4px 10px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  warningBanner: {
    backgroundColor: "#7f1d1d",
    border: "1px solid #ef4444",
    color: "#fef2f2",
    padding: "12px 16px",
    borderRadius: "8px",
    marginBottom: "20px",
    fontSize: "14px",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "28px",
  },
  kpiCard: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "10px",
    padding: "16px",
  },
  kpiLabel: {
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  kpiValue: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#ffffff",
  },
  kpiSubtext: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "4px",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    borderBottom: "1px solid #1e293b",
    marginBottom: "20px",
  },
  tab: {
    backgroundColor: "transparent",
    border: "none",
    color: "#94a3b8",
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  tabActive: {
    backgroundColor: "#1e293b",
    border: "none",
    borderBottom: "2px solid #3b82f6",
    color: "#ffffff",
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },
  tabContent: {
    paddingTop: "8px",
  },
  sectionHeader: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#f1f5f9",
    marginBottom: "14px",
  },
  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #1e293b",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "13px",
  },
  th: {
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    padding: "12px 14px",
    fontWeight: "600",
    borderBottom: "1px solid #334155",
  },
  td: {
    padding: "12px 14px",
    borderBottom: "1px solid #1e293b",
  },
  tr: {
    transition: "background-color 0.15s",
  },
  infoBox: {
    backgroundColor: "#0284c715",
    borderLeft: "4px solid #0284c7",
    padding: "14px 16px",
    borderRadius: "0 8px 8px 0",
    fontSize: "13px",
    color: "#e0f2fe",
    lineHeight: "1.5",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "14px",
    backgroundColor: "#1e293b",
    padding: "18px",
    borderRadius: "10px",
    border: "1px solid #334155",
  },
  formLabel: {
    display: "block",
    fontSize: "12px",
    color: "#94a3b8",
    marginBottom: "6px",
    fontWeight: "500",
  },
  formInput: {
    width: "100%",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#ffffff",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    boxSizing: "border-box",
  },
  formSelect: {
    width: "100%",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#ffffff",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    boxSizing: "border-box",
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    padding: "10px 18px",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
  },
};
