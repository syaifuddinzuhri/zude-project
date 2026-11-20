"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { isIOS, isStandalone } from "./pwa";
import { Icon } from "./ui/icon";

/** Banner panduan pasang di Safari iOS (sekali, bisa ditutup, diingat di localStorage). */
export function IosInstallBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (isIOS() && !isStandalone() && localStorage.getItem("zude:ios-banner") !== "1") setShow(true);
    } catch {}
  }, []);
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem("zude:ios-banner", "1");
    } catch {}
  };
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed-col bottom-[calc(env(safe-area-inset-bottom)+92px)] z-40 px-4"
        >
          <div className="glass flex gap-3 rounded-card p-4 shadow-glass">
            <img src="/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
            <div className="flex-1 text-[14px]">
              <div className="font-semibold">Pasang ZuDe ke Layar Utama</div>
              <div className="mt-0.5 text-muted">
                Ketuk tombol <SharedIcon /> <b>Bagikan</b> → <b>Tambah ke Layar Utama</b>. Pasang untuk menerima pengingat tagihan.
              </div>
            </div>
            <button onClick={dismiss} className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center text-muted" aria-label="Tutup">
              <Icon name="x" size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SharedIcon() {
  return (
    <svg className="inline -mt-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="ikon Bagikan">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
