import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cx } from "@/lib/ui/cx";
import { formatMetricValue, getOrdinalWeight } from "@/lib/analysis/metrics";

type Tone = "accent" | "success" | "warning" | "danger" | "surface";

export function MetricBarChart({
  title,
  description,
  items,
  eyebrow,
  footer,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  footer?: string;
  items: Array<{
    label: string;
    detail?: string;
    valueLabel: string;
    ratio: number;
    tone?: Tone;
    badge?: string;
  }>;
}) {
  return (
    <SectionCard
      className="analysis-surface"
      eyebrow={eyebrow}
      title={title}
      description={description}
      size="compact"
    >
      <div className="analysis-stack">
        <div className="analysis-bar-list">
          {items.map((item) => (
            <div key={`${item.label}-${item.valueLabel}`} className="analysis-bar-row">
              <div className="analysis-bar-row__meta">
                <div>
                  <div className="analysis-bar-row__label">{item.label}</div>
                  {item.detail ? <div className="analysis-bar-row__detail">{item.detail}</div> : null}
                </div>
                <div className="analysis-bar-row__value">
                  {item.badge ? <StatusBadge tone={item.tone ?? "surface"}>{item.badge}</StatusBadge> : null}
                  <span>{item.valueLabel}</span>
                </div>
              </div>
              <div className="analysis-bar-track">
                <div
                  className={cx("analysis-bar-fill", item.tone && `analysis-bar-fill--${item.tone}`)}
                  style={{ width: `${Math.max(0, Math.min(1, item.ratio)) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {footer ? <div className="field-help">{footer}</div> : null}
      </div>
    </SectionCard>
  );
}

export function StackedCompositionChart({
  title,
  description,
  segments,
  eyebrow,
  footer,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  footer?: string;
  segments: Array<{
    label: string;
    value: number | null;
    tone?: Tone;
  }>;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value ?? 0), 0);

  return (
    <SectionCard
      className="analysis-surface"
      eyebrow={eyebrow}
      title={title}
      description={description}
      size="compact"
    >
      <div className="analysis-stack">
        <div className="analysis-stack-bar" aria-hidden="true">
          {segments.map((segment) => {
            const value = Math.max(0, segment.value ?? 0);
            const width = total > 0 ? (value / total) * 100 : 0;

            return (
              <div
                key={segment.label}
                className={cx("analysis-stack-bar__segment", segment.tone && `analysis-stack-bar__segment--${segment.tone}`)}
                style={{ width: `${width}%` }}
              />
            );
          })}
        </div>

        <div className="analysis-legend">
          {segments.map((segment) => {
            const value = Math.max(0, segment.value ?? 0);
            const share = total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";

            return (
              <div key={segment.label} className="analysis-legend__item">
                <div className="analysis-legend__meta">
                  <span className={cx("analysis-dot", segment.tone && `analysis-dot--${segment.tone}`)} />
                  <span className="analysis-legend__label">{segment.label}</span>
                </div>
                <div className="analysis-legend__value">
                  {formatMetricValue(segment.value)}
                  <span className="analysis-legend__share">{share}</span>
                </div>
              </div>
            );
          })}
        </div>
        {footer ? <div className="field-help">{footer}</div> : null}
      </div>
    </SectionCard>
  );
}

export function OrderedInsightChart({
  title,
  description,
  items,
  eyebrow,
  tone = "accent",
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  tone?: Tone;
  items: string[];
}) {
  return (
    <SectionCard
      className="analysis-surface"
      eyebrow={eyebrow}
      title={title}
      description={description}
      size="compact"
    >
      {items.length ? (
        <div className="analysis-stack">
          {items.map((item, index) => (
            <div key={item} className="analysis-rank-row">
              <div className="analysis-rank-row__meta">
                <span className="analysis-rank-row__index">{index + 1}</span>
                <span className="analysis-rank-row__text">{item}</span>
              </div>
              <div className="analysis-rank-track">
                <div
                  className={cx("analysis-rank-fill", tone && `analysis-rank-fill--${tone}`)}
                  style={{ width: `${getOrdinalWeight(index, items.length) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="field-help">No chartable interpretation items yet.</div>
      )}
    </SectionCard>
  );
}
