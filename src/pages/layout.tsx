export default function Layout({ children }: { children: React.JSX.Element }) {
  return (
    <div className="h-[100dvh] w-[100dvw] overflow-hidden text-gray-900">
      <main className="h-full w-full">{children}</main>
    </div>
  );
}
