import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import MealPlan from "./pages/MealPlan";
import Workout from "./pages/Workout";
import Progress from "./pages/Progress";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="meal-plan" element={<MealPlan />} />
        <Route path="workout" element={<Workout />} />
        <Route path="progress" element={<Progress />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}
