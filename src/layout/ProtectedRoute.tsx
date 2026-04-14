import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, openAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      openAuth("login");
      navigate("/", { replace: true });
    }
  }, [user, openAuth, navigate]);

  if (!user) return null;
  return <>{children}</>;
}
