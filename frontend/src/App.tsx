import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/Home/HomePage'
import { RunPage } from './pages/Run/RunPage'
import { ApprovalPage } from './pages/Approval/ApprovalPage'
import { ResultPage } from './pages/Result/ResultPage'
export default function App() { return <BrowserRouter><AppShell><Routes><Route path="/" element={<HomePage/>}/><Route path="/run/:runId" element={<RunPage/>}/><Route path="/run/:runId/approval" element={<ApprovalPage/>}/><Route path="/run/:runId/result" element={<ResultPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></AppShell></BrowserRouter> }
