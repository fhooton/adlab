import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider, RequireAuth } from "./auth";
import { ToastProvider } from "./feedback";
import { Shell } from "./shell";
import { ActivityView } from "./views/Activity";
import { ApprovalsView } from "./views/Approvals";
import { BriefDetailView, BriefsView } from "./views/Briefs";
import { LearningsView } from "./views/Learnings";
import { LoginView } from "./views/Login";
import { NotFound } from "./views/NotFound";
import { OverviewView } from "./views/Overview";
import { TestDetailView, TestsView } from "./views/Tests";
import { VariantDetailView, VariantsView } from "./views/Variants";

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route
              element={
                <RequireAuth>
                  <Shell />
                </RequireAuth>
              }
            >
              <Route index element={<OverviewView />} />
              <Route path="briefs" element={<BriefsView />} />
              <Route path="briefs/:id" element={<BriefDetailView />} />
              <Route path="variants" element={<VariantsView />} />
              <Route path="variants/:id" element={<VariantDetailView />} />
              <Route path="tests" element={<TestsView />} />
              <Route path="tests/:id" element={<TestDetailView />} />
              <Route path="approvals" element={<ApprovalsView />} />
              <Route path="activity" element={<ActivityView />} />
              <Route path="learnings" element={<LearningsView />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
