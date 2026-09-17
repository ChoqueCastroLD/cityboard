import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { accountToken, setAccountToken, subscribeAccount } from '../client/account';
import { type AccountUser, api, ApiError } from '../client/api';

const unwrap = (r: { user: AccountUser } | AccountUser): AccountUser => ('user' in r ? r.user : r);

export function useAccount() {
  const token = useSyncExternalStore(subscribeAccount, accountToken, () => null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['account', token],
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        return unwrap(await api.auth.me());
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setAccountToken(null);
        throw e;
      }
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      await api.auth.logout().catch(() => undefined);
      setAccountToken(null);
      client.removeQueries({ queryKey: ['account'] });
    },
  });

  const rename = useMutation({
    mutationFn: async (name: string) => unwrap(await api.auth.rename(name)),
    onSuccess: (user) => client.setQueryData(['account', token], user),
  });

  const user = token ? (query.data ?? null) : null;
  return {
    token,
    user,
    premium: user?.premium ?? false,
    loading: !!token && query.isPending,
    logout: () => logout.mutateAsync(),
    rename: (name: string) => rename.mutateAsync(name),
    refresh: () => client.invalidateQueries({ queryKey: ['account'] }),
    setToken: (next: string, fresh?: AccountUser) => {
      setAccountToken(next);
      if (fresh) client.setQueryData(['account', next], fresh);
    },
  };
}
