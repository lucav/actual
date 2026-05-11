// @ts-strict-ignore
import React from 'react';

import { View } from '@actual-app/components/view';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { Change } from '#components/reports/Change';

export const renderCashFlowCardViewCondensed = (
  isCardHovered: boolean,
  income: number,
  expenses: number,
) => {
  return (
    <View style={{ textAlign: 'right' }}>
      <PrivacyFilter activationFilters={[!isCardHovered]}>
        <Change amount={income - expenses} />
      </PrivacyFilter>
    </View>
  );
};
