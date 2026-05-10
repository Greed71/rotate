type Props = {
  message: string | null;
};

export function AlertMessage({ message }: Props) {
  if (!message) return null;

  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {message}
    </div>
  );
}
