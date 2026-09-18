import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import AdminPanel from './AdminPanel.jsx'
import Stats from './Stats.jsx'
import Prices from './Prices.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/prices" element={<Prices />} />
    </Routes>
  </HashRouter>
)
