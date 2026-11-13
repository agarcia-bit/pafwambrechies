import { createRoot } from 'react-dom/client';

import { App } from './App';
import { FiletDErreur } from './FiletDErreur';
import './styles.css';

createRoot(document.getElementById('root')!).render(<FiletDErreur><App /></FiletDErreur>);
