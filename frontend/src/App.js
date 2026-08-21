import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { api, messageFor, SESSION_KEY } from "@/api";
import { Shell } from "@/components/Shell";
import { ErrorState, LoadingState } from "@/components/primitives";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import DependencyMap from "@/pages/DependencyMap";
import People from "@/pages/People";
import HumanManual from "@/pages/HumanManual";
import Simulator from "@/pages/Simulator";
import ActionCenter from "@/pages/ActionCenter";
import SharedScenario from "@/pages/SharedScenario";
import "@/App.css";

function Workspace() {
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const hasToken = Boolean(localStorage.getItem(SESSION_KEY));

  useEffect(() => {
    if (!hasToken) return;
    api
      .get("/auth/me")
      .then((response) => setSession(response.data))
      .catch((err) => setError(messageFor(err)));
  }, [hasToken]);

  if (!hasToken) return <Navigate to="/login" replace />;
  if (error) return <ErrorState message={error} />;
  if (!session) return <LoadingState />;

  return (
    <Shell organization={session.organization} user={session.user}>
      <Outlet />
    </Shell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster theme="dark" position="bottom-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/bagikan/:token" element={<SharedScenario />} />
        <Route element={<Workspace />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/map" element={<DependencyMap />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:personId" element={<HumanManual />} />
          <Route path="/simulate/:personId" element={<Simulator />} />
          <Route path="/actions" element={<ActionCenter />} />
        </Route>
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
