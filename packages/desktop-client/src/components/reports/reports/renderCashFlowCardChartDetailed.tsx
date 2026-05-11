// @ts-strict-ignore
import React, { type CSSProperties } from 'react';

import { FutureCashFlowGraph } from '#components/reports/graphs/FutureCashFlowGraph';

export const renderCashFlowCardChartDetailed = (
  graphData: {
    expenses: { x: Date; y: number }[];
    income: { x: Date; y: number }[];
    balances: { x: Date; y: number }[];
    transfers: { x: Date; y: number }[];
  },
  isConcise: boolean,
  style?: CSSProperties,
) => {
  return (
    <FutureCashFlowGraph
      graphData={graphData}
      isConcise={isConcise}
      showBalance={true}
      style={style}
    />
  );
};
