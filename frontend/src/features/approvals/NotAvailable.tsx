// A dash for data the backend doesn't provide yet; screen readers hear the label instead
export default function NotAvailable({ label }: { label: string }) {
  return (
    <span className="text-[#b0bab5]" title={label}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
