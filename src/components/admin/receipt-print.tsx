'use client';

export function ReceiptPrint() {
  return <><button type="button" onClick={() => window.print()} className="print-hide rounded bg-ink px-4 py-2 text-sm text-white">Print receipt</button>
    <style jsx global>{`@media print { @page { margin: 3mm; } .admin-sidebar, .admin-panel > div > header, .print-hide { display:none!important; } .admin-panel > div { padding:0!important; } .admin-panel main { padding:0!important; max-width:none!important; } .receipt-paper { width:74mm!important; border:0!important; padding:0!important; margin:0!important; box-shadow:none!important; } body { background:white!important; } }`}</style>
  </>;
}
