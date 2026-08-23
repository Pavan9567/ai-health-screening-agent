import {
  AlertCircle,
  Clock3,
  HeartPulse,
  Stethoscope,
} from "lucide-react";

export interface HealthReportData {
  mainConcern: string;
  symptoms: string[];
  duration: string;
  severity: string;
  followUp: string;
}

interface HealthReportProps {
  report: HealthReportData;
}

function HealthReport({ report }: HealthReportProps) {
  return (
    <section className="report-panel">
      <div className="report-header">
        <div>
          <p className="panel-eyebrow">SCREENING COMPLETE</p>
          <h2>Health Screening Report</h2>
        </div>

        <HeartPulse size={28} />
      </div>

      <div className="report-grid">
        <div className="report-card">
          <Stethoscope size={20} />
          <span>Main Concern</span>
          <strong>{report.mainConcern || "Not provided"}</strong>
        </div>

        <div className="report-card">
          <Clock3 size={20} />
          <span>Duration</span>
          <strong>{report.duration || "Not provided"}</strong>
        </div>

        <div className="report-card">
          <HeartPulse size={20} />
          <span>Severity</span>
          <strong>{report.severity || "Not provided"}</strong>
        </div>

        <div className="report-card">
          <AlertCircle size={20} />
          <span>Follow-up</span>
          <strong>{report.followUp || "None recorded"}</strong>
        </div>
      </div>

      <div className="symptoms-section">
        <h3>Key Symptoms</h3>

        {report.symptoms.length === 0 ? (
          <p>No symptoms were recorded.</p>
        ) : (
          <ul>
            {report.symptoms.map((symptom) => (
              <li key={symptom}>{symptom}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="report-disclaimer">
        This report summarizes information provided during the screening
        conversation. It is not a medical diagnosis.
      </div>
    </section>
  );
}

export default HealthReport;