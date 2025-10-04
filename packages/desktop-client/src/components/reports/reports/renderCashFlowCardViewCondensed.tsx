// @ts-strict-ignore
import React from 'react';

import { View } from '@actual-app/components/view';

import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import { Change } from '@desktop-client/components/reports/Change';

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
