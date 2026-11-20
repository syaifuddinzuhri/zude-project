export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh flex-col justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+24px)]">{children}</main>;
}
