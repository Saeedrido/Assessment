import { useState, type FormEvent } from 'react';
import { ArrowRightLeft, Send } from 'lucide-react';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SelectField, TextField } from '../../components/ui/Field';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { useTokenBalance } from './useTokenBalance';
import { useConversions, useConvert, useTokenHistory, useWithdraw } from './useTokenMutations';
import { toErrorMessage } from '../../lib/apiClient';
import { formatDateTime, formatTokens, shortHash } from '../../utils/format';
import type { ConversionAsset } from '../../types/api';

const PAGE_SIZE = 10;

/** The user balance view: balance, ledger, conversions and withdrawal. */
export function TokensPage() {
  const { data: balance, isError, refetch } = useTokenBalance();
  const [page, setPage] = useState(1);
  const [isConvertOpen, setConvertOpen] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null);

  const { data: history, isPending: isHistoryPending } = useTokenHistory({ page, pageSize: PAGE_SIZE });
  const { data: conversions } = useConversions({ page: 1, pageSize: 20 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Tokens</h1>
          <p className="text-sm text-slate-400">Your balance, ledger and mock on-chain conversions.</p>
        </div>
        <Button onClick={() => setConvertOpen(true)}>
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
          Convert tokens
        </Button>
      </div>

      {isError && <Alert onRetry={() => void refetch()}>Could not load the token balance.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Balance" value={balance ? formatTokens(balance.balance) : '—'} hint="TWD" />
        <StatCard label="Earned" value={balance ? formatTokens(balance.earned) : '—'} hint="Lifetime credits" />
        <StatCard label="Converted" value={balance ? formatTokens(balance.converted) : '—'} hint="Spent" />
        <StatCard label="Withdrawn" value={balance ? formatTokens(balance.withdrawn) : '—'} hint="Sent on-chain" />
      </div>

      <Card title="Conversions" description="Completed conversions can be withdrawn to a wallet address.">
        {(conversions?.items.length ?? 0) === 0 ? (
          <EmptyState title="No conversions yet" description="Convert tokens to create a mock on-chain asset." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-800">
                <tr>
                  <th className="table-header">Asset</th>
                  <th className="table-header">Tokens</th>
                  <th className="table-header">Received</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Tx</th>
                  <th className="table-header" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {conversions!.items.map((conversion) => (
                  <tr key={conversion.id}>
                    <td className="table-cell font-mono text-xs">{conversion.toAsset}</td>
                    <td className="table-cell font-mono text-xs">{formatTokens(conversion.amount)}</td>
                    <td className="table-cell font-mono text-xs">{conversion.convertedAmount}</td>
                    <td className="table-cell">
                      <StatusBadge status={conversion.status} />
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500" title={conversion.txHashMock}>
                      {shortHash(conversion.txHashMock)}
                    </td>
                    <td className="table-cell text-right">
                      {conversion.status === 'SUCCESS' && (
                        <Button variant="secondary" size="sm" onClick={() => setWithdrawTarget(conversion.id)}>
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                          Withdraw
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Transaction history" description="Append-only ledger for this account.">
        {isHistoryPending ? (
          <p className="py-4 text-sm text-slate-500">Loading history…</p>
        ) : (history?.items.length ?? 0) === 0 ? (
          <EmptyState title="No transactions yet" description="Activity appears here once tokens move." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-800">
                <tr>
                  <th className="table-header">Type</th>
                  <th className="table-header">Source</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Balance</th>
                  <th className="table-header">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {history!.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="table-cell">
                      <Badge tone={entry.amount >= 0 ? 'success' : 'warning'}>{entry.type}</Badge>
                    </td>
                    <td className="table-cell text-xs text-slate-500">{entry.source}</td>
                    <td
                      className={`table-cell font-mono text-xs ${entry.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}
                    >
                      {entry.amount >= 0 ? '+' : ''}
                      {formatTokens(entry.amount)}
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-400">{formatTokens(entry.balanceAfter)}</td>
                    <td className="table-cell whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(entry.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {history && <Pagination meta={history.meta} onPageChange={setPage} />}
          </div>
        )}
      </Card>

      <ConvertModal isOpen={isConvertOpen} onClose={() => setConvertOpen(false)} />
      <WithdrawModal conversionId={withdrawTarget} onClose={() => setWithdrawTarget(null)} />
    </div>
  );
}

function ConvertModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('100');
  const [asset, setAsset] = useState<ConversionAsset>('MOCK_USDT');
  const convert = useConvert();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await convert.mutateAsync({ amount: Number(amount), toAsset: asset });
      onClose();
    } catch {
      // Rendered from the mutation state below.
    }
  }

  return (
    <Modal isOpen={isOpen} title="Convert tokens" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {convert.isError && <Alert>{toErrorMessage(convert.error)}</Alert>}

        <TextField
          id="convert-amount"
          label="Amount (tokens)"
          type="number"
          min={1}
          step={1}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          hint="100 tokens = 1 MOCK_USDT · 20,000 tokens = 1 MOCK_ETH"
        />

        <SelectField
          id="convert-asset"
          label="Receive"
          value={asset}
          onChange={(event) => setAsset(event.target.value as ConversionAsset)}
        >
          <option value="MOCK_USDT">MOCK_USDT</option>
          <option value="MOCK_ETH">MOCK_ETH</option>
        </SelectField>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={convert.isPending}>
            Convert
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function WithdrawModal({ conversionId, onClose }: { conversionId: string | null; onClose: () => void }) {
  const [walletAddress, setWalletAddress] = useState('');
  const withdraw = useWithdraw();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!conversionId) return;
    try {
      await withdraw.mutateAsync({ conversionId, walletAddress: walletAddress.trim() });
      setWalletAddress('');
      onClose();
    } catch {
      // Rendered from the mutation state below.
    }
  }

  return (
    <Modal isOpen={Boolean(conversionId)} title="Withdraw to wallet" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {withdraw.isError && <Alert>{toErrorMessage(withdraw.error)}</Alert>}

        <TextField
          id="withdraw-address"
          label="Wallet address"
          value={walletAddress}
          onChange={(event) => setWalletAddress(event.target.value)}
          required
          pattern="0x[a-fA-F0-9]{40}"
          placeholder="0x0000000000000000000000000000000000000000"
          hint="A 20-byte hex Ethereum address."
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={withdraw.isPending}>
            Withdraw
          </Button>
        </div>
      </form>
    </Modal>
  );
}
