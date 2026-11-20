import React from 'react';
import { ShieldCheck, Cpu, TestTube } from 'lucide-react';

interface Props {
  classification: string;
}

export const ClassificationBadge: React.FC<Props> = ({ classification }) => {
  if (classification === 'OBSERVABLE_MEASURED') {
    return (
      <span className="badge badge-measured" title="Direct satellite radar observation">
        <ShieldCheck size={13} />
        Measured Observable
      </span>
    );
  }

  if (classification === 'BENCHMARK_SYNTHETIC') {
    return (
      <span className="badge badge-synthetic" title="Controlled synthetic physics simulation">
        <TestTube size={13} />
        Synthetic Benchmark
      </span>
    );
  }

  return (
    <span className="badge badge-derived" title="Geophysically inferred estimate with uncertainty">
      <Cpu size={13} />
      Derived Inferred
    </span>
  );
};

