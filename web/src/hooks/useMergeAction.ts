import { useEffect, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS, ABI } from '../config/contract';
import { usePostTxRefresh } from './usePostTxRefresh';

export type MergeStatus = 'idle' | 'confirming' | 'pending' | 'success' | 'error';

export interface UseMergeAction {
  merge: (survivorId: number, burnId: number, swap: boolean) => void;
  status: MergeStatus;
  error: Error | null;
  txHash: `0x${string}` | undefined;
}

export function useMergeAction(): UseMergeAction {
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

  useEffect(() => {
    if (isSuccess && txHash && txHash !== lastRefreshedHash.current) {
      lastRefreshedHash.current = txHash;
      refresh();
    }
  }, [isSuccess, txHash]); // eslint-disable-line react-hooks/exhaustive-deps

  const merge = (survivorId: number, burnId: number, swap: boolean) => {
    reset();
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'merge',
      args: [BigInt(survivorId), BigInt(burnId), swap],
    });
  };

  let status: MergeStatus = 'idle';
  if (isWritePending) status = 'confirming';
  else if (txHash && isConfirming) status = 'pending';
  else if (isSuccess) status = 'success';
  else if (writeError || receiptError) status = 'error';

  return {
    merge,
    status,
    error: writeError ?? receiptError ?? null,
    txHash,
  };
}
