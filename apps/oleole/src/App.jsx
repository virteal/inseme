import { Routes, Route } from "react-router-dom";
import { OleoleHome } from "@inseme/brique-oleole";

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<OleoleHome />} />
    </Routes>
  );
}
