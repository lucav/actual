// @ts-strict-ignore
import React from 'react';
import { Trans } from 'react-i18next';

import { AlignedText } from '@actual-app/components/aligned-text';
import { Block } from '@actual-app/components/block';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { integerToCurrency } from 'loot-core/shared/util';

import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import { Change } from '@desktop-client/components/reports/Change';

export const renderCashFlowCardViewDetailed = (
  totalIncome: number,
  totalExpenses: number,
  totalTransfers: number,
  isCardHovered: boolean,
) => {
  return (
    <View
      style={{
        paddingTop: 20,
        alignItems: 'flex-end',
        color: theme.pageText,
      }}
    >
      <AlignedText
        style={{ marginBottom: 5, minWidth: 160 }}
        left={
          <Block>
            <Trans>Income:</Trans>
          </Block>
        }
        right={
          <Text style={{ fontWeight: 600 }}>
            <PrivacyFilter>{integerToCurrency(totalIncome)}</PrivacyFilter>
          </Text>
        }
      />

      <AlignedText
        style={{ marginBottom: 5, minWidth: 160 }}
        left={
          <Block>
            <Trans>Expenses:</Trans>
          </Block>
        }
        right={
          <Text style={{ fontWeight: 600 }}>
            <PrivacyFilter>{integerToCurrency(totalExpenses)}</PrivacyFilter>
          </Text>
        }
      />

      <AlignedText
        style={{ marginBottom: 5, minWidth: 160 }}
        left={
          <Block>
            <Trans>Transfers:</Trans>
          </Block>
        }
        right={
          <Text style={{ fontWeight: 600 }}>
            <PrivacyFilter>{integerToCurrency(totalTransfers)}</PrivacyFilter>
          </Text>
        }
      />
      <Text style={{ fontWeight: 600 }}>
        <PrivacyFilter activationFilters={[!isCardHovered]}>
          <Change amount={totalIncome + totalExpenses + totalTransfers} />
        </PrivacyFilter>
      </Text>
    </View>
  );
};
