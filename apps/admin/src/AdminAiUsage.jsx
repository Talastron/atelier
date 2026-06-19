// apps/admin/src/AdminAiUsage.jsx
//
// AI spend dashboard. Reads /users/*/aiUsageMonthly via a Firestore
// collection group query, aggregates per-user and per-feature stats for
// the current month, renders as an editorial dashboard.
//
// This is the admin-app version. The consumer app has a separate copy
// (`src/AdminAiUsage.jsx` in the wardrobe app) which can be deleted once
// this admin app is the only place the dashboard is mounted. They differ
// only in import paths (own ./firebase.js) and the self-gate (admin app
// gates at the parent App.jsx level, so this version trusts its parent).
//
// Firestore rules required (already deployed):
//
//   match /{path=**}/aiUsageMonthly/{monthKey} {
//     allow read: if isOwner();
//   }
//
// The {path=**} wildcard is required for collection group queries to work.

import React, { useState, useEffect, useMemo } from 'react';
import { collectionGroup, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatUsd(n) {
  if (!Number.isFinite(n)) return '$0.00';
  if (n < 0.01 && n > 0) return '<$0.01';
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

  const monthKey = currentMonthKey();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
  }, [monthKey]);

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

  return (
    <section>
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span aria-hidden="true" className="inline-block" style={{ width: 24, height: '1.5px', background: 'var(--atelier-brass-300)' }} />
          <p
            className="text-[10px] uppercase font-semibold"
            style={{ letterSpacing: '0.32em', color: 'var(--atelier-brass-600)' }}
          >
            AI spend · {monthKey}
          </p>
        </div>
        <h2
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            lineHeight: 1.1,
            color: 'var(--atelier-stone-900)',
            letterSpacing: '-0.01em',
          }}
        >
          The studio, <em style={{ fontWeight: 400 }}>by the meter</em>.
        </h2>
      </header>

      {loading && (
        <p style={{ color: 'var(--atelier-stone-500)', fontSize: 14 }}>
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
            If this is "Missing or insufficient permissions", the
            collection-group rule for aiUsageMonthly may not be deployed.
            See firestore.rules in the wardrobe app.
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stat row */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-px mb-10"
            style={{
              background: 'var(--atelier-stone-200)',
              border: '1px solid var(--atelier-stone-200)',
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
              <div key={s.label} style={{ background: '#ffffff', padding: '1.25rem 1.5rem' }}>
                <p
                  className="text-[10px] uppercase mb-2"
                  style={{ letterSpacing: '0.28em', color: 'var(--atelier-stone-500)', fontWeight: 600 }}
                >
                  {s.label}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--atelier-font-display)',
                    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                    lineHeight: 1,
                    color: 'var(--atelier-stone-900)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Two-column body: features (left) + users (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Feature breakdown */}
            <div>
              <h3
                className="mb-4 text-[10px] uppercase font-semibold"
                style={{ letterSpacing: '0.32em', color: 'var(--atelier-stone-900)' }}
              >
                By feature
              </h3>
              {totals.featureList.length === 0 ? (
                <p style={{ color: 'var(--atelier-stone-500)', fontSize: 13 }}>
                  No AI usage logged this month yet.
                </p>
              ) : (
                <ul style={{ borderTop: '1px solid var(--atelier-stone-200)' }}>
                  {totals.featureList.map((f) => {
                    const pct = totals.cost > 0 ? (f.estCostUsd / totals.cost) * 100 : 0;
                    return (
                      <li
                        key={f.name}
                        style={{
                          borderBottom: '1px solid var(--atelier-stone-200)',
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
                              fontFamily: 'var(--atelier-font-display)',
                              fontSize: 14,
                              color: 'var(--atelier-stone-900)',
                              marginBottom: 4,
                            }}
                          >
                            {f.name}
                          </div>
                          <div
                            style={{
                              height: 3,
                              background: 'var(--atelier-stone-100)',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: 'var(--atelier-brass-600)',
                                transition: 'width 350ms ease',
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--atelier-stone-500)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatNum(f.calls)}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--atelier-stone-900)',
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
                style={{ letterSpacing: '0.32em', color: 'var(--atelier-stone-900)' }}
              >
                Top users
              </h3>
              {totals.userList.length === 0 ? (
                <p style={{ color: 'var(--atelier-stone-500)', fontSize: 13 }}>
                  No users active this month yet.
                </p>
              ) : (
                <ul style={{ borderTop: '1px solid var(--atelier-stone-200)' }}>
                  {totals.userList.map((u, i) => {
                    const topFeature = u.byFeature
                      ? Object.entries(u.byFeature).sort((a, b) => (b[1].estCostUsd || 0) - (a[1].estCostUsd || 0))[0]?.[0]
                      : null;
                    return (
                      <li
                        key={u.uid}
                        style={{
                          borderBottom: '1px solid var(--atelier-stone-200)',
                          paddingBlock: '0.75rem',
                          display: 'grid',
                          gridTemplateColumns: '1.5rem 1fr auto auto',
                          gap: '0.75rem',
                          alignItems: 'baseline',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--atelier-font-display)',
                            fontStyle: 'italic',
                            fontSize: 13,
                            color: 'var(--atelier-brass-600)',
                          }}
                        >
                          {i + 1}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                              fontSize: 12,
                              color: 'var(--atelier-stone-900)',
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
                                color: 'var(--atelier-stone-500)',
                                fontStyle: 'italic',
                              }}
                            >
                              top: {topFeature}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--atelier-stone-500)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatNum(u.totalCalls || 0)}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--atelier-stone-900)',
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

          <p
            className="mt-8 text-[11px] italic"
            style={{
              color: 'var(--atelier-stone-400)',
              fontFamily: 'var(--atelier-font-display)',
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
