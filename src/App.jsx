import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { DailyLogProvider } from "./context/DailyLogContext";
import { AppDataProvider } from "./context/AppDataContext";
import { BodyProvider } from "./context/BodyContext";
import { GuestOnly, RequireAuth, RequireRole } from "./components/RouteGuards";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import CheckIn from "./pages/CheckIn";
import AdminClient from "./pages/admin/AdminClient";
import Dashboard from "./pages/Dashboard";
import MealPlan from "./pages/MealPlan";
import Workout from "./pages/Workout";
import Progress from "./pages/Progress";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMenu from "./pages/admin/AdminMenu";
import AdminWorkouts from "./pages/admin/AdminWorkouts";
import AdminContent from "./pages/admin/AdminContent";

export default function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <BodyProvider>
        <DailyLogProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/app" element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="meal-plan" element={<MealPlan />} />
              <Route path="workout" element={<Workout />} />
              <Route path="progress" element={<Progress />} />
              <Route path="check-in" element={<CheckIn />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="/admin" element={<RequireRole roles={["admin", "coach"]}><AdminLayout /></RequireRole>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:id" element={<AdminClient />} />
              <Route path="menu" element={<AdminMenu />} />
              <Route path="workouts" element={<AdminWorkouts />} />
              <Route path="content" element={<RequireRole roles={["admin"]}><AdminContent /></RequireRole>} />
            </Route>
          </Routes>
        </DailyLogProvider>
        </BodyProvider>
      </AppDataProvider>
    </AuthProvider>
  );
}
