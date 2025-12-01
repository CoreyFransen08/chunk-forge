import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from "./App";
import "./index.css";

export const createRoot = ViteReactSSG(
  { routes },
  ({ isClient }) => {
    // Custom setup logic
    if (isClient) {
      // Client-only initialization
    }
  }
);
