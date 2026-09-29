import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  dayInZone,
  type Dashboard,
  type Completion,
  type AssessmentResponse,
  type Session,
} from '@rehab/core';
export type Job = { id: string; path: string; body: any; method: 'POST' | 'PATCH'; error?: string };
type Disk = { data: Dashboard | null; outbox: Job[]; reminders: boolean; lastSync?: string };
type Connection = { url: string; token: string; userId: string };
const empty: Disk = { data: null, outbox: [], reminders: false };
const secure = {
  get: () =>
    Platform.OS === 'web'
      ? Promise.resolve(sessionStorage.getItem('rehab.connection'))
      : SecureStore.getItemAsync('rehab.connection'),
  set: (v: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(sessionStorage.setItem('rehab.connection', v))
      : SecureStore.setItemAsync('rehab.connection', v),
  clear: () =>
    Platform.OS === 'web'
      ? Promise.resolve(sessionStorage.removeItem('rehab.connection'))
      : SecureStore.deleteItemAsync('rehab.connection'),
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request(
  c: Pick<Connection, 'url' | 'token'>,
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
) {
  let r: Response;
  try {
    r = await fetch(c.url + path, {
      method,
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error(
      `Could not reach ${c.url}. Check that your rehab server is running and the address is correct. On an iPhone, use your computer’s network address instead of localhost.`,
    );
  }
  const json = await r.json().catch(() => ({ error: 'Server returned an unreadable response' }));
  if (!r.ok) throw new ApiError(r.status, json.error ?? `Request failed (${r.status})`);
  return json;
}
export function applyJobs(data: Dashboard | null, jobs: Job[]): Dashboard | null {
  if (!data) return null;
  let sessions = [...data.sessions];
  let responses = [...data.responses];
  for (const j of jobs) {
    if (j.path === '/completions')
      sessions = sessions.map((s) =>
        s.id === j.body.sessionId
          ? {
              ...s,
              status: j.body.status,
              exerciseIds: j.body.exerciseIds,
              completedAt: j.body.status === 'pending' ? undefined : j.body.occurredAt,
            }
          : s,
      );
    else if (j.path === '/assessment-responses') {
      if (!responses.some((r) => r.id === j.id)) {
        const a = data.assessments.find((a) => a.id === j.body.assessmentId);
        if (a) responses.push({ ...j.body, assessment: a });
      }
    } else if (j.path.endsWith('/reminder'))
      sessions = sessions.map((s) =>
        j.path === `/sessions/${s.id}/reminder`
          ? { ...s, reminderAt: j.body.reminderAt ?? undefined }
          : s,
      );
  }
  return { ...data, sessions, responses };
}
const Context = createContext<any>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [disk, setDisk] = useState<Disk>(empty);
  const diskRef = useRef(disk);
  const [connection, setConnection] = useState<Connection | null>(null);
  const connectionRef = useRef<Connection | null>(null);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const writes = useRef(Promise.resolve());
  const syncPromise = useRef<Promise<void> | null>(null);
  const key = (c: Connection) => `rehab.v1:${encodeURIComponent(c.url)}:${c.userId}`;
  function write(update: (d: Disk) => Disk) {
    const next = writes.current.then(async () => {
      const c = connectionRef.current;
      if (!c) return;
      const d = update(diskRef.current);
      await AsyncStorage.setItem(key(c), JSON.stringify(d));
      diskRef.current = d;
      setDisk(d);
    });
    writes.current = next.catch(() => {});
    return next;
  }
  useEffect(() => {
    (async () => {
      try {
        const raw = await secure.get();
        if (raw) {
          const c = JSON.parse(raw);
          connectionRef.current = c;
          setConnection(c);
          const saved = await AsyncStorage.getItem(key(c));
          if (saved) {
            const d = JSON.parse(saved);
            diskRef.current = d;
            setDisk(d);
          }
        }
      } catch {
        setError('Could not read saved data. Please reconnect.');
      } finally {
        setReady(true);
      }
    })();
  }, []);
  async function sync() {
    if (syncPromise.current) return syncPromise.current;
    const c = connectionRef.current;
    if (!c) return;
    const run = (async () => {
      setSyncing(true);
      try {
        await writes.current;
        for (const job of [...diskRef.current.outbox]) {
          try {
            const result = await request(c, job.path, job.body, job.method);
            await write((d) => {
              let data = d.data;
              if (data) {
                if (job.path === '/completions' || job.path.endsWith('/reminder'))
                  data = {
                    ...data,
                    sessions: data.sessions.map((s) => (s.id === result.id ? result : s)),
                  };
                if (job.path === '/assessment-responses')
                  data = {
                    ...data,
                    responses: [...data.responses.filter((r) => r.id !== result.id), result],
                  };
              }
              return { ...d, data, outbox: d.outbox.filter((j) => j.id !== job.id) };
            });
          } catch (e) {
            if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
              await write((d) => ({
                ...d,
                outbox: d.outbox.map((j) => (j.id === job.id ? { ...j, error: e.message } : j)),
              }));
            }
            throw e;
          }
        }
        const today = dayInZone();
        const data = (await request(
          c,
          `/sync?from=${addDays(today, -730)}&to=${addDays(today, 14)}`,
        )) as Dashboard;
        await write((d) => ({ ...d, data, lastSync: new Date().toISOString() }));
        setError(null);
      } catch (e) {
        setError(
          e instanceof ApiError ? e.message : 'You’re offline. Changes are saved on this device.',
        );
      } finally {
        setSyncing(false);
      }
    })();
    syncPromise.current = run;
    try {
      await run;
    } finally {
      syncPromise.current = null;
    }
  }
  useQuery({
    queryKey: ['sync', connection?.userId, connection?.url],
    enabled: ready && !!connection,
    queryFn: async () => {
      await sync();
      return Date.now();
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void sync();
    });
    return () => sub.remove();
  }, [connection]);
  async function connect(url: string, token: string) {
    url = url.trim().replace(/\/+$/, '');
    token = token.trim();
    if (!/^https?:\/\//.test(url)) throw new Error('Enter an http:// or https:// server address');
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.search || parsed.hash)
      throw new Error('Use a plain server address');
    const octets = parsed.hostname.split('.').map(Number);
    const ipv4 =
      octets.length === 4 && octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
    const local =
      parsed.hostname === 'localhost' ||
      (ipv4 &&
        (octets[0] === 127 ||
          octets[0] === 10 ||
          (octets[0] === 192 && octets[1] === 168) ||
          (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)));
    if (parsed.protocol === 'http:' && !local) throw new Error('Use HTTPS for a public server');
    const user = await request({ url, token }, '/me');
    const c = { url, token, userId: user.id };
    await secure.set(JSON.stringify(c));
    const cached = await AsyncStorage.getItem(key(c));
    const d = cached ? JSON.parse(cached) : empty;
    connectionRef.current = c;
    diskRef.current = d;
    setDisk(d);
    setConnection(c);
    setError(null);
    await sync();
  }
  async function replaceToken(token: string) {
    const current = connectionRef.current;
    if (!current) throw new Error('Connect an account first.');
    if (syncPromise.current) await syncPromise.current;
    const updated = { ...current, token: token.trim() };
    const user = await request(updated, '/me');
    if (user.id !== current.userId)
      throw new Error('Use a token for the same account to keep your saved changes.');
    await secure.set(JSON.stringify(updated));
    connectionRef.current = updated;
    setConnection(updated);
    await sync();
  }
  async function enqueue(path: string, body: any, method: 'POST' | 'PATCH' = 'POST') {
    const job = { id: body.id ?? Crypto.randomUUID(), path, body, method };
    await write((d) => ({ ...d, outbox: [...d.outbox, job] }));
    void sync();
  }
  async function complete(s: Session, status: Session['status']) {
    await enqueue('/completions', {
      id: Crypto.randomUUID(),
      sessionId: s.id,
      status,
      occurredAt: new Date().toISOString(),
      exerciseIds: status === 'completed' ? s.snapshot.prescriptions.map((p) => p.exerciseId) : [],
    });
  }
  async function reminder(s: Session, reminderAt: string | null) {
    await enqueue(`/sessions/${s.id}/reminder`, { reminderAt }, 'PATCH');
  }
  async function respond(body: Omit<AssessmentResponse, 'id' | 'assessment' | 'occurredAt'>) {
    await enqueue('/assessment-responses', {
      ...body,
      id: Crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    });
  }
  async function disconnect() {
    if (diskRef.current.outbox.length)
      throw new Error('Sync your saved changes before disconnecting.');
    if (syncing) throw new Error('Wait for sync to finish.');
    await secure.clear();
    connectionRef.current = null;
    setConnection(null);
    diskRef.current = empty;
    setDisk(empty);
    queryClient.clear();
  }
  const value = {
    data: applyJobs(disk.data, disk.outbox),
    outbox: disk.outbox,
    reminders: disk.reminders,
    lastSync: disk.lastSync,
    connection,
    ready,
    syncing,
    error,
    notificationError,
    setNotificationError,
    connect,
    disconnect,
    replaceToken,
    sync,
    complete,
    respond,
    reminder,
    setReminders: (v: boolean) => write((d) => ({ ...d, reminders: v })),
    discardJob: (id: string) =>
      write((d) => ({ ...d, outbox: d.outbox.filter((j) => j.id !== id) })),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStore(): {
  data: Dashboard | null;
  outbox: Job[];
  reminders: boolean;
  lastSync?: string;
  connection: Connection | null;
  ready: boolean;
  syncing: boolean;
  error: string | null;
  notificationError: string | null;
  setNotificationError: (message: string | null) => void;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  replaceToken: (token: string) => Promise<void>;
  sync: () => Promise<void>;
  complete: (s: Session, status: Session['status']) => Promise<void>;
  respond: (body: Omit<AssessmentResponse, 'id' | 'assessment' | 'occurredAt'>) => Promise<void>;
  reminder: (s: Session, t: string | null) => Promise<void>;
  setReminders: (v: boolean) => Promise<void>;
  discardJob: (id: string) => Promise<void>;
} {
  return useContext(Context);
}
