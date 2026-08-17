/**
 * Session and transient UI state: the signed-in user, the toast queue, the
 * right-hand drawer, and the confirm dialog.
 *
 * These replace the prototype's `toast()`, `drawer()`, `confirmBox()` and
 * `closeDrawer()` globals.
 *
 * There is no sign-in gate: the app opens straight onto the workspace as the
 * default user. The prototype's login screen only ever accepted any credentials,
 * so it gated nothing.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { initialsOf } from '@/data/presence';
import { db } from './db';
const UiContext = createContext(null);
const DEFAULT_USER = {
  name: 'Faisal Khan',
  email: 'fkhan@mcmgroup.com',
  initials: 'FK',
};
let toastSeq = 0;
export function UiProvider({ children }) {
  const [user, setUser] = useState(DEFAULT_USER);
  const [presence, setPresenceState] = useState('Available');
  const [toasts, setToasts] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const toast = useCallback((message) => {
    const id = ++toastSeq;
    setToasts((current) => [
      ...current,
      {
        id,
        message,
      },
    ]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 2600);
  }, []);
  /**
   * Switch the workspace to another person in the directory.
   *
   * With no login screen this is no longer an authentication step — it is how
   * the "signed in as" identity gets set, and it is what Sign out resets.
   */
  const switchUser = useCallback((email) => {
    const known = email ? db.users.find((u) => u.email === email) : undefined;
    if (!known) {
      setUser(DEFAULT_USER);
      return;
    }
    setUser({
      name: known.name,
      email: known.email,
      initials: initialsOf(known.name),
    });
  }, []);
  const signOut = useCallback(() => {
    setUser(DEFAULT_USER);
    setDrawer(null);
    setPresenceState('Available');
  }, []);
  const setPresence = useCallback((next) => setPresenceState(next), []);
  const openDrawer = useCallback((request) => setDrawer(request), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const confirmBox = useCallback((message, onConfirm) => {
    setConfirmRequest({
      message,
      onConfirm,
    });
  }, []);
  const resolveConfirm = useCallback((accepted) => {
    setConfirmRequest((current) => {
      if (accepted && current) current.onConfirm();
      return null;
    });
  }, []);
  const value = useMemo(
    () => ({
      user,
      presence,
      switchUser,
      signOut,
      setPresence,
      toasts,
      toast,
      drawer,
      openDrawer,
      closeDrawer,
      confirmRequest,
      confirmBox,
      resolveConfirm,
    }),
    [
      user,
      presence,
      switchUser,
      signOut,
      setPresence,
      toasts,
      toast,
      drawer,
      openDrawer,
      closeDrawer,
      confirmRequest,
      confirmBox,
      resolveConfirm,
    ]
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}
export function useUi() {
  const context = useContext(UiContext);
  if (!context) throw new Error('useUi must be used inside <UiProvider>');
  return context;
}
