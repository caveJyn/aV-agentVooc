import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { doesSessionExist } from "supertokens-web-js/recipe/session";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        async function checkSession() {
            const sessionExists = await doesSessionExist();
            setIsAuthenticated(sessionExists);
        }
        checkSession();
    }, []);

    if (isAuthenticated === null) {
        return <div>Loading...</div>;
    }

    return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
}