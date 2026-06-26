import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { spacing, borderRadius, shadow, motion } from '../tokens/spacing';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadow,
  motion,
};

export type Theme = typeof theme;
