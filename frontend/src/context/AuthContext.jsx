// AuthContext.jsx
import { createContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode"; // <--- CHANGE THIS LINE
import api from "../api/apiClient";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, name, email, role }
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const decoded = jwtDecode(token); // This line is correct with the named import
        const res = await api.get("/auth/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.valid) {
          setUser({
            id: decoded.id,
            name: decoded.name,
            email: decoded.email,
            role: decoded.role,
          });
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem("token");
        }
      } catch {
        setUser(null);
        setToken(null);
        localStorage.removeItem("token");
      }
    };

    verifyUser();
  }, [token]);

  const login = (token) => {
    localStorage.setItem("token", token);
    setToken(token);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}