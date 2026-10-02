import {
  Clock3,
  HeartPulse,
  Stethoscope,
  User,
} from "lucide-react";

import type { HealthScreeningReport } from "../types/call";

interface HealthReportProps {
  report: HealthScreeningReport;
}

function HealthReport({
  report,
}: HealthReportProps) {
  return (
    <section className="report-panel">
      <div className="report-header">
        <div>
          <p className="panel-eyebrow">
            SCREENING COMPLETE
          </p>

          <h2>
            Health Screening Report
          </h2>
        </div>

        <HeartPulse size={28} />
      </div>

      <div className="report-grid">
        <div className="report-card">
          <User size={20} />

          <span>Name</span>

          <strong>
            {report.name ||
              "Not provided"}
          </strong>
        </div>

        <div className="report-card">
          <Stethoscope size={20} />

          <span>Main Concern</span>

          <strong>
            {report.mainConcern ||
              "Not provided"}
          </strong>
        </div>

        <div className="report-card">
          <Clock3 size={20} />

          <span>Duration</span>

          <strong>
            {report.duration ||
              "Not provided"}
          </strong>
        </div>

        <div className="report-card">
          <HeartPulse size={20} />

          <span>Severity</span>

          <strong>
            {report.severity ||
              "Not provided"}
          </strong>
        </div>
      </div>

      <div className="symptoms-section">
        <h3>Key Symptoms</h3>

        {report.symptoms.length === 0 ? (
          <p>
            No symptoms were recorded.
          </p>
        ) : (
          <ul>
            {report.symptoms.map(
              (symptom) => (
                <li key={symptom}>
                  {symptom}
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <div className="symptoms-section">
        <h3>Related Symptoms</h3>

        {report.relatedSymptoms.length ===
        0 ? (
          <p>
            No related symptoms were
            recorded.
          </p>
        ) : (
          <ul>
            {report.relatedSymptoms.map(
              (symptom) => (
                <li key={symptom}>
                  {symptom}
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <div className="symptoms-section">
        <h3>Follow-up Flags</h3>

        {report.followUpFlags.length ===
        0 ? (
          <p>
            No follow-up flags were
            recorded.
          </p>
        ) : (
          <ul>
            {report.followUpFlags.map(
              (flag) => (
                <li key={flag}>
                  {flag}
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <div className="report-summary">
        <h3>Screening Summary</h3>

        <p>
          {report.summary ||
            "No summary was generated."}
        </p>
      </div>

      <div className="report-disclaimer">
        {report.disclaimer}
      </div>
    </section>
  );
}

export default HealthReport;