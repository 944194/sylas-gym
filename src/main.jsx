
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import App from './App.jsx';
import OwnerLogin from './owner/OwnerLogin.jsx';
import OwnerDashboard from './owner/OwnerDashboard.jsx';
import LoginSelection from './pages/LoginSelection.jsx';

import ClientRegister from './client/ClientRegister.jsx';
import ClientLogin from './client/ClientLogin.jsx';
import OwnerClients from './owner/OwnerClients.jsx';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />

        {/* Login selection */}
        <Route path="/login" element={<LoginSelection />} />

        {/* Owner routes */}
        <Route path="/owner" element={<Navigate to="/owner/login" replace />} />
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        <Route path="/owner/clients" element={<OwnerClients />} />

        {/* Client routes */}
        <Route path="/register" element={<ClientRegister />} />
        <Route path="/client/login" element={<ClientLogin />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
