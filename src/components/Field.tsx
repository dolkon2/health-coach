/**
 * Field — a labelled text input in the data register, with an optional unit
 * suffix. The one input primitive the log forms reuse so weight, reps, duration
 * and distance all read and behave identically.
 */
import React from 'react';
import { View, TextInput, type KeyboardTypeOptions, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

type FieldProps = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
  autoFocus?: boolean;
  style?: ViewStyle;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'decimal-pad',
  suffix,
  autoFocus,
  style,
}: FieldProps) {
  const theme = useTheme();
  return (
    <View style={style}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
          style={{
            ...theme.type.data,
            color: theme.colors.text,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            paddingVertical: theme.spacing[2],
            flex: 1,
            marginTop: label ? theme.spacing[2] : 0,
          }}
        />
        {suffix ? (
          <Text variant="dataSm" color={theme.colors.textMuted}>
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
