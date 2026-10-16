import { z } from "zod";

const text = (min: number, max: number) =>
  z
    .string("required")
    .transform((v) => v.normalize("NFC").trim())
    .pipe(z.string().min(min, "required").max(max, "too_long"));

/** Nội dung trang "Về tôi". strictObject: khoá lạ bị từ chối. Văn bản thuần — frontend không bao giờ render HTML. */
export const aboutSchema = z.strictObject({
  name: text(1, 80),
  title: text(0, 120),
  bio: text(1, 1500),
  quote: text(0, 300),
  badge: z.strictObject({ title: text(0, 60), subtitle: text(0, 60) }),
  stats: z.array(z.strictObject({ value: text(1, 20), label: text(1, 60) }), "invalid").max(4, "too_many"),
  achievements: z.array(z.strictObject({ title: text(1, 80), desc: text(0, 200) }), "invalid").max(8, "too_many"),
});

export type About = z.infer<typeof aboutSchema>;
