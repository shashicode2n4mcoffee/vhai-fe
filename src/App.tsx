/**
 * App — Root component with React Router routes.
 *
 * Route map:
 *   /                        → HomePage (public)
 *   /login                   → LoginPage (public)
 *   /signup                  → SignupPage (public)
 *   /dashboard               → Dashboard (protected)
 *   /profile                 → ProfilePage (protected)
 *   /settings                → SettingsPage (protected)
 *   /interview/new           → TemplateForm (protected)
 *   /interview/session       → VoiceChat (protected, requires template)
 *   /interview/report        → ConversationReport (protected, requires transcript)
 *   /interview/report/:id    → InterviewReportView (protected)
 *   /aptitude                → AptitudeTest (protected)
 *   /aptitude/report/:id     → AptitudeReportView (protected)
 *   /coding                  → CodingTest (protected)
 *   /coding/report/:id       → CodingReportView (protected)
 *   /admin/users             → AdminUsersPage (admin/manager/college)
 *   /admin/assignments       → AdminAssignmentsPage (admin/manager/college)
 */

import { Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./components/HomePage";
import { LoginPage } from "./components/LoginPage";
import { SignupPage } from "./components/SignupPage";
import { Dashboard } from "./components/Dashboard";
import { ProfilePage } from "./components/ProfilePage";
import { SettingsPage } from "./components/SettingsPage";
import { TemplateForm } from "./components/TemplateForm";
import { VoiceChat } from "./components/VoiceChat";
import { ConversationReport } from "./components/ConversationReport";
import { AptitudeTest } from "./components/AptitudeTest";
import { CodingTest } from "./components/CodingTest";
import { InterviewReportView } from "./components/InterviewReportView";
import { AptitudeReportView } from "./components/AptitudeReportView";
import { CodingReportView } from "./components/CodingReportView";
import { AdminUsersPage } from "./components/AdminUsersPage";
import { AdminAssignmentsPage } from "./components/AdminAssignmentsPage";
import { AdminTemplatesPage } from "./components/AdminTemplatesPage";
import { AdminErrorsPage } from "./components/AdminErrorsPage";
import { PricingPage } from "./components/PricingPage";
import { BillingPage } from "./components/BillingPage";
import { CodingQuestionsPage } from "./components/CodingQuestionsPage";
import { CodingQuestionDetailPage } from "./components/CodingQuestionDetailPage";
import { ProfessionalInterviewSession } from "./components/ProfessionalInterviewSession";
import { ProfessionalConsentPage } from "./components/ProfessionalConsentPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { ToastProvider } from "./components/Toast";
import "./App.css";

export default function App() {
  return (
    <ToastProvider>
      <div className="app">
        <Routes>
          {/* ---- Public routes ---- */}
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* ---- Protected routes (all roles) ---- */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/interview/new" element={<TemplateForm />} />
            <Route path="/interview/session" element={<VoiceChat />} />
            <Route path="/interview/report" element={<ConversationReport />} />
            <Route path="/interview/report/:id" element={<InterviewReportView />} />
            <Route path="/interview/professional" element={<Navigate to="/interview/professional/new" replace />} />
            <Route path="/interview/professional/new" element={<TemplateForm variant="professional" />} />
            <Route path="/interview/professional/consent" element={<ProfessionalConsentPage />} />
            <Route path="/interview/professional/session" element={<ProfessionalInterviewSession />} />
            <Route path="/aptitude" element={<AptitudeTest />} />
            <Route path="/aptitude/report/:id" element={<AptitudeReportView />} />
            <Route path="/coding" element={<CodingTest />} />
            <Route path="/coding/report/:id" element={<CodingReportView />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/questions" element={<CodingQuestionsPage />} />
            <Route path="/questions/:id" element={<CodingQuestionDetailPage />} />
          </Route>

          {/* ---- Admin/Manager routes ---- */}
          <Route element={<ProtectedRoute allowedRoles={["ADMIN", "HIRING_MANAGER", "COLLEGE"]} />}>
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/assignments" element={<AdminAssignmentsPage />} />
            <Route path="/admin/templates" element={<AdminTemplatesPage />} />
          </Route>
          {/* ---- Admin-only: Error log ---- */}
          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route path="/admin/errors" element={<AdminErrorsPage />} />
          </Route>

          {/* ---- Fallback ---- */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ToastProvider>
  );
}
