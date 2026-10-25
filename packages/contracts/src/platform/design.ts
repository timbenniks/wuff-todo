import { z } from "zod";
export const listColors = [
  "blue",
  "lavender",
  "sage",
  "rose",
  "peach",
  "sand",
  "slate",
] as const;
export type ListColor = (typeof listColors)[number];
export const listColorSchema = z.enum(listColors);
