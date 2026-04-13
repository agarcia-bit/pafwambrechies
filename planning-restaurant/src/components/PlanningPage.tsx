import { useState } from 'react';
import type { Employee, WeekConfig, EmployeeRole } from '../domain/types';
import { usePlanning } from '../hooks/usePlanning';
import { WeeklyGrid } from './WeeklyGrid';
import { RevenuePanel } from './RevenuePanel';
import { ProductivityIndicator } from './ProductivityIndicator';
import { MinStaffOverride } from './MinStaffOverride';

interface Props {
  employees: Employee[];
  weekConfig: WeekConfig;
}

export function PlanningPage({ employees, weekConfig }: Props) {
  const planning = usePlanning(employees, weekConfig);
  const [activeTab, setActiveTab] = useState<EmployeeRole>('salle');
  const [showConfig, setShowConfig] = useState(false);

  const salleWarnings = planning.result.warnings.filter(
    (w) => !w.toLowerCase().includes('cuisine'),
  );
  const cuisineWarnings = planning.result.warnings.filter(
    (w) => w.toLowerCase().includes('cuisine') || activeTab === 'cuisine',
  );
  const warnings = activeTab === 'salle' ? salleWarnings : cuisineWarnings;

  return (
    <div className="planning-page">
      {/* Header */}
      <header className="planning-page__header">
        <h1>Planning Restaurant</h1>
        <div className="planning-page__actions">
          <button
            className="btn btn--secondary"
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? 'Masquer config' : 'Configuration'}
          </button>
          <button className="btn btn--primary" onClick={planning.regenerate}>
            Regénérer le planning
          </button>
        </div>
      </header>

      {/* Productivity indicator */}
      <ProductivityIndicator metrics={planning.result.productivity} />

      {/* Configuration panel (collapsible) */}
      {showConfig && (
        <div className="planning-page__config">
          <RevenuePanel
            weekConfig={planning.weekConfig}
            onBaseRevenueChange={planning.updateBaseRevenue}
            onDayPctChange={planning.updateDayRevenuePct}
          />
          <MinStaffOverride
            weekConfig={planning.weekConfig}
            onMinStaffChange={planning.updateMinStaff}
            onDefaultChange={planning.updateDefaultMinStaff}
          />
        </div>
      )}

      {/* Warnings */}
      {planning.result.warnings.length > 0 && (
        <div className="planning-page__warnings">
          {planning.result.warnings.map((w, i) => (
            <div key={i} className="planning-page__warning">{w}</div>
          ))}
        </div>
      )}

      {/* Tab bar: Salle / Cuisine */}
      <nav className="planning-page__tabs">
        <button
          className={`planning-page__tab ${activeTab === 'salle' ? 'active' : ''}`}
          onClick={() => setActiveTab('salle')}
        >
          Salle ({planning.employees.filter((e) => e.role === 'salle').length})
        </button>
        <button
          className={`planning-page__tab ${activeTab === 'cuisine' ? 'active' : ''}`}
          onClick={() => setActiveTab('cuisine')}
        >
          Cuisine ({planning.employees.filter((e) => e.role === 'cuisine').length})
        </button>
      </nav>

      {/* Weekly grid */}
      <WeeklyGrid
        role={activeTab}
        employees={planning.employees}
        assignments={planning.assignments}
        summaries={planning.result.employeeSummaries}
        weekConfig={planning.weekConfig}
        onChangeShift={planning.updateShift}
        onRemoveShift={planning.removeShift}
        onAddShift={planning.addShift}
      />

      {/* Employee summaries */}
      <div className="planning-page__summaries">
        <h3>Récapitulatif heures ({activeTab === 'salle' ? 'Salle' : 'Cuisine'})</h3>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Employé</th>
              <th>Contrat</th>
              <th>Planifié</th>
              <th>Écart</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {planning.result.employeeSummaries
              .filter((s) => s.role === activeTab)
              .map((s) => (
                <tr
                  key={s.employeeId}
                  className={s.belowContract ? 'summary-table__row--warning' : ''}
                >
                  <td>{s.employeeName}</td>
                  <td>{s.contractHours}h</td>
                  <td>{s.scheduledHours.toFixed(1)}h</td>
                  <td
                    className={
                      s.delta > 0
                        ? 'positive'
                        : s.delta < 0
                          ? 'negative'
                          : ''
                    }
                  >
                    {s.delta > 0 ? '+' : ''}
                    {s.delta.toFixed(1)}h
                  </td>
                  <td>
                    {s.belowContract ? (
                      <span className="badge badge--danger">Sous contrat</span>
                    ) : s.delta > 0 ? (
                      <span className="badge badge--info">Heures sup</span>
                    ) : (
                      <span className="badge badge--ok">OK</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {warnings.length > 0 && null}
    </div>
  );
}
