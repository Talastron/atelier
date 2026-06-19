// src/AdminAiUsage.jsx
//
// Owner-only AI spend dashboard. Reads /users/*/aiUsageMonthly via a
// Firestore collection group query, aggregates per-user and per-feature
// stats, and renders them as a small editorial dashboard in the app's
// brass/cream visual language.
//
// Mounting: import and render anywhere in the app (e.g. inside the
// Insights view, conditionally below the personal stats). The component
// self-gates — it returns null if the signed-in user is not an owner,
// so it's safe to mount unconditionally.
//
// Firestore rules: collection group queries require a rules block that
// matches the path WITHOUT a parent. Update firestore.rules:
//
//     match /{path=**}/aiUsageMonthly/{monthKey} {
//       allow read: if isOwner();
//     }
//
// (The per-user wildcard at /users/{uid}/{document=**} keeps user-self
// read/write; this collection-group rule adds owner-can-query-across-all.)

import React, { useState, useEffect, useMemo } from 'react';
import { collectionGroup, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';

// Owner detection mirrors the pattern in App.jsx — env var of comma-
// separated emails. Kept here so this component is fully self-contained.
const OWNER_EMAILS = (import.meta.env.VITE_OWNER_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isCurrentUserOwner() {
  const email = auth.currentUser?.email?.toLowerCase();
  return !!(email && OWNER_EMAILS.includes(email));
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatUsd(n) {
  if (!Number.isFinite(n)) return '$0.00';
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
}

function formatNum(n) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-GB');
}

function truncateUid(uid) {
  if (!uid || uid.length < 8) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-3)}`;
}

export function AdminAiUsage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  const owner = isCurrentUserOwner();
  const monthKey = currentMonthKey();

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;

    (async () => {
      try {
        // Collection group query — finds every /users/*/aiUsageMonthly/*
        // doc across all users. Filtered client-side to current month
        // because rules don't permit indexing on doc ID for queries.
        const snap = await getDocs(collectionGroup(db, 'aiUsageMonthly'));
        if (cancelled) return;
        const all = snap.docs
          .map((d) => ({
            uid: d.ref.parent.parent?.id || 'unknown',
            month: d.id,
            ...d.data(),
          }))
          .filter((r) => r.month === monthKey);
        setRows(all);
      } catch (err) {
        if (!cancelled) setError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [owner, monthKey]);

  // Aggregates derived in render — small dataset so no perf concern
  const totals = useMemo(() => {
    let cost = 0;
    let calls = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    const byFeature = new Map();

    for (const r of rows) {
      cost += r.totalEstCostUsd || 0;
      calls += r.totalCalls || 0;
      inputTokens += r.totalInputTokens || 0;
      outputTokens += r.totalOutputTokens || 0;
      const features = r.byFeature || {};
      for (const [name, stats] of Object.entries(features)) {
        const acc = byFeature.get(name) || { calls: 0, estCostUsd: 0 };
        acc.calls += stats.calls || 0;
        acc.estCostUsd += stats.estCostUsd || 0;
        byFeature.set(name, acc);
      }
    }

    const featureList = [...byFeature.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.estCostUsd - a.estCostUsd);

    const userList = [...rows]
      .sort((a, b) => (b.totalEstCostUsd || 0) - (a.totalEstCostUsd || 0))
      .slice(0, 10);

    return { cost, calls, inputTokens, outputTokens, users: rows.length, featureList, userList };
  }, [rows]);

  if (!owner) return null;

  return (
    <section
      className="mx-auto"
      style={{
        maxWidth: 1080,
        padding: 'clamp(1.5rem, 3vw, 2.5rem)',
        marginBlock: '2rem',
        background: 'var(--atelier-cream, #F7F5F2)',
        border: '1px solid var(--atelier-stone-200, #e7e5e4)',
        borderRadius: 16,
      }}
    >
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 24,
              height: '1.5px',
              background: 'var(--atelier-brass-300, #D4B378)',
            }}
          />
          <p
            className="text-[10px] uppercase font-semibold"
            style={{ letterSpacing: '0.32em', color: 'var(--atelier-brass-600, #B0853A)' }}
          >
            Owner only · AI spend
          </p>
        </div>
        <h2
          style={{
            fontFamily: 'var(--atelier-font-display, Playfair Display, serif)',
            fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
            lineHeight: 1.1,
            color: 'var(--atelier-stone-900, #1c1917)',
            letterSpacing: '-0.01em',
          }}
        >
          The studio, by the meter — <em style={{ fontWeight: 400 }}>{monthKey}</em>.
        </h2>
      </header>

      {loading && (
        <p style={{ color: 'var(--atelier-stone-500, #78716c)', fontSize: 14 }}>
          Reading the usage log…
        </p>
      )}

      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b',
            fontSize: 13,
            marginBottom: '1.5rem',
          }}
        >
          <strong>Could not load.</strong> {error}
          <div style={{ marginTop: 6, fontSize: 12, color: '#7f1d1d' }}>
            If this is "Missing or insufficient permissions", deploy the
            collection-group rule for aiUsageMonthly. See the comment at the
            top of AdminAiUsage.jsx.
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Stat row ─────────────────────────────────────────────── */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-px mb-10"
            style={{
              background: 'var(--atelier-stone-200, #e7e5e4)',
              border: '1px solid var(--atelier-stone-200, #e7e5e4)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {[
              { label: 'Total spend', value: formatUsd(totals.cost) },
              { label: 'Total calls', value: formatNum(totals.calls) },
              { label: 'Active users', value: formatNum(totals.users) },
              {
                label: 'Avg / user',
                value: totals.users ? formatUsd(totals.cost / totals.users) : '—',
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: '#ffffff',
                  padding: '1.25rem 1.5rem',
                }}
              >
                <p
                  className="text-[10px] uppercase mb-2"
                  style={{ letterSpacing: '0.28em', color: 'var(--atelier-stone-500, #78716c)', fontWeight: 600 }}
                >
                  {s.label}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--atelier-font-display, Playfair Display, serif)',
                    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                    lineHeight: 1,
                    color: 'var(--atelier-stone-900, #1c1917)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── Two-column body: features (left) + users (right) ─────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Feature breakdown */}
            <div>
              <h3
                className="mb-4 text-[10px] uppercase font-semibold"
                style={{ letterSpacing: '0.32em', color: 'var(--atelier-stone-900, #1c1917)' }}
              >
                By feature
              </h3>
              {totals.featureList.length === 0 ? (
                <p style={{ color: 'var(--atelier-stone-500, #78716c)', fontSize: 13 }}>
                  No AI usage logged this month yet.
                </p>
              ) : (
                <ul style={{ borderTop: '1px solid var(--atelier-stone-200, #e7e5e4)' }}>
                  {totals.featureList.map((f) => {
                    const pct = totals.cost > 0 ? (f.estCostUsd / totals.cost) * 100 : 0;
                    return (
                      <li
                        key={f.name}
                        style={{
                          borderBottom: '1px solid var(--atelier-stone-200, #e7e5e4)',
                          paddingBlock: '0.85rem',
                          display: 'grid',
                          gridTemplateColumns: '1fr auto auto',
                          gap: '1rem',
                          alignItems: 'baseline',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontFamily: 'var(--atelier-font-display, Playfair Display, serif)',
                              fontSize: 14,
                              color: 'var(--atelier-stone-900, #1c1917)',
                              marginBottom: 4,
                            }}
                          >
                            {f.name}
                          </div>
                          {/* Mini bar showing share of total spend */}
                          <div
                            style={{
                              height: 3,
                              background: 'var(--atelier-stone-100, #f5f5f4)',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: 'var(--atelier-brass-600, #B0853A)',
                                transition: 'width 350ms ease',
                              }}
                            />
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--atelier-stone-500, #78716c)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatNum(f.calls)}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--atelier-stone-900, #1c1917)',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: '4.5ch',
                            textAlign: 'right',
                          }}
                        >
                          {formatUsd(f.estCostUsd)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Top users */}
            <div>
              <h3
                className="mb-4 text-[10px] uppercase font-semibold"
                style={{ letterSpacing: '0.32em', color: 'var(--atelier-stone-900, #1c1917)' }}
              >
                Top users
              </h3>
              {totals.userList.length === 0 ? (
                <p style={{ color: 'var(--atelier-stone-500, #78716c)', fontSize: 13 }}>
                  No users active this month yet.
                </p>
              ) : (
                <ul style={{ borderTop: '1px solid var(--atelier-stone-200, #e7e5e4)' }}>
                  {totals.userList.map((u, i) => {
                    const topFeature = u.byFeature
                      ? Object.entries(u.byFeature).sort((a, b) => (b[1].estCostUsd || 0) - (a[1].estCostUsd || 0))[0]?.[0]
                      : null;
                    return (
                      <li
                        key={u.uid}
                        style={{
                          borderBottom: '1px solid var(--atelier-stone-200, #e7e5e4)',
                          paddingBlock: '0.75rem',
                          display: 'grid',
                          gridTemplateColumns: '1.5rem 1fr auto auto',
                          gap: '0.75rem',
                          alignItems: 'baseline',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--atelier-font-display, Playfair Display, serif)',
                            fontStyle: 'italic',
                            fontSize: 13,
                            color: 'var(--atelier-brass-600, #B0853A)',
                          }}
                        >
                          {i + 1}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                              fontSize: 12,
                              color: 'var(--atelier-stone-900, #1c1917)',
                              marginBottom: 2,
                            }}
                            title={u.uid}
                          >
                            {truncateUid(u.uid)}
                          </div>
                          {topFeature && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--atelier-stone-500, #78716c)',
                                fontStyle: 'italic',
                              }}
                            >
                              top: {topFeature}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--atelier-stone-500, #78716c)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatNum(u.totalCalls || 0)}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--atelier-stone-900, #1c1917)',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: '4.5ch',
                            textAlign: 'right',
                          }}
                        >
                          {formatUsd(u.totalEstCostUsd || 0)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Token footnote */}
          <p
            className="mt-8 text-[11px] italic"
            style={{
              color: 'var(--atelier-stone-400, #a8a29e)',
              fontFamily: 'var(--atelier-font-display, Playfair Display, serif)',
              lineHeight: 1.55,
              textAlign: 'center',
            }}
          >
            {formatNum(totals.inputTokens)} input tokens · {formatNum(totals.outputTokens)} output tokens this month.
            Cost estimates use Gemini 2.5 Flash pricing ($0.30 / $2.50 per 1M tokens).
          </p>
        </>
      )}
    </section>
  );
}
