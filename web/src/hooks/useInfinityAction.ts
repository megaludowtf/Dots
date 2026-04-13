import { useEffect, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS, ABI } from '../config/contract';
import { usePostTxRefresh } from './usePostTxRefresh';

export type InfinityStatus = 'idle' | 'confirming' | 'pending' | 'success' | 'error';

export interface UseInfinityAction {
  infinity: (tokenIds: number[]) => void;
  status: InfinityStatus;
  error: Error | null;
  txHash: `0x${string}` | undefined;
}

export function useInfinityAction(): UseInfinityAction {
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

  const infinity = (tokenIds: number[]) => {
    reset();
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'infinity',
      args: [tokenIds.map(id => BigInt(id))],
    });
  };

  let status: InfinityStatus = 'idle';
  if (isWritePending) status = 'confirming';
  else if (txHash && isConfirming) status = 'pending';
  else if (isSuccess) status = 'success';
  else if (writeError || receiptError) status = 'error';

  return {
    infinity,
    status,
    error: writeError ?? receiptError ?? null,
    txHash,
  };
}
