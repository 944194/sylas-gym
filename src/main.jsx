import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import App from './App.jsx';
import OwnerLogin from './owner/OwnerLogin.jsx';
import OwnerDashboard from './owner/OwnerDashboard.jsx';
import OwnerClients from './owner/OwnerClients.jsx';
import MobileLogin from './pages/MobileLogin.jsx';

import UserRegister from './user/UserRegister.jsx';
import UserDashboard from './user/UserDashboard.jsx';
import ClientDashboard from './client/ClientDashboard.jsx';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<MobileLogin />} />

        <Route path="/owner" element={<Navigate to="/owner/login" replace />} />
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        <Route path="/owner/clients" element={<OwnerClients />} />
        <Route path="/owner/clients/:clientId" element={<OwnerClients />} />

        <Route path="/register" element={<UserRegister />} />
        <Route path="/user/dashboard" element={<UserDashboard />} />
        <Route path="/client/dashboard" element={<ClientDashboard />} />

        <Route path="/user/login" element={<Navigate to="/login" replace />} />
        <Route path="/client/login" element={<Navigate to="/login" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
