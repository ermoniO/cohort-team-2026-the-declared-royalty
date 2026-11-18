import InvoiceList from "../components/InvoiceList";
import VendorList from "../components/VendorList";

type WorkspacePageProps = {
  title: string;
};

export default function WorkspacePage({ title }: WorkspacePageProps) {
  if (title === "Bills" || title === "Dashboard") {
    return <InvoiceList />;
  }

  if (title === "Vendors") {
    return <VendorList />;
  }

  return (
    <div className="flex min-h-[320px] h-full w-full items-center justify-center rounded-xl border border-[#e6ebe8] bg-white">
      <p className="font-inter-regular text-sm text-[#68766f]">
        {title === "Dashboard" ? "Page Content" : `${title} Page Content`}
      </p>
    </div>
  );
}
