import { useReadContracts } from 'wagmi';
import { CONTRACT_ADDRESS, ABI, hasContract } from '../config/contract';

export interface ContractStats {
  mintPrice: bigint | undefined;
  totalSupply: bigint | undefined;
  nextTokenId: bigint | undefined;
  mintStart: bigint | undefined;
  mintEnd: bigint | undefined;
  circulation: readonly bigint[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

const contract = { address: CONTRACT_ADDRESS, abi: ABI } as const;

export function useContractStats(): ContractStats {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...contract, functionName: 'mintPrice' },
      { ...contract, functionName: 'totalSupply' },
      { ...contract, functionName: 'nextTokenId' },
      { ...contract, functionName: 'mintStart' },
      { ...contract, functionName: 'mintEnd' },
      { ...contract, functionName: 'circulation' },
    ],
    query: {
      enabled: hasContract,
      refetchInterval: 15_000,
    },
  });

  return {
    mintPrice: data?.[0]?.result as bigint | undefined,
    totalSupply: data?.[1]?.result as bigint | undefined,
    nextTokenId: data?.[2]?.result as bigint | undefined,
    mintStart: data?.[3]?.result as bigint | undefined,
    mintEnd: data?.[4]?.result as bigint | undefined,
    circulation: data?.[5]?.result as readonly bigint[] | undefined,
    isLoading,
    error: error ?? null,
  };
}
