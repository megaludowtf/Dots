import { useEffect, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS, ABI } from '../config/contract';
import { usePostTxRefresh } from './usePostTxRefresh';

export type MintStatus = 'idle' | 'confirming' | 'pending' | 'success' | 'error';

export interface UseMintAction {
  mint: (amount: number, value: bigint) => void;
  status: MintStatus;
  error: Error | null;
  txHash: `0x${string}` | undefined;
}

export function useMintAction(): UseMintAction {
  const refresh = usePostTxRefresh();
  const lastRefreshedHash = useRef<string | undefined>(undefined);

  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // Refresh caches on success — track which txHash was already refreshed
  // so repeated mints each trigger their own refresh.
  useEffect(() => {
    if (isSuccess && txHash && txHash !== lastRefreshedHash.current) {
      lastRefreshedHash.current = txHash;
      refresh();
    }
  }, [isSuccess, txHash]); // eslint-disable-line react-hooks/exhaustive-deps

  const mint = (amount: number, value: bigint) => {
    reset();
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'mint',
      args: [BigInt(amount)],
      value,
    });
  };

  let status: MintStatus = 'idle';
  if (isWritePending) status = 'confirming';
  else if (txHash && isConfirming) status = 'pending';
  else if (isSuccess) status = 'success';
  else if (writeError || receiptError) status = 'error';

  return {
    mint,
    status,
    error: writeError ?? receiptError ?? null,
    txHash,
  };
}
