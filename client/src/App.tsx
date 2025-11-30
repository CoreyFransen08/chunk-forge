import type { RouteRecord } from 'vite-react-ssg';
import { Outlet, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Editor from "@/pages/editor";
import SchemasPage from "@/pages/schemas";
import NotFound from "@/pages/not-found";

function AppLayout() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Outlet />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'editor/:id',
        element: <Editor />,
      },
      {
        path: 'schemas',
        element: <SchemasPage />,
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export default AppLayout;
