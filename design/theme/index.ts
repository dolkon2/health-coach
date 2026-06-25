import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { spacing, borderRadius, shadow } from '../tokens/spacing';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadow,
};

export type Theme = typeof theme;
