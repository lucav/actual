// @ts-strict-ignore
import React from 'react';

import { FutureCashFlowGraph } from '../graphs/FutureCashFlowGraph';

export const renderCashFlowCardChartDetailed = (
  graphData: {
    expenses: { x: Date; y: number }[];
    income: { x: Date; y: number }[];
    balances: { x: Date; y: number }[];
    transfers: { x: Date; y: number }[];
  },
  isConcise: boolean,
) => {
  return (
    <FutureCashFlowGraph
      graphData={graphData}
      isConcise={isConcise}
      showBalance={true}
    />
  );
};
