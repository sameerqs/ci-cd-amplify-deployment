"use client";

import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { clearAccessToken, getAccessToken } from "@/lib/auth/auth-client";
import { needsRenewal, renewSession } from "@/lib/auth/renew-session";
import { revokeSession } from "@/lib/auth/session-api";
import { getSessionUser } from "@/lib/auth/session-user";
import type { SessionUser } from "@/lib/auth/session-user";

type User = SessionUser;

export interface AuthContextType {
	user: User | null;
	/** True until the initial session bootstrap (silent refresh + profile fetch) resolves. */
	loading: boolean;
	/**
	 * Adopt the session a sign-in or onboarding flow has just established. The
	 * access token is already in memory by then — this only re-fetches the
	 * profile, which is why it takes no token: a Cognito access token carries
	 * no identity to read. Returns the resolved user so a caller that needs it
	 * immediately (e.g. to pick a landing screen) doesn't have to wait on a
	 * re-render.
	 */
	adoptSession: () => Promise<User | null>;
	logout: () => Promise<void>;
}

interface AuthProviderProps {
	children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: AuthProviderProps) => {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	// why: the bootstrap below runs in parallel with whatever the first screen
	// does. On the magic-link screen that is a sign-in, which can finish before
	// the bootstrap's own (cookie-less, so empty) answer arrives. Any explicit
	// session change bumps this, and a bootstrap that started earlier then
	// leaves `user` alone instead of overwriting it with its stale result.
	const epoch = useRef(0);

	const adoptSession = useCallback(async () => {
		epoch.current += 1;
		const sessionUser = await getSessionUser();
		setUser(sessionUser);
		setLoading(false);
		return sessionUser;
	}, []);

	const logout = useCallback(async () => {
		epoch.current += 1;
		setUser(null);
		await revokeSession();
		clearAccessToken();
	}, []);

	// why: a static export has no server left to seed this with a request-time
	// user, so every page load bootstraps from scratch here instead — spend the
	// httpOnly `sessionId` cookie for a fresh access token (silently signed out
	// if there isn't one, or it's been revoked), then resolve the profile it
	// belongs to. The root layout never remounts on a client-side navigation,
	// so this runs once per page load, not once per route.
	useEffect(() => {
		const startedAt = epoch.current;
		let cancelled = false;
		void (async () => {
			let token = getAccessToken();
			if (needsRenewal(token)) {
				const renewal = await renewSession();
				token = renewal.action === "renewed" ? renewal.accessToken : null;
			}
			const sessionUser = token ? await getSessionUser() : null;
			if (cancelled) return;
			if (epoch.current === startedAt) setUser(sessionUser);
			setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// why: without this the provider hands every consumer a new object on each
	// render, so a keystroke anywhere re-renders the sidebar, the header and
	// every guard.
	const value = useMemo(
		() => ({ user, loading, adoptSession, logout }),
		[user, loading, adoptSession, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used within AuthProvider");
	return context;
};
