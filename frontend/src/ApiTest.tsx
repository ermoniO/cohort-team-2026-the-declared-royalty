import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ApiTest from "./components/ApiTest";

createRoot(document.getElementById("apitest-root")!).render(
  <StrictMode>
    <ApiTest />
  </StrictMode>
);
