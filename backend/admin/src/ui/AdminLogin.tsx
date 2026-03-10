import type { ConnectionState } from '../types';

type AdminLoginProps = {
  brandName: string;
  adminPassword: string;
  authLoading: boolean;
  authError: string;
  connectionState: ConnectionState;
  lastDisconnectAt: number | null;
  lastDisconnectReason: string;
  lastConnectError: string;
  reconnectCount: number;
  onPasswordChange: (next: string) => void;
  onSubmit: () => void;
};

function formatDisconnectTime(ts: number | null) {
  if (!ts) return 'Unknown';
  return new Date(ts).toLocaleString('en-US', { hour12: false });
}

function connectionHint(connectionState: ConnectionState) {
  if (connectionState === 'connecting') return 'Connecting to backend service...';
  if (connectionState === 'reconnecting') return 'Connection unstable, retrying...';
  return 'Not connected to backend service';
}

export function AdminLogin({
  brandName,
  adminPassword,
  authLoading,
  authError,
  connectionState,
  lastDisconnectAt,
  lastDisconnectReason,
  lastConnectError,
  reconnectCount,
  onPasswordChange,
  onSubmit,
}: AdminLoginProps) {
  const showBanner = connectionState !== 'connected';

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-[#30363d] bg-[#161b22] p-6 shadow-2xl">
        <h1 className="text-2xl font-bold text-[#58a6ff]">{brandName}</h1>

        {showBanner && (
          <div className="mt-3 rounded-lg border border-[#58a6ff]/30 bg-[#58a6ff]/10 px-3 py-2 text-xs text-[#c9e4ff]">
            <div>{connectionHint(connectionState)}</div>
            <div className="mt-1 text-[11px] text-[#8b949e]">
              Last disconnect: {formatDisconnectTime(lastDisconnectAt)} | Reason: {lastDisconnectReason || 'Unknown'} | Reconnects:{' '}
              {reconnectCount}
            </div>
            {lastConnectError && <div className="mt-1 text-[11px] text-amber-200">Connect error: {lastConnectError}</div>}
          </div>
        )}

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Admin password"
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#58a6ff]"
            autoComplete="current-password"
            disabled={authLoading}
          />

          <button
            type="submit"
            disabled={authLoading}
            className={[
              'w-full rounded-xl px-3 py-2 text-sm font-medium transition-all',
              authLoading ? 'bg-[#30363d] text-[#8b949e] cursor-not-allowed' : 'bg-[#58a6ff] hover:bg-[#79c0ff] text-[#0d1117]',
            ].join(' ')}
          >
            {authLoading ? 'Signing in...' : 'Enter Panel'}
          </button>
        </form>

        {authError && <p className="mt-3 text-xs text-red-300">{authError}</p>}
      </div>
    </div>
  );
}
