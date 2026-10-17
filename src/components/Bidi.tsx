export function Bidi({ children }: { children: React.ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}
