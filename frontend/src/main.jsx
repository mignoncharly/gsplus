import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import LocaleProvider from './components/LocaleProvider.jsx';
import './index.css';

document.getElementById('phase10-static-shell')?.remove();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider><App /></LocaleProvider>
  </React.StrictMode>,
)
