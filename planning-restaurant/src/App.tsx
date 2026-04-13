import { PlanningPage } from './components/PlanningPage';
import { SAMPLE_EMPLOYEES, SAMPLE_WEEK_CONFIG } from './data/sampleData';
import './App.css';

export default function App() {
  return (
    <PlanningPage
      employees={SAMPLE_EMPLOYEES}
      weekConfig={SAMPLE_WEEK_CONFIG}
    />
  );
}
